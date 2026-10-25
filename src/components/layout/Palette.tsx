// Komut paleti (⌘K): tek kutudan ara ve git. Yazmadan önce sayfalar ve sık
// yapılan işler listelenir; yazınca backend'de kullanıcı, oda, quiz, yapım,
// sticker ve ürün aranır (kimlik yapıştırmak da çalışır).
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { adminApi, type SearchHit, type SearchKind } from '@/lib/api/admin';
import { cn } from '@/lib/cn';
import { closeOverlays, GO_TO, META, useOverlay } from '@/lib/shortcuts';
import { useIsAdmin } from '@/stores/session';

const KIND: Record<SearchKind, [string, IconName]> = {
  user: ['Kullanıcı', 'person'],
  room: ['Oda', 'groups'],
  quiz: ['Quiz', 'bolt'],
  show: ['Yapım', 'theaters'],
  sticker: ['Sticker', 'toll'],
  product: ['Ürün', 'toll'],
  post: ['Gönderi', 'movie'],
};

interface Row {
  id: string;
  icon: IconName;
  title: string;
  subtitle?: string;
  badge?: string | null;
  image?: string | null;
  to: string;
  group: string;
  /** Yapımın posteri TMDB'de, kullanıcı avatarı bizde. */
  remote?: boolean;
}

/** Sayfalar ve işler: yazmadan önce ve metinle süzülerek görünür. */
function commands(isAdmin: boolean): Row[] {
  const nav: Array<[string, string, IconName]> = [
    ['Genel bakış', '/', 'grid_view'],
    ['Canlı · şu an', '/canli', 'bolt'],
    ['Canlı akış', '/canli/akis', 'bolt'],
    ['Şikayetler', '/moderasyon', 'crisis_alert'],
    ['İçerik', '/moderasyon/icerik', 'visibility_off'],
    ['Odalar', '/moderasyon/odalar', 'groups'],
    ['Eşleşme', '/moderasyon/eslesme', 'person'],
    ['Kurallar · kara liste', '/moderasyon/kurallar', 'shield'],
    ['Moderasyon özeti', '/moderasyon/ozet', 'bar_chart'],
    ['Geri bildirim', '/moderasyon/geri-bildirim', 'campaign'],
    ['Kullanıcılar', '/kullanicilar', 'group'],
    ['Mavi tik başvuruları', '/kullanicilar/tikler', 'verified'],
    ['Dizi sayfası başvuruları', '/kullanicilar/sayfalar', 'theaters'],
    ['Ekip', '/kullanicilar/ekip', 'admin_panel_settings'],
    ['Yapımlar', '/katalog', 'theaters'],
    ['Vitrin', '/katalog/vitrin', 'theaters'],
    ['Yaklaşanlar · etkinlikler', '/yaklasanlar', 'schedule'],
    ['Kullanım analizi', '/analiz', 'monitoring'],
    ['Kitle', '/analiz/kitle', 'group'],
    ['TV ekranı', '/tv', 'tv'],
  ];
  const adminNav: Array<[string, string, IconName]> = [
    ['Yeni yayın', '/yayin', 'campaign'],
    ['Quizler', '/yayin/quizler', 'bolt'],
    ['Bildirim gönder', '/yayin/bildirim', 'campaign'],
    ['Yayın hesapları', '/yayin/hesaplar', 'person'],
    ['Gelir', '/ekonomi', 'toll'],
    ['Coin', '/ekonomi/coin', 'toll'],
    ["Sticker'lar", '/ekonomi/sticker', 'toll'],
    ['Pazar', '/ekonomi/pazar', 'toll'],
    ['Ürünler', '/ekonomi/urunler', 'toll'],
    ['Google · Analytics, Search Console, AdSense', '/analiz/google', 'monitoring'],
    ['Sistem ayarları', '/sistem', 'settings'],
    ['Özellik bayrakları', '/sistem/bayraklar', 'settings'],
    ['Servis durumu', '/sistem/durum', 'monitoring'],
    ['Denetim kaydı', '/sistem/denetim', 'history'],
  ];
  const actions: Array<[string, string, IconName]> = isAdmin
    ? [
        ['Gönderi paylaş (hesap adına)', '/yayin?tur=gonderi', 'add_circle'],
        ['Oda aç', '/yayin?tur=oda', 'add_circle'],
        ['Quiz oluştur', '/yayin?tur=quiz', 'add_circle'],
        ['Duyuru gönder', '/yayin/bildirim', 'add_circle'],
        ['Sticker bas', '/ekonomi/sticker', 'add_circle'],
      ]
    : [];
  return [
    ...actions.map(([title, to, icon]) => ({ id: `a:${to}:${title}`, title, to, icon, group: 'İşlem' })),
    ...[...nav, ...(isAdmin ? adminNav : [])].map(([title, to, icon]) => ({ id: `n:${to}`, title, to, icon, group: 'Sayfa' })),
  ];
}

const fold = (s: string) => s.toLocaleLowerCase('tr-TR');

