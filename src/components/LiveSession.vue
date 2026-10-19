<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import {
  Users,
  Cake,
  Star,
  EyeOff,
  Sun,
  Moon,
  X,
  Plus,
  Trash2,
  BarChart3,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Undo2,
  Download,
  Upload,
  Check,
  HatGlasses,
  Funnel,
  User,
  LogOut,
  createLucideIcon,
  PenIcon,
  Component,
} from "@lucide/vue";
import { preferences } from "../stores/preferences";
import { allRows } from "../lib/data";
import {
  birthdayInDays,
  studentName,
  belongsTo,
  observationClass,
  isSkillComplete,
  isStudentComplete,
  gradeSnapshot,
} from "../lib/domain";
import StudentAvatar from "./StudentAvatar.vue";
import Birthdays from "./popup/Birthdays.vue";
import LoadingPopup from "./popup/LoadingPopup.vue";
import { supabase } from "../supabase";
import { skillIconNames } from "../data/skillIcons";
import { signOut, userEmail, userId } from "../stores/auth";

const BASE = import.meta.env.BASE_URL; // "/tu-valu/"

const Sneaker = createLucideIcon("Sneaker", [
  ["path", { d: "M14.1 7.9 12.5 10" }],
  ["path", { d: "M17.4 10.1 16 12" }],
  [
    "path",
    {
      d: "M2 16a2 2 0 0 0 2 2h13c2.8 0 5-2.2 5-5a2 2 0 0 0-2-2c-.8 0-1.6-.2-2.2-.7l-6.2-4.2c-.4-.3-.9-.2-1.3.1 0 0-.6.8-1.2 1.1a3.5 3.5 0 0 1-4.2.1C4.4 7 3.7 6.3 3.7 6.3A.92.92 0 0 0 2 7Z",
    },
  ],
  ["path", { d: "M2 11c0 1.7 1.3 3 3 3h7" }],
]);
import ClassDetail from "./detail/ClassDetail.vue";
import EvalDetail from "./detail/EvalDetail.vue";
import StudentDetail from "./detail/StudentDetail.vue";
import SkillDetail from "./detail/SkillDetail.vue";
import RangeInput from "./RangeInput.vue";
import IconSelector from "./popup/IconSelector.vue";
import Settings from "./popup/Settings.vue";
import ClassModal from "./modal/ClassModal.vue";
import EvalModal from "./modal/EvalModal.vue";
import ReportModal from "./modal/ReportModal.vue";
import TeamModal from "./modal/TeamModal.vue";
import ActionConfirmation from "./popup/ActionConfirmation.vue";

const actionConfirmation = ref(null);
const showBirthdays = ref(false);
const birthdayToday = ref(new Date());
const birthdayOpenedOn = ref("");
const birthdayDay = computed(() => birthdayToday.value.toLocaleDateString("en-CA"));
const hasBirthdaysToday = computed(() =>
  allStudents.value.some((student) => birthdayInDays(student.birth_date, birthdayToday.value) === 0),
);
const birthdayUnseen = computed(() =>
  hasBirthdaysToday.value && birthdayOpenedOn.value !== birthdayDay.value,
);
let birthdayTimer;
onMounted(() => {
  birthdayToday.value = new Date();
  birthdayTimer = setInterval(() => { birthdayToday.value = new Date(); }, 60000);
});
onUnmounted(() => clearInterval(birthdayTimer));
function openBirthdays() {
  birthdayToday.value = new Date();
  birthdayOpenedOn.value = birthdayDay.value;
  showBirthdays.value = true;
}
const hiddenStudents = ref(new Set());
const absentStudents = ref(new Set());
const priorities = ref({});
const saveError = ref("");
const savingEvent = ref(false);
const activeTeamIds = ref([]);
const teamBatchId = ref(null);
const allTeams = ref([]);
const teamBatches = computed(() => [
  ...new Set(allTeams.value.map((t) => t.batch_id || "legacy")),
]);
function deselectAll() {
  checkedClassIds.value = new Set();
  checkedStudentIds.value = new Set();
  excludedStudentIds.value = new Set();
  hiddenStudents.value = new Set();
  absentStudents.value = new Set();
}
const rosterStudents = computed(() =>
  allStudents.value.filter(
    (s) =>
      (checkedStudentIds.value.has(s.id) ||
        [...checkedClassIds.value].some((id) => belongsTo(s, id))) &&
      !excludedStudentIds.value.has(s.id),
  ),
);
const cohortStudents = computed(() =>
  rosterStudents.value.filter((s) => !absentStudents.value.has(s.id)),
);
const visibleStudents = computed(() =>
  sortedStudents.value.filter(
    (s) =>
      !hiddenStudents.value.has(s.id) &&
      !absentStudents.value.has(s.id) &&
      !isStudentComplete(s.id, currentSkills.value, counts.value),
  ),
);
function restoreStudents() {
  hiddenStudents.value = new Set();
}
let countRequest = 0;

// ── Setup state ───────────────────────────────────────
const classes = ref([]);
const evaluations = ref([]);
const selectedClassId = ref(null);
const dataLoading = ref(false);
const countLoading = ref(false);
const loading = computed(() => dataLoading.value || countLoading.value);
let dataRequest = 0;

// ── Picker state ──────────────────────────────────────
const classModalTab = ref("select"); // 'select' | 'edit'
const evalModalTab = ref("select"); // 'select' | 'edit'

// Single variable to track which modal is open: 'class', 'eval', 'report', 'teams', or null
const activeModal = ref(null);

// Helper functions to check if a specific modal is open
const isClassModalOpen = computed(() => activeModal.value === "class");
const isEvalModalOpen = computed(() => activeModal.value === "eval");
const isReportModalOpen = computed(() => activeModal.value === "report");
const isTeamModalOpen = computed(() => activeModal.value === "teams");

// Unified function to toggle modals
function toggleModal(modalName) {
  activeModal.value = activeModal.value === modalName ? null : modalName;
}

// ── Teams state ───────────────────────────────────────
const teams = ref([]); // All teams from database
const activeTeamId = ref(null); // Currently selected team for filtering (null = all teams)
const teamsActive = ref(false); // Whether team concept is currently active in session
const studentTeamMap = ref({}); // { studentId: teamId }

// Team colors palette
const teamColors = [
  "#FF0000", // Red
  "#0066CC", // Blue
  "#00AA00", // Green
  "#FFD700", // Yellow/Gold
  "#FF8C00", // Orange
  "#000000", // Black
  "#FF69B4", // Pink
  "#9932CC", // Purple
  "#FFFFFF", // White

  "#00CED1", // Cyan/Turquoise
];

function getTeamColor(teamId) {
  if (!teamId) return null;
  const team = teams.value.find((t) => t.id === teamId);
  if (!team) return null;
  // Use team's saved color, or fallback to palette based on index
  if (team.color) return team.color;
  const teamIndex = teams.value.findIndex((t) => t.id === teamId);
  return teamColors[teamIndex % teamColors.length];
}

function getStudentTeamColor(studentId) {
  const teamId = studentTeamMap.value[studentId];
  return getTeamColor(teamId);
}

// ── Checkbox selection state ───────────────────────────
const checkedClassIds = ref(new Set());
const checkedEvalIds = ref(new Set());
const checkedStudentIds = ref(new Set());
const checkedSkillIds = ref(new Set());
const excludedStudentIds = ref(new Set()); // students excluded from a checked class
const excludedSkillIds = ref(new Set()); // skills excluded from a checked evaluation

// Computed properties for counts (ensures reactivity)
const checkedSkillCount = computed(() => checkedSkillIds.value.size);
const checkedClassCount = computed(() => checkedClassIds.value.size);
const checkedEvalCount = computed(() => checkedEvalIds.value.size);
const checkedStudentCount = computed(() => checkedStudentIds.value.size);

