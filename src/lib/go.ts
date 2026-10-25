// Bileşen dışından sayfa geçişi (ör. bir satırdaki kullanıcı adına tıklayınca
// profil sayfasına git). Router kurulunca Navigator köprüsü fonksiyonu kaydeder.
type Nav = (to: string) => void;
let nav: Nav = (to) => {
  window.location.assign(to);
};
export function setNavigator(fn: Nav) {
  nav = fn;
}
export const go = (to: string) => nav(to);

export const paths = {
  user: (id: string) => `/kullanicilar/${id}`,
  room: (id: string) => `/moderasyon/odalar/${id}`,
  quiz: (id: string) => `/yayin/quizler/${id}`,
  post: (id: string) => `/moderasyon/icerik/${id}`,
  sticker: (id: string) => `/ekonomi/sticker/${id}`,
  show: (tmdbId: string) => `/katalog/${tmdbId}`,
  titleEdit: (key: string) => `/katalog/${key}/duzenle`,
};
