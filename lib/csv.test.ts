import { describe, expect, it } from "vitest";
import { csvRow, escapeCsv } from "./csv";

describe("csv export", () => {
  it("quotes commas, line breaks, and quotes", () => {
    expect(escapeCsv('a,"b"')).toBe('"a,""b"""');
    expect(csvRow(["food", "line\nvalue"])).toBe("food,\"line\nvalue\"\r\n");
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(escapeCsv("=1+1")).toBe("'=1+1");
  });
});
