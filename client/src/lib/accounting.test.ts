import { describe, expect, it } from "vitest";
import {
  getSettlementBalances,
  adjustInventoryBalance,
  executeProduction,
  normalizeState,
  reconcileLedgerEvents,
  inventoryLedgerDiscrepancies,
  cashLedgerDiscrepancies,
  rebuildCashProjection,
  rebuildInventoryProjection,
  isJalaliLeapYear,
  isValidJalaliDate,
  jalaliDayDifference,
  jalaliMonthDayBasis,
  quantityInBase,
  rebuildCheckAllocations,
  removeProductionRun,
  settleChecksFIFO,
  unitConversionToBase,
} from "./accounting";

describe("unit conversion", () => {
  const massProduct = {
    id: "p",
    code: "P",
    name: "ماده",
    unit: "کیلوگرم",
    unit2: "گرم",
    conversionRate: 1000,
    stock: 0,
    minStock: 0,
    price: 100,
  };

  it("converts grams to kilograms", () => {
    expect(unitConversionToBase(massProduct, "گرم")).toBeCloseTo(0.001);
    expect(quantityInBase(massProduct, 360, "گرم")).toBeCloseTo(0.36);
  });

  it("uses the configured ratio for a carton", () => {
    const product = {
      ...massProduct,
      unit: "عدد",
      unit2: "کارتن",
      conversionRate: 36,
    };
    expect(quantityInBase(product, 10, "کارتن")).toBe(360);
  });
});

describe("FIFO settlement balances", () => {
  it("shows the staged invoice and check balances from the two-check example", () => {
    const invoice = {
      id: "invoice-1",
      number: "1",
      type: "فروش" as const,
      date: "1405/01/04",
      partyId: "party-1",
      paymentRuleId: "rule-1",
      items: [],
      allocations: [],
      amount: 100_000_000,
      paidAmount: 0,
      status: "باز" as const,
      note: "",
    };
    const checks = [
      {
        id: "check-1",
        number: "1",
        partyId: "party-1",
        receivedDate: "1405/01/04",
        dueDate: "1405/02/18",
        amount: 80_000_000,
        status: "نزد ما" as const,
        bank: "",
      },
      {
        id: "check-2",
        number: "2",
        partyId: "party-1",
        receivedDate: "1405/01/04",
        dueDate: "1405/03/02",
        amount: 50_000_000,
        status: "نزد ما" as const,
        bank: "",
      },
    ];
    const rule = {
      id: "rule-1",
      name: "شش درصد بعد از یک ماه",
      active: true,
      dayBasis: 30,
      graceDays: 0,
      tiers: [{ id: "tier-1", maxDays: 9999, rate: 0.06, note: "" }],
    };
    const settlements = settleChecksFIFO(checks, [invoice], [rule], 30);
    const balances = getSettlementBalances(settlements, checks, [invoice]);
    const first = balances.get("check-1:invoice-1")!;
    const second = balances.get("check-2:invoice-1")!;

    expect(first.remainingCheck).toBeCloseTo(0, 2);
    expect(first.remainingInvoice).toBeCloseTo(26_605_504.59, 2);
    expect(second.remainingCheck).toBeCloseTo(20_201_834.86, 2);
    expect(second.remainingInvoice).toBeCloseTo(0, 2);
  });

  it("does not stop on floating-point residue after fully settling invoice 1010", () => {
    const partyId = "person-z006";
    const invoice1010 = {
      id: "invoice-1010",
      number: "1010",
      type: "فروش" as const,
      date: "1405/06/07",
      partyId,
      paymentRuleId: "rule-z006",
      items: [],
      allocations: [],
      amount: 162_000_000,
      paidAmount: 0,
      status: "باز" as const,
      note: "",
    };
    const invoice1011 = {
      ...invoice1010,
      id: "invoice-1011",
      number: "1011",
      amount: 201_600_000,
      date: "1405/06/07",
    };
    const check = {
      id: "check-z006",
      number: "Z006",
      partyId,
      receivedDate: "1405/06/26",
      dueDate: "1405/08/30",
      amount: 350_000_000,
      status: "نزد ما" as const,
      bank: "حساب بانکی",
    };
    const rule = {
      id: "rule-z006",
      name: "St1",
      active: true,
      dayBasis: 30,
      graceDays: 0,
      tiers: [
        { id: "no-profit", maxDays: 30, rate: 0, note: "" },
        { id: "six-percent", maxDays: 365, rate: 0.06, note: "" },
      ],
    };

    const settlements = settleChecksFIFO(
      [check],
      [invoice1010, invoice1011],
      [rule],
      30
    );
    const first = settlements.find(item => item.invoiceId === invoice1010.id)!;
    const second = settlements.find(item => item.invoiceId === invoice1011.id);

    expect(first.principalAmount).toBe(invoice1010.amount);
    expect(second).toBeDefined();
    expect(second?.amount).toBeGreaterThan(0);

    const rebuilt = rebuildCheckAllocations({
      invoices: [invoice1010, invoice1011],
      checks: [check],
      paymentRules: [rule],
      settings: { dayBasis: 30 },
    } as any);
    expect(rebuilt.invoices.find(item => item.id === invoice1010.id)?.status).toBe(
      "تسویه شده"
    );
    expect(rebuilt.invoices.find(item => item.id === invoice1011.id)?.status).toBe(
      "تسویه جزئی"
    );
  });

  it("does not allocate a customer check after it is spent", () => {
    const invoice = {
      id: "purchase-check-invoice", number: "P-1", type: "فروش" as const,
      date: "1405/01/01", partyId: "customer", items: [], allocations: [],
      amount: 1000, paidAmount: 0, status: "باز" as const, note: "",
    };
    const spentCheck = {
      id: "spent-customer-check", number: "C-1", partyId: "customer",
      receivedDate: "1405/01/01", dueDate: "1405/02/01", amount: 1000,
      status: "خرج شده" as const, bank: "", returnPartyId: "supplier",
    };
    expect(settleChecksFIFO([spentCheck], [invoice])).toEqual([]);
  });
});

