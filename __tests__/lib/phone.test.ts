import { describe, it, expect } from "vitest";
import { phoneMatchesCountry, normalizePhone } from "@/lib/phone";

describe("phoneMatchesCountry", () => {
  it("returns true for empty phone (optional field)", () => {
    expect(phoneMatchesCountry("", "FR")).toBe(true);
  });

  it("validates a valid French number", () => {
    expect(phoneMatchesCountry("+33612345678", "FR")).toBe(true);
  });

  it("rejects a truncated French number", () => {
    expect(phoneMatchesCountry("+336123", "FR")).toBe(false);
  });

  it("validates a valid US number", () => {
    expect(phoneMatchesCountry("+12025551234", "US")).toBe(true);
  });

  it("validates a valid Canadian number", () => {
    expect(phoneMatchesCountry("+16135550111", "CA")).toBe(true);
  });

  it("validates a valid UK number", () => {
    expect(phoneMatchesCountry("+44 7911 123456", "GB")).toBe(true);
  });

  it("rejects a truncated UK number", () => {
    expect(phoneMatchesCountry("+4479", "GB")).toBe(false);
  });

  it("validates a valid German number", () => {
    expect(phoneMatchesCountry("+49 151 23456789", "DE")).toBe(true);
  });

  it("rejects a truncated German number", () => {
    expect(phoneMatchesCountry("+491", "DE")).toBe(false);
  });

  it("returns true for unsupported country (no validation)", () => {
    expect(phoneMatchesCountry("+81 3 1234 5678", "JP")).toBe(true);
  });
});

describe("normalizePhone", () => {
  it("normalizes local French format to E.164", () => {
    expect(normalizePhone("06 12 34 56 78", "FR")).toBe("+33612345678");
  });

  it("normalizes US format", () => {
    expect(normalizePhone("(202) 555-1234", "US")).toBe("+12025551234");
  });

  it("returns original string on parse failure", () => {
    expect(normalizePhone("not-a-phone", "FR")).toBe("not-a-phone");
  });

  it("returns empty string unchanged", () => {
    expect(normalizePhone("", "FR")).toBe("");
  });
});