function toggleChecked(id, type) {
  let set;
  if (type === "class") set = checkedClassIds.value;
  else if (type === "eval") set = checkedEvalIds.value;
  else if (type === "student") set = checkedStudentIds.value;
  else if (type === "skill") set = checkedSkillIds.value;
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  // Trigger reactivity by reassigning
  if (type === "class") checkedClassIds.value = new Set(set);
  else if (type === "eval") checkedEvalIds.value = new Set(set);
  else if (type === "student") checkedStudentIds.value = new Set(set);
  else if (type === "skill") checkedSkillIds.value = new Set(set);
}

// ── Expand/collapse folder state ───────────────────────
const expandedClassId = ref(null);
const expandedEvalId = ref(null);

async function toggleClassExpand(cls) {
  if (expandedClassId.value === cls.id) {
    expandedClassId.value = null;
    return;
  }
  expandedClassId.value = cls.id;
}

async function toggleEvalExpand(ev) {
  if (expandedEvalId.value === ev.id) {
    expandedEvalId.value = null;
    return;
  }
  expandedEvalId.value = ev.id;
}

// ── Class CRUD state ───────────────────────────────────

// ── Evaluation CRUD state ──────────────────────────────

// ── Live state ────────────────────────────────────────
const allStudents = ref([]); // Single source of truth for all students
const students = ref([]); // Students currently in active session (for drag-drop)
const skills = ref([]);
const counts = ref({}); // { studentId: { skillId: count } } — all events
const usedLevels = ref({}); // { studentId: { skillId: { level: true } } }
const levelCounts = ref({}); // { studentId: { skillId: { level: count } } }

// ── Reactive computed arrays ─────────────────────────
// Current students to display (based on selections and team filter)
const currentStudents = computed(() => {
  const excluded = excludedStudentIds.value;

  // Filter allStudents based on checked classes/students, exclusions, gender, and team
  return allStudents.value.filter((s) => {
    // Check if student is in a checked class
    const isInCheckedClass = [...checkedClassIds.value].some((id) =>
      belongsTo(s, id),
    );
    // Check if student is individually checked
    const isIndividuallyChecked = checkedStudentIds.value.has(s.id);
    // Check if student is excluded
    const isExcluded = excluded.has(s.id);

    // Apply gender filter
    let matchesGender = true;
    if (genderFilter.value === "male") {
      matchesGender = s.gender === "M";
    } else if (genderFilter.value === "female") {
      matchesGender = s.gender === "F";
    }

    // Apply team filter if teams are active
    let matchesTeam = true;
    if (teamsActive.value && activeTeamIds.value.length) {
      matchesTeam = activeTeamIds.value.includes(studentTeamMap.value[s.id]);
    }

    return (
      (isInCheckedClass || isIndividuallyChecked) &&
      !isExcluded &&
      matchesGender &&
      matchesTeam
    );
  });
});

// Current evaluations/skills to display
const currentSkills = computed(() => {
  // Simply return all skills that are in checkedSkillIds
  return skills.value.filter(
    (sk) =>
      checkedSkillIds.value.has(sk.id) &&
      !evaluations.value.find((ev) => ev.id === sk.evaluation_id)?.archived_at,
  );
});

// ── Logout handler ────────────────────────────────────
async function handleLogout() {
  if (confirm("Are you sure you want to sign out?")) {
    await signOut();
  }
}

// ── Load all data on mount ────────────────────────────
async function loadAllData() {
  const request = ++dataRequest;
  dataLoading.value = true;
  saveError.value = "";
  try {
    const [classData, evalData, studentData, memberships, skillData] =
      await Promise.all([
        allRows(() =>
          supabase.from("tu_classes").select("*").order("name").order("id"),
        ),
        allRows(() =>
          supabase
            .from("tu_evaluations")
            .select("*")
            .order("sort_order")
            .order("id"),
        ),
        allRows(() => supabase.from("tu_students").select("*").order("id")),
        allRows(() =>
          supabase
            .from("tu_student_classes")
            .select("*")
            .order("student_id")
            .order("class_id"),
        ),
        allRows(() =>
          supabase.from("tu_skills").select("*").order("name").order("id"),
        ),
      ]);
    if (request !== dataRequest) return;
    classes.value = classData;
    evaluations.value = evalData;
    skills.value = skillData;
    allStudents.value = studentData.map((s) => ({
      ...s,
      class_ids: memberships
        .filter((m) => m.student_id === s.id)
        .map((m) => m.class_id),
      class_numbers: Object.fromEntries(
        memberships
          .filter((m) => m.student_id === s.id)
          .map((m) => [m.class_id, m.student_number]),
      ),
    }));
    await loadTeams();
    if (hasEvalSelection.value) await startSession();
  } catch (error) {
    if (request === dataRequest) saveError.value = error.message;
  } finally {
    if (request === dataRequest) dataLoading.value = false;
  }
}

// ── Teams functions ───────────────────────────────────
async function loadTeams() {
  allTeams.value = await allRows(() =>
    supabase
      .from("tu_teams")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id"),
  );
  if (
    !teamBatchId.value ||
    !allTeams.value.some((t) => (t.batch_id || "legacy") === teamBatchId.value)
  )
    teamBatchId.value = allTeams.value[0]?.batch_id || "legacy";
  teams.value = allTeams.value.filter(
    (t) => (t.batch_id || "legacy") === teamBatchId.value,
  );
  const relationships = teams.value.length
    ? await allRows(() =>
        supabase
          .from("tu_student_teams")
          .select("*")
          .in(
            "team_id",
            teams.value.map((t) => t.id),
          )
          .order("student_id")
          .order("team_id"),
      )
    : [];
  studentTeamMap.value = Object.fromEntries(
    relationships.map((r) => [r.student_id, r.team_id]),
  );
  activeTeamIds.value = activeTeamIds.value.filter((id) =>
    teams.value.some((t) => t.id === id),
  );
}
watch(teamBatchId, (value, previous) => {
  if (value && previous)
    loadTeams().catch((e) => {
      saveError.value = e.message;
    });
});

function openTeamModal() {
  toggleModal("teams");
}

function onTeamsCreated(newTeams) {
  teamBatchId.value = null;
  activeModal.value = null;
  teamsActive.value = true;
  loadTeams(); // Reload teams from database
}

function toggleTeamFilter(teamId) {
  if (activeTeamId.value === teamId) {
    activeTeamId.value = null; // Show all
  } else {
    activeTeamId.value = teamId; // Filter to this team
  }
}

function toggleTeamsActive() {
  teamsActive.value = !teamsActive.value;
  if (!teamsActive.value) {
    activeTeamId.value = null;
  }
}

// ── Drag-and-drop state ───────────────────────────────
const drag = ref(null); // { student, startX, startY, currentX, currentY, offsetX, offsetY, width, height }
const hoveredSkillId = ref(null);
const dropFlash = ref(null); // skillId that just received a drop
const hoveredLevel = ref(null); // level label being hovered within a zone
const hoveredAbsent = ref(false); // whether drag is over the absent zone

// ── Students row filter state ─────────────────────────
const filterPanelOpen = ref(false);
const userMenuOpen = ref(false);
const sortBy = ref("firstname"); // 'firstname' | 'lastname'
const genderFilter = ref("all"); // 'all' | 'male' | 'female' (data not yet in DB)
const showFilterModal = ref(false); // Modal for filters

onMounted(async () => {
  await loadAllData();
});

async function selectClass(id) {
  selectedClassId.value = id;
  // Don't close modal - let user manage classes/students
  if (hasEvalSelection.value) startSession();
}

function openClassModal() {
  toggleModal("class");
  classModalTab.value = "select";
}

async function onStudentImportImported() {
  await loadAllData();
}

// Selected evaluation for modal
const selectedEvalId = ref(null);

function selectEvalInModal(evalId) {
  selectedEvalId.value = evalId;
}

// Helper functions for template
function formatStudentName(student) {
  return studentName(student, preferences);
}

function getInitials(firstname, lastname) {
  return (firstname?.[0] || "") + (lastname?.[0] || "");
}

