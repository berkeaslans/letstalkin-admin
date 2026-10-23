const nf = new Intl.NumberFormat('tr-TR');

export const fmt = (n: number) => nf.format(Math.round(n));

/** 12.840 → 12,8B · 1.240.000 → 1,2M */
export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1).replace('.', ',')}B`;
  return fmt(n);
}

export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'şimdi';
  if (s < 3600) return `${Math.round(s / 60)} dk önce`;
  if (s < 86400) return `${Math.round(s / 3600)} sa önce`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? 'İyi geceler' : h < 11 ? 'Günaydın' : h < 17 ? 'İyi günler' : h < 22 ? 'İyi akşamlar' : 'İyi geceler';
}
