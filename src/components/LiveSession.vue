<script setup>
import { ref, computed, onMounted } from "vue";
import {
  Users,
  Dumbbell,
  X,
  Plus,
  Trash2,
  Edit2,
  BarChart3,
  Play,
  Square,
  Eye,
} from "@lucide/vue";
import { supabase } from "../supabase";

// ── Setup state ───────────────────────────────────────
const classes = ref([]);
const evaluations = ref([]);
const selectedClassId = ref(null);
const selectedEvaluationId = ref(null);
const loading = ref(false);

// ── Picker state ──────────────────────────────────────
const classModalOpen = ref(false);
const classModalTab = ref("select"); // 'select' | 'edit'
const evalModalOpen = ref(false);
const evalModalTab = ref("select"); // 'select' | 'edit'

// ── Class CRUD state ───────────────────────────────────
const editingClassId = ref(null);
const editingClassName = ref("");
const isAddingNewClass = ref(false);

// ── Evaluation CRUD state ──────────────────────────────
const editingEvalId = ref(null);
const editingEvalTitle = ref("");
const isAddingNewEval = ref(false);

// ── Live state ────────────────────────────────────────
const view = ref("select");
const students = ref([]);
const classStudents = ref([]); // students preview when only class is selected
const skills = ref([]);
const counts = ref({}); // { studentId: { skillId: count } } — all events
const sessionCounts = ref({}); // { studentId: { skillId: count } } — only current session
const usedLevels = ref({}); // { studentId: { skillId: { level: true } } }
const levelCounts = ref({}); // { studentId: { skillId: { level: count } } }

// ── Session system ─────────────────────────────────────
const activeSession = ref(null); // { id, class_id, evaluation_id, started_at, ended_at }
const sessionLoading = ref(false);
const isSessionActive = computed(
  () => activeSession.value && !activeSession.value.ended_at,
);

async function toggleSession() {
  if (isSessionActive.value) {
    await stopPlaySession();
  } else {
    await startPlaySession();
  }
}

async function startPlaySession() {
  if (!selectedClassId.value || !selectedEvaluationId.value) return;
  sessionLoading.value = true;
  try {
    const { data, error } = await supabase
      .from("tu_sessions")
      .insert({
        class_id: selectedClassId.value,
        evaluation_id: selectedEvaluationId.value,
      })
      .select()
      .single();
    if (error) throw error;
    activeSession.value = data;
  } catch (err) {
    console.error("Failed to start session:", err);
  } finally {
    sessionLoading.value = false;
  }
}

