// Kayıt kanalları: ad + grafik rengi (Analiz · Kayıt kaynakları ve Büyüme ortak).
/** Kanal adı + grafik rengi (yığılmış günlük çubukta ve noktalarda). */
export const CHANNEL: Record<string, { label: string; color: string }> = {
  google: { label: 'Google arama', color: '#4C8DF6' },
  share: { label: 'Paylaşılan link', color: '#FFD800' },
  whatsapp: { label: 'WhatsApp', color: '#30D46B' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  x: { label: 'X (Twitter)', color: '#E7E9EA' },
  tiktok: { label: 'TikTok', color: '#25F4EE' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  telegram: { label: 'Telegram', color: '#2AABEE' },
  youtube: { label: 'YouTube', color: '#FF3B4E' },
  reddit: { label: 'Reddit', color: '#FF5700' },
  eksisozluk: { label: 'Ekşi Sözlük', color: '#81C14B' },
  ai: { label: 'Yapay zekâ (ChatGPT, Perplexity…)', color: '#9B5CFF' },
  search: { label: 'Diğer arama motorları', color: '#7FA7E8' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  discord: { label: 'Discord', color: '#5865F2' },
  flyer: { label: 'El ilanı / QR', color: '#FF9F0A' },
  club: { label: 'Üniversite kulübü', color: '#64D2FF' },
  direct: { label: 'Doğrudan (adres yazıp)', color: '#828489' },
  app: { label: 'Mobil uygulama', color: '#F1ECB4' },
  other: { label: 'Diğer siteler', color: '#505257' },
  unknown: { label: 'Bilinmiyor (takip öncesi)', color: '#2a2a2e' },
};
export const ch = (k: string | null) => CHANNEL[k ?? 'unknown'] ?? { label: k ?? '—', color: '#505257' };
