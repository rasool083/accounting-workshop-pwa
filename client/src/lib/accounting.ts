export const CURRENT_SCHEMA_VERSION = 2;
export const BACKUP_FORMAT_VERSION = 2;

export type PageId =
  | "dashboard"
  | "invoices"
  | "transactions"
  | "banks"
  | "people"
  | "inventory"
  | "production"
  | "prices"
  | "paymentRules"
  | "checks"
  | "monthClose"
  | "reports"
  | "backup"
  | "settings";

export type PersonType = "مشتری" | "تأمین‌کننده" | "شریک" | "کارگر" | "سایر";
export const PERSON_TYPES: PersonType[] = [
  "مشتری",
  "تأمین‌کننده",
  "شریک",
  "کارگر",
  "سایر",
];
export const UNIT_OPTIONS = [
  "عدد",
  "کیلوگرم",
  "گرم",
  "تن",
  "متر",
  "سانتی‌متر",
  "مترمربع",
  "مترمکعب",
  "لیتر",
  "گالن",
  "کیسه",
  "بسته",
  "کارتن",
  "پالت",
  "حلقه",
  "شاخه",
  "دست",
  "سرویس",
  "دستگاه",
  "ساعت",
  "روز",
  "ماه",
  "سایر",
] as const;
export type PriceScope = "عمومی" | "اختصاصی";

export interface Warehouse {
  id: string;
  name: string;
  note: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  quantityBase?: number;
  conversionRate?: number;
}
export interface CheckAllocation {
  checkId: string;
  amount: number;
  principalAmount?: number;
  profit?: number;
  days?: number;
  allocatedAt: string;
}
export interface Invoice {
  id: string;
  number: string;
  type: "فروش" | "خرید";
  date: string;
  partyId?: string;
  paymentRuleId?: string;
  priceHistoryId?: string;
  items: InvoiceItem[];
  allocations: CheckAllocation[];
  discountAmount?: number;
  amount: number;
  paidAmount: number;
  status: "باز" | "تسویه جزئی" | "تسویه شده" | "باطل";
  note: string;
}

export type TransactionType =
  | "فروش"
  | "خرید"
  | "دریافت"
  | "پرداخت"
  | "هزینه"
  | "درآمد"
  | "اصلاحیه"
  | "انتقال بین حساب‌ها"
  | "خرید کالا"
  | "فروش کالا"
  | "هزینه/خرید توسط شریک"
  | "دریافت توسط شریک"
  | "مساعده/پرداخت به شریک"
  | "دریافت تسویه از شریک";
export type PartnerSettlementDirection =
  | "پرداخت بدهی کارگاه به شریک"
  | "دریافت طلب کارگاه از شریک";
export type CheckStatus =
  | "نزد ما"
  | "وصول شده"
  | "تودیع شده"
  | "برگشتی"
  | "عودت داده شده"
  | "جایگزین شده"
  | "باطل"
  | "خرج شده";

export interface Person {
  id: string;
  code: string;
  name: string;
  type: PersonType;
  defaultPaymentRuleId?: string;
  roles: PersonType[];
  phone: string;
  balance: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  unit2?: string;
  conversionRate?: number;
  warehouseId?: string;
  stock: number;
  minStock: number;
  price: number;
  category?: "مواد اولیه" | "محصول تولیدی" | "بسته تولید";
}

export interface ProductionMaterial {
  id: string;
  productId: string;
  quantity: number;
  unit: string;
}

export interface ProductionCost {
  id: string;
  title: string;
  amount: number;
}

export interface ProductionFormula {
  id: string;
  name: string;
  formulaType?: "قطعه" | "بسته تولید";
  outputProductId?: string;
  outputName?: string;
  outputQuantity: number;
  outputUnit: string;
  materials: ProductionMaterial[];
  costs: ProductionCost[];
  note: string;
}

export interface ProductionRecord {
  id: string;
  formulaId: string;
  date: string;
  outputQuantity: number;
  outputQuantityBase?: number;
  materialCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number;
  note: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  partyId?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  productId?: string;
  warehouseId?: string;
  quantity?: number;
  unit?: string;
  checkId?: string;
  partnerEffect?:
    | "افزایش طلب شریک"
    | "کاهش طلب شریک"
    | "افزایش طلب کارگاه از شریک"
    | "کاهش طلب کارگاه از شریک";
  settlementDirection?: PartnerSettlementDirection;
  referenceType?: "فاکتور خرید" | "چک" | "هزینه" | "سایر";
  referenceId?: string;
  referenceLabel?: string;
  amount: number;
  status: "ثبت شده" | "باطل";
  note: string;
}