async function stopPlaySession() {
  if (!activeSession.value) return;
  sessionLoading.value = true;
  try {
    const { error } = await supabase
      .from("tu_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", activeSession.value.id);
    if (error) throw error;
    activeSession.value = {
      ...activeSession.value,
      ended_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to stop session:", err);
  } finally {
    sessionLoading.value = false;
  }
}

// ── Drag-and-drop state ───────────────────────────────
const drag = ref(null); // { student, startX, startY, currentX, currentY, offsetX, offsetY, width, height }
const hoveredSkillId = ref(null);
const dropFlash = ref(null); // skillId that just received a drop
const hoveredLevel = ref(null); // level label being hovered within a zone

onMounted(async () => {
  const [{ data: cls }, { data: evs }] = await Promise.all([
    supabase.from("tu_classes").select("id, name").order("name"),
    supabase.from("tu_evaluations").select("id, title").order("title"),
  ]);
  classes.value = cls || [];
  evaluations.value = evs || [];
});

async function selectClass(id) {
  selectedClassId.value = id;
  classModalOpen.value = false;
  // Load students for the picker preview (even without an evaluation)
  await loadClassStudents(id);
  if (selectedEvaluationId.value) startSession();
}

async function loadClassStudents(classId) {
  if (!classId) {
    classStudents.value = [];
    return;
  }
  const { data } = await supabase
    .from("tu_students")
    .select("id, name")
    .eq("class_id", classId)
    .order("name");
  classStudents.value = data || [];
}

function openClassModal() {
  classModalOpen.value = true;
  classModalTab.value = "select";
  cancelClassEdit();
}

// ── Class CRUD ────────────────────────────────────────
function startClassEdit(item) {
  editingClassId.value = item.id;
  editingClassName.value = item.name;
  isAddingNewClass.value = false;
}

function cancelClassEdit() {
  editingClassId.value = null;
  editingClassName.value = "";
  isAddingNewClass.value = false;
}

async function saveClassEdit(item) {
  if (!editingClassName.value.trim()) return;
  await supabase
    .from("tu_classes")
    .update({ name: editingClassName.value })
    .eq("id", item.id);
  item.name = editingClassName.value;
  cancelClassEdit();
}

async function addNewClass() {
  if (!editingClassName.value.trim()) return;
  const { data } = await supabase
    .from("tu_classes")
    .insert({ name: editingClassName.value })
    .select();
  if (data && data[0]) {
    classes.value.push(data[0]);
    classes.value.sort((a, b) => a.name.localeCompare(b.name));
  }
  cancelClassEdit();
}

async function deleteClass(id) {
  if (!confirm("Êtes-vous sûr?")) return;
  await supabase.from("tu_classes").delete().eq("id", id);
  classes.value = classes.value.filter((c) => c.id !== id);
  if (selectedClassId.value === id) {
    selectedClassId.value = null;
    classStudents.value = [];
    view.value = "select";
  }
}

function selectEval(id) {
  selectedEvaluationId.value = id;
  evalModalOpen.value = false;
  if (selectedClassId.value) startSession();
}

function openEvalModal() {
  evalModalOpen.value = true;
  evalModalTab.value = "select";
  cancelEvalEdit();
}

// ── Evaluation CRUD ────────────────────────────────────
function startEvalEdit(item) {
  editingEvalId.value = item.id;
  editingEvalTitle.value = item.title;
  isAddingNewEval.value = false;
}

function cancelEvalEdit() {
  editingEvalId.value = null;
  editingEvalTitle.value = "";
  isAddingNewEval.value = false;
}

async function saveEvalEdit(item) {
  if (!editingEvalTitle.value.trim()) return;
  await supabase
    .from("tu_evaluations")
    .update({ title: editingEvalTitle.value })
    .eq("id", item.id);
  item.title = editingEvalTitle.value;
  cancelEvalEdit();
}

async function addNewEval() {
  if (!editingEvalTitle.value.trim()) return;
  const { data } = await supabase
    .from("tu_evaluations")
    .insert({ title: editingEvalTitle.value })
    .select();
  if (data && data[0]) {
    evaluations.value.push(data[0]);
    evaluations.value.sort((a, b) => a.title.localeCompare(b.title));
  }
  cancelEvalEdit();
}

async function deleteEval(id) {
  if (!confirm("Êtes-vous sûr?")) return;
  await supabase.from("tu_evaluations").delete().eq("id", id);
  evaluations.value = evaluations.value.filter((e) => e.id !== id);
  if (selectedEvaluationId.value === id) {
    selectedEvaluationId.value = null;
  }
}

async function startSession() {
  if (!selectedClassId.value || !selectedEvaluationId.value) return;
  loading.value = true;

  const [{ data: stu }, { data: ski }, { data: events }] = await Promise.all([
    supabase
      .from("tu_students")
      .select("id, name")
      .eq("class_id", selectedClassId.value)
      .order("name"),
    supabase
      .from("tu_skills")
      .select("id, name, scale")
      .eq("evaluation_id", selectedEvaluationId.value),
    supabase
      .from("tu_session_events")
      .select("student_id, skill_id, level, session_id")
      .eq("class_id", selectedClassId.value)
      .eq("evaluation_id", selectedEvaluationId.value),
  ]);

  skills.value = ski || [];

  const c = {};
  const sc = {};
  const ul = {};
  const lc = {};
  for (const s of stu || []) {
    c[s.id] = {};
    sc[s.id] = {};
    ul[s.id] = {};
    lc[s.id] = {};
  }
  const activeSid = activeSession.value?.id;
  for (const ev of events || []) {
    if (!c[ev.student_id]) c[ev.student_id] = {};
    if (!ul[ev.student_id]) ul[ev.student_id] = {};
    if (!lc[ev.student_id]) lc[ev.student_id] = {};
    if (!ul[ev.student_id][ev.skill_id]) ul[ev.student_id][ev.skill_id] = {};
    if (!lc[ev.student_id][ev.skill_id]) lc[ev.student_id][ev.skill_id] = {};
    c[ev.student_id][ev.skill_id] = (c[ev.student_id][ev.skill_id] || 0) + 1;
    if (ev.level) {
      ul[ev.student_id][ev.skill_id][ev.level] = true;
      lc[ev.student_id][ev.skill_id][ev.level] =
        (lc[ev.student_id][ev.skill_id][ev.level] || 0) + 1;
    }
    // track current-session counts only
    if (ev.session_id === activeSid) {
      if (!sc[ev.student_id]) sc[ev.student_id] = {};
      sc[ev.student_id][ev.skill_id] =
        (sc[ev.student_id][ev.skill_id] || 0) + 1;
    }
  }
  counts.value = c;
  sessionCounts.value = sc;
  usedLevels.value = ul;
  levelCounts.value = lc;

  students.value = stu || [];
  loading.value = false;
  view.value = "active";
}

// ── Sorted students ───────────────────────────────────
const sortedStudents = computed(() =>
  [...students.value].sort((a, b) => a.name.localeCompare(b.name)),
);

// ── Session evaluation stats ──────────────────────────
const maxSessionCount = computed(() => {
  let max = 0;
  for (const s of students.value) {
    max = Math.max(max, totalCount(s.id));
  }
  return max;
});

// ── Evaluation helpers ────────────────────────────────
function totalCount(studentId) {
  return Object.values(sessionCounts.value[studentId] || {}).reduce(
    (a, b) => a + b,
    0,
  );
}

function hasPriorEvals(studentId, skillId) {
  if (!studentId) return false;
  return (counts.value[studentId]?.[skillId] || 0) > 0;
}

function getSkillScale(skill) {
  if (skill.scale && Array.isArray(skill.scale) && skill.scale.length > 0) {
    return skill.scale;
  }
  return ["1", "2", "3", "4", "5"];
}

function hasUsedLevel(studentId, skillId, level) {
  return !!usedLevels.value[studentId]?.[skillId]?.[level];
}

// ── Bubble sizing ─────────────────────────────────────
const BUBBLE_SIZE = 36;

function bubbleSize() {
  return BUBBLE_SIZE;
}

function studentOpacity(studentId) {
  const count = totalCount(studentId);
  const max = maxSessionCount.value;
  if (max === 0) return 0.5;
  // Interpolate: least-evaluated → 0.5 (50%), most-evaluated → 0.1 (10%)
  return 0.5 - (count / max) * 0.4;
}

// ── Drag-and-drop ─────────────────────────────────────
function onDragMove(e) {
  if (!drag.value) return;
  e.preventDefault();

  drag.value.currentX = e.clientX;
  drag.value.currentY = e.clientY;

  // hit-test drop zones and level sub-segments
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const zone = el?.closest("[data-skill-id]");
  hoveredSkillId.value = zone ? zone.dataset.skillId : null;
  const seg = el?.closest("[data-level]");
  hoveredLevel.value = seg ? seg.dataset.level : null;
}

function onDragCancel() {
  document.body.style.touchAction = "";
  document.body.style.userSelect = "";
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.removeEventListener("pointercancel", onDragCancel);
  drag.value = null;
  hoveredSkillId.value = null;
  hoveredLevel.value = null;
}

function onDragEnd() {
  document.body.style.touchAction = "";
  document.body.style.userSelect = "";
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.removeEventListener("pointercancel", onDragCancel);

  if (!drag.value) return;

  const studentId = drag.value.student.id;
  const skillId = hoveredSkillId.value;

  if (skillId && hoveredLevel.value) {
    const level = hoveredLevel.value;

    // update local counts (all events)
    const newCounts = { ...counts.value };
    if (!newCounts[studentId]) newCounts[studentId] = {};
    newCounts[studentId] = {
      ...newCounts[studentId],
      [skillId]: (newCounts[studentId][skillId] || 0) + 1,
    };
    counts.value = newCounts;

    // update current-session counts
    const newSC = { ...sessionCounts.value };
    if (!newSC[studentId]) newSC[studentId] = {};
    newSC[studentId] = {
      ...newSC[studentId],
      [skillId]: (newSC[studentId][skillId] || 0) + 1,
    };
    sessionCounts.value = newSC;

    // track used levels
    const newUsed = { ...usedLevels.value };
    if (!newUsed[studentId]) newUsed[studentId] = {};
    if (!newUsed[studentId][skillId]) newUsed[studentId][skillId] = {};
    newUsed[studentId][skillId] = {
      ...newUsed[studentId][skillId],
      [level]: true,
    };
    usedLevels.value = newUsed;

    // track per-level count
    const newLC = { ...levelCounts.value };
    if (!newLC[studentId]) newLC[studentId] = {};
    if (!newLC[studentId][skillId]) newLC[studentId][skillId] = {};
    newLC[studentId][skillId] = {
      ...newLC[studentId][skillId],
      [level]: (newLC[studentId][skillId][level] || 0) + 1,
    };
    levelCounts.value = newLC;

    // flash the drop zone
    dropFlash.value = skillId;
    setTimeout(() => {
      dropFlash.value = null;
    }, 400);

    // insert event
    const eventPayload = {
      class_id: selectedClassId.value,
      evaluation_id: selectedEvaluationId.value,
      student_id: studentId,
      skill_id: skillId,
      level: level,
    };
    if (activeSession.value) {
      eventPayload.session_id = activeSession.value.id;
    }
    supabase
      .from("tu_session_events")
      .insert(eventPayload)
      .then(({ error }) => {
        if (error) console.error("Failed to save event:", error);
      })
      .catch((err) => console.error("Failed to save event:", err));

    // flash student bubble
    const bubbleEl = document.querySelector(
      `.student-wrapper[data-student-id="${studentId}"] .student-bubble`,
    );
    if (bubbleEl) {
      bubbleEl.style.transition = "none";
      bubbleEl.style.boxShadow = "0 0 0 4px rgba(232, 168, 32, 0.9)";
      bubbleEl.style.borderColor = "#e8a820";
      setTimeout(() => {
        bubbleEl.style.transition = "";
        bubbleEl.style.boxShadow = "";
        bubbleEl.style.borderColor = "";
      }, 350);
    }
  }

  drag.value = null;
  hoveredSkillId.value = null;
  hoveredLevel.value = null;
}

function onDragStart(e, student) {
  if (drag.value) return; // only one drag at a time
  e.preventDefault();

  const rect = e.currentTarget.getBoundingClientRect();
  drag.value = {
    student,
    startX: e.clientX,
    startY: e.clientY,
    currentX: e.clientX,
    currentY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };

  document.body.style.touchAction = "none";
  document.body.style.userSelect = "none";
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);
  document.addEventListener("pointercancel", onDragCancel);
}

