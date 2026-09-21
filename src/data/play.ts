import type { PinKind } from '../types';

export type PinTemplate = {
  id: string;
  label: string;
  emoji: string;
  kind: PinKind;
  text: string;
};

export const PIN_TEMPLATES: PinTemplate[] = [
  {
    id: 'okey',
    label: 'Okey / Batak',
    emoji: '🀄',
    kind: 'activity',
    text: 'Masaya 4. lazım (çiftli / tarafını seç). Gelirsen yaz.',
  },
  {
    id: 'fc',
    label: 'Konsol',
    emoji: '🎮',
    kind: 'activity',
    text: 'EA FC 26 iddialı rakip aranıyor. Kısa maç, yüz yüze.',
  },
  {
    id: 'kahve',
    label: 'Kahve',
    emoji: '☕',
    kind: 'hangout',
    text: '15 dakikaya moladayım, kahve eşlikçisi?',
  },
  {
    id: 'yuruyus',
    label: 'Yürüyüş',
    emoji: '🚶',
    kind: 'activity',
    text: 'Yürüyüş arkadaşı / köpek gezdirme. 20 dk yeter.',
  },
];

export const WHEEL_TASKS = [
  'En yakın kahvecide Amerikan espresso içme iddiası.',
  'En yakın parkta 20 dakika yürüyüş. Telefon cebinde.',
  'İkiniz de aynı şeyi sipariş edin, hangisi daha iyi tartışın.',
  '5 dakikalık tanışma: üç soru, sonra mark konusu.',
  'En yakın bakkaldan rastgele bir atıştırmalık, paylaşın.',
  'Köşe başına kadar yürüyün, dönüşte bir kahve.',
];

export const BADGE_META: Record<
  string,
  { title: string; text: string }
> = {
  kurtarici: {
    title: 'Kurtarıcı',
    text: 'Son anda masaya / sahaya yetişen.',
  },
  kelebek: {
    title: 'Sosyal kelebek',
    text: 'Farklı türde buluşmalara katıldın.',
  },
  dakik: {
    title: 'Dakik',
    text: 'Buluşma noktasına zamanında vardın.',
  },
};

export function suggestionsFor(placeName?: string, kind?: PinKind) {
  const place = placeName?.trim();
  const extra =
    kind === 'activity'
      ? [
          place
            ? `${place} civarında 20 dk yürüyüş.`
            : 'En yakın parkta 20 dk yürüyüş.',
          'Kısa oyun / iddia: kim kaybeder, kahveyi o ısmarlar.',
        ]
      : kind === 'chat'
        ? [
            'Yüz yüze şart değil, buradan yazışalım.',
            'Kısa sohbet: ne izliyorsun / ne dinliyorsun?',
          ]
        : [
          place
            ? `${place}’te birer kahve, 15 dakika sohbet.`
            : 'En yakın kahvecide birer kahve.',
          'Aynı sipariş, hangisi daha iyi iddiası.',
        ];
  return (
    kind === 'chat'
      ? [...extra, 'Üç soru, sonra devam edelim mi?']
      : [...extra, 'Üç soru, sonra yüz yüze plan.']
  ).slice(0, 3);
}