export interface Check {
  id: string;
  number: string;
  partyId?: string;
  dueDate: string;
  receivedDate: string;
  invoiceDate?: string;
  paymentRuleId?: string;
  amount: number;
  status: CheckStatus;
  bank: string;
  bankAccountId?: string;
  returnPartyId?: string;
  replacementOf?: string;
  replacementIds?: string[];
  note?: string;
}

export interface Account {
  id: string;
  name: string;
  type: "بانک" | "صندوق" | "شریک";
  balance: number;
}

export interface PriceHistory {
  id: string;
  productId?: string;
  productName: string;
  scope: PriceScope;
  partyIds?: string[];
  effectiveDate: string;
  unit: string;
  price: number;
  note: string;
}

export interface PaymentRule {
  id: string;
  name: string;
  active: boolean;
  dayBasis: number;
  graceDays: number;
  tiers: Array<{ id: string; maxDays: number; rate: number; note: string }>;
}

export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  note: string;
}

export interface AppState {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  settings: {
    businessName: string;
    currency: string;
    dayBasis: number | "شمسی";
    units: string[];
  };
  people: Person[];
  products: Product[];
  warehouses: Warehouse[];
  invoices: Invoice[];
  priceHistory: PriceHistory[];
  paymentRules: PaymentRule[];
  transactions: Transaction[];
  checks: Check[];
  accounts: Account[];
  audit: AuditEvent[];
  productionFormulas: ProductionFormula[];
  productionRecords: ProductionRecord[];
}

export interface ProductionExecutionResult {
  state: AppState;
  recordIds: string[];
}

/**
 * Produces a requested quantity from a formula. Package formulas used as
 * materials are produced recursively when their available stock is not
 * enough. All quantities are converted to the product base unit before stock
 * changes are applied.
 */
export function executeProduction(
  state: AppState,
  formulaId: string,
  outputQuantity: number,
  outputUnit?: string,
  date = todayJalali()
): ProductionExecutionResult {
  if (!Number.isFinite(outputQuantity) || outputQuantity <= 0)
    throw new Error("مقدار تولید باید بزرگ‌تر از صفر باشد");
  const products = state.products.map(product => ({ ...product }));
  const formulas = new Map(state.productionFormulas.map(item => [item.id, item]));
  const outputFormulaIds = new Map(
    state.productionFormulas
      .filter(item => item.outputProductId)
      .map(item => [item.outputProductId!, item.id])
  );
  const records: ProductionRecord[] = [];
  const visiting = new Set<string>();

  const productById = (id: string) => products.find(product => product.id === id);
  const unitPrice = (product: Product) => Math.max(0, Number(product.price) || 0);

  const run = (
    currentFormulaId: string,
    requestedQuantity: number,
    requestedUnit?: string
  ): number => {
    if (visiting.has(currentFormulaId))
      throw new Error("وابستگی حلقوی در فرمول‌های تولید وجود دارد");
    const formula = formulas.get(currentFormulaId);
    if (!formula || !formula.outputProductId)
      throw new Error("فرمول یا محصول خروجی معتبر نیست");
    const outputProduct = productById(formula.outputProductId);
    if (!outputProduct) throw new Error("محصول خروجی فرمول پیدا نشد");
    const batchBase = quantityInBase(
      outputProduct,
      formula.outputQuantity,
      formula.outputUnit || outputProduct.unit
    );
    const requestedBase = quantityInBase(
      outputProduct,
      requestedQuantity,
      requestedUnit || formula.outputUnit || outputProduct.unit
    );
    if (batchBase <= 0 || requestedBase <= 0)
      throw new Error("مقدار خروجی فرمول معتبر نیست");
    const scale = requestedBase / batchBase;
    visiting.add(currentFormulaId);
    let materialCost = 0;
    for (const material of formula.materials) {
      const materialProduct = productById(material.productId);
      if (!materialProduct) throw new Error("مادهٔ اولیهٔ فرمول پیدا نشد");
      const requiredBase = quantityInBase(
        materialProduct,
        material.quantity * scale,
        material.unit
      );
      const nestedFormulaId = outputFormulaIds.get(materialProduct.id);
      if (nestedFormulaId && materialProduct.stock < requiredBase) {
        run(
          nestedFormulaId,
          requiredBase - materialProduct.stock,
          materialProduct.unit
        );
      }
      if (materialProduct.stock < requiredBase)
        throw new Error(`موجودی مادهٔ اولیهٔ «${materialProduct.name}» کافی نیست`);
      materialProduct.stock -= requiredBase;
      materialCost += nestedFormulaId
        ? requiredBase * unitPrice(materialProduct)
        : requiredBase * unitPrice(materialProduct);
    }
    const overheadCost = formula.costs.reduce(
      (sum, cost) => sum + Math.max(0, Number(cost.amount) || 0) * scale,
      0
    );
    const totalCost = materialCost + overheadCost;
    outputProduct.stock += requestedBase;
    outputProduct.price = totalCost / requestedBase;
    outputProduct.category =
      formula.formulaType === "بسته تولید" ? "بسته تولید" : "محصول تولیدی";
    records.push({
      id: createId("production"),
      formulaId: currentFormulaId,
      date,
      outputQuantity: requestedQuantity,
      outputQuantityBase: requestedBase,
      materialCost,
      overheadCost,
      totalCost,
      unitCost: totalCost / requestedBase,
      note: formula.note,
    });
    visiting.delete(currentFormulaId);
    return totalCost;
  };

  run(formulaId, outputQuantity, outputUnit);
  return {
    state: { ...state, products, productionRecords: [...state.productionRecords, ...records] },
    recordIds: records.map(record => record.id),
  };
}

