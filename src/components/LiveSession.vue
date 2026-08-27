<script setup>
import { ref, computed, onMounted, nextTick, watch } from "vue";
import {
  Users,
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

// ── Setup state ───────────────────────────────────────
const classes = ref([]);
const evaluations = ref([]);
const selectedClassId = ref(null);
const loading = ref(false);

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
    const isInCheckedClass = checkedClassIds.value.has(s.class_id);
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
    if (teamsActive.value && activeTeamId.value) {
      matchesTeam = studentTeamMap.value[s.id] === activeTeamId.value;
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
  return skills.value.filter((sk) => checkedSkillIds.value.has(sk.id));
});

// ── Logout handler ────────────────────────────────────
async function handleLogout() {
  if (confirm("Are you sure you want to sign out?")) {
    await signOut();
  }
}

// ── Load all data on mount ────────────────────────────
async function loadAllData() {
  loading.value = true;

  // Load classes
  const { data: classData } = await supabase
    .from("tu_classes")
    .select("*")
    .order("name");
  classes.value = classData || [];
  console.log("Loaded classes:", classes.value.length);

  // Load evaluations
  const { data: evalData } = await supabase
    .from("tu_evaluations")
    .select("*")
    .order("title");
  evaluations.value = evalData || [];

  // Load ALL students at once (single source of truth)
  // Don't order in database - we'll sort in JavaScript with proper French locale
  const { data: studentData } = await supabase
    .from("tu_students")
    .select(
      "id, firstname, lastname, gender, birth_date, class_id, name_display_prefs, photo_url, custom_name",
    );
  allStudents.value = studentData || [];

  // Load skills
  const { data: skillData } = await supabase
    .from("tu_skills")
    .select("id, name, scale, icon, evaluation_id")
    .order("name");
  skills.value = skillData || [];

  // Load teams
  await loadTeams();

  loading.value = false;
}

// ── Teams functions ───────────────────────────────────
async function loadTeams() {
  // Load all teams ordered by creation date (newest first)
  const { data: teamsData } = await supabase
    .from("tu_teams")
    .select("*")
    .order("created_at", { ascending: false });

  if (!teamsData || teamsData.length === 0) {
    teams.value = [];
    studentTeamMap.value = {};
    return;
  }

  // Get the most recent team creation timestamp
  const latestTimestamp = teamsData[0].created_at;

  // Filter to only include teams created at the same time (same batch)
  // Teams created together will have very similar timestamps (within 1 second)
  const latestTeams = teamsData.filter((team) => {
    const teamTime = new Date(team.created_at).getTime();
    const latestTime = new Date(latestTimestamp).getTime();
    // Consider teams created within 2 seconds of each other as part of the same batch
    return Math.abs(teamTime - latestTime) < 2000;
  });

  teams.value = latestTeams;

  // Load student-team relationships for latest teams only
  const latestTeamIds = latestTeams.map((t) => t.id);
  const { data: relationships } = await supabase
    .from("tu_student_teams")
    .select("student_id, team_id")
    .in("team_id", latestTeamIds);

  // Build student to team map
  const map = {};
  if (relationships) {
    for (const rel of relationships) {
      map[rel.student_id] = rel.team_id;
    }
  }
  studentTeamMap.value = map;
}

function openTeamModal() {
  toggleModal("teams");
}

function onTeamsCreated(newTeams) {
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
  if (!student) return "";

  // Use student's preferences if available, otherwise use defaults
  const prefs = student.name_display_prefs || {
    showFirstname: true,
    showInitial: false,
    showLastname: false,
    showCustomName: false,
  };

  const parts = [];
  if (prefs.showCustomName) {
    parts.push(student.custom_name);
  }
  if (prefs.showFirstname) {
    parts.push(student.firstname);
  }
  if (prefs.showInitial && student.lastname) {
    parts.push(student.lastname.charAt(0).toUpperCase() + ".");
  }
  if (prefs.showLastname && student.lastname) {
    parts.push(student.lastname);
  }

  return parts.join(" ") || student.firstname;
}

function getInitials(firstname, lastname) {
  return (firstname?.[0] || "") + (lastname?.[0] || "");
}

