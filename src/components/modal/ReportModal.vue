<script setup>
import { resizeReportColumns } from "../../lib/reportColumns.js";
import LoadingPopup from "../popup/LoadingPopup.vue";
import { ref, computed, watch, onMounted } from "vue";
import { ChevronUp, Download, ChevronLeft, Eye, User, Hash, Percent, CaseUpper } from "@lucide/vue";
import { allRows, downloadCsv } from "../../lib/data";
import {
  csvText,
  fullName,
  numericGrade,
} from "../../lib/domain";
import { supabase } from "../../supabase";
import { reportPercentage, reportGradeLabel, reportEventLabel } from "../../lib/reportGrades";
import { useUserFilter } from "../../stores/userFilters";
import EvaluationMarks from "../EvaluationMarks.vue";

const props = defineProps({
  checkedClassIds: { type: Set, required: true },
  checkedSkillIds: { type: Set, required: true },
  currentStudents: { type: Array, required: true },
  skills: { type: Array, required: true },
  classes: { type: Array, required: true },
  teams: { type: Array, default: () => [] },
  studentTeamMap: { type: Object, default: () => ({}) },
  userId: { type: [String, Number], required: true },
});

const emit = defineEmits(["close"]);

// ── Internal state ──────────────────────────────────────
const reportLoading = ref(false);
const reportError = ref("");
const observerFilter = ref("");
const conversion = useUserFilter("report-conversion", value => ["original", "percent", "letter"].includes(value));
function reportSkill(skillId) { return reportData.value?.skills.find(skill => skill.id === skillId); }
function formatReportEvent(event) { return reportEventLabel(event, reportSkill(event.skill_id), conversion.value || "original"); }
function reportNumericGrade(event, skill) {
  return !conversion.value || conversion.value === "original" ? numericGrade(event, skill) : reportPercentage(event, skill);
}
function reportDisplayGrade(value, skill) { return reportGradeLabel(value, conversion.value || "original", skill); }

const nameFilter = ref("");
const normalizeName = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr");
const filteredReportStudents = computed(() => {
  const query = normalizeName(nameFilter.value.trim());
  return (reportData.value?.students || []).filter((student) =>
    !query || normalizeName([student.firstname, student.lastname, student.custom_name].filter(Boolean).join(" ")).includes(query),
  );
});
let reportRequest = 0;
const filteredEvents = computed(() =>
  (reportData.value?.events || []).filter(
    (e) =>
      !observerFilter.value ||
      (e.user_id || "unknown") === observerFilter.value,
  ),
);
const observers = computed(() => [
  ...new Map(
    (reportData.value?.events || []).map((e) => [
      e.user_id || "unknown",
      e.observer_name ||
        (e.user_id ? `Observateur ${e.user_id.slice(0, 8)}` : "Inconnu"),
    ]),
  ).entries(),
]);
const reportData = ref(null); // { sessions: [], students: [], skills: [], events: [] }
const reportSelectedStudentId = ref(null); // null = list, id = student detail
const reportTableHeader = ref(null);
const columnWidths = ref({});
const resizingColumn = ref(null);
let resizeStartX = 0;
let resizeStartWidths = {};
const reportColumns = computed(() => [
  "student", ...(reportData.value?.skills || []).map((skill) => `skill-${skill.id}`),
]);
const columnWidthTotal = computed(() =>
  reportColumns.value.reduce((total, key) => total + (columnWidths.value[key] || 0), 0));
function reportColumnStyle(key) {
  if (!reportColumns.value.every((column) => columnWidths.value[column])) return {};
  return { width: `${columnWidths.value[key] / columnWidthTotal.value * 100}%` };
}

function captureColumnWidths() {
  const headers = reportTableHeader.value?.querySelectorAll("th");
  if (!headers) return;
  columnWidths.value = Object.fromEntries(reportColumns.value.map((key, index) => [
    key, headers[index].getBoundingClientRect().width,
  ]));
}

function startColumnResize(event, key) {
  if (event.button !== 0 || key === reportColumns.value.at(-1)) return;
  event.preventDefault();
  captureColumnWidths();
  resizingColumn.value = key;
  resizeStartX = event.clientX;
  resizeStartWidths = { ...columnWidths.value };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveColumnResize(event) {
  const key = resizingColumn.value;
  if (!key) return;
  columnWidths.value = resizeReportColumns(resizeStartWidths, reportColumns.value, key, event.clientX - resizeStartX);
}

function resizeColumnWithKeyboard(event, key) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  captureColumnWidths();
  columnWidths.value = resizeReportColumns(columnWidths.value, reportColumns.value, key, event.key === "ArrowRight" ? 16 : -16);
}

watch(reportTableHeader, (header, _previous, onCleanup) => {
  if (!header) return;
  const updateHeight = () => {
    header.closest("table").style.setProperty(
      "--report-header-height", `${header.getBoundingClientRect().height}px`,
    );
  };
  const observer = new ResizeObserver(updateHeight);
  observer.observe(header);
  updateHeight();
  onCleanup(() => observer.disconnect());
}, { flush: "post" });

const reportSelectedStudent = computed(
  () =>
    reportData.value?.students.find(
      (s) => s.id === reportSelectedStudentId.value,
    ) || null,
);

// Map student id → class id
const studentClassMap = computed(() => {
  const map = {};
  for (const s of props.currentStudents) {
    map[s.id] =
      (s.class_ids || [s.class_id]).find((id) =>
        props.checkedClassIds.has(id),
      ) || s.class_id;
  }
  return map;
});

const studentMenuOpen = ref(false);
const nameSort = ref("firstname");
const groupByClass = ref(true);
const skillSort = ref(null);

function cycleSkillSort(skillId) {
  studentMenuOpen.value = false;
  const current = skillSort.value;
  skillSort.value = current?.skillId !== skillId
    ? { skillId, direction: "ascending" }
    : current.direction === "ascending"
      ? { skillId, direction: "descending" }
      : null;
  nameSort.value = "none";
}

function setNameSort(value) {
  nameSort.value = value;
  skillSort.value = null;
}