const STORAGE_KEY = "accounting-workshop-pwa:v1";

const seedState: AppState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  revision: 1,
  updatedAt: new Date().toISOString(),
  settings: {
    businessName: "کارگاه من",
    currency: "تومان",
    dayBasis: "شمسی",
    units: ["عدد", "کیلوگرم", "گرم", "متر", "لیتر", "کیسه", "بسته", "کارتن"],
  },
  people: [],
  products: [],
  warehouses: [
    { id: "warehouse-production", name: "انبار محصولات تولید", note: "" },
    { id: "warehouse-material", name: "انبار مواد اولیه", note: "" },
    { id: "warehouse-trade", name: "انبار بازرگانی", note: "" },
  ],
  invoices: [],
  priceHistory: [],
  paymentRules: [
    {
      id: "cash-default",
      name: "نقدی و تسویه فوری",
      active: true,
      dayBasis: 30,
      graceDays: 0,
      tiers: [{ id: "tier-1", maxDays: 30, rate: 0, note: "بدون سود" }],
    },
  ],
  transactions: [],
  checks: [],
  accounts: [
    { id: "cash", name: "صندوق اصلی", type: "صندوق", balance: 0 },
    { id: "bank", name: "حساب بانکی", type: "بانک", balance: 0 },
  ],
  audit: [],
  productionFormulas: [],
  productionRecords: [],
};

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function suggestNextNumber(values: string[], fallback = 1) {
  const digits = (value: string) =>
    value
      .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .match(/\d+/g);
  const highest = values.reduce((max, value) => {
    const parts = digits(value || "");
    const last = parts?.[parts.length - 1];
    return Math.max(max, last ? Number(last) : 0);
  }, 0);
  return String(Math.max(fallback, highest + 1));
}

