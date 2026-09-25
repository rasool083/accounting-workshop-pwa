import { isJalaliLeapYear, isValidJalaliDate, normalizeState, reconcileLedgerEvents } from "../client/src/lib/accounting";

const persianDigits = "۱۲۳۴۵۶۷۸۹۰";
const asciiOnlyParser = (value: string) => Number(value.replace(/[^0-9.-]/g, "")) || 0;
const base = normalizeState({
  settings: { businessName: "Probe", currency: "تومان", dayBasis: "شمسی", units: ["عدد"] },
  products: [{ id: "p", code: "P", name: "کالا", unit: "عدد", stock: 10, minStock: 0, price: 0 }],
  accounts: [{ id: "a", name: "بانک", type: "بانک", balance: 100 }],
  inventoryEvents: [{ id: "ie", at: "2026-01-01T00:00:00Z", date: "1404/10/11", kind: "opening_balance", productId: "p", quantityEntered: 10, unitEntered: "عدد", quantityBase: 10, baseUnit: "عدد", sourceType: "opening", note: "" }],
  cashEvents: [{ id: "ce", at: "2026-01-01T00:00:00Z", date: "1404/10/11", kind: "opening_balance", accountId: "a", amount: 100, currency: "تومان", sourceType: "opening", note: "" }],
});
const changedWithoutNewEvents = { ...base, products: base.products.map(p => ({ ...p, stock: p.stock + 1 })), accounts: base.accounts.map(a => ({ ...a, balance: a.balance + 1 })) };
const bridged = reconcileLedgerEvents(base, changedWithoutNewEvents);
const mixedUpdate = {
  ...changedWithoutNewEvents,
  inventoryEvents: [...base.inventoryEvents, { ...base.inventoryEvents[0], id: "new-explicit", productId: "p", quantityBase: 2, quantityEntered: 2, sourceType: "production" as const }],
  cashEvents: [...base.cashEvents, { ...base.cashEvents[0], id: "new-explicit-cash", accountId: "a", amount: 2, sourceType: "transaction" as const }],
};
const mixedResult = reconcileLedgerEvents(base, mixedUpdate);
const calendarMismatch = [] as Array<{ year: number; core: boolean; ui: boolean }>;
for (let year = 1200; year <= 1500; year++) {
  const core = isJalaliLeapYear(year);
  const ui = year % 4 === 3;
  if (core !== ui) calendarMismatch.push({ year, core, ui });
}
const result = {
  calendarMismatchCount: calendarMismatch.length,
  calendarExamples: calendarMismatch.slice(0, 6),
  coreRejects1404_12_30: !isValidJalaliDate(1404, 12, 30),
  persianNumberInput: "۱۲۳۴۵۶٫۷۸",
  asciiOnlyParserResult: asciiOnlyParser("۱۲۳۴۵۶٫۷۸"),
  legacyInventoryDeltaBridged: bridged.inventoryEvents.length - base.inventoryEvents.length,
  legacyCashDeltaBridged: bridged.cashEvents.length - base.cashEvents.length,
  mixedInventoryDeltaEvents: mixedResult.inventoryEvents.length - mixedUpdate.inventoryEvents.length,
  mixedCashDeltaEvents: mixedResult.cashEvents.length - mixedUpdate.cashEvents.length,
};
console.log(JSON.stringify(result, null, 2));
if (result.calendarMismatchCount === 0 || result.asciiOnlyParserResult !== 0 || result.legacyInventoryDeltaBridged !== 0 || result.legacyCashDeltaBridged !== 0) process.exitCode = 1;