describe("Jalali calendar", () => {
  it("uses calendar month lengths for day differences", () => {
    expect(jalaliDayDifference("1405/01/01", "1405/02/15")).toBe(45);
    expect(jalaliDayDifference("1405/06/31", "1405/07/01")).toBe(1);
    expect(jalaliDayDifference("1405/07/30", "1405/08/01")).toBe(1);
  });

  it("handles leap-year Esfand and rejects invalid dates", () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isValidJalaliDate(1403, 12, 30)).toBe(true);
    expect(jalaliDayDifference("1403/12/30", "1404/01/01")).toBe(1);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(isValidJalaliDate(1404, 12, 30)).toBe(false);
    expect(jalaliDayDifference("1404/12/30", "1405/01/01")).toBe(0);
    expect(jalaliMonthDayBasis("1404/12/29")).toBe(29);
  });

  it("does not create a reverse or invalid elapsed period", () => {
    expect(jalaliDayDifference("1405/02/01", "1405/01/31")).toBe(0);
    expect(jalaliDayDifference("not-a-date", "1405/01/01")).toBe(0);
    expect(isValidJalaliDate(1405, 13, 1)).toBe(false);
  });
});

describe("production execution", () => {
  it("records unit cost per base output unit", () => {
    const raw = {
      id: "base-cost-raw", code: "BCR", name: "ماده پایه", unit: "گرم", unit2: "گرم",
      conversionRate: 1, stock: 1000, minStock: 0, price: 1, category: "مواد اولیه" as const,
    };
    const output = {
      id: "base-cost-output", code: "BCO", name: "محصول کیلوگرمی", unit: "کیلوگرم", unit2: "گرم",
      conversionRate: 1000, stock: 0, minStock: 0, price: 0, category: "محصول تولیدی" as const,
    };
    const formula = {
      id: "base-cost-formula", name: "فرمول پایه", formulaType: "قطعه" as const,
      outputProductId: output.id, outputName: output.name, outputQuantity: 1, outputUnit: "کیلوگرم",
      materials: [{ id: "base-cost-line", productId: raw.id, quantity: 100, unit: "گرم" }],
      costs: [], note: "",
    };
    const state = {
      schemaVersion: 2, revision: 1, updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "کیلوگرم"] },
      people: [], products: [raw, output], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [formula], productionRecords: [],
    };
    const record = executeProduction(state, formula.id, 500, "گرم").state.productionRecords[0];
    expect(record.outputQuantityBase).toBeCloseTo(0.5);
    expect(record.unitCost).toBeCloseTo(100);
  });

  it("uses the independent package price instead of package ingredient cost", () => {
    const raw = {
      id: "priced-raw", code: "PR", name: "ماده بسته", unit: "گرم", unit2: "گرم",
      conversionRate: 1, stock: 0, minStock: 0, price: 2, category: "مواد اولیه" as const,
    };
    const pack = {
      id: "priced-pack", code: "PP", name: "بسته قیمت‌گذاری‌شده", unit: "بسته", unit2: "بسته",
      conversionRate: 1, stock: 1, minStock: 0, price: 50, category: "بسته تولید" as const,
    };
    const output = {
      id: "priced-output", code: "PO", name: "محصول با بسته", unit: "عدد", unit2: "عدد",
      conversionRate: 1, stock: 0, minStock: 0, price: 0, category: "محصول تولیدی" as const,
    };
    const formula = {
      id: "priced-formula", name: "محصول با بسته", formulaType: "قطعه" as const,
      outputProductId: output.id, outputName: output.name, outputQuantity: 1, outputUnit: "عدد",
      materials: [{ id: "priced-line", productId: pack.id, quantity: 1, unit: "بسته" }],
      costs: [], note: "",
    };
    const state = {
      schemaVersion: 2, revision: 1, updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "بسته", "عدد"] },
      people: [], products: [raw, pack, output], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [formula], productionRecords: [],
    };
    const result = executeProduction(state, formula.id, 1, "عدد", "1405/07/01");
    expect(result.state.productionRecords[0].materialCost).toBe(50);
    expect(result.state.products.find(item => item.id === pack.id)?.stock).toBe(0);
  });

  it("allows production to leave a missing raw material stock negative", () => {
    const raw = {
      id: "negative-raw", code: "NR", name: "ماده کسری", unit: "گرم", unit2: "گرم",
      conversionRate: 1, stock: 0, minStock: 0, price: 2, category: "مواد اولیه" as const,
    };
    const output = {
      id: "negative-output", code: "NO", name: "محصول کسری", unit: "عدد", unit2: "عدد",
      conversionRate: 1, stock: 0, minStock: 0, price: 0, category: "محصول تولیدی" as const,
    };
    const formula = {
      id: "negative-formula", name: "فرمول کسری", formulaType: "قطعه" as const,
      outputProductId: output.id, outputName: output.name, outputQuantity: 1, outputUnit: "عدد",
      materials: [{ id: "negative-line", productId: raw.id, quantity: 10, unit: "گرم" }],
      costs: [], note: "",
    };
    const state = {
      schemaVersion: 2, revision: 1, updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "عدد"] },
      people: [], products: [raw, output], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [formula], productionRecords: [],
    };
    const result = executeProduction(state, formula.id, 1, "عدد");
    expect(result.state.products.find(item => item.id === raw.id)?.stock).toBe(-10);
  });

  it("applies inventory balance in the selected unit without financial transactions", () => {
    const product = {
      id: "balance-product", code: "BP", name: "ماده بالانس", unit: "کیلوگرم", unit2: "گرم",
      conversionRate: 1000, stock: 100, minStock: 0, price: 20, category: "مواد اولیه" as const,
    };
    const state = {
      schemaVersion: 2, revision: 1, updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "کیلوگرم"] },
      people: [], products: [product], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [], productionRecords: [],
    };
    const balanced = adjustInventoryBalance(state, product.id, 1.5, "کیلوگرم", "شمارش انبار");
    const reduced = adjustInventoryBalance(balanced, product.id, -500, "گرم", "اصلاح شمارش");
    expect(reduced.products[0].stock).toBeCloseTo(101);
    expect(reduced.transactions).toHaveLength(0);
    expect(reduced.audit.at(-1)?.action).toBe("STOCK_ADJUSTMENT");
  });

  it("removes a production batch and reverses actual material and output stock", () => {
    const raw = {
      id: "delete-raw", code: "DR", name: "ماده حذف", unit: "گرم", unit2: "گرم",
      conversionRate: 1, stock: 1000, minStock: 0, price: 2, category: "مواد اولیه" as const,
    };
    const output = {
      id: "delete-output", code: "DO", name: "محصول حذف", unit: "عدد", unit2: "عدد",
      conversionRate: 1, stock: 0, minStock: 0, price: 500, category: "محصول تولیدی" as const,
    };
    const formula = {
      id: "delete-formula", name: "فرمول حذف", formulaType: "قطعه" as const,
      outputProductId: output.id, outputName: output.name, outputQuantity: 1, outputUnit: "عدد",
      standardPieceWeight: 100, standardPieceWeightUnit: "گرم",
      materials: [{ id: "delete-line", productId: raw.id, quantity: 100, unit: "گرم" }],
      costs: [], note: "",
    };
    const state = {
      schemaVersion: 2, revision: 1, updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "عدد"] },
      people: [], products: [raw, output], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [formula], productionRecords: [],
    };
    const produced = executeProduction(state, formula.id, 2, "عدد", "1405/07/01", {
      batchNumber: "B-DELETE", pieceWeight: 100, pieceWeightUnit: "گرم",
    }).state;
    const restored = removeProductionRun(produced, produced.productionRecords[0].id);
    expect(restored.products.find(item => item.id === raw.id)?.stock).toBeCloseTo(1000, 6);
    expect(restored.products.find(item => item.id === output.id)?.stock).toBeCloseTo(0, 6);
    expect(restored.productionRecords).toHaveLength(0);
  });

  it("keeps a production row self-contained after its formula engine is removed", () => {
    const raw = {
      id: "snapshot-raw", code: "SR", name: "ماده snapshot", unit: "گرم", unit2: "گرم",
      conversionRate: 1, stock: 1000, minStock: 0, price: 1, category: "مواد اولیه" as const,
    };
    const output = {
      id: "snapshot-output", code: "SO", name: "محصول snapshot", unit: "عدد", unit2: "عدد",
      conversionRate: 1, stock: 0, minStock: 0, price: 200, category: "محصول تولیدی" as const,
    };
    const formula = {
      id: "snapshot-formula", name: "موتور موقت", formulaType: "قطعه" as const,
      outputProductId: output.id, outputName: output.name, outputQuantity: 1, outputUnit: "عدد",
      materials: [{ id: "snapshot-line", productId: raw.id, quantity: 100, unit: "گرم" }],
      costs: [], note: "",
    };
    const state = {
      schemaVersion: 2, revision: 1, updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "عدد"] },
      people: [], products: [raw, output], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [formula], productionRecords: [],
    };
    const produced = executeProduction(state, formula.id, 1, "عدد", "1405/07/01", {
      batchNumber: "B-SNAPSHOT",
    }).state;
    const engineRemoved = {
      ...produced,
      productionFormulas: [],
    };
    expect(engineRemoved.productionRecords[0].formulaSnapshot?.name).toBe("موتور موقت");
    const restored = removeProductionRun(engineRemoved, engineRemoved.productionRecords[0].id);
    expect(restored.products.find(item => item.id === raw.id)?.stock).toBeCloseTo(1000, 6);
    expect(restored.products.find(item => item.id === output.id)?.stock).toBeCloseTo(0, 6);
  });

  it("scales material usage by actual piece weight and records batch adjustments", () => {
    const raw = {
      id: "weighted-raw",
      code: "WR",
      name: "پودر تست",
      unit: "گرم",
      unit2: "گرم",
      conversionRate: 1,
      stock: 10_000,
      minStock: 0,
      price: 2,
      category: "مواد اولیه" as const,
    };
    const output = {
      id: "weighted-output",
      code: "WO",
      name: "لقمه تست",
      unit: "عدد",
      unit2: "کارتن",
      conversionRate: 36,
      stock: 0,
      minStock: 0,
      price: 999_000,
      category: "محصول تولیدی" as const,
    };
    const formula = {
      id: "weighted-formula",
      name: "لقمه ۴۰۰ گرمی",
      formulaType: "قطعه" as const,
      outputProductId: output.id,
      outputName: output.name,
      outputQuantity: 1,
      outputUnit: "عدد",
      standardPieceWeight: 400,
      standardPieceWeightUnit: "گرم",
      materials: [
        { id: "weighted-line", productId: raw.id, quantity: 400, unit: "گرم" },
      ],
      costs: [],
      note: "",
    };
    const state = {
      schemaVersion: 2,
      revision: 1,
      updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "عدد"] },
      people: [], products: [raw, output], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [formula], productionRecords: [],
    };
    const result = executeProduction(state, formula.id, 10, "عدد", "1405/07/01", {
      batchNumber: "B-001",
      pieceWeight: 430,
      pieceWeightUnit: "گرم",
      wastePercent: 10,
      materialAdjustments: { "weighted-line": 5 },
      note: "خشک‌کردن بیشتر پودر",
    });
    const updatedRaw = result.state.products.find(item => item.id === raw.id)!;
    const updatedOutput = result.state.products.find(item => item.id === output.id)!;
    const record = result.state.productionRecords[0];

    expect(updatedRaw.stock).toBeCloseTo(5_265, 6);
    expect(updatedOutput.stock).toBe(10);
    expect(updatedOutput.price).toBe(999_000);
    expect(record.batchNumber).toBe("B-001");
    expect(record.pieceWeight).toBe(430);
    expect(record.wastePercent).toBe(10);
    expect(record.materialUsage?.[0].plannedQuantity).toBeCloseTo(4300, 6);
    expect(record.materialUsage?.[0].adjustmentQuantity).toBe(5);
    expect(record.materialUsage?.[0].actualQuantity).toBeCloseTo(4735, 6);
  });

  it("produces nested packages and converts decimal quantities to base stock", () => {
    const raw = {
      id: "raw",
      code: "R",
      name: "ماده",
      unit: "گرم",
      unit2: "گرم",
      conversionRate: 1,
      stock: 1000,
      minStock: 0,
      price: 2,
      category: "مواد اولیه" as const,
    };
    const pack = {
      id: "pack",
      code: "P",
      name: "بسته نیمه‌آماده",
      unit: "بسته",
      unit2: "بسته",
      conversionRate: 1,
      stock: 0,
      minStock: 0,
      price: 0,
      category: "بسته تولید" as const,
    };
    const output = {
      id: "output",
      code: "O",
      name: "محصول نهایی",
      unit: "عدد",
      unit2: "عدد",
      conversionRate: 1,
      stock: 0,
      minStock: 0,
      price: 0,
      category: "محصول تولیدی" as const,
    };
    const state = {
      schemaVersion: 2,
      revision: 1,
      updatedAt: "1405/01/01",
      settings: {
        businessName: "آزمون",
        currency: "تومان",
        dayBasis: 30 as const,
        units: ["گرم", "بسته", "عدد"],
      },
      people: [], products: [raw, pack, output], warehouses: [], invoices: [],
      priceHistory: [], paymentRules: [], transactions: [], checks: [],
      accounts: [], audit: [],
      productionFormulas: [
        {
          id: "pack-formula", name: "بسته", formulaType: "بسته تولید" as const,
          outputProductId: "pack", outputName: "بسته نیمه‌آماده", outputQuantity: 1,
          outputUnit: "بسته", materials: [{ id: "pm", productId: "raw", quantity: 100, unit: "گرم" }],
          costs: [], note: "",
        },
        {
          id: "output-formula", name: "محصول", formulaType: "قطعه" as const,
          outputProductId: "output", outputName: "محصول نهایی", outputQuantity: 1,
          outputUnit: "عدد", materials: [{ id: "om", productId: "pack", quantity: 2, unit: "بسته" }],
          costs: [], note: "",
        },
      ],
      productionRecords: [],
    };
    const result = executeProduction(state, "output-formula", 1, "عدد");
    expect(result.state.products.find(product => product.id === "raw")?.stock).toBe(800);
    expect(result.state.products.find(product => product.id === "pack")?.stock).toBe(0);
    expect(result.state.products.find(product => product.id === "output")?.stock).toBe(1);
    expect(result.state.productionRecords).toHaveLength(2);
  });

  it("always consumes packages while package ticks only control weight inclusion", () => {
    const makeProduct = (id: string, name: string, unit: string, stock: number, category: "مواد اولیه" | "بسته تولید" | "محصول تولیدی", conversionRate = 1) => ({
      id, code: id, name, unit, unit2: unit, conversionRate, stock, minStock: 0, price: 1, category,
    });
    const x = makeProduct("x", "X", "گرم", 100000, "مواد اولیه");
    const y = makeProduct("y", "Y", "گرم", 100000, "مواد اولیه");
    const aRaw = makeProduct("a-raw", "ماده بسته الف", "گرم", 100000, "مواد اولیه");
    const bRaw = makeProduct("b-raw", "ماده بسته ب", "عدد", 100000, "مواد اولیه");
    const packA = makeProduct("pack-a", "بسته الف", "گرم", 0, "بسته تولید");
    const packB = makeProduct("pack-b", "بسته ب", "عدد", 0, "بسته تولید");
    const output = {
      ...makeProduct("piece", "قطعه A", "عدد", 0, "محصول تولیدی", 36),
      unit2: "کارتن",
    };
    const formulaA = {
      id: "formula-a", name: "فرمول A", formulaType: "قطعه" as const,
      outputProductId: output.id, outputName: output.name, outputQuantity: 1, outputUnit: "عدد",
      materials: [
        { id: "x-line", productId: x.id, quantity: 2, unit: "گرم" },
        { id: "y-line", productId: y.id, quantity: 3, unit: "گرم" },
        { id: "a-line", productId: packA.id, quantity: 5, unit: "گرم" },
        { id: "b-line", productId: packB.id, quantity: 1, unit: "عدد" },
      ], costs: [], note: "",
    };
    const formulaAEngine = {
      id: "formula-pack-a", name: "موتور بسته الف", formulaType: "بسته تولید" as const,
      outputProductId: packA.id, outputName: packA.name, outputQuantity: 5, outputUnit: "گرم",
      materials: [{ id: "a-raw-line", productId: aRaw.id, quantity: 5, unit: "گرم" }], costs: [], note: "",
    };
    const formulaBEngine = {
      id: "formula-pack-b", name: "موتور بسته ب", formulaType: "بسته تولید" as const,
      outputProductId: packB.id, outputName: packB.name, outputQuantity: 1, outputUnit: "عدد",
      materials: [{ id: "b-raw-line", productId: bRaw.id, quantity: 1, unit: "عدد" }], costs: [], note: "",
    };
    const state = {
      schemaVersion: 2, revision: 1, updatedAt: "1405/01/01",
      settings: { businessName: "آزمون", currency: "تومان", dayBasis: 30 as const, units: ["گرم", "عدد", "کارتن"] },
      people: [], products: [x, y, aRaw, bRaw, packA, packB, output], warehouses: [], invoices: [], priceHistory: [],
      paymentRules: [], transactions: [], checks: [], accounts: [], audit: [],
      productionFormulas: [formulaA, formulaAEngine, formulaBEngine], productionRecords: [],
    };
    const result = executeProduction(state, formulaA.id, 11, "کارتن", "1405/07/01", {
      batchNumber: "B-430-11C", pieceWeight: 430, pieceWeightUnit: "گرم", excludedMaterialIds: ["b-line"],
    });
    const stocks = new Map(result.state.products.map(product => [product.id, product.stock]));
    expect(stocks.get(x.id)).toBeCloseTo(100000 - 11 * 36 * 2 * 43, 6);
    expect(stocks.get(y.id)).toBeCloseTo(100000 - 11 * 36 * 3 * 43, 6);
    expect(stocks.get(aRaw.id)).toBeCloseTo(100000 - 11 * 36 * 5 * 43, 6);
    expect(stocks.get(bRaw.id)).toBe(100000 - 396);
    expect(stocks.get(packB.id)).toBe(0);
    expect(stocks.get(output.id)).toBe(396);
    const mainRecord = result.state.productionRecords.find(record => record.formulaId === formulaA.id)!;
    expect(mainRecord.excludedMaterialIds).toEqual(["b-line"]);
    expect(mainRecord.pieceWeight).toBe(430);
  });
});