export function suggestNextPartyNumber(
  records: Array<{ partyId?: string; number: string }>,
  partyId?: string,
  partyCode?: string,
  fallbackValues: string[] = []
) {
  const own = partyId ? records.filter(item => item.partyId === partyId) : [];
  const source = own.length
    ? own
    : records.filter(item => fallbackValues.includes(item.number));
  const matches = source
    .map(item => item.number.match(/^(.*?)(\d+)\s*$/))
    .filter(Boolean) as RegExpMatchArray[];
  if (!matches.length) return suggestNextNumber(fallbackValues);
  const reference = matches.sort((a, b) => Number(b[2]) - Number(a[2]))[0];
  const prefix = reference?.[1] ?? (partyCode?.match(/^[^\d]*/)?.[0] || "");
  const width = reference?.[2]?.length || 0;
  const next = suggestNextNumber(source.map(item => item.number));
  return `${prefix}${width ? next.padStart(width, "0") : next}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function migrateBackupData(input: unknown, version: number) {
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `این پشتیبان برای نسخهٔ جدیدتری از برنامه است (نسخه ${version}). ابتدا برنامه را به‌روزرسانی کنید.`
    );
  }
  return normalizeState(input);
}

export function normalizeState(input: unknown): AppState {
  const source = isRecord(input) ? input : {};
  const sourceProducts = Array.isArray(source.products) ? source.products : [];
  const discoveredUnits = sourceProducts.flatMap(product =>
    isRecord(product)
      ? [product.unit, product.unit2].filter(
          (unit): unit is string =>
            typeof unit === "string" && Boolean(unit.trim())
        )
      : []
  );
  const configuredUnits =
    isRecord(source.settings) && Array.isArray(source.settings.units)
      ? source.settings.units.filter(
          (unit): unit is string =>
            typeof unit === "string" && Boolean(unit.trim())
        )
      : seedState.settings.units;
  const allUnits = Array.from(
    new Set([...configuredUnits, ...discoveredUnits])
  );
  const availableAccounts = Array.isArray(source.accounts)
    ? source.accounts
    : seedState.accounts;
  return {
    ...seedState,
    ...source,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: typeof source.revision === "number" ? source.revision : 1,
    updatedAt:
      typeof source.updatedAt === "string"
        ? source.updatedAt
        : new Date().toISOString(),
    settings: {
      ...seedState.settings,
      ...(isRecord(source.settings) ? source.settings : {}),
      dayBasis:
        isRecord(source.settings) &&
        (source.settings.dayBasis === "شمسی" ||
          typeof source.settings.dayBasis === "number")
          ? source.settings.dayBasis
          : seedState.settings.dayBasis,
      units: allUnits,
    },
    people: Array.isArray(source.people)
      ? source.people.map(person => ({
          ...person,
          defaultPaymentRuleId:
            typeof person.defaultPaymentRuleId === "string"
              ? person.defaultPaymentRuleId
              : undefined,
          roles:
            Array.isArray(person.roles) && person.roles.length
              ? person.roles
              : [person.type || "مشتری"],
        }))
      : [],
    products: Array.isArray(source.products)
      ? source.products.map(product => ({
          ...product,
          unit2: product.unit2 || product.unit,
          conversionRate: Number(product.conversionRate) || 1,
        }))
      : [],
    warehouses: Array.isArray(source.warehouses)
      ? source.warehouses
      : seedState.warehouses,
    invoices: Array.isArray(source.invoices)
      ? source.invoices.map(invoice => ({
          ...invoice,
          items: Array.isArray(invoice.items) ? invoice.items : [],
          allocations: Array.isArray(invoice.allocations)
            ? invoice.allocations
            : [],
          paidAmount: Number(invoice.paidAmount) || 0,
        }))
      : [],
    priceHistory: Array.isArray(source.priceHistory) ? source.priceHistory : [],
    paymentRules: Array.isArray(source.paymentRules)
      ? source.paymentRules
      : seedState.paymentRules,
    transactions: Array.isArray(source.transactions) ? source.transactions : [],
    checks: Array.isArray(source.checks)
      ? source.checks.map(check => ({
          ...check,
          bankAccountId:
            typeof check.bankAccountId === "string"
              ? check.bankAccountId
              : availableAccounts.find(
                  account =>
                    account.type === "بانک" && account.name === check.bank
                )?.id,
          returnPartyId:
            typeof check.returnPartyId === "string"
              ? check.returnPartyId
              : undefined,
          replacementIds: Array.isArray(check.replacementIds)
            ? check.replacementIds
            : [],
          receivedDate:
            typeof check.receivedDate === "string"
              ? check.receivedDate
              : check.dueDate || "",
          invoiceDate:
            typeof check.invoiceDate === "string"
              ? check.invoiceDate
              : undefined,
          paymentRuleId:
            typeof check.paymentRuleId === "string"
              ? check.paymentRuleId
              : undefined,
        }))
      : [],
    accounts: availableAccounts,
    audit: Array.isArray(source.audit) ? source.audit.slice(-500) : [],
    productionFormulas: Array.isArray(source.productionFormulas)
      ? source.productionFormulas.map(formula => ({
          ...formula,
          formulaType:
            formula.formulaType === "بسته تولید" ? "بسته تولید" : "قطعه",
        }))
      : [],
    productionRecords: Array.isArray(source.productionRecords)
      ? source.productionRecords
      : [],
  } as AppState;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : normalizeState(seedState);
  } catch {
    return normalizeState(seedState);
  }
}

export function saveState(state: AppState) {
  const next = normalizeState({
    ...state,
    revision: state.revision + 1,
    updatedAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createEmptyState(previous: AppState): AppState {
  return normalizeState({
    revision: previous.revision + 1,
    people: [],
    products: [],
    priceHistory: [],
    invoices: [],
    transactions: [],
    checks: [],
    productionFormulas: [],
    productionRecords: [],
    audit: [
      {
        id: createId("audit"),
        at: new Date().toISOString(),
        action: "CLEAR_DATA",
        note: "حذف همه اطلاعات کسب‌وکار پس از تأیید کاربر",
      },
    ],
  });
}

export function formatMoney(value: number, currency = "ریال") {
  return `${new Intl.NumberFormat("fa-IR").format(Math.round(value || 0))} ${currency}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value || 0);
}

const STANDARD_UNIT_FACTORS: Record<string, number> = {
  میلی‌گرم: 0.000001,
  "میلی گرم": 0.000001,
  گرم: 0.001,
  کیلوگرم: 1,
  تن: 1000,
  میلی‌لیتر: 0.001,
  "میلی لیتر": 0.001,
  لیتر: 1,
  سانتی‌متر: 0.01,
  "سانتی متر": 0.01,
  متر: 1,
};