export function Palette() {
  const open = useOverlay((s) => s.palette);
  const isAdmin = useIsAdmin();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [debounced, setDebounced] = useState('');
  const [listKey, setListKey] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setDebounced('');
    }
  }, [open]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  const search = useQuery({
    queryKey: ['admin', 'palette', debounced],
    queryFn: () => adminApi.search(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 15_000,
  });

  const term = fold(q.trim());
  const local = commands(isAdmin).filter((c) => !term || fold(c.title).includes(term));
  const remote: Row[] = (search.data?.items ?? []).map((h: SearchHit) => ({
    id: `${h.kind}:${h.id}`,
    icon: KIND[h.kind][1],
    title: h.title,
    subtitle: h.subtitle,
    badge: h.badge,
    image: h.image,
    to: h.to,
    group: KIND[h.kind][0],
    remote: h.kind === 'show',
  }));
  const rows: Row[] = [...remote, ...local.slice(0, term ? 6 : 24)];

  // Liste değişince seçim başa döner (render sırasında, efekt beklemeden).
  const key = `${debounced}|${rows.length}`;
  if (key !== listKey) {
    setListKey(key);
    setSel(0);
  }
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;
  const go = (row?: Row) => {
    if (!row) return;
    closeOverlays();
    nav(row.to);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setSel((s) => Math.min(rows.length - 1, s + 1));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(rows[sel]);
    }
  };

  // Başlık yalnız grup değişince yazılır.
  const heads = rows.map((r, i) => (i === 0 || rows[i - 1].group !== r.group ? r.group : null));
  return (
    <div className="fixed inset-0 z-[120] flex justify-center bg-black/65 px-4 pt-[12vh]" onMouseDown={closeOverlays}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Komut paleti"
        className="pop-in flex max-h-[70vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[18px] bg-elev shadow-[0_30px_90px_rgb(0_0_0/0.6),inset_0_0_0_0.5px_var(--color-line2)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 shadow-[inset_0_-0.5px_0_var(--color-line)]">
          <Icon name="search" size={20} className="text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Kullanıcı, oda, quiz, yapım ara ya da sayfaya git…"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          {search.isFetching && <Icon name="progress_activity" size={17} className="animate-spin text-faint" />}
          <kbd className="rounded-[6px] bg-elev2 px-1.5 py-0.5 text-[11px] text-faint">esc</kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {!rows.length ? (
            <p className="px-4 py-8 text-center text-[13px] text-faint">
              {debounced.length >= 2 ? 'Sonuç yok. Kullanıcı adı, oda adı ya da kimlik deneyebilirsin.' : 'Aramak için en az 2 harf yaz.'}
            </p>
          ) : (
            rows.map((r, i) => {
              const head = heads[i];
              return (
                <div key={r.id}>
                  {head && <p className="px-4 pt-2.5 pb-1 text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{head}</p>}
                  <button
                    type="button"
                    data-index={i}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => go(r)}
                    className={cn('flex w-full items-center gap-3 px-4 py-2 text-left', i === sel ? 'bg-white/8' : 'hover:bg-white/4')}
                  >
                    {r.image ? (
                      r.remote ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${r.image}`}
                          alt=""
                          className="h-7 w-5 flex-none rounded-[4px] object-cover"
                        />
                      ) : (
                        <Avatar src={r.image} name={r.title} size={26} />
                      )
                    ) : (
                      <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-elev2 text-sub">
                        <Icon name={r.icon} size={15} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-[11.5px] text-faint">{r.subtitle}</span>}
                    </span>
                    {r.badge && <span className="flex-none rounded-tag bg-elev2 px-2 py-0.5 text-[11px] text-sub">{r.badge}</span>}
                    {i === sel && <Icon name="chevron_right" size={16} className="flex-none text-faint" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[11.5px] text-faint shadow-[inset_0_0.5px_0_var(--color-line)]">
          <Key>↑↓</Key> gez <Key>↵</Key> aç <Key>{META}K</Key> aç/kapat <Key>?</Key> kısayollar
        </div>
      </div>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[5px] bg-elev2 px-1.5 py-0.5 font-sans text-[11px] text-sub">{children}</kbd>;
}

/** ? ile açılan kısayol listesi. */
export function ShortcutHelp() {
  const open = useOverlay((s) => s.help);
  if (!open) return null;
  const groups: Array<[string, Array<[string, string]>]> = [
    [
      'Her yerde',
      [
        [`${META}K`, 'Komut paleti: ara ve git'],
        ['?', 'Bu liste'],
        ['Esc', 'Kapat'],
      ],
    ],
    ['Bölüme git (g sonra harf)', GO_TO.map((g) => [`g ${g.key}`, g.label] as [string, string])],
    [
      'Listelerde',
      [
        ['Görünüm', 'Filtreyi adlandırıp sakla; paylaşırsan ekip de görür'],
        ['CSV', 'Filtreye uyan tüm kayıtları indir'],
      ],
    ],
    [
      'Şikayet kuyruğu',
      [
        ['j / k', 'Sonraki / önceki şikayet'],
        ['x', 'Seç (toplu işlem için)'],
        ['e', 'Yoksay'],
        ['h', 'İçeriği kaldır'],
        ['Enter', 'Profili aç'],
      ],
    ],
  ];
  return (
    <div className="fixed inset-0 z-[120] flex justify-center bg-black/65 px-4 pt-[10vh]" onMouseDown={closeOverlays}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Klavye kısayolları"
        className="pop-in flex max-h-[76vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] bg-elev shadow-[0_30px_90px_rgb(0_0_0/0.6),inset_0_0_0_0.5px_var(--color-line2)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-[18px] py-3.5 shadow-[inset_0_-0.5px_0_var(--color-line)]">
          <h2 className="flex-1 text-[15px] font-bold">Klavye kısayolları</h2>
          <button
            type="button"
            onClick={closeOverlays}
            aria-label="Kapat"
            className="press grid h-8 w-8 place-items-center rounded-full hover:bg-elev2"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3">
          {groups.map(([title, items]) => (
            <section key={title} className="pb-4">
              <p className="pb-1.5 text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{title}</p>
              {items.map(([k, label]) => (
                <div key={k} className="flex items-center gap-3 py-1.5 text-[13.5px]">
                  <Key>{k}</Key>
                  <span className="text-sub">{label}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