// ── Clone style (computed for reactivity) ─────────────
const cloneStyle = computed(() => {
  if (!drag.value) return { display: "none" };
  return {
    position: "fixed",
    left: drag.value.currentX - drag.value.offsetX + "px",
    top: drag.value.currentY - drag.value.offsetY + "px",
    width: drag.value.width + "px",
    height: drag.value.height + "px",
    zIndex: 200,
    pointerEvents: "none",
  };
});

// ── Session metadata ──────────────────────────────────
const selectedEvaluation = computed(() =>
  evaluations.value.find((e) => e.id === selectedEvaluationId.value),
);
const selectedClass = computed(() =>
  classes.value.find((c) => c.id === selectedClassId.value),
);

// ── Report state ──────────────────────────────────────
const reportModalOpen = ref(false);
const reportData = ref(null); // { sessions: [], students: [], skills: [], events: [] }
const reportLoading = ref(false);
const selectedSessionId = ref(null); // null = all sessions

const filteredEvents = computed(() => {
  if (!reportData.value) return [];
  const all = reportData.value.events;
  if (!selectedSessionId.value) return all;
  return all.filter((e) => e.session_id === selectedSessionId.value);
});

async function openReport() {
  if (!selectedClassId.value || !selectedEvaluationId.value) return;
  reportLoading.value = true;
  reportModalOpen.value = true;
  selectedSessionId.value = null; // reset filter

  try {
    const [sessionsRes, studentsRes, skillsRes, eventsRes] = await Promise.all([
      supabase
        .from("tu_sessions")
        .select("id, started_at, ended_at")
        .eq("class_id", selectedClassId.value)
        .eq("evaluation_id", selectedEvaluationId.value)
        .order("started_at", { ascending: true }),
      supabase
        .from("tu_students")
        .select("id, name")
        .eq("class_id", selectedClassId.value)
        .order("name"),
      supabase
        .from("tu_skills")
        .select("id, name, scale")
        .eq("evaluation_id", selectedEvaluationId.value),
      supabase
        .from("tu_session_events")
        .select("student_id, skill_id, level, session_id, created_at")
        .eq("class_id", selectedClassId.value)
        .eq("evaluation_id", selectedEvaluationId.value)
        .order("created_at", { ascending: true }),
    ]);

    reportData.value = {
      sessions: sessionsRes.data || [],
      students: studentsRes.data || [],
      skills: skillsRes.data || [],
      events: eventsRes.data || [],
    };
  } catch (err) {
    console.error("Failed to load report:", err);
  } finally {
    reportLoading.value = false;
  }
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function countBy(arr, key) {
  const result = {};
  for (const item of arr) {
    const k = typeof key === "function" ? key(item) : item[key];
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}

// ── Report helpers ─────────────────────────────────────
function studentEvents(studentId) {
  if (!reportData.value) return [];
  return filteredEvents.value.filter((e) => e.student_id === studentId);
}

function studentSkillCount(studentId, skillId) {
  return studentEvents(studentId).filter((e) => e.skill_id === skillId).length;
}

function studentNb(studentId) {
  return studentEvents(studentId).length;
}

function studentLevels(studentId) {
  return studentEvents(studentId)
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
}

function studentMin(studentId) {
  const vals = studentLevels(studentId);
  return vals.length > 0 ? Math.min(...vals) : null;
}

function studentMax(studentId) {
  const vals = studentLevels(studentId);
  return vals.length > 0 ? Math.max(...vals) : null;
}

function studentAvg(studentId) {
  const vals = studentLevels(studentId);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function fmtNum(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && !Number.isInteger(v)) return v.toFixed(1);
  return String(v);
}

// ── Per-skill report helpers ───────────────────────────
function studentSkillMin(studentId, skillId) {
  const vals = studentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
  return vals.length > 0 ? Math.min(...vals) : null;
}

function studentSkillMax(studentId, skillId) {
  const vals = studentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
  return vals.length > 0 ? Math.max(...vals) : null;
}

function studentSkillAvg(studentId, skillId) {
  const vals = studentEvents(studentId)
    .filter((e) => e.skill_id === skillId)
    .map((e) => parseFloat(e.level))
    .filter((v) => !isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function studentSkillLast(studentId, skillId) {
  const evts = studentEvents(studentId).filter((e) => e.skill_id === skillId);
  if (evts.length === 0) return null;
  return evts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    .level;
}

defineExpose({
  openClassModal,
  openEvalModal,
  selectedClass,
  selectedEvaluation,
});
</script>

<template>
  <div class="app-root">
    <!-- ── TOP BAR (menu buttons) ──────────────────────── -->
    <div class="top-bar">
      <button
        class="fab"
        :class="{ 'fab--filled': !!selectedClass }"
        title="Classes"
        @click="openClassModal()"
      >
        <template v-if="selectedClass">
          <span class="fab-selected-name">{{ selectedClass.name }}</span>
        </template>
        <template v-else>
          <Users :size="18" />
        </template>
      </button>
      <button
        class="fab"
        :class="{ 'fab--filled': !!selectedEvaluation }"
        title="Évaluations"
        @click="openEvalModal()"
      >
        <template v-if="selectedEvaluation">
          <span class="fab-selected-name">{{ selectedEvaluation.title }}</span>
        </template>
        <template v-else>
          <Dumbbell :size="18" />
        </template>
      </button>

      <!-- Report button -->
      <button
        class="fab"
        :disabled="!selectedClassId || !selectedEvaluationId"
        title="Rapport"
        @click="openReport"
      >
        <BarChart3 :size="18" />
      </button>

      <div class="top-bar-spacer"></div>

      <!-- Session play / stop -->
      <button
        class="fab session-btn"
        :class="{
          'session--active': isSessionActive,
          'session--loading': sessionLoading,
        }"
        :title="isSessionActive ? 'Arrêter la session' : 'Démarrer une session'"
        :disabled="!selectedClassId || !selectedEvaluationId || sessionLoading"
        @click="toggleSession"
      >
        <template v-if="sessionLoading">
          <span class="session-spinner"></span>
        </template>
        <template v-else-if="isSessionActive">
          <Square :size="14" />
        </template>
        <template v-else>
          <Play :size="16" />
        </template>
      </button>
    </div>

    <!-- ── SESSION PICKER ─────────────────────────────── -->
    <div v-if="view === 'select'" class="wood-bg picker-screen">
      <div class="brand">
        <img class="hero-img" src="/tu-hero.png" alt="" />
        <div class="brand-name">Tuvalu</div>
      </div>
      <p class="picker-hint">Sélectionnez une classe et une évaluation</p>
    </div>

    <!-- ── LIVE SCREEN ────────────────────────────────── -->
    <div v-else-if="view === 'active'" class="wood-bg live-screen">
      <!-- Drop zones -->
      <div class="zones-container">
        <div
          v-for="skill in skills"
          :key="skill.id"
          class="drop-zone"
          :class="{
            'zone-hover':
              hoveredSkillId === skill.id &&
              !hasPriorEvals(drag?.student?.id, skill.id),
            'zone-hover-prior':
              hoveredSkillId === skill.id &&
              hasPriorEvals(drag?.student?.id, skill.id),
            'zone-flash': dropFlash === skill.id,
          }"
          :data-skill-id="skill.id"
        >
          <div class="zone-header">
            <span class="zone-name">{{ skill.name }}</span>
          </div>

          <div class="zone-segments">
            <div
              v-for="level in getSkillScale(skill)"
              :key="level"
              class="zone-segment"
              :class="{
                'segment-hover':
                  hoveredSkillId === skill.id && hoveredLevel === level,
                'segment-used': hasUsedLevel(
                  drag?.student?.id,
                  skill.id,
                  level,
                ),
              }"
              :data-skill-id="skill.id"
              :data-level="level"
            >
              {{ level }}
              <span
                v-if="
                  (levelCounts[drag?.student?.id]?.[skill.id]?.[level] || 0) > 0
                "
                class="segment-used-dots"
              >
                <span
                  v-for="n in levelCounts[drag?.student?.id]?.[skill.id]?.[
                    level
                  ] || 0"
                  :key="n"
                  class="segment-used-dot"
                ></span>
              </span>
            </div>
          </div>
        </div>
        <div v-if="skills.length === 0" class="zones-empty">
          No skills defined for this evaluation.
        </div>
      </div>

      <!-- Floating drag clone -->
      <Teleport to="body">
        <div v-if="drag" class="drag-clone" :style="cloneStyle">
          {{ drag.student.name.split(" ")[0] }}
        </div>
      </Teleport>
    </div>

    <!-- ── PERMANENT STUDENTS ROW ───────────────────────── -->
    <div class="students-row">
      <template v-if="view === 'active'">
        <div
          v-for="student in sortedStudents"
          :key="student.id"
          class="student-wrapper"
          :class="{ 'is-ghost': drag?.student?.id === student.id }"
          :data-student-id="student.id"
          :style="{ opacity: studentOpacity(student.id) }"
          @pointerdown="onDragStart($event, student)"
        >
          <div
            class="student-bubble"
            :style="{
              width: bubbleSize() + 'px',
              height: bubbleSize() + 'px',
              fontSize: Math.max(7, bubbleSize() * 0.25) + 'px',
            }"
          >
            {{ student.name.split(" ")[0] }}
          </div>
        </div>
      </template>
      <template v-else>
        <div
          v-for="student in classStudents"
          :key="student.id"
          class="student-wrapper"
        >
          <div class="student-bubble-preview">
            {{ student.name.split(" ")[0] }}
          </div>
        </div>
      </template>
    </div>

    <!-- Class picker dropdown (outside conditional views) -->
    <!-- Class modal (select or edit) -->
    <Teleport to="body">
      <div
        v-if="classModalOpen"
        class="picker-backdrop"
        @click.self="classModalOpen = false"
      >
        <div class="picker-panel class-modal">
          <div class="picker-panel-header">
            <span>{{ classModalTab === "edit" ? "Classes" : "" }}</span>
            <button class="close-btn" @click="classModalOpen = false">
              <X :size="18" />
            </button>
          </div>

          <!-- Select tab -->
          <div v-if="classModalTab === 'select'" class="class-modal-body">
            <button
              v-for="cls in classes"
              :key="cls.id"
              class="picker-item"
              :class="{ selected: selectedClassId === cls.id }"
              @click="selectClass(cls.id)"
            >
              {{ cls.name }}
            </button>
            <div v-if="classes.length === 0" class="picker-empty">
              Aucune classe
            </div>
          </div>

          <!-- Edit tab -->
          <div v-else class="class-modal-body">
            <div v-for="cls in classes" :key="cls.id" class="class-edit-row">
              <template v-if="editingClassId === cls.id">
                <input
                  v-model="editingClassName"
                  class="edit-input"
                  @keyup.enter="saveClassEdit(cls)"
                  @keyup.escape="cancelClassEdit"
                />
                <button class="save-btn" @click="saveClassEdit(cls)">✓</button>
                <button class="cancel-btn" @click="cancelClassEdit">✕</button>
              </template>
              <template v-else>
                <span class="class-name">{{ cls.name }}</span>
                <button class="action-btn" @click="startClassEdit(cls)">
                  <Edit2 :size="16" />
                </button>
                <button class="action-btn delete" @click="deleteClass(cls.id)">
                  <Trash2 :size="16" />
                </button>
              </template>
            </div>

            <div v-if="isAddingNewClass" class="class-edit-row">
              <input
                v-model="editingClassName"
                class="edit-input"
                autofocus
                @keyup.enter="addNewClass"
                @keyup.escape="cancelClassEdit"
              />
              <button class="save-btn" @click="addNewClass">+</button>
              <button class="cancel-btn" @click="cancelClassEdit">✕</button>
            </div>

            <button
              v-if="!isAddingNewClass && !editingClassId"
              class="add-btn"
              @click="
                isAddingNewClass = true;
                editingClassName = '';
              "
            >
              <Plus :size="16" /> Ajouter
            </button>
          </div>

          <!-- Tab switcher -->
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ active: classModalTab === 'select' }"
              @click="
                classModalTab = 'select';
                cancelClassEdit();
              "
            >
              Sélectionner
            </button>
            <button
              class="picker-tab"
              :class="{ active: classModalTab === 'edit' }"
              @click="
                classModalTab = 'edit';
                cancelClassEdit();
              "
            >
              Modifier
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Evaluation modal (select or edit) -->
    <Teleport to="body">
      <div
        v-if="evalModalOpen"
        class="picker-backdrop"
        @click.self="evalModalOpen = false"
      >
        <div class="picker-panel class-modal">
          <div class="picker-panel-header">
            <span>{{ evalModalTab === "edit" ? "Évaluations" : "" }}</span>
            <button class="close-btn" @click="evalModalOpen = false">
              <X :size="18" />
            </button>
          </div>

          <!-- Select tab -->
          <div v-if="evalModalTab === 'select'" class="class-modal-body">
            <button
              v-for="ev in evaluations"
              :key="ev.id"
              class="picker-item"
              :class="{ selected: selectedEvaluationId === ev.id }"
              @click="selectEval(ev.id)"
            >
              {{ ev.title }}
            </button>
            <div v-if="evaluations.length === 0" class="picker-empty">
              Aucune évaluation
            </div>
          </div>

          <!-- Edit tab -->
          <div v-else class="class-modal-body">
            <div v-for="ev in evaluations" :key="ev.id" class="class-edit-row">
              <template v-if="editingEvalId === ev.id">
                <input
                  v-model="editingEvalTitle"
                  class="edit-input"
                  @keyup.enter="saveEvalEdit(ev)"
                  @keyup.escape="cancelEvalEdit"
                />
                <button class="save-btn" @click="saveEvalEdit(ev)">✓</button>
                <button class="cancel-btn" @click="cancelEvalEdit">✕</button>
              </template>
              <template v-else>
                <span class="class-name">{{ ev.title }}</span>
                <button class="action-btn" @click="startEvalEdit(ev)">
                  <Edit2 :size="16" />
                </button>
                <button class="action-btn delete" @click="deleteEval(ev.id)">
                  <Trash2 :size="16" />
                </button>
              </template>
            </div>

            <div v-if="isAddingNewEval" class="class-edit-row">
              <input
                v-model="editingEvalTitle"
                class="edit-input"
                autofocus
                @keyup.enter="addNewEval"
                @keyup.escape="cancelEvalEdit"
              />
              <button class="save-btn" @click="addNewEval">+</button>
              <button class="cancel-btn" @click="cancelEvalEdit">✕</button>
            </div>

            <button
              v-if="!isAddingNewEval && !editingEvalId"
              class="add-btn"
              @click="
                isAddingNewEval = true;
                editingEvalTitle = '';
              "
            >
              <Plus :size="16" /> Ajouter
            </button>
          </div>

          <!-- Tab switcher -->
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ active: evalModalTab === 'select' }"
              @click="
                evalModalTab = 'select';
                cancelEvalEdit();
              "
            >
              Sélectionner
            </button>
            <button
              class="picker-tab"
              :class="{ active: evalModalTab === 'edit' }"
              @click="
                evalModalTab = 'edit';
                cancelEvalEdit();
              "
            >
              Modifier
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── REPORT MODAL ─────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="reportModalOpen"
        class="picker-backdrop"
        @click.self="reportModalOpen = false"
      >
        <div class="picker-panel report-modal">
          <div class="picker-panel-header">
            <span>Rapport</span>
            <button class="close-btn" @click="reportModalOpen = false">
              <X :size="18" />
            </button>
          </div>

          <div class="report-body">
            <!-- Loading -->
            <div v-if="reportLoading" class="report-loading">Chargement…</div>

            <!-- No data -->
            <div v-else-if="!reportData" class="report-empty">
              Aucune donnée.
            </div>

            <template v-else>
              <div class="report-meta">
                {{ selectedClass?.name }} — {{ selectedEvaluation?.title }} ·
                {{ reportData.sessions.length }} session(s) ·
                {{ reportData.students.length }} élève(s)
              </div>

              <!-- Session filter -->
              <div class="report-filter" v-if="reportData.sessions.length > 0">
                <select v-model="selectedSessionId" class="session-select">
                  <option :value="null">Toutes les sessions</option>
                  <option
                    v-for="s in reportData.sessions"
                    :key="s.id"
                    :value="s.id"
                  >
                    {{ formatDateTime(s.started_at)
                    }}{{
                      s.ended_at
                        ? " → " + formatDateTime(s.ended_at)
                        : " (en cours)"
                    }}
                  </option>
                </select>
              </div>

              <!-- No students at all -->
              <div v-if="reportData.students.length === 0" class="report-empty">
                Aucun élève dans cette classe.
              </div>

              <!-- Student list (always shown) -->
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
                    <tr
                      v-for="student in reportData.students"
                      :key="student.id"
                    >
                      <td class="report-td-student">
                        {{ student.name }}
                      </td>
                      <td
                        v-for="skill in reportData.skills"
                        :key="skill.id"
                        class="report-td-count"
                      >
                        <template
                          v-if="studentSkillCount(student.id, skill.id) > 0"
                        >
                          <div class="skill-stats">
                            <span class="stat-item">
                              <Eye :size="11" />
                              <span class="stat-val">{{
                                studentSkillCount(student.id, skill.id)
                              }}</span>
                            </span>
                            <span class="stat-item stat-tri">
                              <span class="tri-down">▼</span>
                              <span class="stat-val">{{
                                fmtNum(studentSkillMin(student.id, skill.id))
                              }}</span>
                            </span>
                            <span class="stat-item stat-tri">
                              <span class="tri-up">▲</span>
                              <span class="stat-val">{{
                                fmtNum(studentSkillMax(student.id, skill.id))
                              }}</span>
                            </span>
                            <span class="stat-item">
                              <span class="stat-tilde">~</span>
                              <span class="stat-val">{{
                                fmtNum(studentSkillAvg(student.id, skill.id))
                              }}</span>
                            </span>
                            <span
                              v-if="
                                studentSkillLast(student.id, skill.id) != null
                              "
                              class="stat-item stat-last-big"
                            >
                              {{ studentSkillLast(student.id, skill.id) }}
                            </span>
                          </div>
                        </template>
                        <span v-else class="stats-na">N/A</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── App root ─────────────────────────────────────── */