/** مقدار یک واحد انتخاب‌شده را به واحد اول کالا تبدیل می‌کند. */
export function unitConversionToBase(product: Product, unit: string) {
  if (!unit || unit === product.unit) return 1;
  if (unit === product.unit2) {
    const baseFactor = STANDARD_UNIT_FACTORS[product.unit];
    const selectedFactor = STANDARD_UNIT_FACTORS[unit];
    if (baseFactor && selectedFactor) return selectedFactor / baseFactor;
    return Number(product.conversionRate) > 0
      ? Number(product.conversionRate)
      : 1;
  }
  const baseFactor = STANDARD_UNIT_FACTORS[product.unit];
  const selectedFactor = STANDARD_UNIT_FACTORS[unit];
  return baseFactor && selectedFactor ? selectedFactor / baseFactor : 1;
}

export function quantityInBase(
  product: Product,
  quantity: number,
  unit: string
) {
  return (Number(quantity) || 0) * unitConversionToBase(product, unit);
}

export function todayJalali() {
  const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return formatted
    .replace(/[۰-۹]/g, digit =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)).replace(/-/g, "/")
    )
    .replace(/-/g, "/");
}

export function formatDate(value: string) {
  if (!value) return "—";
  return value.replace(/-/g, "/");
}

export function personName(state: AppState, id?: string) {
  return state.people.find(person => person.id === id)?.name || "بدون طرف حساب";
}

export function transactionLabel(type: TransactionType) {
  return {
    فروش: "فروش",
    خرید: "خرید",
    دریافت: "دریافت",
    پرداخت: "پرداخت",
    هزینه: "هزینه",
    درآمد: "درآمد",
    اصلاحیه: "اصلاحیه",
    "انتقال بین حساب‌ها": "انتقال بین حساب‌ها",
    "خرید کالا": "خرید کالا",
    "فروش کالا": "فروش کالا",
    "هزینه/خرید توسط شریک": "هزینه/خرید توسط شریک",
    "دریافت توسط شریک": "دریافت توسط شریک",
    "مساعده/پرداخت به شریک": "مساعده/پرداخت به شریک",
    "دریافت تسویه از شریک": "دریافت تسویه از شریک",
  }[type];
}

export function exportPayload(state: AppState) {
  const data = normalizeState(state);
  return JSON.stringify(
    {
      format: "accounting-workshop-backup",
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      application: "حسابداری کارگاه",
      collections: {
        people: data.people.length,
        products: data.products.length,
        warehouses: data.warehouses.length,
        priceHistory: data.priceHistory.length,
        paymentRules: data.paymentRules.length,
        invoices: data.invoices.length,
        transactions: data.transactions.length,
        checks: data.checks.length,
        accounts: data.accounts.length,
        audit: data.audit.length,
        productionFormulas: data.productionFormulas.length,
        productionRecords: data.productionRecords.length,
      },
      data,
    },
    null,
    2
  );
}

export function importPayload(text: string) {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error("ساختار فایل پشتیبان معتبر نیست");
  if (
    parsed.format === "accounting-workshop-backup" &&
    typeof parsed.backupFormatVersion === "number" &&
    parsed.backupFormatVersion > BACKUP_FORMAT_VERSION
  ) {
    throw new Error(
      "این فایل پشتیبان برای نسخهٔ جدیدتری از برنامه ساخته شده است."
    );
  }
  const data = "data" in parsed ? parsed.data : parsed;
  const version =
    typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 1;
  const normalized = migrateBackupData(data, version);
  if (
    !Array.isArray(normalized.people) ||
    !Array.isArray(normalized.transactions)
  )
    throw new Error("فایل پشتیبان ناقص است");
  return normalized;
}

export function appendAudit(
  state: AppState,
  action: string,
  note: string
): AppState {
  return {
    ...state,
    audit: [
      ...state.audit,
      { id: createId("audit"), at: new Date().toISOString(), action, note },
    ].slice(-500),
  };
}

export function jalaliDayDifference(from: string, to: string) {
  const ordinal = (value: string) => {
    const [year, month, day] = value.replace(/-/g, "/").split("/").map(Number);
    if (![year, month, day].every(Number.isFinite)) return 0;
    const completedYears = Math.max(0, year - 1);
    const cycles = Math.floor(completedYears / 33);
    const remainder = completedYears % 33;
    const leapYearsBefore =
      cycles * 8 +
      [1, 5, 9, 13, 17, 22, 26, 30].filter(item => item <= remainder).length;
    const monthDays = month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30;
    return year * 365 + leapYearsBefore + monthDays + day;
  };
  return Math.max(0, ordinal(to) - ordinal(from));
}