function compareReportStudents(a, b) {
  if (skillSort.value) {
    const { skillId, direction } = skillSort.value;
    const numericValue = (student) => {
      const events = getStudentEvents(student.id).filter(event => event.skill_id === skillId);
      const latest = [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const value = latest ? reportNumericGrade(latest, reportSkill(skillId)) : null;
      if (value == null || value === "abs" || value === "") return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const av = numericValue(a);
    const bv = numericValue(b);
    if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
    return (av - bv) * (direction === "ascending" ? 1 : -1);
  }
  if (nameSort.value === "none") return 0;
  const field = nameSort.value;
  const other = field === "firstname" ? "lastname" : "firstname";
  return (a[field] || "").localeCompare(b[field] || "", "fr-FR", { sensitivity: "base", numeric: true }) ||
    (a[other] || "").localeCompare(b[other] || "", "fr-FR", { sensitivity: "base", numeric: true });
}

// Stable sorting restores the loaded order when no sort is selected.
const reportStudentsByClass = computed(() => {
  if (!reportData.value) return [];
  if (!groupByClass.value) {
    return [{ classId: "all", students: [...filteredReportStudents.value].sort(compareReportStudents) }];
  }
  const groups = {};
  for (const s of filteredReportStudents.value) {
    const classId = s.class_id ?? studentClassMap.value[s.id];
    if (!groups[classId]) {
      const cls = props.classes.find((c) => c.id === classId);
      groups[classId] = {
        classId,
        className: cls?.name || "Autre",
        students: [],
      };
    }
    groups[classId].students.push(s);
  }
  // Apply the selected sort within each class.
  return Object.values(groups).sort((a, b) =>
    String(a.className).localeCompare(String(b.className), "fr-FR", { numeric: true }),
  ).map((group) => ({
    ...group,
    students: group.students.sort(compareReportStudents),
  }));
});

// ── Load report data ────────────────────────────────────
async function loadReportData() {
  const request = ++reportRequest;
  reportLoading.value = true;
  reportError.value = "";
  try {
    const selectedStudents = [...props.currentStudents];
    const selectedSkills = props.skills.filter((sk) =>
      props.checkedSkillIds.has(sk.id),
    );
    const ids = selectedStudents.map((s) => s.id);
    const events = [];
    if (selectedSkills.length) {
      for (let i = 0; i < ids.length; i += 100) {
        events.push(
          ...(await allRows(() =>
            supabase
              .from("tu_session_events")
              .select("*")
              .in("student_id", ids.slice(i, i + 100))
              .in("evaluation_id", [
                ...new Set(selectedSkills.map((sk) => sk.evaluation_id)),
              ])
              .order("created_at")
              .order("id"),
          )),
        );
      }
    }
    const selectedIds = new Set(selectedSkills.map((sk) => sk.id));
    const reportSkills = selectedSkills.flatMap((sk) =>
      sk.grading_mode === "rubric"
        ? sk.criteria.map((criterion) => ({
            ...sk,
            id: `${sk.id}:${criterion}`,
            name: `${sk.name} — ${criterion}`,
          }))
        : [sk],
    );
    const reportEvents = events.flatMap((event) => {
      if (event.level === "abs" && !event.skill_id)
        return selectedSkills
          .filter((sk) => sk.evaluation_id === event.evaluation_id)
          .map((sk) => ({ ...event, skill_id: sk.id }));
      if (!selectedIds.has(event.skill_id)) return [];
      const skill = selectedSkills.find((sk) => sk.id === event.skill_id);
      if (skill?.grading_mode === "rubric") {
        if (event.level === "abs")
          return skill.criteria.map((criterion) => ({
            ...event,
            skill_id: `${skill.id}:${criterion}`,
          }));
        return [{ ...event, skill_id: `${skill.id}:${event.criterion}` }];
      }
      return [event];
    });
    for (const event of reportEvents) {
      if (!reportSkills.some((sk) => sk.id === event.skill_id)) {
        const source = selectedSkills.find((sk) =>
          event.skill_id?.startsWith(`${sk.id}:`),
        );
        if (source)
          reportSkills.push({
            ...source,
            id: event.skill_id,
            name: `${source.name} — ${event.criterion || "Ancien critère"}`,
          });
      }
    }
    // Current observations have no session_id: chart them by observation day.
    const sessions = new Map();
    for (const event of reportEvents) {
      const key =
        event.session_id || formatDateTime(event.created_at).slice(0, 10);
      event.session_id = key;
      if (!sessions.has(key))
        sessions.set(key, { id: key, started_at: event.created_at });
    }
    if (request !== reportRequest) return;
    reportData.value = {
      students: selectedStudents.sort((a, b) =>
        (a.firstname || "").localeCompare(b.firstname || "", "fr"),
      ),
      skills: reportSkills,
      events: reportEvents,
      sessions: [...sessions.values()],
    };
  } catch (error) {
    if (request === reportRequest) {
      reportData.value = null;
      reportError.value = error.message || "Impossible de charger le rapport.";
    }
  } finally {
    if (request === reportRequest) reportLoading.value = false;
  }
}

// Load data when selections change or modal opens
watch(
  [
    () => props.checkedClassIds,
    () => props.checkedSkillIds,
    () => props.currentStudents,
  ],
  () => {
    // Always load data when any selection changes
    loadReportData();
  },
  { deep: true },
);

// Load data when component mounts
onMounted(() => {
  console.log("ReportModal mounted, loading data...");
  loadReportData();
});

// ── Helper functions ────────────────────────────────────
function formatStudentFullName(student) {
  return student
    ? fullName(student) +
        (student.custom_name ? ` (${student.custom_name})` : "")
    : "";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}

function fmtNum(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && !Number.isInteger(v)) return v.toFixed(1);
  return String(v);
}

function getStudentEvents(studentId) {
  if (!reportData.value) return [];
  return filteredEvents.value
    .filter((e) => e.student_id === studentId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function studentSkillCount(studentId, skillId) {
  return getStudentEvents(studentId).filter((e) => e.skill_id === skillId)
    .length;
}

function studentSkillHasOnlyAbs(studentId, skillId) {
  const events = getStudentEvents(studentId).filter(
    (e) => e.skill_id === skillId,
  );
  return events.length > 0 && events.every((event) => event.level === "abs");
}

function studentSkillLast(studentId, skillId) {
  const evts = getStudentEvents(studentId).filter(
    (e) => e.skill_id === skillId,
  );
  if (evts.length === 0) return null;
  return formatReportEvent(evts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]);
}

function studentSkillMin(studentId, skillId) {
  const vals = getStudentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) =>
      reportNumericGrade(
        e,
        reportData.value?.skills.find((sk) => sk.id === e.skill_id),
      ),
    )
    .filter((v) => v !== null && Number.isFinite(v));
  return vals.length > 0
    ? reportDisplayGrade(
        Math.min(...vals),
        reportData.value?.skills.find((sk) => sk.id === skillId),
      )
    : null;
}

