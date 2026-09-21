import { useSpot } from '../store/SpotContext';
import { adMarksLeft, dailyPinLimit, isProRange } from './limits';
import type { PinRange } from '../utils';

export function usePro() {
  const spot = useSpot();
  const isPro = Boolean(spot.me?.isPro);
  const adMarksToday = Number(spot.me?.adMarksToday) || 0;
  const limit = dailyPinLimit(isPro, adMarksToday);
  return {
    isPro,
    adsEnabled: !isPro,
    dailyPinLimit: limit,
    remainingPins: spot.remainingPins,
    adMarksToday,
    adMarksLeft: adMarksLeft(isPro, adMarksToday),
    canUseRange: (range: PinRange) => isPro || !isProRange(range),
    canChatMark: isPro,
    canFeature: isPro,
    canAnonymous: isPro,
    claimAdMark: spot.claimAdMark,
  };
}