export function jalaliDateKey(value: string) {
  const parts = value.replace(/-/g, "/").split("/").map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
    return "9999/99/99";
  }
  return parts.map(part => String(part).padStart(2, "0")).join("/");
}
export function jalaliMonthDayBasis(date: string) {
  const [year, month] = date.replace(/-/g, "/").split("/").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}
export function isJalaliLeapYear(year: number) {
  const remainder = year % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(remainder);
}

export interface FIFOSettlement {
  checkId: string;
  invoiceId: string;
  amount: number;
  principalAmount: number;
  profit: number;
  days: number;
}

export interface FIFOSettlementBalance {
  remainingCheck: number;
  remainingInvoice: number;
}

// Interest and unit-conversion calculations can leave a harmless fraction of
// a currency unit. Treat values below one cent/toman as zero so FIFO can
// continue to the next invoice instead of stopping on floating-point residue.
const FIFO_EPSILON = 0.01;

function principalCollectedForInvoice(
  invoiceAmount: number,
  rows: FIFOSettlement[]
) {
  const collected = rows.reduce((sum, item) => sum + item.principalAmount, 0);
  return Math.min(
    invoiceAmount,
    Math.abs(invoiceAmount - collected) <= FIFO_EPSILON
      ? invoiceAmount
      : collected
  );
}

export function settleChecksFIFO(
  checks: Check[],
  invoices: Invoice[],
  paymentRules: PaymentRule[] = [],
  dayBasis: number | "شمسی" = 30
) {
  const settlements: FIFOSettlement[] = [];
  const eligibleInvoices = [...invoices]
    .filter(invoice => invoice.type === "فروش" && invoice.status !== "باطل")
    .sort(
      (a, b) =>
        jalaliDateKey(a.date).localeCompare(jalaliDateKey(b.date)) ||
        a.id.localeCompare(b.id)
    );
  const eligibleChecks = [...checks]
    .filter(
      check =>
        !["باطل", "برگشتی", "عودت داده شده", "جایگزین شده"].includes(
          check.status
        )
    )
    .sort(
      (a, b) =>
        jalaliDateKey(a.dueDate).localeCompare(jalaliDateKey(b.dueDate)) ||
        jalaliDateKey(a.receivedDate).localeCompare(
          jalaliDateKey(b.receivedDate)
        ) ||
        a.id.localeCompare(b.id)
    );
  const remainingByInvoice = new Map(
    eligibleInvoices.map(invoice => [invoice.id, Math.max(0, invoice.amount)])
  );
  const remainingByCheck = new Map(
    eligibleChecks.map(check => [check.id, Math.max(0, check.amount)])
  );

  for (const check of eligibleChecks) {
    let checkRemaining = remainingByCheck.get(check.id) || 0;
    for (const invoice of eligibleInvoices) {
      if (
        invoice.partyId !== check.partyId ||
        checkRemaining <= FIFO_EPSILON
      )
        continue;
      const baseRemaining = remainingByInvoice.get(invoice.id) || 0;
      if (baseRemaining <= FIFO_EPSILON) {
        remainingByInvoice.set(invoice.id, 0);
        continue;
      }
      const rule =
        paymentRules.find(item => item.id === invoice.paymentRuleId) ||
        paymentRules.find(item => item.active);
      const probe = calculateLateProfit(
        { ...check, amount: checkRemaining },
        rule,
        invoice.date,
        baseRemaining,
        dayBasis
      );
      const amount = Math.min(checkRemaining, probe.settled);
      const factor = baseRemaining > 0 ? probe.settled / baseRemaining : 1;
      const calculatedPrincipal = Math.min(
        baseRemaining,
        amount / Math.max(1, factor)
      );
      const principalAmount =
        baseRemaining - calculatedPrincipal <= FIFO_EPSILON
          ? baseRemaining
          : calculatedPrincipal;
      const profit = Math.max(0, amount - principalAmount);
      if (amount <= FIFO_EPSILON || principalAmount <= FIFO_EPSILON) continue;
      settlements.push({
        checkId: check.id,
        invoiceId: invoice.id,
        amount,
        principalAmount,
        profit,
        days: probe.days,
      });
      const invoiceRemaining = Math.max(0, baseRemaining - principalAmount);
      remainingByInvoice.set(
        invoice.id,
        invoiceRemaining <= FIFO_EPSILON ? 0 : invoiceRemaining
      );
      const nextCheckRemaining = Math.max(0, checkRemaining - amount);
      checkRemaining =
        nextCheckRemaining <= FIFO_EPSILON ? 0 : nextCheckRemaining;
      remainingByCheck.set(check.id, checkRemaining);
      if ((remainingByInvoice.get(invoice.id) || 0) > FIFO_EPSILON) break;
    }
  }
  return settlements;
}