async function startSession() {
  if (!hasStudentSelection.value) return;
  loading.value = true;

  // Use currentStudents computed array (already filtered and sorted)
  const stu = [...currentStudents.value];

  students.value = stu;
  // Don't modify skills.value - it's the master array from the database
  // Template uses currentSkills computed property for filtering

  // Load events for selected students and skills
  const studentIds = stu.map((s) => s.id);
  const skillIds = currentSkills.value.map((s) => s.id);

  if (studentIds.length > 0 && skillIds.length > 0) {
    const { data: eventsRes } = await supabase
      .from("tu_session_events")
      .select("*")
      .in("student_id", studentIds)
      .in("skill_id", skillIds);

    const c = {};
    const ul = {};
    const lc = {};

    for (const s of stu) {
      c[s.id] = {};
      ul[s.id] = {};
      lc[s.id] = {};
    }

    for (const ev of eventsRes || []) {
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

  loading.value = false;
}

// ── Sorted students ───────────────────────────────────
const sortedStudents = computed(() => {
  const students = [...currentStudents.value];

  if (sortBy.value === "team" && teamsActive.value) {
    // Sort by team first, then by firstname within each team
    students.sort((a, b) => {
      const teamA = studentTeamMap.value[a.id];
      const teamB = studentTeamMap.value[b.id];

      // Students without teams go to the end
      if (!teamA && !teamB)
        return (a.firstname || "").localeCompare(b.firstname || "", "fr-FR");
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
      return (a.firstname || "").localeCompare(b.firstname || "", "fr-FR");
    });
  } else {
    // Original sorting logic
    const field = sortBy.value === "lastname" ? "lastname" : "firstname";
    students.sort((a, b) => {
      return (a[field] || "").localeCompare(b[field] || "", "fr-FR");
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
const studentOpacityMap = computed(() => {
  void counts.value;
  void currentStudents.value;
  const map = {};
  const max = maxSessionCount.value;
  for (const s of currentStudents.value) {
    const count = studentTotalCount(s.id);
    map[s.id] = max === 0 ? 1 : 1 - (count / max) * 0.8;
  }
  return map;
});

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

function onDragEnd() {
  document.body.style.touchAction = "";
  document.body.style.userSelect = "";
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.removeEventListener("pointercancel", onDragCancel);

  if (!drag.value) return;

  const studentId = drag.value.student.id;

  // Check if dropped on the absent zone
  const dropEl = document.elementFromPoint(
    drag.value.currentX,
    drag.value.currentY,
  );
  if (dropEl?.closest("[data-absent-zone]")) {
    const absentStudent = currentStudents.value.find((s) => s.id === studentId);
    if (absentStudent) {
      // Find which class this student belongs to
      let foundClass = null;
      for (const cls of classes.value) {
        const studentsInClass = allStudents.value.filter(
          (s) => s.class_id === cls.id,
        );
        if (studentsInClass.some((s) => s.id === studentId)) {
          foundClass = cls;
          break;
        }
      }
      if (foundClass && checkedClassIds.value.has(foundClass.id)) {
        // Student is from a checked class → exclude them
        const newExcluded = new Set(excludedStudentIds.value);
        newExcluded.add(studentId);
        excludedStudentIds.value = newExcluded;
      } else {
        // Individually checked student → uncheck them
        const wasChecked = checkedStudentIds.value.has(studentId);
        if (wasChecked) {
          toggleChecked(studentId, "student");
        }
      }
      if (hasEvalSelection.value) startSession();
    }
    drag.value = null;
    hoveredSkillId.value = null;
    hoveredLevel.value = null;
    return;
  }

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
    const primaryClassId =
      [...checkedClassIds.value][0] || selectedClassId.value;
    const skill = skills.value.find((s) => s.id === skillId);
    const eventPayload = {
      class_id: primaryClassId,
      evaluation_id: skill?.evaluation_id || [...checkedEvalIds.value][0],
      student_id: studentId,
      skill_id: skillId,
      level: level,
      team_id: teamsActive.value
        ? studentTeamMap.value[studentId] || null
        : null,
      user_id: userId.value,
    };
    supabase
      .from("tu_session_events")
      .insert(eventPayload)
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to save event:", error);
          return;
        }
        // Store in undo history
        actionHistory.value.push({
          studentId,
          skillId,
          level,
          eventId: data.id,
        });
        // Refresh report data if the report modal is open
        if (activeModal.value === "report" && reportModalRef.value) {
          reportModalRef.value.loadReportData();
        }
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
  hoveredAbsent.value = false;
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

// ── Undo last action ────────────────────────────────────
async function undoLastAction() {
  const action = actionHistory.value.pop();
  if (!action) return;

  const { studentId, skillId, level, eventId } = action;

  // Revert counts (all events)
  const newCounts = { ...counts.value };
  if (newCounts[studentId]) {
    newCounts[studentId] = { ...newCounts[studentId] };
    if (newCounts[studentId][skillId] != null) {
      newCounts[studentId][skillId] -= 1;
      if (newCounts[studentId][skillId] <= 0) {
        delete newCounts[studentId][skillId];
      }
    }
    if (Object.keys(newCounts[studentId]).length === 0) {
      delete newCounts[studentId];
    }
  }
  counts.value = newCounts;

  // Revert per-level count
  const newLC = { ...levelCounts.value };
  if (newLC[studentId]) {
    newLC[studentId] = { ...newLC[studentId] };
    if (newLC[studentId][skillId]) {
      newLC[studentId][skillId] = { ...newLC[studentId][skillId] };
      if (newLC[studentId][skillId][level] != null) {
        newLC[studentId][skillId][level] -= 1;
        if (newLC[studentId][skillId][level] <= 0) {
          delete newLC[studentId][skillId][level];
        }
      }
      if (Object.keys(newLC[studentId][skillId]).length === 0) {
        delete newLC[studentId][skillId];
      }
    }
    if (Object.keys(newLC[studentId]).length === 0) {
      delete newLC[studentId];
    }
  }
  levelCounts.value = newLC;

  // Revert used levels — only remove the level marker if no count remains
  if (!levelCounts.value[studentId]?.[skillId]?.[level]) {
    const newUsed = { ...usedLevels.value };
    if (newUsed[studentId]) {
      newUsed[studentId] = { ...newUsed[studentId] };
      if (newUsed[studentId][skillId]) {
        newUsed[studentId][skillId] = { ...newUsed[studentId][skillId] };
        delete newUsed[studentId][skillId][level];
        if (Object.keys(newUsed[studentId][skillId]).length === 0) {
          delete newUsed[studentId][skillId];
        }
      }
      if (Object.keys(newUsed[studentId]).length === 0) {
        delete newUsed[studentId];
      }
    }
    usedLevels.value = newUsed;
  }

  // Remove from database
  const { error } = await supabase
    .from("tu_session_events")
    .delete()
    .eq("id", eventId);
  if (error) {
    console.error("Failed to delete event for undo:", error);
    // Re-push the action so the user can retry
    actionHistory.value.push(action);
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

const selectionSummary = computed(() => {
  // Count total students from checked classes and individually checked students
  let totalStudents = 0;

  // Add students from checked classes
  for (const classId of checkedClassIds.value) {
    const classStudents = allStudents.value.filter(
      (s) => s.class_id === classId && !excludedStudentIds.value.has(s.id),
    );
    totalStudents += classStudents.length;
  }

  // Add individually checked students
  totalStudents += checkedStudentIds.value.size;

  return totalStudents > 0 ? totalStudents.toString() : "";
});

async function handleClassCheck(cls) {
  const wasChecked = checkedClassIds.value.has(cls.id);
  toggleChecked(cls.id, "class");

  // Clear any excluded students for this class when checking
  if (!wasChecked) {
    const students = allStudents.value.filter((s) => s.class_id === cls.id);
    const newExcluded = new Set(excludedStudentIds.value);
    for (const s of students) {
      newExcluded.delete(s.id);
    }
    excludedStudentIds.value = newExcluded;
  }
  // currentStudents computed will automatically update
}

function handleStudentCheck(cls, student) {
  if (checkedClassIds.value.has(cls.id)) {
    // Class is checked — toggle this student's exclusion
    const newExcluded = new Set(excludedStudentIds.value);
    if (newExcluded.has(student.id)) {
      newExcluded.delete(student.id);
    } else {
      newExcluded.add(student.id);
    }
    excludedStudentIds.value = newExcluded;
  } else {
    // Class is not checked — toggle individual student
    const wasChecked = checkedStudentIds.value.has(student.id);
    toggleChecked(student.id, "student");
    if (
      wasChecked &&
      checkedStudentIds.value.size === 0 &&
      checkedClassIds.value.size === 0
    ) {
      return;
    }
  }
  // Reload live view to reflect exclusion changes
  if (hasEvalSelection.value) startSession();
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
  <div class="app-root">
    <div class="top-bar">
      <div class="top-bar-left">
        <button
          class="undo-btn"
          :disabled="actionHistory.length === 0"
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
      <div class="top-bar-spacer"></div>
      <div class="top-bar-right">
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
                <span class="zone-skill-name">{{ skill.name }}</span>
              </span>
            </div>

            <div
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
            :current-students="currentStudents"
            :skills="skills"
            :classes="classes"
            :user-id="userId"
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
      </div>

      <!-- Middle zone: student bubbles -->
      <div class="students-row-center">
        <template v-if="currentStudents.length > 0">
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
                border: teamsActive
                  ? `2px solid ${getStudentTeamColor(student.id) || '#457b9d'}`
                  : 'none',
                background: teamsActive ? 'rgba(69, 123, 157, 0.3)' : '#457b9d',
              }"
            >
              {{ formatStudentName(student) }}
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
                background: teamsActive ? 'rgba(69, 123, 157, 0.3)' : '#457b9d',
              }"
            >
              {{ formatStudentName(student) }}
            </div>
          </div>
        </template>
      </div>

      <!-- Right zone: absent drop -->
      <div class="students-row-right">
        <div
          class="absent-zone"
          :class="{ 'absent-zone--hover': hoveredAbsent }"
          data-absent-zone
          title="Glisser un élève ici pour le retirer"
        >
          <HatGlasses :size="22" />
        </div>
      </div>
    </div>
  </div>

  <!-- Settings/Filter Modal -->
  <Settings
    :show="showFilterModal"
    :sort-by="sortBy"
    :gender-filter="genderFilter"
    :teams-active="teamsActive"
    :active-team-id="activeTeamId"
    :teams="teams"
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

.user-menu-btn:hover {
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

.user-menu-logout:hover {
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
  min-height: 200px;
  height: auto;
  align-items: flex-start;
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
  border-color: #457b9d;
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
  background: #457b9d;
  border-color: #457b9d;
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
  background: #457b9d;
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
}

.top-bar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-right: 1rem;
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
  /* border-radius: 999px; */
  border: 2px var(--text-light) solid;
  /* background: rgba(20, 10, 2, 0.85); */
  /* color: var(--stadium-yellow); */

  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  font-size: 0.75rem;
  /* line-height: 1.2; */
  /* padding: 4px 12px; */
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
</style>
;
