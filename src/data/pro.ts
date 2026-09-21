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
    title: '12 mark / gün',
    text: 'Ücretsiz 2 hak. Reklamla +2. Pro’da günde 12 işaret.',
  },
  {
    title: 'Sohbet noktası',
    text: 'Yüz yüze şart değil. Yalnızca mesaj odaklı mark.',
  },
  {
    title: '16 saat haritada',
    text: 'Pro mark 16 saat kalır. Ücretsiz 2 saat.',
  },
  {
    title: 'Öne çıkan ışıltı',
    text: 'Haritada mor-turuncu neon çerçeve. Anonim paylaşım da Pro.',
  },
  {
    title: 'Semt ve tüm şehir',
    text: 'Ücretsiz en fazla 15 km. Pro Semt ve Tümü’yü açar.',
  },
  {
    title: 'Sohbet 24 saat',
    text: 'Eşleşme sohbeti Pro’da bir gün açık kalır.',
  },
  {
    title: 'Reklamsız',
    text: 'Banner ve geçiş reklamları kapanır.',
  },
];
