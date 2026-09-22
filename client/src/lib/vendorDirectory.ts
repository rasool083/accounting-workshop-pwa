export type VendorKind = "تولیدکننده" | "واردکننده" | "بازرگانی" | "نماینده" | "سایر";
export type QuoteStatus = "معتبر" | "منقضی" | "بررسی نشده";

export type Vendor = {
  id: string;
  name: string;
  kind: VendorKind;
  contactName: string;
  phone: string;
  email: string;
  location: string;
  website: string;
  suppliedMaterials: string[];
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VendorQuote = {
  id: string;
  vendorId: string;
  materialName: string;
  productId?: string;
  quoteDate: string;
  price: number;
  currency: string;
  unit: string;
  packageDescription: string;
  minimumOrder: string;
  leadTimeDays?: number;
  validUntil: string;
  status: QuoteStatus;
  source: string;
  notes: string;
  createdAt: string;
};

export type VendorDirectoryState = {
  version: 1;
  vendors: Vendor[];
  quotes: VendorQuote[];
};

const STORAGE_KEY = "accounting-workshop-pwa:vendor-directory:v1";

const emptyState: VendorDirectoryState = { version: 1, vendors: [], quotes: [] };

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadVendorDirectory(): VendorDirectoryState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<VendorDirectoryState>;
    return {
      version: 1,
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
    };
  } catch {
    return emptyState;
  }
}

export function saveVendorDirectory(state: VendorDirectoryState) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function createVendor(input: Omit<Vendor, "id" | "createdAt" | "updatedAt">): Vendor {
  const now = new Date().toISOString();
  return { ...input, id: makeId("vendor"), createdAt: now, updatedAt: now };
}

export function createVendorQuote(input: Omit<VendorQuote, "id" | "createdAt">): VendorQuote {
  return { ...input, id: makeId("quote"), createdAt: new Date().toISOString() };
}

export type VendorMaterialStat = {
  materialName: string;
  quoteCount: number;
  vendorCount: number;
  latestPrice?: number;
  lowestPrice?: number;
  averagePrice?: number;
  latestDate?: string;
  lowestVendorId?: string;
  previousPrice?: number;
  changePercent?: number;
};

export function materialNames(state: VendorDirectoryState) {
  return Array.from(new Set([
    ...state.vendors.flatMap(vendor => vendor.suppliedMaterials),
    ...state.quotes.map(quote => quote.materialName),
  ].map(name => name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "fa"));
}

export function getMaterialStats(state: VendorDirectoryState, materialName?: string): VendorMaterialStat[] {
  const names = materialName ? [materialName] : materialNames(state);
  return names.map(name => {
    const quotes = state.quotes
      .filter(quote => quote.materialName === name && quote.price >= 0)
      .sort((a, b) => b.quoteDate.localeCompare(a.quoteDate) || b.createdAt.localeCompare(a.createdAt));
    const prices = quotes.map(quote => quote.price);
    const latest = quotes[0];
    const previous = quotes[1];
    const lowest = quotes.reduce<VendorQuote | undefined>((best, quote) => !best || quote.price < best.price ? quote : best, undefined);
    const vendorIds = new Set(quotes.map(quote => quote.vendorId));
    return {
      materialName: name,
      quoteCount: quotes.length,
      vendorCount: vendorIds.size,
      latestPrice: latest?.price,
      lowestPrice: lowest?.price,
      averagePrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : undefined,
      latestDate: latest?.quoteDate,
      lowestVendorId: lowest?.vendorId,
      previousPrice: previous?.price,
      changePercent: latest && previous && previous.price !== 0 ? ((latest.price - previous.price) / previous.price) * 100 : undefined,
    } satisfies VendorMaterialStat;
  });
}

export function quoteUnitKey(quote: VendorQuote) {
  return `${quote.price} ${quote.currency}/${quote.unit}`;
}
