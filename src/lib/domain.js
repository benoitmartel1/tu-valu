export const LETTERS = ["D", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
export const SIMPLE_LETTERS = ["D", "C", "B", "A"];

export function gradeScale(mode = "numeric", modifiers = true) {
  return mode === "letter" ? (modifiers ? LETTERS : SIMPLE_LETTERS) : [];
}
export function gradeSnapshot(skill) {
  return {
    mode: skill.grading_mode || "numeric",
    labels: [...(skill.scale || [])],
    criteria: [...(skill.criteria || [])],
  };
}
export function numericGrade(event, skill) {
  if (event.level === "abs") return null;
  const scale = event.grading_snapshot || gradeSnapshot(skill || {});
  if (scale.mode === "category") return null;
  if (scale.mode === "letter") {
    const index = scale.labels.indexOf(String(event.level));
    return index < 0 ? null : ((index + 1) / scale.labels.length) * 10;
  }
  if (event.level === "" || event.level == null) return null;
  const n = Number(event.level);
  return Number.isFinite(n) ? n : null;
}
export function displayGrade(value, skill) {
  if (value == null) return "—";
  if (skill?.grading_mode === "letter") {
    const labels = skill.scale || [];
    return (
      labels[
        Math.max(
          0,
          Math.min(
            labels.length - 1,
            Math.ceil((value / 10) * labels.length - 1e-9) - 1,
          ),
        )
      ] || "—"
    );
  }
  return typeof value === "number"
    ? String(Math.round(value * 10) / 10)
    : String(value);
}
export function studentName(student, override) {
  const prefs =
    override?.individual !== false ? student.name_display_prefs : override;
  const p = prefs || { showFirstname: true };
  const parts = [];
  if (p.showFirstname && student.firstname) parts.push(student.firstname);
  if (p.showInitial && student.lastname) parts.push(`${student.lastname[0]}.`);
  if (p.showLastname && student.lastname) parts.push(student.lastname);
  if (p.showCustomName && student.custom_name) parts.push(student.custom_name);
  return parts.join(" ");
}
export function fullName(student) {
  return [student.firstname, student.lastname].filter(Boolean).join(" ");
}
export function belongsTo(student, classId) {
  return student.class_ids
    ? student.class_ids.includes(classId)
    : student.class_id === classId;
}
export function observationClass(student, selectedClasses, focusedClass) {
  const ids = student.class_ids || [student.class_id];
  if (selectedClasses.has(focusedClass) && ids.includes(focusedClass))
    return focusedClass;
  return (
    ids.find((id) => selectedClasses.has(id)) ||
    ids.find((id) => id === focusedClass) ||
    ids[0]
  );
}
export function isSkillComplete(studentId, skill, counts) {
  return (
    skill.max_observations > 0 &&
    (counts[studentId]?.[skill.id] || 0) >= skill.max_observations
  );
}
export function isStudentComplete(studentId, skills, counts) {
  return (
    skills.length > 0 &&
    skills.every((skill) => isSkillComplete(studentId, skill, counts))
  );
}
export function roundBrightness(count, cohortCounts) {
  const baseline = cohortCounts.length ? Math.min(...cohortCounts) : 0;
  return count > baseline
    ? Math.max(0.36, 0.55 - (count - baseline - 1) * 0.08)
    : 1;
}
export function birthdayInDays(birthDate, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate || "");
  if (!match) return null;
  const month = Number(match[2]) - 1,
    day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const start = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  let birthday = Date.UTC(today.getFullYear(), month, day);
  if (birthday < start)
    birthday = Date.UTC(today.getFullYear() + 1, month, day);
  return Math.round((birthday - start) / 86400000);
}
export function csvText(rows) {
  const escape = (value) => {
    let text = String(value ?? "");
    // Spreadsheet applications must not interpret student-controlled text as formulas.
    if (/^[=+@\t\r]/.test(text) || /^-(?!\d+(?:\.\d+)?$)/.test(text))
      text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
}
export function parseDelimited(text) {
  const first = text.split(/\r?\n/)[0] || "";
  const delimiter = first.includes("\t")
    ? "\t"
    : first.includes(";")
      ? ";"
      : ",";
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted)
    throw new Error("Guillemet non fermé dans les données importées.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function photoCandidates(filename, students) {
  const normalize = (v) =>
    String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const name = normalize(filename.replace(/\.[^.]+$/, ""));
  const tokens = name.split(" "),
    compact = tokens.join("");
  return students
    .map((student) => {
      const first = normalize(student.firstname),
        last = normalize(student.lastname);
      const record = normalize(student.record_number);
      const firstTokens = first.split(" ").filter(Boolean),
        lastTokens = last.split(" ").filter(Boolean);
      const hasLast =
        lastTokens.length > 0 && lastTokens.every((t) => tokens.includes(t));
      const hasFirst =
        firstTokens.length > 0 && firstTokens.every((t) => tokens.includes(t));
      let score = record && tokens.includes(record) ? 120 : 0;
      if (
        first &&
        last &&
        (compact === (first + last).replaceAll(" ", "") ||
          compact === (last + first).replaceAll(" ", ""))
      )
        score = Math.max(score, 100);
      if (hasFirst && hasLast) score = Math.max(score, 100);
      else if (hasLast && firstTokens.some((t) => tokens.includes(t)))
        score = Math.max(score, 80);
      else if (hasLast || hasFirst) score = Math.max(score, 40);
      return { student, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}
export function distributeByAbility(students, count, similar = false) {
  const sorted = [...students].sort(
    (a, b) => (b.ability_level ?? -1) - (a.ability_level ?? -1),
  );
  const teams = Array.from({ length: count }, () => []);
  sorted.forEach((student, i) => {
    const round = Math.floor(i / count),
      position = i % count;
    const index = similar
      ? Math.min(count - 1, Math.floor((i * count) / sorted.length))
      : round % 2
        ? count - 1 - position
        : position;
    teams[index].push(student);
  });
  return teams;
}