function studentSkillMax(studentId, skillId) {
  const vals = getStudentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) =>
      reportNumericGrade(
        e,
        reportData.value?.skills.find((sk) => sk.id === e.skill_id),
      ),
    )
    .filter((v) => v !== null && Number.isFinite(v));
  return vals.length > 0
    ? reportDisplayGrade(
        Math.max(...vals),
        reportData.value?.skills.find((sk) => sk.id === skillId),
      )
    : null;
}

function studentSkillAvg(studentId, skillId) {
  const vals = getStudentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) =>
      reportNumericGrade(
        e,
        reportData.value?.skills.find((sk) => sk.id === e.skill_id),
      ),
    )
    .filter((v) => v !== null && Number.isFinite(v));
  if (vals.length === 0) return null;
  return reportDisplayGrade(
    vals.reduce((a, b) => a + b, 0) / vals.length,
    reportData.value?.skills.find((sk) => sk.id === skillId),
  );
}

// ── Chart helpers ──────────────────────────────────────
const chartColors = [
  "#e8a820",
  "#42a5f5",
  "#66bb6a",
  "#ef5350",
  "#ab47bc",
  "#ff7043",
  "#26c6da",
  "#8d6e63",
  "#78909c",
  "#ffa726",
  "#5c6bc0",
  "#8bc34a",
];

const studentChartData = computed(() => {
  if (!reportData.value || !reportSelectedStudentId.value) return null;
  const { sessions, skills } = reportData.value;
  const events = filteredEvents.value.filter(
    (e) => e.student_id === reportSelectedStudentId.value,
  );
  if (sessions.length === 0) return null;

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.started_at) - new Date(b.started_at),
  );

  const allLevels = events
    .map((e) =>
      reportNumericGrade(
        e,
        reportData.value?.skills.find((sk) => sk.id === e.skill_id),
      ),
    )
    .filter((v) => v !== null && Number.isFinite(v));
  if (allLevels.length === 0) return null;

  const yMin = Math.min(...allLevels);
  const yMax = Math.max(...allLevels);
  const yPad = Math.max((yMax - yMin) * 0.1, 0.5);
  const yAxisMin = conversion.value && conversion.value !== "original" ? 0 : Math.floor(yMin - yPad);
  const yAxisMax = conversion.value && conversion.value !== "original" ? Math.max(100, Math.ceil(yMax / 10) * 10) : Math.ceil(yMax + yPad);

  const datasets = skills.map((skill, i) => {
    const data = sortedSessions.map((session) => {
      const sessionEvents = events.filter(
        (e) => e.session_id === session.id && e.skill_id === skill.id,
      );
      const levels = sessionEvents
        .map((e) =>
          reportNumericGrade(
            e,
            reportData.value?.skills.find((sk) => sk.id === e.skill_id),
          ),
        )
        .filter((v) => v !== null && Number.isFinite(v));
      if (levels.length === 0) return null;
      return levels.reduce((a, b) => a + b, 0) / levels.length;
    });
    return { skill, data, color: chartColors[i % chartColors.length] };
  });

  return { sessions: sortedSessions, datasets, yAxisMin, yAxisMax };
});

function chartX(index, total) {
  if (total <= 1) return 300;
  return 50 + (index / (total - 1)) * 520;
}

function chartY(value, yMin, yMax) {
  const plotTop = 20;
  const plotBottom = 180;
  if (yMax === yMin) return (plotTop + plotBottom) / 2;
  return plotBottom - ((value - yMin) / (yMax - yMin)) * (plotBottom - plotTop);
}

function chartPath(data, yMin, yMax) {
  const total = data.length;
  const points = data.map((v, i) => {
    if (v == null) return null;
    const x = chartX(i, total);
    const y = chartY(v, yMin, yMax);
    return { x, y };
  });

  let path = "";
  let started = false;
  for (const p of points) {
    if (p == null) {
      started = false;
      continue;
    }
    if (!started) {
      path += `M${p.x},${p.y} `;
      started = true;
    } else {
      path += `L${p.x},${p.y} `;
    }
  }
  return path;
}

