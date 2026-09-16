export const PRO_PLANS = [
  {
    id: 'monthly' as const,
    name: 'Aylık',
    price: '79,99 TL',
    period: 'ay',
    note: 'İstediğin zaman iptal',
  },
  {
    id: 'yearly' as const,
    name: 'Yıllık',
    price: '499,99 TL',
    period: 'yıl',
    note: '2 ay hediye',
  },
];

export const PRO_FEATURES = [
  {
    title: 'Sınırsız mark',
    text: 'Günde 2 hak yok. İstediğin kadar buluşma noktası koy.',
  },
  {
    title: 'Öne çıkan mark',
    text: 'Haritada altın çerçeve. Yakındakiler seni önce görür.',
  },
  {
    title: 'Tüm şehir',
    text: 'Sadece mahalle değil; şehirdeki açık mark’lar listelenir.',
  },
  {
    title: 'Sohbet +24 saat',
    text: 'Mark bitince sohbet hemen kapanmaz. Pro’da bir gün daha açık kalır.',
  },
  {
    title: 'Anında istek uyarısı',
    text: 'Selam geldiğinde haritada ve sohbet rozetinde kaçırmazsın.',
  },
  {
    title: 'Reklamsız',
    text: 'Teaser ve kota kartları kaybolur. Sade harita.',
  },
];
