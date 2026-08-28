<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { ChevronUp, Download, ChevronLeft, Eye } from "@lucide/vue";
import { supabase } from "../../supabase";

const props = defineProps({
  checkedClassIds: { type: Set, required: true },
  checkedSkillIds: { type: Set, required: true },
  currentStudents: { type: Array, required: true },
  skills: { type: Array, required: true },
  classes: { type: Array, required: true },
  userId: { type: [String, Number], required: true },
});

const emit = defineEmits(["close"]);

// ── Internal state ──────────────────────────────────────
const reportLoading = ref(false);
const reportData = ref(null); // { sessions: [], students: [], skills: [], events: [] }
const reportSelectedStudentId = ref(null); // null = list, id = student detail

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
    map[s.id] = s.class_id;
  }
  return map;
});

// Group report students by class for the table
const reportStudentsByClass = computed(() => {
  if (!reportData.value) return [];
  const groups = {};
  for (const s of reportData.value.students) {
    const classId = studentClassMap.value[s.id];
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
  // Sort students within each group by firstname using French locale
  return Object.values(groups).map((group) => ({
    ...group,
    students: group.students.sort((a, b) =>
      (a.firstname || "").localeCompare(b.firstname || "", "fr-FR"),
    ),
  }));
});

// ── Load report data ────────────────────────────────────
async function loadReportData() {
  const classIds = [...props.checkedClassIds];
  const selectedStudentIds = new Set(props.currentStudents.map((s) => s.id));
  const selectedSkillIds = new Set(
    props.skills
      .filter((sk) => props.checkedSkillIds.has(sk.id))
      .map((sk) => sk.id),
  );

  // Determine relevant eval IDs for the report
  const relevantEvalIdsForReport = new Set();
  for (const sk of props.skills) {
    if (props.checkedSkillIds.has(sk.id)) {
      relevantEvalIdsForReport.add(sk.evaluation_id);
    }
  }

  console.log("Report query params:", {
    classIds,
    selectedStudentIds: [...selectedStudentIds],
    selectedSkillIds: [...selectedSkillIds],
    relevantEvalIds: [...relevantEvalIdsForReport],
    currentStudentsCount: props.currentStudents.length,
    checkedSkillsCount: props.checkedSkillIds.size,
  });

  try {
    // Always fetch students and skills based on selections
    const [studentsRes, skillsRes] = await Promise.all([
      supabase
        .from("tu_students")
        .select("id, firstname, lastname, class_id")
        .in("id", [...selectedStudentIds]),
      supabase
        .from("tu_skills")
        .select("id, name, scale, icon")
        .in("id", [...selectedSkillIds]),
    ]);

    // Only fetch events and sessions if we have skills selected
    let eventsRes = { data: [] };
    let sessionsRes = { data: [] };

    if (selectedSkillIds.size > 0 && selectedStudentIds.size > 0) {
      let eventsQuery = supabase
        .from("tu_session_events")
        .select("student_id, skill_id, level, session_id, created_at");

      if (classIds.length > 0) {
        eventsQuery = eventsQuery.in("class_id", classIds);
      }

      if (relevantEvalIdsForReport.size > 0) {
        eventsQuery = eventsQuery.in("evaluation_id", [
          ...relevantEvalIdsForReport,
        ]);
      }

      eventsQuery = eventsQuery
        .in("student_id", [...selectedStudentIds])
        .order("created_at", { ascending: true });

      const [sessRes, evtRes] = await Promise.all([
        classIds.length > 0 && relevantEvalIdsForReport.size > 0
          ? supabase
              .from("tu_sessions")
              .select("id, started_at, ended_at")
              .in("class_id", classIds)
              .in("evaluation_id", [...relevantEvalIdsForReport])
              .order("started_at", { ascending: true })
          : { data: [] },
        eventsQuery,
      ]);

      sessionsRes = sessRes;
      eventsRes = evtRes;
    }

    const reportEvents = (eventsRes.data || []).flatMap((event) => {
      if (event.level !== "abs" || event.skill_id) return [event];

      return props.skills
        .filter(
          (skill) =>
            selectedSkillIds.has(skill.id) &&
            skill.evaluation_id === event.evaluation_id,
        )
        .map((skill) => ({ ...event, skill_id: skill.id }));
    });

    reportData.value = {
      sessions: sessionsRes.data || [],
      students: (studentsRes.data || []).sort((a, b) =>
        a.firstname.localeCompare(b.firstname, "fr-FR"),
      ),
      skills: (skillsRes.data || []).sort((a, b) =>
        a.name.localeCompare(b.name, "fr-FR"),
      ),
      events: reportEvents,
    };
  } catch (err) {
    console.error("Failed to load report:", err);
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
  if (!student) return "";
  const parts = [];
  if (student.firstname) parts.push(student.firstname);
  if (student.lastname) parts.push(student.lastname);
  return parts.join(" ") || student.firstname || "";
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
  return reportData.value.events
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
  return evts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    .level;
}

function studentSkillMin(studentId, skillId) {
  const vals = getStudentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
  return vals.length > 0 ? Math.min(...vals) : null;
}

function studentSkillMax(studentId, skillId) {
  const vals = getStudentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
  return vals.length > 0 ? Math.max(...vals) : null;
}

function studentSkillAvg(studentId, skillId) {
  const vals = getStudentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
  const events = reportData.value.events.filter(
    (e) => e.student_id === reportSelectedStudentId.value,
  );
  if (sessions.length === 0) return null;

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.started_at) - new Date(b.started_at),
  );

  const allLevels = events
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
  if (allLevels.length === 0) return null;

  const yMin = Math.min(...allLevels);
  const yMax = Math.max(...allLevels);
  const yPad = Math.max((yMax - yMin) * 0.1, 0.5);
  const yAxisMin = Math.floor(yMin - yPad);
  const yAxisMax = Math.ceil(yMax + yPad);

  const datasets = skills.map((skill, i) => {
    const data = sortedSessions.map((session) => {
      const sessionEvents = events.filter(
        (e) => e.session_id === session.id && e.skill_id === skill.id,
      );
      const levels = sessionEvents
        .map((e) => parseFloat(e.level))
        .filter((v) => !isNaN(v));
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
function exportReport() {
  if (!reportData.value) return;
  const { students, skills, events } = reportData.value;

  const stats = {};
  for (const s of students) {
    stats[s.id] = {};
    for (const sk of skills) {
      const evts = events.filter(
        (e) => e.student_id === s.id && e.skill_id === sk.id,
      );
      if (evts.length === 0) continue;
      const levels = evts
        .map((e) => parseFloat(e.level))
        .filter((v) => !isNaN(v));
      const sorted = [...evts].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      stats[s.id][sk.id] = {
        nb: evts.length,
        min: Math.min(...levels),
        max: Math.max(...levels),
        avg: levels.reduce((a, b) => a + b, 0) / levels.length,
        last: sorted[0].level,
      };
    }
  }

  const esc = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const header = ["Classe", "Élève", ...skills.map((sk) => sk.name)];
  const rows = students.map((s) => {
    const classId = studentClassMap.value[s.id];
    const cls = props.classes.find((c) => c.id === classId);
    const className = cls?.name || "";
    const name = `${s.firstname} ${s.lastname}`;
    const vals = skills.map((sk) => {
      const st = stats[s.id]?.[sk.id];
      if (!st) return "";
      return `${st.nb} (min:${st.min} max:${st.max} moy:${st.avg.toFixed(1)} dernier:${st.last})`;
    });
    return [className, name, ...vals];
  });

  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
          <button
            class="export-btn"
            :disabled="!reportData"
            title="Exporter en CSV"
            @click="$emit('export-report')"
          >
            <Download :size="22" />
          </button>
        </aside>
        <div class="report-body">
          <div v-if="reportLoading" class="report-loading">Chargement…</div>
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
                      stroke="rgba(38,70,83,0.08)"
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
                      {{
                        (
                          studentChartData.yAxisMin +
                          ((studentChartData.yAxisMax -
                            studentChartData.yAxisMin) *
                            (n - 1)) /
                            4
                        ).toFixed(1)
                      }}
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
                        <span v-else class="stats-na">N/A</span>
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
                          {{ event.level }}
                        </template>
                        <span v-else class="stats-na">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Report table (list) -->
              <div v-else key="list">
                <div
                  v-if="reportData.students.length === 0"
                  class="report-empty"
                >
                  Aucun élève dans cette sélection.
                </div>
                <template v-else>
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th class="report-th-student">Élève</th>
                        <th
                          v-for="skill in reportData.skills"
                          :key="skill.id"
                          class="report-th-skill-col"
                        >
                          {{ skill.name }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <template
                        v-for="group in reportStudentsByClass"
                        :key="group.classId"
                      >
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
                              <span v-else class="stat-latest">
                                <span class="stat-latest-value">{{
                                  studentSkillLast(student.id, skill.id)
                                }}</span>
                              </span>
                            </template>
                            <span v-else class="stats-na">N/A</span>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
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
/* Modal background */
.report-modal {
  background: white;
}

/* Report modal body - full width */
.report-modal .class-modal-body {
  overflow: hidden;
  width: 100%;
}

/* Report body - white background container */
.report-body {
  width: 100%;
  max-width: 100%;
  flex: 1;

  border-radius: 12px;
  padding: 1rem;
  height: 100%;
  > div {
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
    height: 100%;
    overflow-y: auto;
  }
}

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
  color: var(--court-blue);
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
    color: var(--court-blue) !important;
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
  background: rgba(255, 255, 255, 0.08);

  cursor: pointer;
}

.class-modal-rail-button.close {
  background: none;
}

.export-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
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
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  font-size: 0.82rem;
  table-layout: fixed;
  /* overflow-y: scroll; */
}

.report-table th,
.report-table td {
  color: var(--court-blue);
  padding: 0.4rem 0.6rem;
  text-align: center;
}

.report-table thead {
  position: sticky;
  top: 0;
  th {
    border-right: 1px solid white;
    background: rgb(235, 235, 235);
    color: var(--court-blue);
    font-weight: 700;
    font-size: 1.1rem;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    max-width: 80px;
  }
}

.report-table thead th:first-child {
  border-top-left-radius: 18px;
}

.report-table thead th:last-child {
  border-top-right-radius: 18px;
}

.report-table .report-th-student {
  text-align: left;
  width: 1%;
}

.report-class-header td {
  background: var(--court-blue);
  /* color: var(--text-light); */
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0;
  text-align: left;
  letter-spacing: 0.04em;
}

.report-table tbody tr.report-class-header {
  border-top: 2px solid rgba(38, 70, 83, 0.2);
}

.report-th-skill-col {
  text-align: center;
  width: 1%;
}

.report-table .report-td-student {
  text-align: left;
  color: var(--court-blue);
  font-weight: 600;
}

.report-table tbody tr:not(.report-class-header):nth-child(even) {
  background: rgba(38, 70, 83, 0.04);
}

.report-td-count {
  color: var(--court-blue);
  font-weight: 600;
  font-size: 0.85rem;
  text-align: center;
}

.report-abs {
  color: #d62828;
  font-style: italic;
  font-weight: 700;
}

.report-table .report-td-student--clickable {
  cursor: pointer;
}

.report-table .report-td-student--clickable:hover {
  background: rgba(38, 70, 83, 0.08);
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
  color: var(--court-blue);
  padding: 0.4rem 0.6rem;
  /* text-align: left; */
  border: 1px solid rgba(38, 70, 83, 0.1);
}

.report-detail-table thead {
  th {
    background: rgba(38, 70, 83, 0.08);
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
  background: rgba(38, 70, 83, 0.04);
}

.report-stats-separator td {
  height: 0.5rem;
  padding: 0;
  border: 0;
  background: transparent;
}

.stats-na {
  color: #999;
}

/* Chart styles */
.report-chart {
  margin-bottom: 2rem;
}

.report-chart-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--court-blue);
}

.report-chart-svg {
  width: 100%;
  max-width: 600px;
  display: block;
  margin: 0 auto;
}

.chart-axis-label {
  font-size: 10px;
  fill: var(--court-blue);
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
  color: #e63946;
}

.tri-up {
  color: #2a9d8f;
}

.stat-tilde {
  color: #666;
}

.report-loading,
.report-empty {
  text-align: center;
  padding: 2rem;
  color: var(--court-blue);
  font-size: 1rem;
}

.report-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: rgba(38, 70, 83, 0.08);
  color: var(--court-blue);
  cursor: pointer;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.report-back-btn:hover {
  background: rgba(38, 70, 83, 0.15);
}

/* Chart styles */
.report-chart {
  margin-bottom: 1.25rem;
}

.report-chart-title {
  font-size: 0.85rem;
  color: var(--court-blue);
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.report-chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.chart-axis-label {
  fill: var(--court-blue);
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
  color: var(--court-blue);
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
  color: var(--court-blue);
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
  color: rgba(255, 140, 100, 0.7);
  font-size: 1rem;
  margin-right: 0.3rem;
  line-height: 1;
}

.tri-up {
  color: rgba(100, 200, 130, 0.7);
  font-size: 1rem;
  margin-right: 0.3rem;
  line-height: 1;
}

.stat-tilde {
  color: var(--court-blue);
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
  color: var(--court-blue);
  /* background: var(--court-blue); */
  flex-shrink: 0;
}

.stat-latest-value {
  font-size: 1rem;
  font-weight: 800;
  /* color: var(--text-light); */
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
  color: var(--court-blue);
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
  color: var(--court-blue);
  font-weight: 600;
}

.detail-td-level {
  color: var(--court-blue);
  font-weight: 600;
  font-size: 0.85rem;
}

.report-detail-table .stats-na {
  color: rgba(38, 70, 83, 0.25);
  font-weight: 400;
}
</style>
