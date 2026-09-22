import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import { localError } from '../i18n/errors';
import {
  PRO_ENTITLEMENT_ID,
  PRO_PRODUCT_IDS,
  iapEnabledOnThisDevice,
  rcPublicKeyForOs,
  type ProPlanId,
} from '../iap';

export type StorePlan = {
  id: ProPlanId;
  productId: string;
  price: string;
  currencyCode?: string;
  pkg: PurchasesPackage | null;
  product: PurchasesStoreProduct;
};

let configured = false;

function isPurchasesError(err: unknown): err is PurchasesError {
  return Boolean(err && typeof err === 'object' && 'code' in err);
}

export function hasProEntitlement(info: CustomerInfo | null | undefined) {
  if (!info) return false;
  return Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID]);
}

export async function configurePurchases() {
  if (configured) return iapEnabledOnThisDevice();
  if (!iapEnabledOnThisDevice()) return false;
  const apiKey = rcPublicKeyForOs();
  if (!apiKey) return false;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

export async function identifyPurchaser(appUserId?: string | null) {
  if (!(await configurePurchases())) return;
  const id = String(appUserId || '').trim();
  if (!id) {
    try {
      await Purchases.logOut();
    } catch {
      /* anonymous is fine */
    }
    return;
  }
  await Purchases.logIn(id);
}

function planIdOf(pkg: PurchasesPackage): ProPlanId | null {
  const productId = String(pkg.product.identifier || '').toLowerCase();
  if (productId === PRO_PRODUCT_IDS.monthly.toLowerCase()) return 'monthly';
  if (productId === PRO_PRODUCT_IDS.yearly.toLowerCase()) return 'yearly';
  if (productId.includes('year')) return 'yearly';
  if (productId.includes('month')) return 'monthly';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'monthly';
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'yearly';
  return null;
}

function toStorePlan(pkg: PurchasesPackage): StorePlan | null {
  const id = planIdOf(pkg);
  if (!id) return null;
  const product = pkg.product;
  const price = String(product.priceString || '').trim();
  if (!price) return null;
  return {
    id,
    productId: String(product.identifier || PRO_PRODUCT_IDS[id]),
    price,
    currencyCode: product.currencyCode || undefined,
    pkg,
    product,
  };
}

export async function fetchStorePlans(): Promise<StorePlan[]> {
  if (!(await configurePurchases())) return [];
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  const fromOffering = (current?.availablePackages || [])
    .map(toStorePlan)
    .filter((p): p is StorePlan => Boolean(p && p.price));

  if (fromOffering.length) {
    const seen = new Set<ProPlanId>();
    return fromOffering.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  const products = await Purchases.getProducts([
    PRO_PRODUCT_IDS.monthly,
    PRO_PRODUCT_IDS.yearly,
  ]);
  const fromStore: StorePlan[] = [];
  for (const product of products) {
    const raw = String(product.identifier || '').toLowerCase();
    const id =
      raw === PRO_PRODUCT_IDS.monthly.toLowerCase() || raw.includes('month')
        ? ('monthly' as const)
        : raw === PRO_PRODUCT_IDS.yearly.toLowerCase() || raw.includes('year')
          ? ('yearly' as const)
          : null;
    const price = String(product.priceString || '').trim();
    if (!id || !price) continue;
    const pkg =
      current?.availablePackages.find(
        (item) => item.product.identifier === product.identifier,
      ) || null;
    fromStore.push({
      id,
      productId: product.identifier,
      price,
      currencyCode: product.currencyCode || undefined,
      pkg,
      product,
    });
  }
  return fromStore;
}

export async function purchaseStorePlan(plan: StorePlan) {
  try {
    const { customerInfo } = plan.pkg
      ? await Purchases.purchasePackage(plan.pkg)
      : await Purchases.purchaseStoreProduct(plan.product);
    return { ok: true as const, customerInfo };
  } catch (err) {
    if (
      isPurchasesError(err) &&
      err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      return { ok: false as const, cancelled: true as const, reason: '' };
    }
    return {
      ok: false as const,
      cancelled: false as const,
      reason:
        isPurchasesError(err) && err.message
          ? err.message
          : localError('Satın alma tamamlanamadı.'),
    };
  }
}

export async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { ok: true as const, customerInfo };
  } catch (err) {
    return {
      ok: false as const,
      reason:
        isPurchasesError(err) && err.message
          ? err.message
          : localError('Satın alma tamamlanamadı.'),
    };
  }
}

export async function readCustomerInfo() {
  if (!(await configurePurchases())) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function proSyncFromCustomerInfo(info: CustomerInfo | null | undefined) {
  const ent = info?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
  if (!ent) return null;
  const productId = String(ent.productIdentifier || '');
  const lower = productId.toLowerCase();
  const plan: ProPlanId =
    lower.includes('year') || productId === PRO_PRODUCT_IDS.yearly
      ? 'yearly'
      : 'monthly';
  const expiresAt = ent.expirationDate
    ? Date.parse(String(ent.expirationDate))
    : undefined;
  return {
    productId,
    plan,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
  };
}

export function listenCustomerInfo(onInfo: (info: CustomerInfo) => void) {
  Purchases.addCustomerInfoUpdateListener(onInfo);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(onInfo);
  };
}
