import { describe, expect, it } from "vitest";
import { csvRow, escapeCsv } from "./csv";

describe("csv export", () => {
  it("quotes commas, line breaks, and quotes", () => {
    expect(escapeCsv('a,"b"')).toBe('"a,""b"""');
    expect(csvRow(["food", "line\nvalue"])).toBe("food,\"line\nvalue\"\r\n");
  });

  it("neutralizes spreadsheet formulas including leading whitespace and control characters", () => {
    expect(escapeCsv("=1+1")).toBe("'=1+1");
    expect(escapeCsv("  =SUM(A1:A2)")).toBe("'  =SUM(A1:A2)");
    expect(escapeCsv("\t+1")).toBe("'\t+1");
    expect(escapeCsv("\r@cmd")).toBe("\"'\\r@cmd\"".replace("\\r", "\r"));
  });
});