.app-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

/* ── Top bar (menu buttons) ────────────────────────── */
.top-bar,
.students-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: rgb(48, 24, 0);

  height: 60px;
}

/* ── Menu buttons ──────────────────────────────────── */
.fab {
  border: 2px #ffe8a0 solid;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  /* background: rgba(20, 10, 2, 0.8);
  backdrop-filter: blur(8px); */
  color: #ffe8a0;
  background: none;
  /* box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s,
    box-shadow 0.2s;
  font-family: inherit;
}

/* ── Wood background ──────────────────────────────── */
.wood-bg {
  /* flexible height, parent controls it */
  background:
    radial-gradient(
      ellipse 90% 35% at 50% 0%,
      rgba(255, 235, 140, 0.18) 0%,
      transparent 65%
    ),
    repeating-linear-gradient(
      180deg,
      transparent 0px,
      transparent 53px,
      rgba(80, 38, 4, 0.28) 53px,
      rgba(80, 38, 4, 0.28) 56px
    ),
    repeating-linear-gradient(
      94deg,
      transparent 0%,
      rgba(255, 255, 255, 0.03) 12%,
      transparent 25%,
      rgba(0, 0, 0, 0.025) 38%,
      transparent 50%
    ),
    linear-gradient(168deg, #e0a830 0%, #c88820 35%, #b07018 70%, #c08828 100%);
}

/* ── Picker ───────────────────────────────────────── */
.picker-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem 1rem;
  min-height: 0;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.hero-img {
  width: 140px;
  opacity: 0.9;
  margin-bottom: -28px;
  position: relative;
  z-index: 1;
}
.brand-name {
  font-size: 2.6rem;
  font-weight: 700;
  color: #ffeece;
  white-space: nowrap;
  /* text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4); */
  margin-top: 15px;
}

.picker-hint {
  color: rgba(255, 220, 120, 0.45);
  font-size: 0.85rem;
  font-style: italic;
}

/* ── Class preview (students on picker screen) ────── */
.class-preview {
  width: 100%;
  max-width: 500px;
  margin-top: 1.5rem;
  padding: 1rem 1.25rem;
  background: rgba(20, 10, 2, 0.45);
  border: 1px solid rgba(255, 200, 80, 0.12);
  border-radius: 16px;
  backdrop-filter: blur(4px);
}

.class-preview-label {
  font-size: 0.85rem;
  color: rgba(255, 220, 140, 0.55);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.class-preview-label strong {
  color: rgba(255, 235, 170, 0.9);
  font-weight: 700;
}

.class-preview-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: rgba(255, 200, 80, 0.4);
}

.class-preview-students {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── Top bar spacer pushes session btn right ──── */
.top-bar-spacer {
  flex: 1;
}

/* ── Session button ───────────────────────────────── */
.session-btn {
  transition:
    background 0.2s,
    border-color 0.2s,
    opacity 0.2s;
}

.session-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.session-btn:not(:disabled):hover {
  background: rgba(255, 232, 160, 0.12);
}

.session--active {
  border-color: #ff6b6b !important;
  color: #ff6b6b !important;
}

.session--active:not(:disabled):hover {
  background: rgba(255, 107, 107, 0.12) !important;
}

.session-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #ffe8a0;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Student bubble preview (picker screen) ───────── */
.student-bubble-preview {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px #ffe8a0 solid;
  background: none;
  color: #ffe8a0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ── Live layout ──────────────────────────────────── */
.live-screen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

/* ── Drop zones container ─────────────────────────── */
.zones-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  margin: 4px 12px;
  border: 2px dashed rgba(255, 200, 80, 0.2);
  border-radius: 12px;
  background: rgba(20, 10, 2, 0.35);
  transition:
    background 0.18s,
    border-color 0.18s,
    transform 0.15s,
    box-shadow 0.18s;
  cursor: default;
}

.drop-zone:first-child {
  margin-top: 8px;
}
.drop-zone:last-child {
  margin-bottom: 8px;
}

.zone-header {
  text-align: center;
  padding: 6px 10px 2px;
  flex-shrink: 0;
  pointer-events: none;
}

.zone-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: rgba(255, 220, 120, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: color 0.18s;
  pointer-events: none;
}

.zone-prior-count {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(232, 168, 32, 0.7);
  color: #1a0e04;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* Zone: hover (no prior evals) */
.zone-hover {
  border-color: rgba(255, 200, 80, 0.7);
  background: rgba(40, 22, 4, 0.6);
  box-shadow: 0 0 20px rgba(232, 168, 32, 0.25);
  transform: scale(1.02);
}
.zone-hover .zone-name {
  color: rgba(255, 230, 140, 0.9);
}

/* Zone: hover (has prior evals) */
.zone-hover-prior {
  border-color: rgba(255, 200, 80, 0.45);
  background: rgba(30, 16, 3, 0.5);
  border-style: solid;
}
.zone-hover-prior .zone-name {
  color: rgba(255, 200, 120, 0.65);
}

/* Zone: confirmation flash */
@keyframes zone-flash-anim {
  0% {
    background: rgba(232, 168, 32, 0.55);
    border-color: #e8a820;
    box-shadow: 0 0 28px rgba(232, 168, 32, 0.6);
  }
  100% {
    background: rgba(20, 10, 2, 0.35);
    border-color: rgba(255, 200, 80, 0.2);
    box-shadow: none;
  }
}
.zone-flash {
  animation: zone-flash-anim 0.4s ease-out forwards;
}

.zones-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 200, 120, 0.35);
  font-size: 0.9rem;
  font-style: italic;
}

/* ── Students row ─────────────────────────────────── */
.students-row-container {
  flex-shrink: 0;
  background: rgba(10, 5, 0, 0.6);
  border-top: 1px solid rgba(255, 200, 80, 0.12);
  padding: 6px 8px;
}

/* ── Student wrapper ──────────────────────────────── */
.student-wrapper {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: opacity 0.2s;
  touch-action: none;
  /* background: rgba(255, 142, 50, 0.35); */
}
.student-wrapper:active {
  cursor: grabbing;
}
.student-wrapper.is-ghost {
  opacity: 0.25 !important;
}

/* ── Student bubble ───────────────────────────────── */
.student-bubble {
  border-radius: 50%;
  border: 2px #ffe8a0 solid;
  background: none;
  color: #ffe8a0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  line-height: 1.1;
  transition:
    width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease,
    font-size 0.3s ease;
  pointer-events: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: 2px;
}

/* ── Drag clone ───────────────────────────────────── */
.drag-clone {
  border-radius: 50%;
  border: 2px #ffe8a0 solid;
  background: rgba(20, 10, 2, 0.85);
  color: #ffe8a0;
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.55),
    0 2px 6px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  line-height: 1.1;
  font-size: 8px;
  transform: scale(1.15);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: 2px;
}

/* ── Zone sub-segments (shown during drag) ─────────── */
.zone-segments {
  display: flex;
  flex: 1;
  width: 100%;
  gap: 2px;
  padding: 2px 4px 4px;
}

.zone-segment {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 1px dashed rgba(255, 200, 80, 0.3);
  border-radius: 8px;
  background: rgba(30, 16, 3, 0.4);
  color: rgba(255, 220, 120, 0.6);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s,
    transform 0.1s;
}

.segment-hover {
  border-color: rgba(255, 200, 80, 0.85);
  background: rgba(232, 168, 32, 0.35);
  color: #ffe8a0;
  transform: scale(1.04);
  border-style: solid;
}

.segment-used-dots {
  position: absolute;
  top: 3px;
  left: 5px;
  display: flex;
  gap: 4px;
  pointer-events: none;
}

.segment-used-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 220, 120, 0.45);
  box-shadow: 0 0 3px rgba(255, 220, 120, 0.25);
  pointer-events: none;
}