/**
 * Returns the check and invoice balances immediately after each allocation.
 * The key is stable for the settlement row and keeps the UI from displaying
 * the final balance on every accordion row.
 */
export function getSettlementBalances(
  settlements: FIFOSettlement[],
  checks: Check[],
  invoices: Invoice[]
) {
  const remainingChecks = new Map(
    checks.map(check => [check.id, Math.max(0, check.amount)])
  );
  const remainingInvoices = new Map(
    invoices.map(invoice => [invoice.id, Math.max(0, invoice.amount)])
  );
  const result = new Map<string, FIFOSettlementBalance>();
  settlements.forEach(item => {
    const remainingCheck = Math.max(
      0,
      (remainingChecks.get(item.checkId) || 0) - item.amount
    );
    const remainingInvoice = Math.max(
      0,
      (remainingInvoices.get(item.invoiceId) || 0) - item.principalAmount
    );
    remainingChecks.set(item.checkId, remainingCheck);
    remainingInvoices.set(item.invoiceId, remainingInvoice);
    result.set(`${item.checkId}:${item.invoiceId}`, {
      remainingCheck,
      remainingInvoice,
    });
  });
  return result;
}

export function allocateCheckFIFO(
  check: Check,
  invoices: Invoice[],
  paymentRules: PaymentRule[] = []
) {
  return settleChecksFIFO([check], invoices, paymentRules).map(item => ({
    invoice: invoices.find(invoice => invoice.id === item.invoiceId)!,
    allocation: item.amount,
    principalAmount: item.principalAmount,
    profit: item.profit,
    remainingAfter: Math.max(0, check.amount - item.amount),
  }));
}

export function applyCheckFIFO(state: AppState, check: Check) {
  if (!check.partyId) return state;
  const partyChecks = state.checks.map(item =>
    item.id === check.id ? check : item
  );
  const settlements = settleChecksFIFO(
    partyChecks,
    state.invoices,
    state.paymentRules,
    state.settings.dayBasis
  );
  const byInvoice = new Map<string, FIFOSettlement[]>();
  settlements.forEach(item =>
    byInvoice.set(item.invoiceId, [
      ...(byInvoice.get(item.invoiceId) || []),
      item,
    ])
  );
  const now = new Date().toISOString();
  const invoices = state.invoices.map(invoice => {
    if (
      invoice.partyId !== check.partyId ||
      invoice.type !== "فروش" ||
      invoice.status === "باطل"
    )
      return invoice;
    const rows = byInvoice.get(invoice.id) || [];
    const paidAmount = principalCollectedForInvoice(invoice.amount, rows);
    return {
      ...invoice,
      paidAmount,
      allocations: rows.map(item => ({
        checkId: item.checkId,
        amount: item.amount,
        principalAmount: item.principalAmount,
        profit: item.profit,
        days: item.days,
        allocatedAt: now,
      })),
      status:
        paidAmount >= invoice.amount
          ? ("تسویه شده" as const)
          : paidAmount > 0
            ? ("تسویه جزئی" as const)
            : ("باز" as const),
    };
  });
  return { ...state, invoices };
}

export function rebuildCheckAllocations(state: AppState): AppState {
  const settlements = settleChecksFIFO(
    state.checks,
    state.invoices,
    state.paymentRules,
    state.settings.dayBasis
  );
  const byInvoice = new Map<string, FIFOSettlement[]>();
  settlements.forEach(item => {
    byInvoice.set(item.invoiceId, [
      ...(byInvoice.get(item.invoiceId) || []),
      item,
    ]);
  });
  const now = new Date().toISOString();
  const invoices = state.invoices.map(invoice => {
    if (invoice.type !== "فروش" || invoice.status === "باطل") return invoice;
    const rows = byInvoice.get(invoice.id) || [];
    const paidAmount = principalCollectedForInvoice(invoice.amount, rows);
    return {
      ...invoice,
      paidAmount,
      allocations: rows.map(item => ({
        checkId: item.checkId,
        amount: item.amount,
        principalAmount: item.principalAmount,
        profit: item.profit,
        days: item.days,
        allocatedAt: now,
      })),
      status:
        paidAmount >= invoice.amount
          ? ("تسویه شده" as const)
          : paidAmount > 0
            ? ("تسویه جزئی" as const)
            : ("باز" as const),
    };
  });
  return { ...state, invoices };
}

