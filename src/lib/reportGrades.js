import { gradeSnapshot, numericGrade, displayGrade, LETTERS } from "./domain.js";
export const REPORT_LETTERS = ["E", ...LETTERS];
export function reportPercentage(event, skill) {
  const value = numericGrade(event, skill);
  if (value == null) return null;
  const snapshot = event.grading_snapshot || gradeSnapshot(skill || {});
  if (snapshot.mode === "letter") {
    const index = REPORT_LETTERS.indexOf(String(event.level));
    return index >= 0 ? (index + 1) * 10 : value * 10;
  }
  const labels = (snapshot.labels || []).filter(v => v !== "" && v != null).map(Number).filter(Number.isFinite);
  if (!labels.length) return null;
  const min = Math.min(0, ...labels), max = Math.max(...labels);
  // The 0–9 scale represents 1/10 through 10/10; 10 is the bonus star.
  if (min === 0 && labels.includes(0) && labels.includes(9) && max <= 10)
    return (Math.max(0, Math.min(10, value)) + 1) * 10;
  if (max <= min) return null;
  return Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
}
export function reportGradeLabel(value, mode, skill) {
  if (value == null) return "—";
  if (mode === "percent") return String(Math.ceil(value - 1e-9));
  if (mode === "letter") return REPORT_LETTERS[Math.max(0, Math.min(10, Math.floor(value / 10 + 1e-9) - 1))];
  return displayGrade(value, skill);
}
export function reportEventLabel(event, skill, mode) {
  if (mode === "original" || !mode) return event.level === "abs" ? "ABS" : event.level;
  const percent = reportPercentage(event, skill);
  return percent == null ? (event.level === "abs" ? "ABS" : event.level) : reportGradeLabel(percent, mode);
}