// ── Export report ──────────────────────────────────────
function reportClassName(student) {
  const ids = student.class_ids || [student.class_id];
  return props.classes
    .filter(
      (c) =>
        ids.includes(c.id) &&
        (!props.checkedClassIds.size || props.checkedClassIds.has(c.id)),
    )
    .map((c) => c.name)
    .join(" / ");
}
const studentHeaders = [
  "Groupes",
  "Fiche",
  "Numéro",
  "Prénom",
  "Nom",
  "Surnom",
  "Sexe",
  "Date de naissance",
  "Niveau",
  "Photo (référence)",
  "ID élève",
  "Niveaux scolaires",
  "Années scolaires",
  "Équipe (ensemble actif)",
  "Numéros par groupe",
];
function studentColumns(s) {
  return [
    reportClassName(s),
    s.record_number,
    s.student_number,
    s.firstname,
    s.lastname,
    s.custom_name,
    s.gender,
    s.birth_date,
    s.ability_level,
    s.photo_url,
    s.id,
    props.classes
      .filter((c) => (s.class_ids || [s.class_id]).includes(c.id))
      .map((c) => c.school_grade)
      .filter(Boolean)
      .join(" / "),
    props.classes
      .filter((c) => (s.class_ids || [s.class_id]).includes(c.id))
      .map((c) => c.school_year)
      .filter(Boolean)
      .join(" / "),
    props.teams.find((t) => t.id === props.studentTeamMap[s.id])?.name || "",
    Object.entries(s.class_numbers || {})
      .map(
        ([id, number]) =>
          `${props.classes.find((c) => c.id === id)?.name || id}: ${number || ""}`,
      )
      .join(" / "),
  ];
}
function exportLatestReport() {
  if (!reportData.value || reportLoading.value) return;
  const { students, skills } = reportData.value;
  downloadCsv(
    "sommaire",
    csvText([
      [
        ...studentHeaders,
        ...skills.flatMap((sk) => [
          `${sk.name} — Dernière`,
          `${sk.name} — Moyenne`,
        ]),
      ],
      ...students.map((s) => [
        ...studentColumns(s),
        ...skills.flatMap((sk) => [
          studentSkillLast(s.id, sk.id) ?? "",
          studentSkillAvg(s.id, sk.id) ?? "",
        ]),
      ]),
    ]),
  );
}
function exportAllReport() {
  if (!reportData.value || reportLoading.value) return;
  const students = new Map(reportData.value.students.map((s) => [s.id, s]));
  const skills = new Map(reportData.value.skills.map((sk) => [sk.id, sk]));
  downloadCsv(
    "log",
    csvText([
      [
        ...studentHeaders,
        "Groupe de la trace",
        "Habileté",
        "Cote",
        "Horodatage",
        "Observateur",
        "ID observateur",
        "Commentaire",
      ],
      ...filteredEvents.value
        .filter((e) => students.has(e.student_id) && skills.has(e.skill_id))
        .map((e) => [
          ...studentColumns(students.get(e.student_id)),
          props.classes.find((c) => c.id === e.class_id)?.name || "",
          skills.get(e.skill_id).name,
          formatReportEvent(e),
          e.created_at,
          e.observer_name || "Inconnu",
          e.user_id || "",
          e.comment || "",
        ]),
    ]),
  );
}

// Expose methods for parent
defineExpose({
  loadReportData,
  resetSelection: () => {
    reportSelectedStudentId.value = null;
  },
  selectStudent: (studentId) => {
    reportSelectedStudentId.value = studentId;
  },
});
</script>