describe("event ledger projections", () => {
  it("migrates legacy stock and account balances into opening events", () => {
    const legacy = normalizeState({
      schemaVersion: 2,
      products: [{ id: "p", name: "کالا", code: "P", unit: "عدد", stock: 12, price: 0 }],
      accounts: [{ id: "cash", name: "صندوق", type: "صندوق", balance: 500 }],
    });
    expect(legacy.schemaVersion).toBe(3);
    expect(legacy.inventoryEvents).toHaveLength(1);
    expect(legacy.inventoryEvents[0].quantityBase).toBe(12);
    expect(legacy.cashEvents).toHaveLength(1);
    expect(legacy.cashEvents[0].amount).toBe(500);
    expect(rebuildInventoryProjection(legacy).products[0].stock).toBe(12);
    expect(rebuildCashProjection(legacy).accounts[0].balance).toBe(500);
  });

  it("records production input and output events that rebuild stock", () => {
    const raw = {
      id: "ledger-raw", code: "LR", name: "ماده", unit: "گرم", unit2: "گرم",
      conversionRate: 1, stock: 100, minStock: 0, price: 2, category: "مواد اولیه" as const,
    };
    const output = {
      id: "ledger-output", code: "LO", name: "محصول", unit: "عدد", unit2: "عدد",
      conversionRate: 1, stock: 0, minStock: 0, price: 0, category: "محصول تولیدی" as const,
    };
    const state = normalizeState({
      schemaVersion: 3, products: [raw, output], accounts: [], warehouses: [],
      productionFormulas: [{
        id: "ledger-formula", name: "فرمول", outputProductId: output.id,
        outputQuantity: 1, outputUnit: "عدد", materials: [{ id: "line", productId: raw.id, quantity: 10, unit: "گرم" }],
        costs: [], note: "",
      }], productionRecords: [],
    });
    const result = executeProduction(state, "ledger-formula", 3, "عدد", "1405/01/01");
    expect(result.state.inventoryEvents.filter(event => event.sourceType === "production")).toHaveLength(2);
    const rebuilt = rebuildInventoryProjection({ ...result.state, products: result.state.products.map(product => ({ ...product, stock: 0 })) });
    expect(rebuilt.products.find(product => product.id === raw.id)?.stock).toBe(70);
    expect(rebuilt.products.find(product => product.id === output.id)?.stock).toBe(3);
  });

  it("bridges a legacy stock and cash mutation exactly once", () => {
    const previous = normalizeState({
      products: [{ id: "p", name: "کالا", code: "P", unit: "عدد", stock: 10, price: 0 }],
      accounts: [{ id: "cash", name: "صندوق", type: "صندوق", balance: 100 }],
    });
    const next = { ...previous,
      products: previous.products.map(product => ({ ...product, stock: 7 })),
      accounts: previous.accounts.map(account => ({ ...account, balance: 130 })),
    };
    const bridged = reconcileLedgerEvents(previous, next);
    expect(bridged.inventoryEvents.at(-1)?.quantityBase).toBe(-3);
    expect(bridged.cashEvents.at(-1)?.amount).toBe(30);
    expect(rebuildInventoryProjection(bridged).products[0].stock).toBe(7);
    expect(rebuildCashProjection(bridged).accounts[0].balance).toBe(130);
  });

  it("reports a stock projection mismatch instead of hiding it", () => {
    const state = normalizeState({
      products: [{ id: "p", name: "کالا", code: "P", unit: "عدد", stock: 10, price: 0 }],
      accounts: [],
    });
    const altered = {
      ...state,
      products: state.products.map(product => ({ ...product, stock: 12 })),
    };
    expect(inventoryLedgerDiscrepancies(altered)).toEqual([
      expect.objectContaining({ id: "p", recorded: 12, projected: 10, difference: 2 }),
    ]);
  });

  it("classifies a new purchase as inventory purchase and cash payment", () => {
    const previous = normalizeState({
      products: [{ id: "p", name: "کالا", code: "P", unit: "عدد", stock: 10, price: 0 }],
      accounts: [{ id: "cash", name: "صندوق", type: "صندوق", balance: 100 }],
    });
    const transaction = {
      id: "tx-purchase", type: "خرید کالا" as const, date: "1405/07/01",
      productId: "p", warehouseId: "w", quantity: 2, unit: "عدد",
      accountId: "cash", partyId: "person", amount: 50,
      status: "ثبت شده" as const, note: "خرید آزمایشی",
    };
    const next = {
      ...previous,
      products: previous.products.map(product => ({ ...product, stock: 12 })),
      accounts: previous.accounts.map(account => ({ ...account, balance: 50 })),
      transactions: [transaction],
    };
    const reconciled = reconcileLedgerEvents(previous, next);
    expect(reconciled.inventoryEvents.at(-1)?.kind).toBe("purchase");
    expect(reconciled.cashEvents.at(-1)?.kind).toBe("payment");
    expect(reconciled.cashEvents.at(-1)?.amount).toBe(-50);
    expect(rebuildInventoryProjection(reconciled).products[0].stock).toBe(12);
    expect(rebuildCashProjection(reconciled).accounts[0].balance).toBe(50);
    expect(inventoryLedgerDiscrepancies(reconciled)).toHaveLength(0);
    expect(cashLedgerDiscrepancies(reconciled)).toHaveLength(0);
  });

  it("records check receipt and reverses it on return", () => {
    const previous = normalizeState({
      accounts: [{ id: "bank", name: "بانک", type: "بانک", balance: 0 }],
      checks: [{
        id: "check-1", number: "۱", partyId: "person", receivedDate: "1405/07/01",
        dueDate: "1405/07/30", amount: 100, status: "نزد ما", bank: "بانک",
      }],
    });
    const received = {
      ...previous,
      accounts: previous.accounts.map(account => ({ ...account, balance: 100 })),
      checks: previous.checks.map(check => ({ ...check, status: "وصول شده" as const, bankAccountId: "bank" })),
    };
    const cleared = reconcileLedgerEvents(previous, received);
    expect(cleared.cashEvents.at(-1)).toEqual(expect.objectContaining({ kind: "check_receipt", amount: 100, accountId: "bank" }));
    expect(rebuildCashProjection(cleared).accounts[0].balance).toBe(100);
    const returned = {
      ...cleared,
      accounts: cleared.accounts.map(account => ({ ...account, balance: 0 })),
      checks: cleared.checks.map(check => ({ ...check, status: "برگشتی" as const })),
    };
    const reversed = reconcileLedgerEvents(cleared, returned);
    expect(reversed.cashEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "reversal", amount: -100, accountId: "bank" }),
      expect.objectContaining({ kind: "check_return", amount: 0, accountId: "bank" }),
    ]));
    expect(rebuildCashProjection(reversed).accounts[0].balance).toBe(0);
  });
});