/* ── Class modal (big popup) ──────────────────────────── */
.class-modal {
  width: 95vw;
  max-width: 800px;
  max-height: 92vh;
  border-radius: 28px;
  box-shadow:
    0 48px 120px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 200, 80, 0.08),
    inset 0 1px 0 rgba(255, 235, 170, 0.06);
  overflow: hidden;
  clip-path: circle(0% at 0% 0%);
  animation: class-modal-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes class-modal-enter {
  from {
    clip-path: circle(16px at 40px 40px);
    opacity: 0;
  }
  to {
    clip-path: circle(150% at 50% 50%);
    opacity: 1;
  }
}

.class-modal-body {
  padding: 0.25rem 0 0.5rem;
  overflow-y: auto;
  max-height: calc(92vh - 140px);
  scrollbar-width: thin;
  scrollbar-color: rgba(232, 168, 32, 0.3) transparent;
}

.class-modal-body::-webkit-scrollbar {
  width: 8px;
}

.class-modal-body::-webkit-scrollbar-track {
  background: rgba(20, 10, 2, 0.3);
  border-radius: 4px;
}

.class-modal-body::-webkit-scrollbar-thumb {
  background: rgba(232, 168, 32, 0.4);
  border-radius: 4px;
  transition: background 0.2s;
}