async function startSession() {
  if (!hasStudentSelection.value) {
    ++countRequest;
    countLoading.value = false;
    counts.value = {};
    usedLevels.value = {};
    levelCounts.value = {};
    return;
  }
  countLoading.value = true;

  // Use currentStudents computed array (already filtered and sorted)
  const request = ++countRequest;
  const stu = [...rosterStudents.value];

  students.value = stu;
  // Don't modify skills.value - it's the master array from the database
  // Template uses currentSkills computed property for filtering

  // Load events for selected students and skills
  const studentIds = stu.map((s) => s.id);
  const skillIds = currentSkills.value.map((s) => s.id);

  if (studentIds.length > 0 && skillIds.length > 0) {
    let eventsRes = [];
    try {
      for (let i = 0; i < studentIds.length; i += 100)
        eventsRes.push(
          ...(await allRows(() =>
            supabase
              .from("tu_session_events")
              .select("*")
              .in("student_id", studentIds.slice(i, i + 100))
              .in("skill_id", skillIds)
              .order("id"),
          )),
        );
    } catch (error) {
      if (request === countRequest) {
        saveError.value = error.message;
        countLoading.value = false;
      }
      return;
    }
    if (request !== countRequest) return;

    const c = {};
    const ul = {};
    const lc = {};

    for (const s of stu) {
      c[s.id] = {};
      ul[s.id] = {};
      lc[s.id] = {};
    }

    for (const ev of eventsRes || []) {
      if (ev.level === "abs") continue;
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
    }

    counts.value = c;
    usedLevels.value = ul;
    levelCounts.value = lc;
  } else {
    counts.value = {};
    usedLevels.value = {};
    levelCounts.value = {};
  }

  countLoading.value = false;
}

// ── Sorted students ───────────────────────────────────
function compareStudentNames(a, b, field = "firstname") {
  const firstnames = (a.firstname || "").localeCompare(
    b.firstname || "",
    "fr-FR",
  );
  const lastnames = (a.lastname || "").localeCompare(b.lastname || "", "fr-FR");
  return field === "lastname"
    ? lastnames || firstnames
    : firstnames || lastnames;
}

const sortedStudents = computed(() => {
  const students = [...currentStudents.value];

  if (sortBy.value === "ability") {
    students.sort(
      (a, b) =>
        (b.ability_level ?? -1) - (a.ability_level ?? -1) ||
        compareStudentNames(a, b),
    );
  } else if (sortBy.value === "team" && teamsActive.value) {
    // Sort by team first, then by firstname within each team
    students.sort((a, b) => {
      const teamA = studentTeamMap.value[a.id];
      const teamB = studentTeamMap.value[b.id];

      // Students without teams go to the end
      if (!teamA && !teamB) return compareStudentNames(a, b);
      if (!teamA) return 1;
      if (!teamB) return -1;

      // Compare team names
      const teamObjA = teams.value.find((t) => t.id === teamA);
      const teamObjB = teams.value.find((t) => t.id === teamB);
      const teamNameA = teamObjA?.name || "";
      const teamNameB = teamObjB?.name || "";

      const teamCompare = teamNameA.localeCompare(teamNameB, "fr-FR");
      if (teamCompare !== 0) return teamCompare;

      // Within same team, sort by firstname
      return compareStudentNames(a, b);
    });
  } else {
    // Sort by actual names independently of display preferences.
    const field = sortBy.value === "lastname" ? "lastname" : "firstname";
    students.sort((a, b) => {
      return compareStudentNames(a, b, field);
    });
  }

  return students;
});

// ── Session evaluation stats ──────────────────────────
const maxSessionCount = computed(() => {
  // Read counts.value explicitly to ensure dependency tracking
  void counts.value;
  let max = 0;
  for (const s of currentStudents.value) {
    max = Math.max(max, studentTotalCount(s.id));
  }
  return max;
});

