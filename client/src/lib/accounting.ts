export type PageId = "dashboard" | "transactions" | "people" | "inventory" | "prices" | "paymentRules" | "checks" | "reports" | "backup";

export type PersonType = "مشتری" | "تأمین‌کننده" | "شریک" | "کارگر" | "سایر";
export type TransactionType = "فروش" | "خرید" | "دریافت" | "پرداخت" | "هزینه" | "درآمد" | "اصلاحیه";
export type CheckStatus = "نزد ما" | "وصول شده" | "تودیع شده" | "برگشتی" | "باطل";

export interface Person {
  id: string;
  code: string;
  name: string;
  type: PersonType;
  phone: string;
  balance: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
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
    people: Array.isArray(source.people) ? source.people : [],
    products: Array.isArray(source.products) ? source.products : [],
    priceHistory: Array.isArray(source.priceHistory) ? source.priceHistory : [],
    paymentRules: Array.isArray(source.paymentRules) ? source.paymentRules : seedState.paymentRules,
    transactions: Array.isArray(source.transactions) ? source.transactions : [],
    checks: Array.isArray(source.checks) ? source.checks : [],
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
  { id: "transactions", label: "عملیات مالی", caption: "فروش و دریافت", icon: "arrow-left-right" },
  { id: "people", label: "طرف حساب‌ها", caption: "مشتری و تأمین‌کننده", icon: "users" },
  { id: "inventory", label: "انبار و کالا", caption: "موجودی و قیمت", icon: "boxes" },
  { id: "prices", label: "تاریخچه قیمت", caption: "قیمت‌های معتبر", icon: "tags" },
  { id: "paymentRules", label: "شرایط پرداخت", caption: "پله‌های سود", icon: "percent" },
  { id: "checks", label: "چک‌ها", caption: "سررسید و وضعیت", icon: "file-clock" },
  { id: "reports", label: "گزارش‌ها", caption: "خروجی و تحلیل", icon: "chart-no-axes-combined" },
  { id: "backup", label: "پشتیبان و تنظیمات", caption: "امنیت داده", icon: "cloud-cog" },
];

export { seedState };