.class-modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(232, 168, 32, 0.6);
}

.class-edit-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.35rem 1rem;
  padding: 0.75rem 1.25rem;
  border-radius: 16px;
  background: rgba(255, 200, 80, 0.04);
  transition: background 0.15s;
}

.class-edit-row:hover {
  background: rgba(255, 200, 80, 0.08);
}

.class-name {
  flex: 1;
  font-size: 1.25rem;
  color: rgba(255, 235, 170, 0.85);
  font-weight: 500;
}

.class-edit-row .edit-input {
  flex: 1;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: 1.5px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.6);
  color: #ffe090;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
}

.class-edit-row .edit-input:focus {
  border-color: #e8a820;
  background: rgba(30, 16, 3, 0.7);
  box-shadow: 0 0 0 3px rgba(232, 168, 32, 0.12);
}

.class-edit-row .edit-input::placeholder {
  color: rgba(255, 220, 140, 0.35);
}
.picker-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(255, 200, 80, 0.08);
  background: rgba(10, 5, 0, 0.25);
}

.picker-tab {
  flex: 1;
  padding: 0.7rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 220, 140, 0.45);
  background: rgba(255, 200, 80, 0.04);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.picker-tab:hover {
  color: rgba(255, 235, 170, 0.7);
  background: rgba(255, 200, 80, 0.1);
}

