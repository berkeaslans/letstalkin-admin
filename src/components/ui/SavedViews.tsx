// Kaydedilmiş görünümler: ekranın o anki filtresini adlandırıp saklar, tek
// tıkla geri yükler. "Ekiple paylaş" işaretlenirse herkes görür.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { adminApi, type SavedView, type ViewPage, type ViewQuery } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useIsAdmin, useSession } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';

/** Boş, undefined ve "all" değerleri kaydedilmez (varsayılanı kirletmesin). */
function clean(q: ViewQuery): ViewQuery {
  const out: ViewQuery = {};
  for (const [k, v] of Object.entries(q)) if (v !== '' && v != null && v !== 'all' && v !== false) out[k] = v;
  return out;
}
const same = (a: ViewQuery, b: unknown) => JSON.stringify(clean(a)) === JSON.stringify(clean((b ?? {}) as ViewQuery));

export function SavedViews({ page, query, onApply }: { page: ViewPage; query: ViewQuery; onApply: (q: ViewQuery) => void }) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const meId = useSession((s) => s.me?.id);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'views', page], queryFn: () => adminApi.views(page) });
  const after = (rows: SavedView[]) => qc.setQueryData(['admin', 'views', page], rows);
  const save = useMutation({
    mutationFn: () => adminApi.saveView(page, name.trim(), clean(query), shared),
    onSuccess: (rows) => {
      toast('Görünüm kaydedildi', 'success', shared ? 'Ekipteki herkes görebilir' : 'Yalnız sen görürsün');
      setNaming(false);
      setName('');
      setShared(false);
      after(rows);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.removeView(id),
    onSuccess: (rows) => {
      toast('Görünüm silindi');
      after(rows);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const views = q.data ?? [];
  const dirty = Object.keys(clean(query)).length > 0;
  const active = views.find((v) => same(query, v.query));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.map((v) => {
        const on = active?.id === v.id;
        return (
          <span
            key={v.id}
            className={cn(
              'group flex h-[30px] items-center rounded-full pr-1 pl-3 text-[12.5px] font-semibold transition-colors',
              on
                ? 'bg-yellow/14 text-yellow shadow-[inset_0_0_0_0.5px_rgb(255_216_0/0.4)]'
                : 'bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)]',
            )}
          >
            <button
              type="button"
              onClick={() => onApply((v.query ?? {}) as ViewQuery)}
              title={v.shared ? `Paylaşılan · @${v.owner?.username ?? '?'}` : 'Yalnız sana görünür'}
            >
              {v.name}
            </button>
            {v.shared && <Icon name="group" size={13} className="ml-1.5 opacity-60" />}
            {(v.mine || isAdmin) && (
              <button
                type="button"
                aria-label={`${v.name} görünümünü sil`}
                className="ml-1 grid h-5 w-5 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
                onClick={async () => {
                  const c = await confirmAction({
                    title: `"${v.name}" silinsin mi?`,
                    body:
                      v.shared && v.owner?.id !== meId
                        ? 'Paylaşılan bir görünüm; ekipteki herkesten kalkar.'
                        : 'Yalnız bu kayıtlı filtre silinir.',
                    ok: 'Sil',
                    danger: true,
                  });
                  if (c.ok) del.mutate(v.id);
                }}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </span>
        );
      })}

      {naming ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
            placeholder="Görünüm adı"
            maxLength={60}
            className="h-[30px] w-[150px] rounded-full bg-elev2 px-3 text-[12.5px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint"
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-sub" title="Ekipteki herkes görsün">
            <input type="checkbox" className="accent-yellow" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            Paylaş
          </label>
          <Button type="submit" size="xs" variant="primary" busy={save.isPending} disabled={!name.trim()}>
            Kaydet
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setNaming(false)}>
            Vazgeç
          </Button>
        </form>
      ) : (
        dirty &&
        !active && (
          <Button size="xs" variant="ghost" icon="add_circle" onClick={() => setNaming(true)} title="Bu filtreyi adlandırıp sakla">
            Görünümü kaydet
          </Button>
        )
      )}
    </div>
  );
}