<template>
  <div class="picker-panel report-modal picker-panel--full">
    <div class="class-modal-body">
      <div class="class-modal-content">
        <aside class="class-modal-rail" aria-label="Actions de classe">
          <button
            class="class-modal-rail-button close"
            title="Fermer"
            @click="$emit('close')"
          >
            <ChevronUp :size="28" :stroke-width="3" />
          </button>
          <details class="report-export-menu" @keydown.esc="$event.currentTarget.removeAttribute('open')">
            <summary class="export-btn" title="Exporter en CSV" aria-label="Exporter en CSV">
              <Download :size="22" />
            </summary>
            <div class="report-export-options">
              <button type="button" :disabled="!reportData || reportLoading"
                @click="exportLatestReport(); $event.currentTarget.closest('details').removeAttribute('open')">
                Sommaire
              </button>
              <button type="button" :disabled="!reportData || reportLoading"
                @click="exportAllReport(); $event.currentTarget.closest('details').removeAttribute('open')">
                Log avec horodatage
              </button>
            </div>
          </details>
        </aside>
        <div class="report-body">
          <div class="feature-toolbar report-toolbar">
            <div v-if="!reportSelectedStudentId" class="class-search-bar report-name-search">
              <input v-model="nameFilter" type="search" placeholder="Rechercher par nom" aria-label="Rechercher un élève par nom" />
            </div>
            <div v-if="!reportSelectedStudentId && reportData" class="report-group-toggle" role="group" aria-label="Regroupement des élèves">
              <button type="button" :aria-pressed="groupByClass" @click="groupByClass = true">Par classe</button>
              <button type="button" :aria-pressed="!groupByClass" @click="groupByClass = false">Tous mélangés</button>
            </div>
            <div class="report-conversion-filter" role="radiogroup" aria-label="Conversion des cotes">
              <label class="report-conversion-option" title="Number — notes originales">
                <input type="radio" name="report-conversion" value="original" :checked="!conversion || conversion === 'original'" aria-label="Number" @change="conversion = 'original'" />
                <span><Hash :size="20" aria-hidden="true" /></span>
              </label>
              <label class="report-conversion-option" title="% — pourcentage">
                <input type="radio" name="report-conversion" value="percent" :checked="conversion === 'percent'" aria-label="%" @change="conversion = 'percent'" />
                <span><Percent :size="20" aria-hidden="true" /></span>
              </label>
              <label class="report-conversion-option" title="Letter — cotes E à A+">
                <input type="radio" name="report-conversion" value="letter" :checked="conversion === 'letter'" aria-label="Letter" @change="conversion = 'letter'" />
                <span><CaseUpper :size="20" aria-hidden="true" /></span>
              </label>
            </div>
            <label class="report-observer-filter" title="Observateur">
              <User :size="20" aria-hidden="true" />
              <PopupSelect v-model="observerFilter" aria-label="Observateur">
                <option value="">Tous</option>
                <option v-for="[id, name] in observers" :key="id" :value="id">{{ name }}</option>
              </PopupSelect>
            </label>
          </div>
          <div v-if="reportError" role="alert">
            {{ reportError }} <button @click="loadReportData">Réessayer</button>
          </div>
          <LoadingPopup v-if="reportLoading" />
          <div v-else-if="!reportData" class="report-empty">Aucune donnée.</div>
          <template v-else>
            <Transition name="slide-edit" mode="out-in">
              <!-- Student detail: chart + sessions × skills table -->
              <div
                v-if="reportSelectedStudentId && reportSelectedStudent"
                :key="'detail-' + reportSelectedStudentId"
                class="report-student-detail"
              >
                <!-- Back button -->
                <button
                  class="report-back-btn"
                  title="Retour à la liste"
                  @click="reportSelectedStudentId = null"
                >
                  <ChevronLeft :size="28" :stroke-width="3" />
                  <span>Retour</span>
                </button>

                <details class="observation-log">
                  <summary>Traces et observateurs</summary>
                  <p
                    v-for="event in getStudentEvents(reportSelectedStudentId)"
                    :key="event.id + ':' + event.skill_id"
                  >
                    {{ formatDateTime(event.created_at) }} ·
                    {{
                      reportData.skills.find((sk) => sk.id === event.skill_id)
                        ?.name
                    }}
                    · {{ formatReportEvent(event) }} · {{ event.observer_name || "Inconnu" }}
                    <span v-if="event.comment">— {{ event.comment }}</span>
                  </p>
                </details>
                <!-- Student name header -->
                <div class="report-student-name">
                  {{ formatStudentFullName(reportSelectedStudent) }}
                </div>

                <div class="report-chart" v-if="studentChartData">
                  <div class="report-chart-title">Progression</div>
                  <svg
                    class="report-chart-svg"
                    viewBox="0 0 600 240"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <!-- Grid lines -->
                    <line
                      v-for="n in 4"
                      :key="'grid' + n"
                      :x1="50"
                      :y1="
                        chartY(
                          studentChartData.yAxisMin +
                            ((studentChartData.yAxisMax -
                              studentChartData.yAxisMin) *
                              n) /
                              4,
                          studentChartData.yAxisMin,
                          studentChartData.yAxisMax,
                        )
                      "
                      :x2="570"
                      :y2="
                        chartY(
                          studentChartData.yAxisMin +
                            ((studentChartData.yAxisMax -
                              studentChartData.yAxisMin) *
                              n) /
                              4,
                          studentChartData.yAxisMin,
                          studentChartData.yAxisMax,
                        )
                      "
                      stroke="var(--input-border)"
                      stroke-width="1"
                    />
                    <!-- Y-axis labels -->
                    <text
                      v-for="n in 5"
                      :key="'yl' + n"
                      :x="45"
                      :y="
                        chartY(
                          studentChartData.yAxisMin +
                            ((studentChartData.yAxisMax -
                              studentChartData.yAxisMin) *
                              (n - 1)) /
                              4,
                          studentChartData.yAxisMin,
                          studentChartData.yAxisMax,
                        ) + 4
                      "
                      text-anchor="end"
                      class="chart-axis-label"
                    >
                      {{ reportDisplayGrade(studentChartData.yAxisMin +
                          ((studentChartData.yAxisMax -
                            studentChartData.yAxisMin) *
                            (n - 1)) /
                            4) }}
                    </text>
                    <!-- Lines -->
                    <path
                      v-for="ds in studentChartData.datasets"
                      :key="ds.skill.id"
                      :d="
                        chartPath(
                          ds.data,
                          studentChartData.yAxisMin,
                          studentChartData.yAxisMax,
                        )
                      "
                      :stroke="ds.color"
                      stroke-width="2"
                      fill="none"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                    />
                    <!-- Dots -->
                    <g
                      v-for="(ds, di) in studentChartData.datasets"
                      :key="'dots' + di"
                    >
                      <template
                        v-for="(val, si) in ds.data"
                        :key="'d' + di + '-' + si"
                      >
                        <circle
                          v-if="val != null"
                          :cx="chartX(si, studentChartData.sessions.length)"
                          :cy="
                            chartY(
                              val,
                              studentChartData.yAxisMin,
                              studentChartData.yAxisMax,
                            )
                          "
                          :r="3"
                          :fill="ds.color"
                        />
                      </template>
                    </g>
                    <!-- X-axis labels -->
                    <text
                      v-for="(s, i) in studentChartData.sessions"
                      :key="'xl' + i"
                      :x="chartX(i, studentChartData.sessions.length)"
                      y="200"
                      text-anchor="middle"
                      class="chart-axis-label chart-axis-label-x"
                    >
                      {{ formatDateShort(s.started_at) }}
                    </text>
                  </svg>
                  <!-- Legend -->
                  <div class="chart-legend">
                    <span
                      v-for="ds in studentChartData.datasets"
                      :key="ds.skill.id"
                      class="chart-legend-item"
                    >
                      <span
                        class="chart-legend-dot"
                        :style="{ background: ds.color }"
                      ></span>
                      {{ ds.skill.name }}
                    </span>
                  </div>
                </div>

                <table class="report-student-info report-detail-table">
                  <thead>
                    <tr>
                      <th class="detail-th-date">Date</th>
                      <th
                        v-for="skill in reportData.skills"
                        :key="skill.id"
                        class="detail-th-skill"
                      >
                        {{ skill.name }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="report-stats-row">
                      <td class="detail-td-date">Stats</td>
                      <td
                        v-for="skill in reportData.skills"
                        :key="skill.id"
                        class="detail-td-level"
                      >
                        <span
                          v-if="
                            studentSkillHasOnlyAbs(
                              reportSelectedStudent.id,
                              skill.id,
                            )
                          "
                          class="report-abs"
                        >
                          ABS
                        </span>
                        <span
                          v-else-if="
                            studentSkillCount(
                              reportSelectedStudent.id,
                              skill.id,
                            ) > 0
                          "
                          class="skill-stats"
                        >
                          <span class="stat-latest">
                            <span class="stat-latest-value">{{
                              studentSkillLast(
                                reportSelectedStudent.id,
                                skill.id,
                              )
                            }}</span>
                          </span>
                          <span class="stat-group">
                            <span class="stat-item"
                              ><Eye :size="11" />
                              <span class="stat-val">{{
                                studentSkillCount(
                                  reportSelectedStudent.id,
                                  skill.id,
                                )
                              }}</span></span
                            >
                            <span class="stat-item stat-tri"
                              ><span class="tri-down">▼</span>
                              <span class="stat-val">{{
                                fmtNum(
                                  studentSkillMin(
                                    reportSelectedStudent.id,
                                    skill.id,
                                  ),
                                )
                              }}</span></span
                            >
                            <span class="stat-item stat-tri"
                              ><span class="tri-up">▲</span>
                              <span class="stat-val">{{
                                fmtNum(
                                  studentSkillMax(
                                    reportSelectedStudent.id,
                                    skill.id,
                                  ),
                                )
                              }}</span></span
                            >
                            <span class="stat-item"
                              ><span class="stat-tilde">~</span>
                              <span class="stat-val">{{
                                fmtNum(
                                  studentSkillAvg(
                                    reportSelectedStudent.id,
                                    skill.id,
                                  ),
                                )
                              }}</span></span
                            >
                          </span>
                        </span>
                        <span v-else class="stats-na--empty" aria-label="Aucune évaluation"></span>
                      </td>
                    </tr>
                    <tr class="report-stats-separator">
                      <td :colspan="reportData.skills.length + 1"></td>
                    </tr>
                    <tr
                      v-for="event in getStudentEvents(
                        reportSelectedStudent.id,
                      )"
                      :key="event.id"
                    >
                      <td class="detail-td-date">
                        {{ formatDateTime(event.created_at) }}
                      </td>
                      <td
                        v-for="skill in reportData.skills"
                        :key="skill.id"
                        class="detail-td-level"
                      >
                        <template v-if="event.skill_id === skill.id">
                          {{ formatReportEvent(event) }}
                        </template>
                        <span v-else class="stats-na">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Report table (list) -->
              <div v-else key="list" class="report-list" @keydown.esc="studentMenuOpen = false">


                <div
                  v-if="filteredReportStudents.length === 0"
                  class="report-empty"
                >
                  Aucun élève dans cette sélection ou correspondant à la recherche.
                </div>
                <template v-else>
                  <div class="report-table-scroll">
                  <table class="report-table" :class="{ 'report-table--resizing': resizingColumn }">
                    <colgroup>
                      <col v-for="key in reportColumns" :key="key" :style="reportColumnStyle(key)" />
                    </colgroup>
                    <thead ref="reportTableHeader">
                      <tr>
                        <th class="report-th-student" :aria-sort="!skillSort && nameSort !== 'none' ? 'ascending' : 'none'">
                          <button class="report-header-button" :aria-expanded="studentMenuOpen" @click="studentMenuOpen = !studentMenuOpen">
                            Élève <span aria-hidden="true">⌄</span>
                          </button>
                          <span v-if="reportColumns.length > 1" class="report-column-resizer" role="separator" aria-orientation="vertical" aria-label="Redimensionner la colonne Élève" tabindex="0"
                            @pointerdown.stop="startColumnResize($event, 'student')" @pointermove="moveColumnResize" @pointerup="resizingColumn = null" @pointercancel="resizingColumn = null" @lostpointercapture="resizingColumn = null" @click.stop
                            @keydown="resizeColumnWithKeyboard($event, 'student')"></span>
                <template v-if="studentMenuOpen">
                  <button class="report-menu-dismiss" aria-label="Fermer les options" @click="studentMenuOpen = false"></button>
                  <div class="report-student-menu" role="group" aria-label="Options des élèves">
                    <fieldset>
                      <legend>Trier par</legend>
                      <label v-for="option in [{ value: 'firstname', label: 'Prénom' }, { value: 'lastname', label: 'Nom de famille' }, { value: 'none', label: 'Aucun tri' }]" :key="option.value">
                        <input type="radio" name="report-name-sort" :checked="nameSort === option.value && !skillSort" @change="setNameSort(option.value)" />
                        {{ option.label }}
                      </label>
                    </fieldset>

                  </div>
                </template>
                        </th>
                        <th
                          v-for="skill in reportData.skills"
                          :key="skill.id"
                          class="report-th-skill-col"
                        :aria-sort="skillSort?.skillId === skill.id ? skillSort.direction : 'none'"
                        >
                        <button class="report-header-button" @click="cycleSkillSort(skill.id)">
                          <span class="report-header-label">{{ skill.name }}</span>
                          <span v-if="skillSort?.skillId === skill.id" aria-hidden="true">{{ skillSort.direction === 'ascending' ? '↑' : '↓' }}</span>
                        </button>
                        <span v-if="`skill-${skill.id}` !== reportColumns.at(-1)" class="report-column-resizer" role="separator" aria-orientation="vertical" :aria-label="`Redimensionner la colonne ${skill.name}`" tabindex="0"
                          @pointerdown.stop="startColumnResize($event, `skill-${skill.id}`)" @pointermove="moveColumnResize" @pointerup="resizingColumn = null" @pointercancel="resizingColumn = null" @lostpointercapture="resizingColumn = null" @click.stop
                          @keydown="resizeColumnWithKeyboard($event, `skill-${skill.id}`)"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody
                        v-for="group in reportStudentsByClass"
                        :key="group.classId"
                      >
                        <tr v-if="groupByClass" class="report-class-header">
                          <td :colspan="reportData.skills.length + 1">Classe {{ group.className }}</td>
                        </tr>
                        <tr v-for="student in group.students" :key="student.id">
                          <td
                            class="report-td-student report-td-student--clickable"
                            @click="reportSelectedStudentId = student.id"
                          >
                            {{ formatStudentFullName(student) }}
                          </td>
                          <td
                            v-for="skill in reportData.skills"
                            :key="skill.id"
                            class="report-td-count"
                          >
                            <template
                              v-if="studentSkillCount(student.id, skill.id) > 0"
                            >
                              <span
                                v-if="
                                  studentSkillHasOnlyAbs(student.id, skill.id)
                                "
                                class="report-abs"
                                >ABS</span
                              >
                              <EvaluationMarks
                                v-else
                                :events="getStudentEvents(student.id).filter((event) => event.skill_id === skill.id)"
                                :format-event="formatReportEvent"
                                :average-label="studentSkillAvg(student.id, skill.id) ?? '—'"
                              />
                            </template>
                            <span v-else class="stats-na--empty" aria-label="Aucune évaluation"></span>
                          </td>
                        </tr>
                    </tbody>
                  </table>
                  </div>
                </template>
              </div>
            </Transition>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-conversion-filter,
