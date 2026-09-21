const WHEEL_TASKS = [
  'En yakın kahvecide Amerikan espresso içme iddiası.',
  'En yakın parkta 20 dakika yürüyüş. Telefon cebinde.',
  'İkiniz de aynı şeyi sipariş edin, hangisi daha iyi tartışın.',
  '5 dakikalık tanışma: üç soru, sonra mark konusu.',
  'En yakın bakkaldan rastgele bir atıştırmalık, paylaşın.',
  'Köşe başına kadar yürüyün, dönüşte bir kahve.',
];

function pickWheel(pin) {
  const place = String(pin?.placeName || '').trim();
  const pool = [...WHEEL_TASKS];
  if (place) {
    pool.push(`${place}’te 15 dakika kalın, sonra karar verin.`);
  }
  if (pin?.kind === 'activity') {
    pool.push('Kısa iddia: kim kaybeder, kahveyi o ısmarlar.');
  }
  if (pin?.kind === 'chat') {
    return (
      [
        'Üç soru, yüz yüze şart değil.',
        'Ne izliyorsun / ne dinliyorsun, 5 dakikalık sohbet.',
        'Aynı şehirde iki yabancı: merhaba deyin.',
      ][Math.floor(Math.random() * 3)]
    );
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function toRad(n) {
  return (n * Math.PI) / 180;
}

function distanceMeters(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return Infinity;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

module.exports = { pickWheel, distanceMeters, WHEEL_TASKS };
