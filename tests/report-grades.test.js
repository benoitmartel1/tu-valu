import test from "node:test";
import assert from "node:assert/strict";
import { reportPercentage, reportGradeLabel, reportEventLabel } from "../src/lib/reportGrades.js";
const skill = { grading_mode: "numeric", scale: ["1", "2", "3", "4", "5"] };
test("report conversion uses each observation's recorded scale", () => {
  assert.equal(reportPercentage({ level: "4" }, skill), 80);
  assert.equal(reportPercentage({ level: "4", grading_snapshot: { mode: "numeric", labels: ["0", "10"] } }, skill), 40);
  assert.equal(reportEventLabel({ level: "4" }, skill, "percent"), "80");
  assert.equal(reportEventLabel({ level: "4" }, skill, "original"), "4");
});
test("signed scales map their full range and conversion excludes missing and categorical marks", () => {
  const signed = { scale: ["-3", "0", "3"] };
  assert.equal(reportPercentage({ level: "-3" }, signed), 0);
  assert.equal(reportPercentage({ level: "0" }, signed), 50);
  assert.equal(reportPercentage({ level: "3" }, signed), 100);
  for (const level of ["abs", "", null]) assert.equal(reportPercentage({ level }, skill), null);
  assert.equal(reportEventLabel({ level: "abs" }, skill, "percent"), "ABS");
  assert.equal(reportEventLabel({ level: "Acquis" }, { grading_mode: "category" }, "letter"), "Acquis");
  assert.equal(reportPercentage({ level: "2" }, {}), null);
});
test("report letters follow the documented bands with stable boundaries", () => {
  assert.equal(reportGradeLabel(0, "letter"), "E");
  assert.equal(reportGradeLabel(10, "letter"), "E");
  assert.equal(reportGradeLabel(20, "letter"), "D");
  assert.equal(reportGradeLabel(80, "letter"), "B+");
  assert.equal(reportGradeLabel(90, "letter"), "A-");
  assert.equal(reportGradeLabel(90.01, "letter"), "A-");
  assert.equal(reportGradeLabel(100, "letter"), "A");
  assert.equal(reportGradeLabel(null, "percent"), "—");
  const letters = { grading_mode: "letter", scale: ["D", "C", "B", "A"] };
  assert.equal(reportPercentage({ level: "B" }, letters), 70);
});

test("0–9 marks match the requested E–A scale and reserve A+ for the bonus star", () => {
  const skill = { scale: Array.from({ length: 10 }, (_, i) => String(i)) };
  const letters = ["E", "D", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
  letters.forEach((letter, level) => {
    const event = { level: String(level) };
    assert.equal(reportEventLabel(event, skill, "letter"), letter);
    assert.equal(reportEventLabel(event, skill, "percent"), String((level + 1) * 10));
  });
  const snapshot = { mode: "numeric", labels: skill.scale };
  assert.equal(reportEventLabel({ level: "9", grading_snapshot: snapshot }, { scale: ["1", "5"] }, "letter"), "A");
  assert.equal(reportGradeLabel(105, "letter"), "A");
  assert.equal(reportEventLabel({ level: "A+" }, { grading_mode: "letter", scale: letters }, "percent"), "110");
});

test("fractional percentages stay in the reached grade band", () => {
  const six = { scale: ["1", "2", "3", "4", "5", "6"] };
  assert.equal(reportEventLabel({ level: "5" }, six, "letter"), "B+");
  assert.equal(reportGradeLabel(83.33, "letter"), "B+");
  assert.equal(reportGradeLabel(89.99, "letter"), "B+");
  assert.equal(reportGradeLabel(90, "letter"), "A-");
  assert.equal(reportGradeLabel(99.99, "letter"), "A-");
  assert.equal(reportGradeLabel(100, "letter"), "A");
  assert.equal(reportGradeLabel(109.99, "letter"), "A");
  assert.equal(reportGradeLabel(110, "letter"), "A+");
});

test("report percentages round up for display without changing letter thresholds", () => {
  assert.equal(reportGradeLabel(83.333333, "percent"), "84");
  assert.equal(reportGradeLabel(66.666667, "percent"), "67");
  assert.equal(reportGradeLabel(50, "percent"), "50");
  assert.equal(reportGradeLabel(110, "percent"), "110");
  assert.equal(reportGradeLabel(83.333333, "letter"), "B+");
});
