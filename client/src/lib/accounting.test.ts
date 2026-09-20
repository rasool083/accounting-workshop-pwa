import { describe, expect, it } from "vitest";
import { quantityInBase, unitConversionToBase } from "./accounting";

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
