export type PageId = "dashboard" | "invoices" | "transactions" | "people" | "inventory" | "prices" | "paymentRules" | "checks" | "monthClose" | "reports" | "backup";

export type PersonType = "مشتری" | "تأمین‌کننده" | "شریک" | "کارگر" | "سایر";
export const PERSON_TYPES: PersonType[] = ["مشتری", "تأمین‌کننده", "شریک", "کارگر", "سایر"];
export const UNIT_OPTIONS = ["عدد", "کیلوگرم", "گرم", "تن", "متر", "سانتی‌متر", "مترمربع", "مترمکعب", "لیتر", "گالن", "کیسه", "بسته", "کارتن", "پالت", "حلقه", "شاخه", "دست", "سرویس", "دستگاه", "ساعت", "روز", "ماه", "سایر"] as const;
export type PriceScope = "عمومی" | "اختصاصی";

export interface Warehouse { id: string; name: string; note: string; }

export interface InvoiceItem { id: string; productId?: string; description: string; quantity: number; unit: string; unitPrice: number; total: number; }
export interface CheckAllocation { checkId: string; amount: number; allocatedAt: string; }
export interface Invoice {
  id: string; number: string; type: "فروش" | "خرید"; date: string; partyId?: string; paymentRuleId?: string; priceHistoryId?: string; items: InvoiceItem[]; allocations: CheckAllocation[]; amount: number; paidAmount: number; status: "باز" | "تسویه جزئی" | "تسویه شده" | "باطل"; note: string;
}

export type TransactionType = "فروش" | "خرید" | "دریافت" | "پرداخت" | "هزینه" | "درآمد" | "اصلاحیه";
export type CheckStatus = "نزد ما" | "وصول شده" | "تودیع شده" | "برگشتی" | "باطل";

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
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  partyId?: string;
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
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  settings: {
    businessName: string;
    currency: string;
    dayBasis: number;
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
}

const STORAGE_KEY = "accounting-workshop-pwa:v1";