// ── Evaluation helpers ────────────────────────────────
function studentTotalCount(studentId) {
  return Object.values(counts.value[studentId] || {}).reduce(
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

// Calculate grid columns for zone segments - cap at ~12 per row for wrapping
function getZoneGridColumns(skill) {
  const scaleLength = getSkillScale(skill).length;
  // Cap at 12 columns per row, will wrap to multiple rows if needed
  const colsPerRow = Math.min(scaleLength, 12);
  return `repeat(${colsPerRow}, 1fr)`;
}

function hasUsedLevel(studentId, skillId, level) {
  return !!usedLevels.value[studentId]?.[skillId]?.[level];
}

// ── Opacity helper ─────────────────────────────────────
const studentOpacityMap = computed(() =>
  Object.fromEntries(cohortStudents.value.map((student) => [
    student.id,
    Math.max(0.18, 1 / (1 + studentTotalCount(student.id) * 0.25)),
  ])),
);

function studentOpacity(studentId) {
  return studentOpacityMap.value[studentId] ?? 1;
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
  console.log(
    hoveredLevel.value
      ? `Hovering level: ${hoveredLevel.value}`
      : "Not hovering over a level segment",
  );
  hoveredAbsent.value = !!el?.closest("[data-absent-zone]");
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
  hoveredAbsent.value = false;
}

async function markStudentAbsent(student) {
  const classId = observationClass(
    student,
    checkedClassIds.value,
    selectedClassId.value,
  );
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const { data: existing, error } = await supabase
    .from("tu_session_events")
    .select("skill_id")
    .eq("student_id", student.id)
    .eq("level", "abs")
    .gte("created_at", day.toISOString());
  if (error) throw error;
  const ids = new Set((existing || []).map((e) => e.skill_id));
  const events = currentSkills.value
    .filter((sk) => !ids.has(sk.id))
    .map((sk) => ({
      class_id: classId,
      evaluation_id: sk.evaluation_id,
      student_id: student.id,
      skill_id: sk.id,
      level: "abs",
      user_id: userId.value,
    }));
  if (!currentSkills.value.length)
    throw new Error("Sélectionnez une habileté pour consigner une absence.");
  let eventIds = [];
  if (events.length) {
    const { data, error: insertError } = await supabase
      .from("tu_session_events")
      .insert(events)
      .select("id");
    if (insertError) throw insertError;
    eventIds = data.map((e) => e.id);
  }
  actionHistory.value.push({ absent: true, studentId: student.id, eventIds });
  absentStudents.value = new Set([...absentStudents.value, student.id]);
}
async function onDragEnd() {
  const active = drag.value;
  const target = active
    ? document.elementFromPoint(active.currentX, active.currentY)
    : null;
  const skillId = hoveredSkillId.value,
    level = hoveredLevel.value;
  onDragCancel();
  if (!active || savingEvent.value) return;
  const student = active.student;
  if (target?.closest("[data-priority-zone]")) {
    priorities.value = {
      ...priorities.value,
      [student.id]: Math.min(3, (priorities.value[student.id] || 0) + 1),
    };
    return;
  }
  if (target?.closest("[data-hide-zone]")) {
    hiddenStudents.value = new Set([...hiddenStudents.value, student.id]);
    return;
  }
  savingEvent.value = true;
  saveError.value = "";
  try {
    if (target?.closest("[data-absent-zone]")) {
      await markStudentAbsent(student);
      return;
    }
    const skill = currentSkills.value.find((sk) => sk.id === skillId);
    if (!skill || level == null) return;
    if (isSkillComplete(student.id, skill, counts.value))
      throw new Error(
        "Le nombre maximal de traces est atteint pour cette habileté.",
      );
    let comment = null;
    if (skill.grading_mode === "category") {
      comment = window.prompt("Commentaire (facultatif)", "");
      if (comment === null) return;
    }
    const { data, error } = await supabase
      .from("tu_session_events")
      .insert({
        class_id: observationClass(
          student,
          checkedClassIds.value,
          selectedClassId.value,
        ),
        evaluation_id: skill.evaluation_id,
        student_id: student.id,
        skill_id: skill.id,
        level: String(level),
        user_id: userId.value,
        grading_snapshot: gradeSnapshot(skill),
        comment,
        criterion:
          target?.closest("[data-criterion]")?.getAttribute("data-criterion") ||
          null,
        team_id: teamsActive.value
          ? studentTeamMap.value[student.id] || null
          : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const confirmationDetails = {
      studentName: formatStudentName(student),
      skillName: skill.name,
      level,
    };
    actionHistory.value.push({
      studentId: student.id,
      eventId: data.id,
      confirmationDetails,
    });
    actionConfirmation.value?.show(confirmationDetails);
    dropFlash.value = skill.id;
    setTimeout(() => {
      dropFlash.value = null;
    }, 400);
    await startSession();
  } catch (error) {
    saveError.value = error.message || "Impossible d’enregistrer la trace.";
  } finally {
    savingEvent.value = false;
  }
}

function onDragStart(e, student) {
  if (drag.value || savingEvent.value || loading.value) return; // one confirmed action at a time
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

// ── Undo last action ────────────────────────────────────
async function undoLastAction() {
  if (savingEvent.value) return;
  const action = actionHistory.value.at(-1);
  if (!action) return;
  savingEvent.value = true;
  try {
    const ids = action.eventIds || [action.eventId];
    if (ids.length) {
      const { error } = await supabase
        .from("tu_session_events")
        .delete()
        .in("id", ids);
      if (error) throw error;
    }
    actionHistory.value.pop();
    if (action.absent) {
      const ids = new Set(absentStudents.value);
      ids.delete(action.studentId);
      absentStudents.value = ids;
    }
    if (action.confirmationDetails)
      actionConfirmation.value?.show(action.confirmationDetails, true);
    await startSession();
  } catch (error) {
    saveError.value = error.message;
  } finally {
    savingEvent.value = false;
  }
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

// ── Eval ID → title lookup ────────────────────────────
const evalNameById = computed(() => {
  const map = {};
  for (const ev of evaluations.value) {
    map[ev.id] = ev.title;
  }
  return map;
});

// ── Session metadata ──────────────────────────────────
const selectedEvaluation = computed(() => {
  // Return the first checked eval for display purposes
  const firstId = [...checkedEvalIds.value][0];
  return firstId ? evaluations.value.find((e) => e.id === firstId) : null;
});
const selectedClass = computed(() =>
  classes.value.find((c) => c.id === selectedClassId.value),
);

const hasStudentSelection = computed(
  () => checkedClassIds.value.size > 0 || checkedStudentIds.value.size > 0,
);

const hasEvalSelection = computed(
  () => checkedEvalIds.value.size > 0 || checkedSkillIds.value.size > 0,
);

// Helper to get skills for an evaluation
function getSkillsForEval(evalId) {
  return skills.value.filter((s) => s.evaluation_id === evalId);
}

// Helper to check if an eval has any of its skills selected
function evalHasSelectedSkills(evalId) {
  const evSkills = getSkillsForEval(evalId);
  return evSkills.some((sk) => checkedSkillIds.value.has(sk.id));
}

const evalSelectionSummary = computed(() => {
  const evalCount = checkedEvalIds.value.size;
  const skillCount = checkedSkillIds.value.size;
  if (evalCount === 0 && skillCount === 0) return "";
  const parts = [];
  if (evalCount > 0) {
    const names = [...checkedEvalIds.value]
      .map((id) => evaluations.value.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => e.title);
    if (names.length <= 2) {
      parts.push(names.join(" · "));
    } else {
      parts.push(`${names[0]} +${evalCount - 1}`);
    }
  }
  if (skillCount > 0 && evalCount === 0) {
    parts.push(`${skillCount} habileté${skillCount > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
});

const selectionSummary = computed(() =>
  rosterStudents.value.length ? String(rosterStudents.value.length) : "",
);

async function handleClassCheck(cls) {
  const wasChecked = checkedClassIds.value.has(cls.id);
  toggleChecked(cls.id, "class");

  // Clear any excluded students for this class when checking
  if (!wasChecked) {
    const students = allStudents.value.filter((s) => belongsTo(s, cls.id));
    const newExcluded = new Set(excludedStudentIds.value);
    for (const s of students) {
      newExcluded.delete(s.id);
    }
    excludedStudentIds.value = newExcluded;
  }
  // currentStudents computed will automatically update
}

async function refreshReportAfterStudentChange() {
  if (activeModal.value === "report" && reportModalRef.value) {
    await reportModalRef.value.loadReportData();
  }
}

async function handleStudentCheck(classId, student, isSelected) {
  const isClassSelected = checkedClassIds.value.has(classId);

  if (isClassSelected) {
    // Class is checked — toggle this student's exclusion
    const newExcluded = new Set(excludedStudentIds.value);
    if (isSelected) {
      newExcluded.add(student.id);
    } else {
      newExcluded.delete(student.id);
    }
    excludedStudentIds.value = newExcluded;
  } else {
    // Class is not checked — toggle individual student
    if (isSelected) toggleChecked(student.id, "student");
    else if (!checkedStudentIds.value.has(student.id)) {
      toggleChecked(student.id, "student");
    }
  }

  // Reload live view to reflect exclusion changes
  if (hasEvalSelection.value) await startSession();
  await refreshReportAfterStudentChange();
}

async function handleEvalCheck(ev) {
  const wasChecked = checkedEvalIds.value.has(ev.id);
  const evSkills = getSkillsForEval(ev.id);

  if (wasChecked) {
    // Unchecking eval — unselect all its skills
    toggleChecked(ev.id, "eval");

    // Remove all skills of this eval from checkedSkillIds
    for (const sk of evSkills) {
      checkedSkillIds.value.delete(sk.id);
    }
  } else {
    // Checking eval — select all its skills
    toggleChecked(ev.id, "eval");

    // Add all skills of this eval to checkedSkillIds
    for (const sk of evSkills) {
      checkedSkillIds.value.add(sk.id);
    }
  }
}

function handleSkillCheck(ev, skill) {
  // Simply toggle the skill in checkedSkillIds
  if (checkedSkillIds.value.has(skill.id)) {
    checkedSkillIds.value.delete(skill.id);
  } else {
    checkedSkillIds.value.add(skill.id);
  }

  // Reload live view to reflect skill changes
  if (hasEvalSelection.value && hasStudentSelection.value) startSession();
}

// ── Editing class title (for the ClassDetail modal header) ─
const editingClassTitle = computed(() => {
  if (classDetailId.value === "new") return "Nouvelle classe";
  if (classDetailId.value) {
    const cls = classes.value.find((c) => c.id === classDetailId.value);
    return cls?.name || "Chargement…";
  }
  return "Groupes";
});

// ── Detail view names (for student/skill sub-views) ──────
const studentDetailName = computed(() => {
  if (!studentDetailId.value) return "";
  const found = allStudents.value.find((s) => s.id === studentDetailId.value);
  if (found) return `${found.firstname} ${found.lastname}`;
  return "";
});

// Clear student detail when selected class changes
watch(selectedClassId, () => {
  // Student detail is now managed by ClassModal
});

// ── Undo history ────────────────────────────────────────
const actionHistory = ref([]); // { studentId, skillId, level, eventId }[]

// ── Live preview animation ────────────────────────────
const liveAnimating = ref(false);

watch(
  () => [
    isClassModalOpen.value,
    isEvalModalOpen.value,
    isReportModalOpen.value,
    isTeamModalOpen.value,
  ],
  (
    [curClass, curEval, curReport, curTeams],
    [prevClass, prevEval, prevReport, prevTeams],
  ) => {
    // Re-trigger enter animation when any modal closes
    if (
      (prevClass || prevEval || prevReport || prevTeams) &&
      !(curClass || curEval || curReport || curTeams)
    ) {
      liveAnimating.value = true;
      setTimeout(() => {
        liveAnimating.value = false;
      }, 500);
    }
  },
);

watch(
  () => [
    rosterStudents.value.map((s) => s.id).join(","),
    currentSkills.value.map((s) => s.id).join(","),
  ],
  () => startSession(),
);
const reportModalRef = ref(null); // Reference to ReportModal component

async function openReport() {
  if (activeModal.value === "report") {
    activeModal.value = null;
    return;
  }
  if (!hasStudentSelection.value || !hasEvalSelection.value) return;

  toggleModal("report");

  // Wait for modal to mount, then load data
  await nextTick();
  if (reportModalRef.value) {
    await reportModalRef.value.loadReportData();
  }
}

defineExpose({
  openClassModal,
  selectedClass,
  hasEvalSelection,
});
</script>

<template>
  <div
    class="app-root"
    :aria-busy="loading || savingEvent"
    :class="{
      'modal-open':
        isClassModalOpen ||
        isEvalModalOpen ||
        isReportModalOpen ||
        isTeamModalOpen,
    }"
  >
    <div class="top-bar">
      <div class="top-bar-left">
        <button
          class="undo-btn"
          :disabled="actionHistory.length === 0 || savingEvent"
          title="Annuler la dernière action"
          @click="undoLastAction"
        >
          <Undo2 :size="20" />Undo
        </button>
      </div>
      <div class="top-bar-center">
        <!-- {{ hoveredSkillId }}<br />
        {{ hoveredLevel }}<br /> -->

        <button
          class="fab"
          :class="{
            'fab--filled': hasStudentSelection,
            'fab--modal-open': isClassModalOpen,
          }"
          title="Classes"
          @click="openClassModal()"
        >
          <template v-if="hasStudentSelection">
            <Users :size="20" />
            <span class="fab-selected-name">{{ selectionSummary }}</span>
          </template>
          <template v-else>
            <Users :size="20" />
          </template>
        </button>
        <button
          class="fab fab--eval"
          :class="{
            'fab--filled': hasEvalSelection,
            'fab--modal-open': isEvalModalOpen,
          }"
          title="Évaluations"
          @click="toggleModal('eval')"
        >
          <template v-if="hasEvalSelection">
            <Sneaker :size="20" />
            <span class="fab-selected-name">{{ checkedSkillCount }}</span>
          </template>
          <template v-else>
            <Sneaker :size="20" />
          </template>
        </button>
        <!-- Teams button -->
        <button
          class="fab fab--teams"
          :class="{ 'fab--modal-open': isTeamModalOpen }"
          :disabled="currentStudents.length === 0"
          title="Équipes"
          @click="openTeamModal"
        >
          <Component :size="20" />
        </button>
        <!-- Report button -->
        <button
          class="fab"
          :class="{ 'fab--modal-report': isReportModalOpen }"
          :disabled="!hasStudentSelection || !hasEvalSelection"
          title="Rapport"
          @click="openReport"
        >
          <BarChart3 :size="20" />
        </button>
      </div>
      <div class="top-bar-spacer">
        <ActionConfirmation ref="actionConfirmation" />
      </div>
      <div class="top-bar-right">
        <div class="toolbar-utilities" role="group" aria-label="Affichage et anniversaires">
        <button class="utility-btn birthday-btn"
          :class="{ 'birthday-btn--today': hasBirthdaysToday, 'birthday-btn--unseen': birthdayUnseen }"
          :title="hasBirthdaysToday ? 'Anniversaires aujourd’hui' : 'Anniversaires'"
          :aria-label="hasBirthdaysToday ? 'Anniversaires aujourd’hui' : 'Anniversaires'"
          :aria-expanded="showBirthdays"
          @click="openBirthdays">
          <Cake :size="20" />
        </button>
        <button
          class="utility-btn"
          title="Changer le thème"
          @click="
            preferences.theme = preferences.theme === 'dark' ? 'light' : 'dark'
          "
        >
          <Sun v-if="preferences.theme === 'dark'" :size="20" /><Moon
            v-else
            :size="20"
          />
        </button>
        </div>
        <!-- User menu -->
        <div class="user-menu-container">
          <button
            class="user-menu-btn"
            @click="userMenuOpen = !userMenuOpen"
            title="User menu"
          >
            <User :size="24" />
          </button>

          <!-- User menu popup -->
          <div v-if="userMenuOpen" class="user-menu-popup" @click.stop>
            <div v-if="userEmail" class="user-menu-email">
              {{ userEmail }}
            </div>
            <button class="user-menu-logout" @click="handleLogout">
              <LogOut :size="18" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="saveError" class="feature-error" role="alert">
      {{ saveError }} <button @click="loadAllData">Réessayer</button>
      <button @click="saveError = ''">Fermer</button>
    </div>
    <div v-if="savingEvent" role="status">Enregistrement…</div>
    <LoadingPopup v-if="loading" />
    <!-- ── MAIN CONTENT (stacked layers) ────────────────── -->
    <div class="main-content" @click="userMenuOpen = false">
      <!-- LIVE SCREEN (always visible) -->
      <div class="live-screen">
        <!-- Drop zones -->
        <div
          v-if="currentSkills.length > 0 && currentStudents.length > 0"
          class="zones-container"
          :class="{
            'zones-container--enter': liveAnimating,
            'zones-container--grid': currentSkills.length > 5,
          }"
        >
          <div
            v-for="skill in currentSkills"
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
              <span class="zone-name">
                <span class="zone-eval-name">{{
                  evalNameById[skill.evaluation_id]
                }}</span>
                <img
                  v-if="skill.icon"
                  :src="`${BASE}icons/skills/${skill.icon}.svg`"
                  class="zone-skill-icon"
                  alt=""
                />
                <span class="zone-skill-name"
                  >{{ skill.name }}
                  <small
                    v-if="
                      drag && isSkillComplete(drag.student.id, skill, counts)
                    "
                    >— Terminé</small
                  ></span
                >
              </span>
            </div>

            <div v-if="skill.grading_mode === 'rubric'" class="rubric-criteria">
              <div
                v-for="criterion in skill.criteria"
                :key="criterion"
                class="rubric-column"
              >
                <strong>{{ criterion }}</strong>
                <div
                  v-for="value in [...getSkillScale(skill)].reverse()"
                  :key="value"
                  class="zone-segment"
                  :data-skill-id="skill.id"
                  :data-level="value"
                  :data-criterion="criterion"
                  :class="{
                    'segment-hover':
                      hoveredSkillId === skill.id &&
                      hoveredLevel === String(value),
                  }"
                >
                  {{ Number(value) > 0 ? "+" : "" }}{{ value }}
                </div>
              </div>
            </div>
            <div
              v-else
              class="zone-segments"
              :style="{ gridTemplateColumns: getZoneGridColumns(skill) }"
            >
              <div
                v-for="level in getSkillScale(skill)"
                :key="level"
                class="zone-segment"
                :class="{
                  'segment-hover':
                    String(hoveredSkillId) === String(skill.id) &&
                    String(hoveredLevel) === String(level),
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
                    (levelCounts[drag?.student?.id]?.[skill.id]?.[level] || 0) >
                    0
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
        </div>
        <div v-else class="zones-empty">
          <div class="brand">
            <img class="hero-img" src="/tu-hero.png" alt="" />
            <!-- <div class="brand-name">Tuvalu</div> -->
          </div>
        </div>

        <!-- Floating drag clone -->
        <Teleport to="body">
          <div v-if="drag" class="drag-clone" :style="cloneStyle">
            <StudentAvatar
              v-if="preferences.showPhoto"
              :student="drag.student"
            />
            {{ formatStudentName(drag.student) }}
          </div>
        </Teleport>
      </div>

      <!-- MODAL OVERLAY (top layer) -->
      <div
        v-show="
          isClassModalOpen ||
          isEvalModalOpen ||
          isReportModalOpen ||
          isTeamModalOpen
        "
        class="picker-screen picker-screen--modal"
        @click.self="toggleModal('class')"
      >
        <Transition name="panel-drawer" mode="out-in">
          <ClassModal
            v-if="isClassModalOpen"
            key="class"
            :classes="classes"
            :selected-class-id="selectedClassId"
            :all-students="allStudents"
            :checked-class-ids="checkedClassIds"
            :checked-student-ids="checkedStudentIds"
            :excluded-student-ids="excludedStudentIds"
            @deselect-all="deselectAll"
            @close="toggleModal('class')"
            @select-class="selectClass"
            @student-check="handleStudentCheck"
            @class-check="handleClassCheck"
            @data-changed="loadAllData"
          />

          <!-- Evaluation modal -->
          <EvalModal
            v-else-if="isEvalModalOpen"
            key="eval"
            :evaluations="evaluations"
            :selected-eval-id="selectedEvalId"
            :skills="skills"
            :checked-eval-ids="checkedEvalIds"
            :checked-skill-ids="checkedSkillIds"
            :base-url="BASE"
            :skill-icon-names="skillIconNames"
            @close="toggleModal('eval')"
            @select-eval="selectEvalInModal"
            @skill-check="(id) => toggleChecked(id, 'skill')"
            @eval-check="handleEvalCheck"
            @data-changed="loadAllData"
          />

          <!-- Report modal Rapport-->
          <ReportModal
            v-else-if="isReportModalOpen"
            ref="reportModalRef"
            key="report"
            :checked-class-ids="checkedClassIds"
            :checked-skill-ids="checkedSkillIds"
            :current-students="rosterStudents"
            :skills="skills"
            :classes="classes"
            :user-id="userId"
            :teams="teams"
            :student-team-map="studentTeamMap"
            @close="toggleModal('report')"
          />

          <!-- Teams modal -->
          <TeamModal
            v-else-if="isTeamModalOpen"
            key="teams"
            :current-students="currentStudents"
            @close="toggleModal('teams')"
            @teams-created="onTeamsCreated"
          />
        </Transition>
      </div>
    </div>

    <!-- ── PERMANENT STUDENTS ROW ───────────────────────── -->
    <div class="students-row">
      <!-- Left zone: filter toggle -->
      <div class="students-row-left">
        <button
          class="fab students-row-btn"
          :class="{ 'fab--filled': showFilterModal }"
          title="Filtrer"
          @click="showFilterModal = true"
        >
          <Funnel :size="16" />
        </button>

        <button
          v-if="hiddenStudents.size"
          @click="restoreStudents"
          title="Rétablir les élèves retirés"
        >
          Rétablir ({{ hiddenStudents.size }})
        </button>
        <div
          class="session-drop"
          data-hide-zone
          title="Retirer temporairement, sans trace"
        >
          <EyeOff :size="22" /><small>Retirer</small>
        </div>
        <div
          class="session-drop"
          data-priority-zone
          title="Priorité : jusqu’à 3 niveaux"
        >
          <Star :size="22" /><small>Priorité</small>
        </div>
        <div
          class="absent-zone"
          :class="{ 'absent-zone--hover': hoveredAbsent }"
          data-absent-zone
          title="Consigner une absence"
        >
          <HatGlasses :size="22" /><small>Absence</small>
        </div>
      </div>

      <!-- Middle zone: student bubbles -->
      <div class="students-row-center">
        <template v-if="currentStudents.length > 0">
          <div
            v-for="student in visibleStudents"
            :key="student.id"
            class="student-wrapper"
            :class="{ 'is-ghost': drag?.student?.id === student.id }"
            :data-student-id="student.id"
            :style="{
              '--student-opacity': studentOpacity(student.id),
              '--student-ink': '#ffffff',
              outline: priorities[student.id]
                ? `${priorities[student.id] + 1}px solid var(--priority-color)`
                : 'none',
            }"
            @pointerdown="onDragStart($event, student)"
          >
            <div
              class="student-bubble"
              :style="{
                border: teamsActive
                  ? `2px solid ${getStudentTeamColor(student.id) || '#457b9d'}`
                  : 'none',
                background: 'var(--class-accent)',
              }"
            >
              <StudentAvatar v-if="preferences.showPhoto" :student="student" />
              <span v-if="formatStudentName(student)" class="student-label">{{
                formatStudentName(student)
              }}</span>
              <span v-else-if="!preferences.showPhoto">{{
                getInitials(student.firstname, student.lastname)
              }}</span>
              <button
                v-if="priorities[student.id]"
                class="priority-reduce"
                title="Réduire la priorité"
                @pointerdown.stop
                @click.stop="
                  priorities = {
                    ...priorities,
                    [student.id]: Math.max(0, priorities[student.id] - 1),
                  }
                "
              >
                <Star :size="16" />{{ priorities[student.id] }}
              </button>
            </div>
          </div>
        </template>
        <template v-else-if="currentStudents.length > 0">
          <div
            v-for="student in currentStudents"
            :key="student.id"
            class="student-wrapper"
          >
            <div
              class="student-bubble-preview"
              :style="{
                border: teamsActive
                  ? `2px solid ${getStudentTeamColor(student.id) || '#457b9d'}`
                  : 'none',
                background: 'var(--class-accent)',
              }"
            >
              <StudentAvatar v-if="preferences.showPhoto" :student="student" />
              <span v-if="formatStudentName(student)" class="student-label">{{
                formatStudentName(student)
              }}</span>
              <span v-else-if="!preferences.showPhoto">{{
                getInitials(student.firstname, student.lastname)
              }}</span>
              <button
                v-if="priorities[student.id]"
                class="priority-reduce"
                title="Réduire la priorité"
                @pointerdown.stop
                @click.stop="
                  priorities = {
                    ...priorities,
                    [student.id]: Math.max(0, priorities[student.id] - 1),
                  }
                "
              >
                <Star :size="16" />{{ priorities[student.id] }}
              </button>
            </div>
          </div>
        </template>
      </div>

    </div>
  </div>

  <Birthdays
    v-if="showBirthdays"
    :students="allStudents"
    :initial-all="hasBirthdaysToday"
    :selected-students="rosterStudents"
    @close="showBirthdays = false"
  />
  <!-- Settings/Filter Modal -->
  <Settings
    :show="showFilterModal"
    :sort-by="sortBy"
    :gender-filter="genderFilter"
    :teams-active="teamsActive"
    :active-team-id="activeTeamId"
    :teams="teams"
    :active-team-ids="activeTeamIds"
    :team-batches="teamBatches"
    :team-batch-id="teamBatchId"
    @update:active-team-ids="activeTeamIds = $event"
    @update:team-batch-id="teamBatchId = $event"
    @reset-priorities="priorities = {}"
    @close="showFilterModal = false"
    @update:sort-by="sortBy = $event"
    @update:gender-filter="genderFilter = $event"
    @update:teams-active="teamsActive = $event"
    @update:active-team-id="activeTeamId = $event"
  />
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Coiny&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Varela+Round&display=swap");

/* ── Global input styles ─────────────────────────── */
input,
textarea {
  font-size: 1.5rem;
}

/* ── App root ─────────────────────────────────────── */
.app-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  max-width: 1366px;
  margin: auto;
}

/* ── Top bar & bottom bar ──────────────────────────── */
.top-bar,
.students-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  /* padding: 6px 20px 0 20px; */

  /* height: 80px; */
}
.top-bar {
  margin: 6px 20px 0px 20px;
  position: relative;
  display: flex;
  align-items: center;
  /* height: 60px; */
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.user-info {
  display: flex;
  align-items: center;
}

/* User menu */
.user-menu-container {
  position: relative;
}

.user-menu-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.user-menu-btn:focus-visible {
  background: rgba(255, 255, 255, 0.2);
}

.user-menu-popup {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: rgba(20, 10, 2, 0.95);
  border: 1.5px solid rgba(255, 200, 80, 0.3);
  border-radius: 12px;
  padding: 0.75rem;
  min-width: 250px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-menu-email {
  font-size: 0.85rem;
  color: var(--text-light);
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  word-break: break-all;
  opacity: 0.8;
}

.user-menu-logout {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.user-menu-logout:focus-visible {
  background: rgba(239, 68, 68, 0.2);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.students-row {
  padding: 15px;
  gap: 10px;
  /* min-height: 200px; */
  height: auto;
  align-items: flex-start;
}

.app-root.modal-open .students-row {
  display: none;
}

.app-root.modal-open .main-content {
  margin-bottom: 0;
}

.students-row-left,
.students-row-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.students-row-center {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  justify-content: center;
  min-width: 0;
}

.students-row-left {
  position: relative;
  flex-direction: column;
  align-items: center;
  width: 56px;
}
.students-row-left .students-row-btn { width: 48px; }
.students-row-left > button:not(.students-row-btn) {
  max-width: 56px;
  padding: 0.25rem;
  font-size: 0.7rem;
}


.top-bar-center {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

/* ── Menu buttons ──────────────────────────────────── */
.fab {
  width: 100px;
  border: 2px solid transparent;
  border-radius: 18px;
  padding: 0.8rem 0.5rem;
  margin-bottom: 3px;
  color: var(--text-light);
  background: rgba(0, 0, 0, 0.3);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.fab svg {
  flex-shrink: 0;
}

.fab-selected-name {
  flex-shrink: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fab:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Filled mode: stroke around the button (for classes and eval only) */
.fab--filled {
  border-color: var(--student-bg);
  background: transparent;
  color: var(--text-light);
  font-weight: 700;
}

/* Modal open: expands down, fills background, removes bottom radius */
.fab--modal-open {
  border-radius: 18px 18px 0 0;
  border-bottom: none;
  margin-bottom: 0;

  padding-bottom: calc(3px + 0.8rem);
  background: var(--student-bg);
  border-color: var(--student-bg);
  color: var(--text-light);
}

/* Report button modal state */
.fab--modal-report {
  background: var(--text-light);
  border-color: var(--text-light);
  color: var(--court-blue);
}

/* ── Eval button (yellow) ─────────────────────────── */
.fab--eval.fab--filled {
  border-color: var(--stadium-yellow);
  background: transparent;
}

.fab--eval.fab--modal-open {
  background: var(--stadium-yellow);
  border-color: var(--stadium-yellow);
  color: var(--text-light);
  font-weight: 700;
}

/* ── Teams button (gray) ─────────────────────── */
.fab--teams.fab--modal-open {
  background: var(--team-gray);
  border-color: var(--team-gray);
  color: var(--text-light);
  font-weight: 700;
}

/* ── Students row action button ───────────────────── */
.students-row-btn {
  flex-shrink: 0;
  padding: 0.5rem;
}

/* ── Filter panel ─────────────────────────────────── */
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  background: var(--student-bg);
  border-radius: 20px;
  position: absolute;
  left: 0;
  bottom: calc(100% + 12px);
  z-index: 50;
  min-width: 320px;
}

.filter-panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-panel-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-light);
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-panel-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-light);
  opacity: 0.7;
  cursor: pointer;
  padding: 8px 18px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.15s;
}

.filter-option input {
  display: none;
}

.filter-option.active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.5);
}

.filter-option--disabled {
  opacity: 0.3 !important;
  cursor: not-allowed;
}

.filter-panel-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.toggle-teams-btn {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: var(--text-light);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-teams-btn.active {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.5);
}

/* ── Absent drop zone ─────────────────────────────── */
.absent-zone {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: 2px dashed var(--text-light);
  /* color: rgba(255, 100, 80, 0.5); */
  /* background: rgba(255, 80, 60, 0.08); */
  cursor: default;
  opacity: 0.3;
  transition: all 0.2s;
  pointer-events: auto;
}

.absent-zone--hover {
  /* border-color: rgba(255, 80, 60, 0.8);
  color: rgba(255, 80, 60, 0.95);
  background: rgba(255, 80, 60, 0.2); */
  transform: scale(1.2);
  opacity: 1;
  transform-origin: top right;
}

/* ── Turf background ──────────────────────────────── */
.wood-bg {
  background: #3a5e69;
  /* box-shadow: inset 0 0 60px 20px rgb(116, 199, 255, 0.4); */
  /* filter: brightness(1.45); */

  z-index: 0 !important;
}
/* ── Eval background (yellow) ────────────────────── */
.eval-bg {
  /* --text-light: #1a0e04; */
  background: var(--stadium-yellow);
}

/* ── Teams modal background (gray) ───────────────── */
.team-modal-bg {
  background: var(--team-gray);
}

/* ── Main content (stacked layers) ──────────────── */
.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  margin: 0 16px;
  border-radius: 24px;
  min-height: 0;
}

/* ── Picker (no modal — brand screen) ──────────── */
.picker-screen:not(.picker-screen--modal) {
  /* background: radial-gradient(#fc7765, #f57b35); */
  /* border: 2px solid var(--text-light); */
  border-radius: 24px;
}

/* ── Picker ───────────────────────────────────────── */
.picker-screen,
.live-screen {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  /* padding: 1rem; */
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.hero-img {
  width: 260px;
  opacity: 1;
  margin-bottom: -12px;
  position: relative;
  z-index: 1;
}
.brand-name {
  font-size: 2.6rem;
  font-weight: 700;
  color: var(--text-light);
  white-space: nowrap;
  margin-top: 15px;
}

.picker-hint {
  color: var(--text-light);
  font-size: 0.85rem;
  font-style: italic;
  opacity: 0.65;
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
  color: var(--text-light);
  opacity: 0.6;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.class-preview-label strong {
  color: var(--text-light);
  font-weight: 700;
  opacity: 0.85;
}

.class-preview-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-light);
  opacity: 0.5;
}

.class-preview-students {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── Top bar left section (undo) ──────────────── */
.top-bar-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

/* ── Top bar spacer pushes session btn right ──── */
.top-bar-spacer {
  flex: 1;
  min-width: 0;
}

.top-bar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-right: 1rem;
}

.toolbar-utilities {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding-right: 0.65rem;
  margin-right: 0.15rem;
  border-right: 1px solid var(--border-color);
}
.utility-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-light);
}
.utility-btn:hover {
  background: var(--team-gray);
}

.utility-btn.birthday-btn { --birthday-accent: #e879ad; background: transparent; }
.utility-btn.birthday-btn--today { background: color-mix(in srgb, var(--birthday-accent) 30%, var(--surface)); color: var(--text-light); }
.utility-btn.birthday-btn--unseen { animation: birthday-pulse 0.9s ease-in-out infinite; }
@keyframes birthday-pulse {
  0%, 100% { background-color: transparent; }
  50% { background-color: color-mix(in srgb, var(--birthday-accent) 30%, var(--surface)); }
}
@media (prefers-reduced-motion: reduce) {
  .utility-btn.birthday-btn--unseen { animation: none; }
}

/* ── Undo button ────────────────────────────────── */
.undo-btn {
  border: none;
  /* border: 2px var(--text-light) solid; */
  /* border-radius: 999px; */
  padding: 0.5rem 1rem;
  color: var(--text-light);
  background: none;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
  svg {
    margin-right: 0.2rem;
  }
}
.undo-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ── Student bubble preview (picker screen) ───────── */

/* ── Live layout ──────────────────────────────────── */
.live-screen {
  /* z-index: 3 !important; */
  background: var(--track-red);
  overflow: hidden;
  /* flex: 1; */
  /* display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; */
  /* gap: 2rem;
  min-height: 0; */
  /* margin: 0 16px; */

  /* width: 100%; */
  /* border-radius: 24px; */
}

/* ── Live preview enter animation ─────────────────── */
@keyframes live-enter {
  0% {
    transform: scale(0.95);
    opacity: 0.6;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.zones-container--enter {
  animation: live-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* ── Drop zones container ─────────────────────────── */
.zones-container {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0.5rem 0.1rem;
}

.zones-container--grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: stretch;
}
.zones-container--grid .drop-zone {
  margin: 0;
  flex: none;
  min-height: 0;
  height: auto;
}

.drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  margin: 4px 12px;
  /* border: 2px solid rgba(255, 200, 80, 0.2); */
  border-radius: 16px;
  background: rgba(20, 10, 2, 0.35);
  /* overflow: hidden; */
  transition:
    background 0.18s,
    border-color 0.18s,
    transform 0.15s;
  cursor: default;
}

.zone-header {
  text-align: center;
  padding: 8px;
  flex-shrink: 0;
  pointer-events: none;
}

.zone-name {
  display: flex;
  /* flex-direction: column; */
  /* gap: 12px; */
  padding-left: 8px;
  align-items: center;
  line-height: 1.3;
  pointer-events: none;
}

.zone-skill-name,
.zone-eval-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-light);
  transition: color 0.18s;
}
.zone-eval-name::after {
  content: "/";
  margin: 0 12px;
  /* opacity: 0.5; */
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
  color: var(--text-light);
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

  /* transform: scale(1.02); */
}
.zone-hover .zone-name {
  color: var(--text-light);
  /* opacity: 0.85; */
}

.zone-hover-prior .zone-name {
  color: var(--text-light);
  /* opacity: 0.7; */
}

/* Zone: confirmation flash */
@keyframes zone-flash-anim {
  0% {
    background: rgba(232, 168, 32, 0.55);
    border-color: #e8a820;
  }
  100% {
    background: rgba(20, 10, 2, 0.35);
    border-color: rgba(255, 200, 80, 0.2);
  }
}
.zone-flash {
  animation: zone-flash-anim 0.4s ease-out forwards;
}

.zones-empty {
  flex: 1;
  display: flex;
  align-items: flex-end;
  width: 100%;
  justify-content: flex-end;
  color: var(--text-light);
  /* opacity: 0.4; */
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

/* ── Drag clone ───────────────────────────────────── */
.drag-clone {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgb(69, 123, 157);
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  font-size: 1.1rem;
  font-family: inherit;
  padding: 8px 18px;
  transform: scale(1.15);
  white-space: nowrap;
}

/* ── Zone sub-segments (shown during drag) ─────────── */
.zone-segments {
  display: grid;
  flex: 1;
  width: 100%;
  max-width: 100%;
  gap: 4px;
  /* padding: 12px; */
  padding-top: 0;
  /* border-radius: 8px; */
  overflow: visible;
  /* Allow wrapping for skills with many segments */
  grid-auto-flow: row;
}

.zone-segment {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  /* border: 1px dashed rgba(255, 200, 80, 0.3); */
  /* border-radius: 8px; */
  background: rgba(30, 16, 3, 0.4);
  color: rgba(224, 72, 1, 0.6);
  font-size: clamp(0.8rem, min(4vw, 3cqw), 5.5rem);
  font-family: "Coiny", sans-serif;
  /* opacity: 0.6; */
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s,
    transform 0.1s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px;
}

.segment-hover {
  border-color: rgba(255, 200, 80, 0.85);
  background: rgba(232, 168, 32, 0.35);
  color: var(--text-light);
  transform: scale(1.04);
  /* border-style: solid; */
  opacity: 0.85;
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

  pointer-events: none;
}

/* ── Panel drawer transition ──────────────────────────── */
.panel-drawer-enter-active {
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.panel-drawer-enter-from,
.panel-drawer-leave-to {
  transform: translateY(-50%);
}

/* ── Slide-edit transition (right to left) ──────────── */
.slide-edit-enter-active,
.slide-edit-leave-active {
  transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-edit-enter-from {
  transform: translateX(60px);
  opacity: 0;
}
.slide-edit-leave-to {
  transform: translateX(-60px);
  opacity: 0;
}

/* ── Shared picker styles ─────────────────────────── */
.picker-panel {
  /* border: 2px solid var(--text-light); */
  /* background: var(--track-red); */
  /* border-radius: 28px; */
  width: 90%;
  max-width: 600px;
  max-height: 80dvh;
  overflow-y: auto;
}

/* When panel fills the entire picker screen */
.picker-panel--full {
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  border-radius: inherit;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Report body in full panel */
.picker-panel--full > .report-body {
  width: 100%;
  max-width: 100%;
  flex: 1;
  overflow-y: auto;
}

.picker-screen--modal {
  margin: 0;
  border-radius: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
}

/* ── Zone skill icon (drop zones) ───────────────── */
.zone-skill-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  mix-blend-mode: screen;
  opacity: 0.7;
  flex-shrink: 0;
  vertical-align: middle;
  margin-right: 0.25rem;
}

.main-content,
.live-screen {
  min-height: 0;
  flex: 1;
}
.live-screen {
  overflow: hidden;
}
.zones-container {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.drop-zone {
  min-height: 0;
}
.zones-container--grid .drop-zone {
  min-height: 0;
}
.students-row {
  max-height: none;
  padding-bottom: env(safe-area-inset-bottom);
}
.students-row-center {
  min-width: 0;
  max-height: none;
  overflow: visible;
}
.student-wrapper {
  border-radius: 16px;
}
.student-bubble {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  filter: none;
}
.student-label {
  background: var(--student-bg);
  color: var(--text-light);
  border-radius: 5px;
  padding: 0.15rem 0.3rem;
}
.session-drop,
.absent-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-width: 48px;
  min-height: 48px;
  color: var(--text-light);
}
.session-drop {
  border: 1px dashed var(--text-light);
  border-radius: 8px;
  padding: 0.3rem;
}
.session-drop small,
.absent-zone small {
  font-size: 0.65rem;
}
.top-bar {
  flex-wrap: wrap;
  gap: 0.3rem;
}
.top-bar-center {
  flex-wrap: wrap;
}
@media (max-width: 700px) {
  .top-bar {
    margin: 4px;
  }
  .students-row {
    gap: 4px;
  }
  .students-row-right {
    gap: 3px;
  }
}

.live-screen {
  background: var(--surface-muted);
  justify-content: flex-start;
}
.drop-zone {
  background: var(--surface);
}
.zone-segment {
  --zone-fill: color-mix(in srgb, var(--surface-muted) 88%, var(--text-muted));
  color: color-mix(in srgb, var(--text-muted) 18%, var(--zone-fill));
  background: var(--zone-fill);
}
.segment-hover {
  color: #ffffff;
  background: var(--accent);
}
.rubric-criteria {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0.4rem;
  flex: 1;
  padding: 0.5rem;
}
.rubric-column {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: center;
}
.rubric-column .zone-segment {
  min-height: 40px;
  font-size: 1.25rem;
}
.student-bubble,
.student-bubble-preview {
  color: var(--text-light);
  filter: none;
  background: color-mix(
    in srgb,
    var(--class-accent) calc(var(--student-opacity, 1) * 100%),
    transparent
  ) !important;
}
.student-label {
  background: transparent;
  color: var(--student-ink, #ffffff);
}
.student-bubble :deep(.student-avatar) {
  filter: none;
}

.fab {
  background: var(--surface-muted);
  color: var(--text-light);
  transition: border-color 0.2s;
}
.fab--filled {
  border-color: var(--accent);
}
.fab--modal-open {
  background: var(--student-bg);
}
.fab--modal-report {
  background: var(--accent);
  color: var(--surface);
}
.zone-segment,
.zone-name,
.student-label {
  transition: none;
}
.drop-zone {
  transition:
    border-color 0.18s,
    transform 0.15s;
}
.priority-reduce {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem;
  border: 0;
  background: transparent;
  color: var(--student-ink);
}
.students-row-right {
  flex-shrink: 0;
}
/* Evaluation targets share the available height instead of extending the page. */
.zones-container--grid {
  grid-auto-rows: minmax(0, 1fr);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.drop-zone { min-width: 0; flex-basis: 0; }
.zone-segments {
  min-height: 0;
  grid-auto-rows: minmax(0, 1fr);
  container-type: size;
}
.zone-segment {
  min-height: 0;
  padding: 2px;
  font-size: clamp(0.65rem, min(4vw, 60cqh), 5.5rem);
}
.zone-header { padding: 4px 8px; }
.zone-name { min-width: 0; overflow: hidden; white-space: nowrap; }
.zone-skill-name, .zone-eval-name { overflow: hidden; text-overflow: ellipsis; }
.rubric-criteria { min-height: 0; grid-auto-rows: minmax(0, 1fr); }
.rubric-column { min-height: 0; min-width: 0; }
.rubric-column .zone-segment { min-height: 0; flex: 1 1 0; font-size: clamp(0.65rem, 1.8vh, 1.25rem); }
</style>
;
