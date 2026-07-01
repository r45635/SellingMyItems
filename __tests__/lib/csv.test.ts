import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("returns empty string for empty array", () => {
    expect(toCsv([])).toBe("");
  });

  it("produces header + one data row", () => {
    const result = toCsv([{ name: "Alice", age: 30 }]);
    expect(result).toBe("name,age\nAlice,30");
  });

  it("escapes values containing commas", () => {
    const result = toCsv([{ title: "Hello, world" }]);
    expect(result).toBe('title\n"Hello, world"');
  });

  it("escapes values containing double quotes", () => {
    const result = toCsv([{ note: 'He said "hi"' }]);
    expect(result).toBe('note\n"He said ""hi"""');
  });

  it("escapes values containing newlines", () => {
    const result = toCsv([{ body: "line1\nline2" }]);
    expect(result).toBe('body\n"line1\nline2"');
  });

  it("handles null and undefined as empty strings", () => {
    const result = toCsv([{ a: null, b: undefined }]);
    expect(result).toBe("a,b\n,");
  });

  it("produces multiple rows", () => {
    const result = toCsv([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(result).toBe("x,y\n1,2\n3,4");
  });
});