const seedState: AppState = {
  schemaVersion: 1,
  revision: 1,
  updatedAt: new Date().toISOString(),
  settings: { businessName: "کارگاه من", currency: "ریال", dayBasis: 30 },
  people: [],
  products: [],
  warehouses: [{ id: "warehouse-production", name: "انبار محصولات تولید", note: "" }, { id: "warehouse-material", name: "انبار مواد اولیه", note: "" }, { id: "warehouse-trade", name: "انبار بازرگانی", note: "" }],
  invoices: [],
  priceHistory: [],
  paymentRules: [{ id: "cash-default", name: "نقدی و تسویه فوری", active: true, dayBasis: 30, graceDays: 0, tiers: [{ id: "tier-1", maxDays: 30, rate: 0, note: "بدون سود" }] }],
  transactions: [],
  checks: [],
  accounts: [
    { id: "cash", name: "صندوق اصلی", type: "صندوق", balance: 0 },
    { id: "bank", name: "حساب بانکی", type: "بانک", balance: 0 },
  ],
  audit: [],
};

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function normalizeState(input: unknown): AppState {
  const source = isRecord(input) ? input : {};
  return {
    ...seedState,
    ...source,
    schemaVersion: 1,
    revision: typeof source.revision === "number" ? source.revision : 1,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
    settings: { ...seedState.settings, ...(isRecord(source.settings) ? source.settings : {}) },
    people: Array.isArray(source.people) ? source.people.map((person) => ({ ...person, defaultPaymentRuleId: typeof person.defaultPaymentRuleId === "string" ? person.defaultPaymentRuleId : undefined, roles: Array.isArray(person.roles) && person.roles.length ? person.roles : [person.type || "مشتری"] })) : [],
    products: Array.isArray(source.products) ? source.products.map((product) => ({ ...product, unit2: product.unit2 || product.unit, conversionRate: Number(product.conversionRate) || 1 })) : [],
    warehouses: Array.isArray(source.warehouses) ? source.warehouses : seedState.warehouses,
    invoices: Array.isArray(source.invoices) ? source.invoices.map((invoice) => ({ ...invoice, items: Array.isArray(invoice.items) ? invoice.items : [], allocations: Array.isArray(invoice.allocations) ? invoice.allocations : [], paidAmount: Number(invoice.paidAmount) || 0 })) : [],
    priceHistory: Array.isArray(source.priceHistory) ? source.priceHistory : [],
    paymentRules: Array.isArray(source.paymentRules) ? source.paymentRules : seedState.paymentRules,
    transactions: Array.isArray(source.transactions) ? source.transactions : [],
    checks: Array.isArray(source.checks) ? source.checks.map((check) => ({ ...check, receivedDate: typeof check.receivedDate === "string" ? check.receivedDate : check.dueDate || "", invoiceDate: typeof check.invoiceDate === "string" ? check.invoiceDate : undefined, paymentRuleId: typeof check.paymentRuleId === "string" ? check.paymentRuleId : undefined })) : [],
    accounts: Array.isArray(source.accounts) ? source.accounts : seedState.accounts,
    audit: Array.isArray(source.audit) ? source.audit.slice(-500) : [],
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
  const next = normalizeState({ ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function formatMoney(value: number, currency = "ریال") {
  return `${new Intl.NumberFormat("fa-IR").format(Math.round(value || 0))} ${currency}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value || 0);
}

export function todayJalali() {
  const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return formatted.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)).replace(/-/g, "/")).replace(/-/g, "/");
}

export function formatDate(value: string) {
  if (!value) return "—";
  return value.replace(/-/g, "/");
}

export function personName(state: AppState, id?: string) {
  return state.people.find((person) => person.id === id)?.name || "بدون طرف حساب";
}

export function transactionLabel(type: TransactionType) {
  return { فروش: "فروش", خرید: "خرید", دریافت: "دریافت", پرداخت: "پرداخت", هزینه: "هزینه", درآمد: "درآمد", اصلاحیه: "اصلاحیه" }[type];
}

export function exportPayload(state: AppState) {
  return JSON.stringify({
    format: "accounting-workshop-backup",
    schemaVersion: state.schemaVersion,
    exportedAt: new Date().toISOString(),
    data: state,
  }, null, 2);
}

export function importPayload(text: string) {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error("ساختار فایل پشتیبان معتبر نیست");
  const data = "data" in parsed ? parsed.data : parsed;
  const normalized = normalizeState(data);
  if (!Array.isArray(normalized.people) || !Array.isArray(normalized.transactions)) throw new Error("فایل پشتیبان ناقص است");
  return normalized;
}

export function appendAudit(state: AppState, action: string, note: string): AppState {
  return {
    ...state,
    audit: [...state.audit, { id: createId("audit"), at: new Date().toISOString(), action, note }].slice(-500),
  };
}

export function jalaliDayDifference(from: string, to: string) {
  const parse = (value: string) => { const parts = value.replace(/-/g, "/").split("/").map(Number); return parts.length === 3 && parts.every(Number.isFinite) ? parts[0] * 372 + parts[1] * 31 + parts[2] : 0; };
  return Math.max(0, parse(to) - parse(from));
}

export function allocateCheckFIFO(check: Check, invoices: Invoice[]) {
  const alreadyAllocated = invoices.reduce((sum, invoice) => sum + invoice.allocations.filter((item) => item.checkId === check.id).reduce((a, item) => a + item.amount, 0), 0);
  let remaining = Math.max(0, check.amount - alreadyAllocated);
  return [...invoices].filter((invoice) => invoice.partyId === check.partyId && invoice.type === "فروش" && invoice.status !== "تسویه شده").sort((a, b) => a.date.localeCompare(b.date)).map((invoice) => { const allocation = Math.min(remaining, Math.max(0, invoice.amount - invoice.paidAmount)); remaining -= allocation; return { invoice, allocation, remainingAfter: remaining }; }).filter((item) => item.allocation > 0);
}

export function applyCheckFIFO(state: AppState, check: Check) {
  const allocations = allocateCheckFIFO(check, state.invoices);
  if (!allocations.length) return state;
  const invoices = state.invoices.map((invoice) => { const row = allocations.find((item) => item.invoice.id === invoice.id); if (!row) return invoice; const paidAmount = invoice.paidAmount + row.allocation; return { ...invoice, paidAmount, allocations: [...invoice.allocations, { checkId: check.id, amount: row.allocation, allocatedAt: new Date().toISOString() }], status: paidAmount >= invoice.amount ? "تسویه شده" as const : "تسویه جزئی" as const }; });
  return { ...state, invoices };
}

export function calculateLateProfit(check: Check, rule?: PaymentRule, invoiceDate?: string) {
  const days = jalaliDayDifference(invoiceDate || check.invoiceDate || check.receivedDate, check.dueDate);
  const activeRule = rule || { dayBasis: 30, graceDays: 0, tiers: [{ maxDays: 9999, rate: 0 }] };
  const overdueDays = Math.max(0, days - activeRule.graceDays);
  const tier = [...activeRule.tiers].sort((a, b) => a.maxDays - b.maxDays).find((item) => overdueDays <= item.maxDays) || activeRule.tiers[activeRule.tiers.length - 1];
  const profit = check.amount * ((tier?.rate || 0) * overdueDays / activeRule.dayBasis);
  return { days, overdueDays, profit, settled: check.amount + profit, remaining: Math.max(0, check.amount - check.amount) };
}

export function calculateMetrics(state: AppState) {
  const valid = state.transactions.filter((item) => item.status !== "باطل");
  const sales = valid.filter((item) => item.type === "فروش").reduce((sum, item) => sum + item.amount, 0);
  const purchases = valid.filter((item) => item.type === "خرید").reduce((sum, item) => sum + item.amount, 0);
  const receipts = valid.filter((item) => item.type === "دریافت" || item.type === "درآمد").reduce((sum, item) => sum + item.amount, 0);
  const payments = valid.filter((item) => ["پرداخت", "هزینه"].includes(item.type)).reduce((sum, item) => sum + item.amount, 0);
  const outstandingChecks = state.checks.filter((item) => ["نزد ما", "تودیع شده"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
  return { sales, purchases, receipts, payments, outstandingChecks, balance: receipts - payments };
}

export const navItems: Array<{ id: PageId; label: string; caption: string; icon: string }> = [
  { id: "dashboard", label: "نمای کلی", caption: "وضعیت امروز", icon: "layout-dashboard" },
  { id: "invoices", label: "فاکتورها", caption: "فروش و خرید", icon: "file-text" },
  { id: "transactions", label: "عملیات مالی", caption: "فروش و دریافت", icon: "arrow-left-right" },
  { id: "people", label: "طرف حساب‌ها", caption: "مشتری و تأمین‌کننده", icon: "users" },
  { id: "inventory", label: "انبار و کالا", caption: "موجودی و قیمت", icon: "boxes" },
  { id: "prices", label: "تاریخچه قیمت", caption: "قیمت‌های معتبر", icon: "tags" },
  { id: "paymentRules", label: "شرایط پرداخت", caption: "پله‌های سود", icon: "percent" },
  { id: "checks", label: "چک‌ها", caption: "سررسید و وضعیت", icon: "file-clock" },
  { id: "monthClose", label: "بستن ماه", caption: "تسویه و سود دیرکرد", icon: "lock-keyhole" },
  { id: "reports", label: "گزارش‌ها", caption: "خروجی و تحلیل", icon: "chart-no-axes-combined" },
  { id: "backup", label: "پشتیبان و تنظیمات", caption: "امنیت داده", icon: "cloud-cog" },
];

export { seedState };