.report-group-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 3px;
  border: 1px solid var(--input-border);
  border-radius: 999px;
  flex-shrink: 0;
  color: var(--text-muted);
}
.report-conversion-option { position: relative; cursor: pointer; }
.report-conversion-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.report-conversion-option span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.report-conversion-option input:checked + span,
.report-group-toggle button[aria-pressed="true"] {
  background: var(--modal-accent, #e5b82e);
  color: #1f2328;
}
.report-conversion-option input:focus-visible + span {
  outline: 2px solid var(--modal-accent, #e5b82e);
  outline-offset: 2px;
}
.report-export-menu { position: relative; }
.report-export-menu > summary { list-style: none; }
.report-export-menu > summary::-webkit-details-marker { display: none; }
.report-export-options {
  position: absolute;
  top: 0;
  left: calc(100% + 0.5rem);
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 190px;
  padding: 0.4rem;
  border: 1px solid var(--input-border);
  border-radius: 12px;
  background: var(--surface);
}
.report-export-options button {
  padding: 0.65rem;
  border: 0;
  border-radius: 8px;
  text-align: left;
  background: transparent;
  color: var(--text-light);
}
/* Modal background */
.report-modal {
  --report-surface: var(--surface);
  --report-header-background: var(--surface);
  color: var(--text-light);
  background: var(--report-surface);
}

/* Report modal body - full width */
.report-modal .class-modal-body {
  overflow: hidden;
  width: 100%;
}

/* Keep controls and report content in one scrollable viewport. */
.report-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-radius: 12px;
  overflow: hidden;
}

.report-body > .feature-toolbar {
  flex-shrink: 0;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.report-toolbar .report-name-search {
  flex: 1 1 240px;
  max-width: 360px;
  min-width: 160px;
}
.report-name-search input {
  width: 100%;
  min-height: 44px;
  font: inherit;
}
.report-body > .feature-toolbar .report-group-toggle { margin-left: auto; }
.report-toolbar .report-observer-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}
.report-student-detail { overflow: auto; min-height: 0; }

/* Keep controls outside the scroll area so rows stay below the table header. */
.report-body > .report-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
.report-list-toolbar {
  position: relative;
  z-index: 3;
  display: flex;
  justify-content: flex-start;
  flex-shrink: 0;
  padding: 0.5rem 0.6rem 0.75rem;
  background: var(--report-surface);
}
/* Cover fractional-pixel seams at the scroll viewport's top edge. */
.report-list-toolbar::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: -3px;
  height: 3px;
  background: var(--report-surface);
  pointer-events: none;
}