.picker-tab.active {
  color: #ffe090;
  background: rgba(232, 168, 32, 0.15);
}
.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 200, 80, 0.4);
  cursor: pointer;
  padding: 0.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-btn:hover {
  color: #ffe090;
  background: rgba(255, 80, 60, 0.15);
}

.action-btn {
  background: transparent;
  border: none;
  color: rgba(255, 220, 140, 0.55);
  cursor: pointer;
  padding: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.action-btn:hover {
  color: #ffe090;
  background: rgba(255, 200, 80, 0.15);
  transform: scale(1.08);
}

.action-btn.delete:hover {
  color: #ff7060;
  background: rgba(255, 80, 60, 0.18);
}

.save-btn,
.cancel-btn {
  background: transparent;
  border: 1.5px solid rgba(255, 200, 80, 0.25);
  color: rgba(255, 220, 140, 0.65);
  cursor: pointer;
  padding: 0.3rem 0.65rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
}

.save-btn:hover {
  background: rgba(232, 168, 32, 0.3);
  border-color: #e8a820;
  color: #ffe090;
}

.cancel-btn:hover {
  background: rgba(255, 80, 60, 0.2);
  border-color: rgba(255, 100, 80, 0.5);
  color: #ff9080;
}
.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: calc(100% - 2rem);
  margin: 0.5rem 1rem 0.75rem;
  padding: 0.85rem 1.5rem;
  background: rgba(232, 168, 32, 0.08);
  border: 1.5px dashed rgba(255, 200, 80, 0.2);
  border-radius: 16px;
  color: rgba(255, 220, 140, 0.6);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.add-btn:hover {
  color: #ffe090;
  background: rgba(232, 168, 32, 0.15);
  border-color: rgba(255, 200, 80, 0.45);
  transform: translateY(-1px);
}

/* ── Report modal ─────────────────────────────────── */
.report-modal {
  width: 95vw;
  max-width: 960px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.report-body {
  padding: 0.5rem 1.5rem 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.report-loading,
.report-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(255, 200, 140, 0.5);
  font-size: 1.1rem;
}

.report-meta {
  font-size: 0.85rem;
  color: rgba(255, 220, 140, 0.5);
  margin-bottom: 0.5rem;
}

.report-filter {
  margin-bottom: 0.75rem;
}

.session-select {
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.6);
  color: rgba(255, 235, 170, 0.85);
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  max-width: 100%;
}

.session-select:focus {
  border-color: rgba(232, 168, 32, 0.5);
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  font-size: 0.82rem;
}

.report-table th,
.report-table td {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(255, 200, 80, 0.1);
  text-align: center;
}

.report-table thead th {
  background: rgba(232, 168, 32, 0.1);
  color: rgba(255, 230, 160, 0.7);
  font-weight: 700;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.report-th-student {
  min-width: 120px;
  text-align: left;
}

.report-th-skill-col {
  min-width: 60px;
  text-align: center;
}

.report-td-student {
  text-align: left;
  color: rgba(255, 235, 170, 0.85);
  font-weight: 600;
}

.report-td-count {
  color: rgba(255, 220, 120, 0.6);
  font-weight: 600;
  font-size: 0.85rem;
  text-align: center;
  min-width: 150px;
}

/* ── Skill cell stats ────────────────────────────── */
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
  color: rgba(255, 220, 120, 0.7);
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
  font-size: 0.55rem;
  line-height: 1;
}

.tri-up {
  color: rgba(100, 200, 130, 0.7);
  font-size: 0.55rem;
  line-height: 1;
}

.stat-tilde {
  color: rgba(255, 235, 170, 0.75);
  font-weight: 600;
  font-size: 0.85rem;
  line-height: 1;
}

.stat-last-big {
  font-size: 0.96rem;
  font-weight: 700;
  color: #ffe8a0;
  line-height: 1;
}

.stats-na {
  color: rgba(255, 220, 120, 0.35);
  font-size: 0.8rem;
  font-style: italic;
}

.report-session-detail {
  margin-top: 1rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(255, 200, 80, 0.08);
}

.report-session-header {
  font-size: 0.85rem;
  font-weight: 700;
  color: rgba(255, 230, 160, 0.6);
  margin-bottom: 0.4rem;
}

.report-session-ended {
  color: rgba(255, 200, 140, 0.4);
  font-weight: 400;
}

.report-session-active {
  color: #6bff6b;
  font-weight: 400;
  font-size: 0.75rem;
}

.report-student-detail {
  display: flex;
  gap: 0.6rem;
  padding: 0.2rem 0;
  font-size: 0.8rem;
  flex-wrap: wrap;
}

.report-detail-name {
  color: rgba(255, 235, 170, 0.8);
  font-weight: 600;
  min-width: 100px;
}

.report-detail-skill {
  color: rgba(255, 220, 140, 0.55);
}
</style>
<style>
.nav-circles {
  position: fixed;
  top: 1rem;
  left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 60;
}
.nav-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.75);
  backdrop-filter: blur(8px);
  color: rgba(255, 220, 120, 0.55);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition:
    background 0.2s,
    border-color 0.2s,
    color 0.2s,
    transform 0.15s,
    box-shadow 0.2s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  font-family: inherit;
}
.nav-circle:hover {
  color: rgba(255, 230, 140, 0.85);
  border-color: rgba(255, 200, 80, 0.4);
  transform: scale(1.08);
  background: rgba(40, 22, 4, 0.85);
}
.nav-circle--active {
  color: #ffe090;
  border-color: #e8a820;
  background: rgba(60, 34, 6, 0.9);
  box-shadow: 0 4px 20px rgba(232, 168, 32, 0.3);
}
.nav-circle--filled {
  color: #ffe8a0;
  border-color: rgba(255, 200, 80, 0.45);
}
.nav-circle-label {
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-circle--stop {
  color: #f09080;
  border-color: rgba(255, 100, 80, 0.3);
}
.nav-circle--stop:hover {
  color: #f0a090;
  border-color: rgba(255, 100, 80, 0.5);
  background: rgba(255, 80, 60, 0.12);
} /*
── Picker dropdowns (big popups) ──────────────────── */
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.picker-panel {
  background: rgba(20, 10, 2, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 28px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
}
.picker-panel-header {
  padding: 1.2rem 1.5rem 0.6rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 220, 140, 0.4);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.picker-item {
  display: block;
  width: calc(100% - 2rem);
  margin: 0.4rem 1rem;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 16px;
  background: rgba(255, 200, 80, 0.06);
  color: rgba(255, 235, 170, 0.8);
  font-size: 1.25rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    transform 0.12s,
    box-shadow 0.15s;
}
.picker-item:hover {
  background: rgba(255, 200, 80, 0.14);
  color: #ffe8b0;
  transform: translateX(4px);
}
.picker-item.selected {
  background: rgba(232, 168, 32, 0.2);
  color: #ffe090;
  box-shadow: inset 0 0 0 1px rgba(232, 168, 32, 0.3);
}
.picker-item.selected {
  background: rgba(232, 168, 32, 0.25);
  color: #ffe090;
  font-weight: 700;
}
.picker-empty {
  padding: 3rem 1.5rem;
  text-align: center;
  color: rgba(255, 200, 140, 0.4);
  font-style: italic;
  font-size: 1.1rem;
}
</style>
