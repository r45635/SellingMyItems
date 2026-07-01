import { describe, it, expect } from "vitest";
import { formatPrice, formatDistance } from "@/lib/format";

describe("formatPrice", () => {
  it("formats USD amount in en-US locale", () => {
    expect(formatPrice(100, "USD", "en")).toBe("$100");
  });

  it("formats EUR amount in fr locale", () => {
    // French locale formats as "100 €" (non-breaking space)
    const result = formatPrice(100, "EUR", "fr");
    expect(result).toContain("100");
    expect(result).toContain("€");
  });

  it("includes decimals when amount is not whole", () => {
    expect(formatPrice(99.99, "USD", "en")).toContain("99.99");
  });

  it("omits decimals for whole amounts", () => {
    expect(formatPrice(50, "CAD", "en")).not.toContain(".");
  });
});

describe("formatDistance", () => {
  it("formats km", () => {
    expect(formatDistance(10, "km")).toBe("10 km");
  });

  it("converts km to miles", () => {
    const result = formatDistance(16.09, "mi");
    expect(result).toContain("mi");
    // 16.09 km ≈ 10 mi
    expect(result).toMatch(/10(\s|$)/);
  });

  it("keeps one decimal for sub-10 distances", () => {
    const result = formatDistance(5.7, "km");
    expect(result).toBe("5.7 km");
  });
});