.report-group-toggle button {
  padding: 0.4rem 0.7rem;
  border: 0;
  border-radius: 999px;
  min-height: 36px;
  background: transparent;
  color: var(--text-light);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.report-group-toggle button:focus-visible {
  outline: 2px solid var(--modal-accent, #e5b82e);
  outline-offset: 2px;
}
.report-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
}

.report-header-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0 8px 0 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.report-table thead th.report-th-student { position: relative; overflow: visible; }
.report-th-student .report-header-button { justify-content: flex-start; }
.report-header-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.report-header-button:focus-visible { outline: 2px solid var(--text-light); outline-offset: 2px; }
.report-column-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
  z-index: 3;
}
.report-column-resizer:focus-visible { background: color-mix(in srgb, var(--accent) 25%, transparent); outline: none; }
.report-table--resizing { user-select: none; cursor: col-resize; }
.report-menu-dismiss { position: fixed; inset: 0; z-index: 20; border: 0; background: transparent; cursor: default; }
.report-student-menu {
  position: absolute;
  top: 100%;
  left: 0.5rem;
  z-index: 21;
  min-width: 180px;
  padding: 0.75rem;
  border: 1px solid var(--input-border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-light);
  box-shadow: 0 6px 24px color-mix(in srgb, var(--text-light) 15%, transparent);
  font-size: 0.85rem;
}
.report-student-menu fieldset { margin: 0; padding: 0; border: 0; }
.report-student-menu fieldset + fieldset { margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--input-border); }
.report-student-menu legend { margin-bottom: 0.3rem; font-weight: 700; }
.report-student-menu label { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; cursor: pointer; }
.report-student-menu input { accent-color: var(--accent); }

/* Report student detail view */
.report-student-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Student name header in detail view */
.report-student-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-light);
  margin-bottom: 0.5rem;
}

/* Modal-specific styles */
.class-modal-body {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  padding: 1rem;
  position: relative;
}

.class-modal-content {
  width: 100%;
  display: flex;
  gap: 0.65rem;
  height: 100%;
  min-height: 0;
  align-items: flex-start;
  justify-content: flex-start;
}

.class-modal-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  button {
    opacity: 1;
    color: var(--text-light) !important;
  }
}

.class-modal-rail-button {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--surface-muted);

  cursor: pointer;
}

.class-modal-rail-button.close {
  background: none;
}

.export-btn {
  width: 38px;
  min-height: 38px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.65rem;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-light);
  cursor: pointer;
}

.export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Report table styles */
.report-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-bottom: 1.5rem;
  font-size: 0.82rem;
  table-layout: fixed;
  /* overflow-y: scroll; */
}

.report-table th,
.report-table td {
  color: var(--text-light);
  padding: 0.34rem 0.6rem;
  text-align: center;
}

.report-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--report-surface);
  box-shadow: 0 1px 0 var(--input-border);
  th {
    position: relative;
    box-sizing: border-box;
    height: 2.7625rem;
    padding-block: 0.31875rem;
    border-right: none;
    border-bottom: 1px solid var(--input-border);
    background: var(--report-header-background);
    color: var(--text-light);
    font-weight: 700;
    font-size: 1.1rem;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    max-width: 80px;
  }
}

.report-table thead th:first-child {
  border-top-left-radius: 0;
}

.report-table thead th:last-child {
  border-top-right-radius: 0;
}

.report-table .report-th-student {
  text-align: left;
  width: 1%;
}

.report-table tbody td { height: 2.805rem; }
.report-table :deep(.evaluation-marks),
.report-detail-table :deep(.evaluation-marks) {
  --mark-height: 2.125rem;
}

