import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Switch } from '@/components/ui/Switch';
import { adminApi, type Flag } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { toast } from '@/stores/ui';

export function Flags() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'flags'], queryFn: adminApi.flags });
  const set = useMutation({
    mutationFn: ({ key, enabled }: { key: Flag['key']; enabled: boolean | null }) => adminApi.setFlag(key, enabled),
    onSuccess: (rows, v) => {
      qc.setQueryData(['admin', 'flags'], rows);
      const f = rows.find((r) => r.key === v.key);
      toast(
        v.enabled === null ? `${f?.label}: varsayılana döndü` : `${f?.label} ${v.enabled ? 'açıldı' : 'kapatıldı'}`,
        'success',
        'Kullanıcılara birkaç saniyede yansır',
      );
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Card sub="Kapalı bir özellik uygulamada gizlenir ve sunucu isteklerini reddeder. Değişiklik yeniden başlatma gerektirmez.">
      {q.isLoading ? (
        <Rows n={8} />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        q.data?.map((f) => (
          <div key={f.key} className="flex items-center gap-3 px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                {f.label}
                {f.source === 'override' && <Tag tone="yellow">Panelden değişti</Tag>}
              </p>
              <p className="text-[12px] text-faint">
                {f.blockedReason ? (
                  <span className="text-live">Açık ama çalışmıyor · {f.blockedReason}</span>
                ) : f.source === 'override' ? (
                  `Varsayılan: ${f.defaultEnabled ? 'açık' : 'kapalı'} · ${timeAgo(f.updatedAt)}`
                ) : (
                  'Ortam varsayılanı'
                )}{' '}
                · <code className="text-[11px]">{f.key}</code>
              </p>
            </div>
            {f.source === 'override' && (
              <Button size="xs" variant="ghost" onClick={() => set.mutate({ key: f.key, enabled: null })}>
                Varsayılana dön
              </Button>
            )}
            <Switch label={f.label} checked={f.enabled} disabled={set.isPending} onChange={(v) => set.mutate({ key: f.key, enabled: v })} />
          </div>
        ))
      )}
    </Card>
  );
}
