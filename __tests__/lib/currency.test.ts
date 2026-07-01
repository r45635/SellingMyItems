import { describe, it, expect } from "vitest";
import {
  convertApprox,
  defaultCurrencyForCountry,
  localeToCurrency,
  isCurrencyCode,
} from "@/lib/currency";

describe("convertApprox", () => {
  it("USD→USD returns same amount", () => {
    expect(convertApprox(100, "USD", "USD")).toBe(100);
  });

  it("USD→EUR converts using hardcoded rate", () => {
    expect(convertApprox(100, "USD", "EUR")).toBe(92);
  });

  it("EUR→USD converts", () => {
    expect(convertApprox(100, "EUR", "USD")).toBe(109);
  });

  it("rounds to integer", () => {
    expect(Number.isInteger(convertApprox(99, "USD", "EUR"))).toBe(true);
  });
});

describe("defaultCurrencyForCountry", () => {
  it("US → USD", () => expect(defaultCurrencyForCountry("US")).toBe("USD"));
  it("CA → CAD", () => expect(defaultCurrencyForCountry("CA")).toBe("CAD"));
  it("FR → EUR", () => expect(defaultCurrencyForCountry("FR")).toBe("EUR"));
  it("unknown → USD", () => expect(defaultCurrencyForCountry("XX")).toBe("USD"));
  it("null → USD", () => expect(defaultCurrencyForCountry(null)).toBe("USD"));
});

describe("localeToCurrency", () => {
  it("fr → EUR", () => expect(localeToCurrency("fr")).toBe("EUR"));
  it("en → USD", () => expect(localeToCurrency("en")).toBe("USD"));
  it("unknown → USD", () => expect(localeToCurrency("de")).toBe("USD"));
});

describe("isCurrencyCode", () => {
  it("accepts valid codes", () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("EUR")).toBe(true);
    expect(isCurrencyCode("CAD")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isCurrencyCode("GBP")).toBe(false);
    expect(isCurrencyCode(42)).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
  });
});
