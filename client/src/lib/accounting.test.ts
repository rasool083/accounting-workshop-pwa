import { describe, expect, it } from "vitest";
import {
  getSettlementBalances,
  executeProduction,
  quantityInBase,
  rebuildCheckAllocations,
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
});

describe("production execution", () => {
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
});
