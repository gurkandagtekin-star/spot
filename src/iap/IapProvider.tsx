import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CustomerInfo } from 'react-native-purchases';
import { useSpot } from '../store/SpotContext';
import { IAP_ENABLED } from '../iap';
import {
  configurePurchases,
  fetchStorePlans,
  hasProEntitlement,
  identifyPurchaser,
  listenCustomerInfo,
  purchaseStorePlan,
  readCustomerInfo,
  restorePurchases,
  type StorePlan,
} from './purchases';
import type { ProPlanId } from '../iap';

type Value = {
  ready: boolean;
  loading: boolean;
  hasPro: boolean;
  plans: StorePlan[];
  error: string | null;
  refresh: () => Promise<void>;
  purchase: (
    planId: ProPlanId,
  ) => Promise<{ ok: true } | { ok: false; cancelled?: boolean; reason: string }>;
  restore: () => Promise<{ ok: true } | { ok: false; reason: string }>;
};

const IapContext = createContext<Value>({
  ready: false,
  loading: false,
  hasPro: false,
  plans: [],
  error: null,
  refresh: async () => {},
  purchase: async () => ({ ok: false, reason: '' }),
  restore: async () => ({ ok: false, reason: '' }),
});

export function IapProvider({ children }: { children: ReactNode }) {
  const spot = useSpot();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPro, setHasPro] = useState(false);
  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const applyInfo = (info: CustomerInfo | null) => {
    setHasPro(hasProEntitlement(info));
  };

  const refresh = async () => {
    if (!IAP_ENABLED) {
      setPlans([]);
      setReady(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await configurePurchases();
      const [nextPlans, info] = await Promise.all([
        fetchStorePlans(),
        readCustomerInfo(),
      ]);
      setPlans(nextPlans);
      applyInfo(info);
      if (!nextPlans.length) {
        setError('empty');
      }
    } catch (err) {
      setPlans([]);
      setError(err instanceof Error ? err.message : 'empty');
    } finally {
      setLoading(false);
      setReady(true);
    }
  };

  useEffect(() => {
    void refresh();
    if (!IAP_ENABLED) return undefined;
    const onInfo = (info: CustomerInfo) => applyInfo(info);
    const remove = listenCustomerInfo(onInfo);
    return () => {
      remove();
    };
  }, []);

  useEffect(() => {
    if (!IAP_ENABLED) return;
    void identifyPurchaser(spot.signedIn ? spot.meId : null).then(() => {
      void readCustomerInfo().then(applyInfo);
    });
  }, [spot.signedIn, spot.meId]);

  const value = useMemo<Value>(
    () => ({
      ready,
      loading,
      hasPro,
      plans,
      error,
      refresh,
      purchase: async (planId) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return { ok: false, reason: 'empty' };
        const res = await purchaseStorePlan(plan);
        if (res.ok) {
          applyInfo(res.customerInfo);
          return { ok: true };
        }
        return res;
      },
      restore: async () => {
        const res = await restorePurchases();
        if (res.ok) {
          applyInfo(res.customerInfo);
          return { ok: true };
        }
        return res;
      },
    }),
    [ready, loading, hasPro, plans, error],
  );

  return <IapContext.Provider value={value}>{children}</IapContext.Provider>;
}

export function useIap() {
  return useContext(IapContext);
}