export function calculateLateProfit(
  check: Check,
  rule?: PaymentRule,
  invoiceDate?: string,
  invoiceBaseAmount = check.amount,
  dayBasisOverride: number | "شمسی" = 30
) {
  const days = jalaliDayDifference(
    invoiceDate || check.invoiceDate || check.receivedDate,
    check.dueDate
  );
  const activeRule = rule || {
    dayBasis: 30,
    graceDays: 0,
    tiers: [{ maxDays: 9999, rate: 0 }],
  };
  const overdueDays = Math.max(0, days - activeRule.graceDays);
  const tier =
    [...activeRule.tiers]
      .sort((a, b) => a.maxDays - b.maxDays)
      .find(item => overdueDays <= item.maxDays) ||
    activeRule.tiers[activeRule.tiers.length - 1];
  const rate = tier?.rate || 0;
  const basis =
    dayBasisOverride === "شمسی"
      ? jalaliMonthDayBasis(
          invoiceDate || check.invoiceDate || check.receivedDate
        )
      : Math.max(1, Number(dayBasisOverride) || activeRule.dayBasis || 30);
  const profit = invoiceBaseAmount * ((rate * overdueDays) / basis);
  const settled = invoiceBaseAmount + profit;
  const remaining = Math.max(0, settled - check.amount);
  const remainingBase = settled
    ? remaining / (1 + (rate * overdueDays) / basis)
    : 0;
  return {
    days,
    overdueDays,
    rate,
    base: invoiceBaseAmount,
    profit,
    settled,
    remaining,
    remainingBase,
  };
}

export function calculateMetrics(state: AppState) {
  const valid = state.transactions.filter(item => item.status !== "باطل");
  const sales = valid
    .filter(item => item.type === "فروش")
    .reduce((sum, item) => sum + item.amount, 0);
  const purchases = valid
    .filter(item => item.type === "خرید")
    .reduce((sum, item) => sum + item.amount, 0);
  const receipts = valid
    .filter(item => item.type === "دریافت" || item.type === "درآمد")
    .reduce((sum, item) => sum + item.amount, 0);
  const payments = valid
    .filter(item => ["پرداخت", "هزینه"].includes(item.type))
    .reduce((sum, item) => sum + item.amount, 0);
  const outstandingChecks = state.checks
    .filter(item => ["نزد ما", "تودیع شده"].includes(item.status))
    .reduce((sum, item) => sum + item.amount, 0);
  return {
    sales,
    purchases,
    receipts,
    payments,
    outstandingChecks,
    balance: receipts - payments,
  };
}

export const navItems: Array<{
  id: PageId;
  label: string;
  caption: string;
  icon: string;
}> = [
  {
    id: "dashboard",
    label: "نمای کلی",
    caption: "وضعیت امروز",
    icon: "layout-dashboard",
  },
  {
    id: "invoices",
    label: "فاکتورها",
    caption: "فروش و خرید",
    icon: "file-text",
  },
  {
    id: "transactions",
    label: "عملیات مالی",
    caption: "فروش و دریافت",
    icon: "arrow-left-right",
  },
  {
    id: "banks",
    label: "بانک‌ها و صندوق‌ها",
    caption: "موجودی و حساب‌ها",
    icon: "wallet-cards",
  },
  {
    id: "people",
    label: "طرف حساب‌ها",
    caption: "مشتری و تأمین‌کننده",
    icon: "users",
  },
  {
    id: "inventory",
    label: "انبار و کالا",
    caption: "موجودی و قیمت",
    icon: "boxes",
  },
  {
    id: "production",
    label: "تولید",
    caption: "فرمول و هزینه ساخت",
    icon: "boxes",
  },
  {
    id: "prices",
    label: "تاریخچه قیمت",
    caption: "قیمت‌های معتبر",
    icon: "tags",
  },
  {
    id: "paymentRules",
    label: "شرایط پرداخت",
    caption: "پله‌های سود",
    icon: "percent",
  },
  {
    id: "checks",
    label: "چک‌ها",
    caption: "سررسید و وضعیت",
    icon: "file-clock",
  },
  {
    id: "monthClose",
    label: "بستن ماه",
    caption: "تسویه و سود دیرکرد",
    icon: "lock-keyhole",
  },
  {
    id: "reports",
    label: "گزارش‌ها",
    caption: "خروجی و تحلیل",
    icon: "chart-no-axes-combined",
  },
  {
    id: "backup",
    label: "پشتیبان و بازیابی",
    caption: "امنیت و انتقال داده",
    icon: "cloud-cog",
  },
  {
    id: "settings",
    label: "تنظیمات برنامه",
    caption: "مشخصات کارگاه",
    icon: "settings",
  },
];

export { seedState };
