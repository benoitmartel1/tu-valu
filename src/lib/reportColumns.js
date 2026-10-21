// Move an internal divider while keeping the table's total width unchanged.
export function resizeReportColumns(widths, columns, key, delta) {
  const index = columns.indexOf(key);
  if (index < 0 || index >= columns.length - 1) return widths;
  const next = columns[index + 1];
  const left = widths[key], right = widths[next];
  // Narrow columns must remain resizable without jumping to the minimum.
  const movement = Math.max(Math.min(120, left) - left,
    Math.min(delta, right - Math.min(120, right)));
  return { ...widths, [key]: left + movement, [next]: right - movement };
}