.report-class-header td {
  box-shadow: 0 -1px 0 var(--input-border);
  position: sticky;
  top: var(--report-header-height, 2.5rem);
  z-index: 1;
  background: var(--modal-accent, #e5b82e);
  color: #ffffff;
  font-weight: 700;
  font-size: 1.15rem;
  line-height: 1.2;
  padding: 0.34rem 0.6rem;
  border: none;
  border-radius: 0;
  text-align: left;
  letter-spacing: 0.04em;
}

.report-table tbody tr.report-class-header {
  border-top: 2px solid var(--input-border);
}

.report-th-skill-col {
  text-align: center;
  width: 1%;
}

.report-table .report-td-student {
  text-align: left;
  color: var(--text-light);
  font-size: 1.15rem;
  line-height: 1.2;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-table tbody tr:not(.report-class-header):nth-child(even) {
  background: color-mix(in srgb, var(--surface-muted) 65%, var(--surface));
}

.report-td-count {
  overflow-x: auto;
  color: var(--text-light);
  font-weight: 600;
  font-size: 0.85rem;
  text-align: center;
}

.report-abs {
  color: var(--danger);
  font-style: italic;
  font-weight: 700;
}

.report-table .report-td-student--clickable {
  cursor: pointer;
}

.report-table .report-td-student--clickable:focus-visible {
  background: var(--surface-muted);
}

.report-table .stat-latest {
  margin-inline: auto;
}

/* Report detail table */
.report-detail-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  font-size: 0.82rem;
}

.report-detail-table th,
.report-detail-table td {
  color: var(--text-light);
  padding: 0.34rem 0.6rem;
  /* text-align: left; */
  border: 1px solid var(--input-border);
}

.report-detail-table thead {
  th {
    background: var(--surface-muted);
    font-weight: 700;
  }
}

.detail-th-date {
  width: 150px;
}

.detail-td-date {
  white-space: nowrap;
}

.report-stats-row td {
  background: color-mix(in srgb, var(--surface-muted) 65%, var(--surface));
}

.report-stats-separator td {
  height: 0.425rem;
  padding: 0;
  border: 0;
  background: transparent;
}

.stats-na {
  color: var(--text-muted);
}

/* Chart styles */
.report-chart {
  margin-bottom: 2rem;
}

.report-chart-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-light);
}

.report-chart-svg {
  width: 100%;
  max-width: 600px;
  display: block;
  margin: 0 auto;
}

.chart-axis-label {
  font-size: 10px;
  fill: var(--text-light);
}

.chart-axis-label-x {
  transform: rotate(-45deg);
  transform-origin: center;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: center;
}

.chart-legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.chart-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Skill stats */
.skill-stats {
  display: flex;
  /* flex-direction: column; */
  align-items: center;
  gap: 0.2rem;
}

.stat-latest {
  font-weight: 700;
  font-size: 1rem;
}

.stat-group {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.stat-val {
  font-weight: 600;
}

.tri-down {
  color: var(--danger);
}

.tri-up {
  color: #2a9d8f;
}

.stat-tilde {
  color: var(--text-muted);
}

.report-loading,
.report-empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-light);
  font-size: 1rem;
}

.report-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-light);
  cursor: pointer;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.report-back-btn:focus-visible {
  background: color-mix(in srgb, var(--accent) 15%, var(--surface));
}

/* Chart styles */
.report-chart {
  margin-bottom: 1.25rem;
}

.report-chart-title {
  font-size: 0.85rem;
  color: var(--text-light);
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.report-chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.chart-axis-label {
  fill: var(--text-light);
  font-size: 11px;
  font-family: inherit;
  opacity: 0.7;
}

.chart-axis-label-x {
  opacity: 0.6;
  font-size: 10px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.4rem;
  justify-content: center;
}

.chart-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text-light);
  font-weight: 600;
}

.chart-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Skill cell stats */
.skill-stats {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  width: 100%;
  gap: 1px;
}

.stat-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
  color: var(--text-light);
  flex: 1;
  min-width: 0;
}

.stat-item svg {
  opacity: 0.6;
  flex-shrink: 0;
}

.stat-val {
  font-size: 0.8rem;
  line-height: 1;
}

.stat-tri {
  gap: 1px;
}

.tri-down {
  color: var(--danger);
  font-size: 1rem;
  margin-right: 0.3rem;
  line-height: 1;
}

.tri-up {
  color: var(--accent);
  font-size: 1rem;
  margin-right: 0.3rem;
  line-height: 1;
}

.stat-tilde {
  color: var(--text-light);
  font-weight: 600;
  font-size: 1rem;

  line-height: 1;
}

/* Latest mark */
.stat-latest {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  aspect-ratio: 1;
  border-radius: 50%;
  color: var(--text-light);
  /* background: var(--text-light); */
  flex-shrink: 0;
}

.stat-latest-value {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-light);
  line-height: 1;
}

/* Group of min/max/avg/count */
.stat-group {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  flex: 1;
  gap: 1px;
}

.stats-na {
  color: var(--text-light);
  font-size: 0.8rem;
  font-style: italic;
}

/* Detail table headers */
.detail-th-date {
  text-align: left;
  white-space: nowrap;
}

.detail-th-skill {
  text-align: center;
}

.detail-td-date {
  text-align: left;
  white-space: nowrap;
  color: var(--text-light);
  font-weight: 600;
}

.detail-td-level {
  color: var(--text-light);
  font-weight: 600;
  font-size: 0.85rem;
}

.report-detail-table .stats-na {
  color: var(--text-muted);
  font-weight: 400;
}

.report-table tbody tr:not(.report-class-header) {
  height: 2.7625rem;
}

.report-table tbody tr:not(.report-class-header) > td {
  box-sizing: border-box;
  height: 2.7625rem;
  padding-block: 0.31875rem;
  vertical-align: middle;
}

.stats-na--empty {
  display: block;
  height: 2.5rem;
}
</style>

<style scoped>
/* Keep column boundaries visible throughout the report table. */
.report-table tr > th:not(:last-child),
.report-table tr:not(.report-class-header) > td:not(:last-child) {
  border-right: 1px solid var(--input-border);
}
</style>
