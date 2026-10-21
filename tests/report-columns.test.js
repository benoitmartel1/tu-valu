import test from "node:test";
import assert from "node:assert/strict";
import { resizeReportColumns } from "../src/lib/reportColumns.js";
const columns = ["student", "a", "b"];
test("resizing a divider preserves total width and other columns", () => {
  const widths = { student: 200, a: 180, b: 160 };
  assert.deepEqual(resizeReportColumns(widths, columns, "student", 40),
    { student: 240, a: 140, b: 160 });
  assert.deepEqual(widths, { student: 200, a: 180, b: 160 });
});
test("both directions clamp at neighboring column minimums", () => {
  const widths = { student: 200, a: 180, b: 160 };
  assert.deepEqual(resizeReportColumns(widths, columns, "a", 500),
    { student: 200, a: 220, b: 120 });
  assert.deepEqual(resizeReportColumns(widths, columns, "a", -500),
    { student: 200, a: 120, b: 220 });
});
test("outer edge and already narrow columns do not jump", () => {
  const widths = { student: 80, a: 90, b: 160 };
  assert.deepEqual(resizeReportColumns(widths, columns, "student", 40), widths);
  assert.deepEqual(resizeReportColumns(widths, columns, "b", 40), widths);
});
