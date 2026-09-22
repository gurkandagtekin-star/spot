import { useSpot } from '../store/SpotContext';
import { useIap } from '../iap/IapProvider';
import { adMarksLeft, dailyPinLimit, isProRange } from './limits';
import type { PinRange } from '../utils';
import { ADS_ENABLED } from '../ads/ids';

export function usePro() {
  const spot = useSpot();
  const iap = useIap();
  const isPro = Boolean(spot.me?.isPro) || iap.hasPro;
  const adMarksToday = Number(spot.me?.adMarksToday) || 0;
  const limit = dailyPinLimit(isPro, adMarksToday);
  return {
    isPro,
    adsEnabled: ADS_ENABLED && !isPro,
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
