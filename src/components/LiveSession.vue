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
  Check,
  HatGlasses,
  Funnel,
  createLucideIcon,
  PenIcon,
  LogOut,
} from "@lucide/vue";
import { supabase } from "../supabase";
import { skillIconNames } from "../data/skillIcons";
import { signOut, userEmail } from "../stores/auth";

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
import "../styles/shared.css";
import ClassDetail from "./ClassDetail.vue";
import TeamSetup from "./TeamSetup.vue";
import RangeInput from "./RangeInput.vue";

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
  "#9932CC", // Purple
  "#FFFFFF", // White
  "#FF69B4", // Pink
  "#00CED1", // Cyan/Turquoise
  "#8B0000", // Dark Red/Maroon
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
const editingClassId = ref(null);
const editingClassName = ref("");
const isAddingNewClass = ref(false);
const classDetailId = ref(null); // null | 'new' | classId — opens ClassDetail view
const studentDetailId = ref(null); // null | studentId — opens student detail view
const studentDetailData = ref(null); // { id, firstname, lastname, gender } loaded from DB

// ── Evaluation CRUD state ──────────────────────────────
const editingEvalId = ref(null);
const editingEvalTitle = ref("");
const skillDetailId = ref(null); // null | skillId — opens skill detail view
const skillDetailData = ref(null); // { id, name, scale, icon } loaded from DB
const showSkillIconPicker = ref(false);
const iconPickerSearch = ref("");
const filteredSkillIcons = computed(() => {
  const q = iconPickerSearch.value.toLowerCase().trim();
  if (!q) return skillIconNames;
  return skillIconNames.filter((n) => n.includes(q));
});
function selectSkillIcon(iconName) {
  if (!skillDetailEditing.value) return;
  skillDetailEditing.value.icon = iconName;
  showSkillIconPicker.value = false;
  iconPickerSearch.value = "";
  saveSkillDetail();
}

const isAddingNewEval = ref(false);
const editingSkills = ref([]); // skills for the evaluation being edited
const editingNewSkillName = ref("");
const editingNewSkillMin = ref(1);
const editingNewSkillMax = ref(5);
const editingNewSkillStep = ref(1);
const showNewSkillForm = ref(false);
const editingSkillIndex = ref(null); // null = adding new, number = editing skill at this index

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
  return allStudents.value
    .filter((s) => {
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
    })
    .sort((a, b) =>
      (a.firstname || "").localeCompare(b.firstname || "", "fr-FR"),
    );
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
    .select("id, firstname, lastname, gender, class_id");
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
  const { data: teamsData } = await supabase
    .from("tu_teams")
    .select("*")
    .order("name");
  teams.value = teamsData || [];

  // Load student-team relationships
  const { data: relationships } = await supabase
    .from("tu_student_teams")
    .select("student_id, team_id");

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
const sortBy = ref("firstname"); // 'firstname' | 'lastname'
const genderFilter = ref("all"); // 'all' | 'male' | 'female' (data not yet in DB)

onMounted(async () => {
  await loadAllData();
});

async function selectClass(id) {
  selectedClassId.value = id;
  activeModal.value = null;
  if (hasEvalSelection.value) startSession();
}

function openClassModal() {
  toggleModal("class");
  classDetailId.value = null;
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
  if (!confirm("Supprimer cette classe et tous ses élèves ?")) return;
  await supabase.from("tu_classes").delete().eq("id", id);
  classes.value = classes.value.filter((c) => c.id !== id);
  if (classDetailId.value === id) {
    classDetailId.value = null;
  }
  if (selectedClassId.value === id) {
    selectedClassId.value = null;
  }
}

function onClassDetailSaved() {
  console.log("Class saved, reloading all data...");
  classDetailId.value = null;
  loadAllData();
}

function onClassDetailDeleted() {
  const deletedId = classDetailId.value;
  classDetailId.value = null;
  loadAllData();
  // If the deleted class was selected, reset selection
  if (deletedId !== "new" && selectedClassId.value === deletedId) {
    selectedClassId.value = null;
  }
}

async function handleRemoveStudent(studentId) {
  await supabase
    .from("tu_students")
    .update({ class_id: null })
    .eq("id", studentId);
  // Refresh the class detail to reflect the change
  if (classDetailId.value && classDetailId.value !== "new") {
    // The ClassDetail component will re-load via its own mechanism
    // Re-open the detail by toggling classDetailId
    const id = classDetailId.value;
    classDetailId.value = null;
    await nextTick();
    classDetailId.value = id;
  }
}

function clearClassSelection() {
  selectedClassId.value = null;
}

function clearEvalSelection() {
  checkedEvalIds.value = new Set();
  checkedSkillIds.value = new Set();
  excludedSkillIds.value = new Set();
  // Don't clear skills.value - that's the master list from the database
}

function selectEval(id) {
  toggleChecked(id, "eval");
  activeModal.value = null;
  if (hasStudentSelection.value) startSession();
}

function openEvalModal() {
  toggleModal("eval");
  classDetailId.value = null;
  evalModalTab.value = "select";
  if (!editingEvalId.value && !isAddingNewEval.value) {
    cancelEvalEdit();
  }
}

function handleClassClick(cls) {
  toggleClassExpand(cls);
}

// ── Helper functions for two-column layout ─────────────
function getClassName(classId) {
  const cls = classes.value.find((c) => c.id === classId);
  return cls ? cls.name : "";
}

async function selectClassInModal(classId) {
  selectedClassId.value = classId;
  // Close class detail when selecting a different class
  classDetailId.value = null;
}

// Computed to get students for the currently selected class (reactive)
const currentClassStudents = computed(() => {
  if (!selectedClassId.value) return [];

  return allStudents.value
    .filter((s) => s.class_id === selectedClassId.value)
    .sort((a, b) =>
      (a.firstname || "").localeCompare(b.firstname || "", "fr-FR"),
    );
});

// Helper to get skills for a specific evaluation (reactive)
function getSkillsForEval(evalId) {
  return skills.value.filter((sk) => sk.evaluation_id === evalId);
}

async function handleAddStudentToClass(classId) {
  if (!classId) return;

  // Create a new student with default name
  const { data, error } = await supabase
    .from("tu_students")
    .insert({
      firstname: "Nouvel",
      lastname: "Élève",
      class_id: classId,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add student:", error);
    alert("Erreur lors de l'ajout de l'élève");
    return;
  }

  // Add to allStudents array
  allStudents.value.push(data);

  // Select the class if not already selected
  selectedClassId.value = classId;

  // Select the new student to show details immediately
  studentDetailId.value = data.id;
}

async function handleAddNewClass() {
  // Create a new class with default name
  const { data, error } = await supabase
    .from("tu_classes")
    .insert({ name: "Nouvelle classe" })
    .select()
    .single();

  if (error) {
    console.error("Failed to create class:", error);
    alert("Erreur lors de la création de la classe");
    return;
  }

  // Add to classes array
  classes.value.push(data);

  // Open the class detail for editing
  classDetailId.value = data.id;

  // Select the new class
  selectedClassId.value = data.id;
}

// Selected evaluation for modal
const selectedEvalId = ref(null);

function selectEvalInModal(evalId) {
  selectedEvalId.value = evalId;
  // Close eval detail and skill detail when selecting a different eval
  editingEvalId.value = null;
  skillDetailId.value = null;
}

function cancelEvalEdit() {
  editingEvalId.value = null;
  editingEvalTitle.value = "";
  isAddingNewEval.value = false;
}

async function handleAddNewEval() {
  // Create a new evaluation with default name
  const { data, error } = await supabase
    .from("tu_evaluations")
    .insert({ title: "Nouvelle activité" })
    .select()
    .single();

  if (error) {
    console.error("Failed to create evaluation:", error);
    alert("Erreur lors de la création de l'activité");
    return;
  }

  // Add to evaluations array
  evaluations.value.push(data);

  // Open the eval detail for editing
  editingEvalId.value = data.id;
  editingEvalTitle.value = data.title;

  // Select the new eval
  selectedEvalId.value = data.id;
}

async function saveEvalTitleInline() {
  if (!editingEvalId.value || !editingEvalTitle.value.trim()) return;

  await supabase
    .from("tu_evaluations")
    .update({ title: editingEvalTitle.value.trim() })
    .eq("id", editingEvalId.value);

  // Update local array
  const evalIndex = evaluations.value.findIndex(
    (e) => e.id === editingEvalId.value,
  );
  if (evalIndex !== -1) {
    evaluations.value[evalIndex].title = editingEvalTitle.value.trim();
  }
}

async function handleAddNewSkill(evalId) {
  if (!evalId) return;

  // Create a new skill with default name
  const { data, error } = await supabase
    .from("tu_skills")
    .insert({
      name: "Nouvelle habileté",
      evaluation_id: evalId,
      scale: ["1", "2", "3", "4", "5"],
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add skill:", error);
    alert("Erreur lors de l'ajout de l'habileté");
    return;
  }

  // Add to skills array
  skills.value.push(data);

  // Select the new skill to show details immediately
  skillDetailId.value = data.id;
}

async function addSkillToEval() {
  if (!editingNewSkillName.value.trim() || !editingEvalId.value) return;

  const { data, error } = await supabase
    .from("tu_skills")
    .insert({
      name: editingNewSkillName.value.trim(),
      evaluation_id: editingEvalId.value,
      scale: ["1", "2", "3", "4", "5"],
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add skill:", error);
    return;
  }

  // Add to skills array
  skills.value.push(data);

  // Clear input
  editingNewSkillName.value = "";
}

async function deleteSkillInline(skillId) {
  if (!confirm("Supprimer cette habileté?")) return;

  await supabase.from("tu_skills").delete().eq("id", skillId);

  // Remove from skills array
  skills.value = skills.value.filter((s) => s.id !== skillId);
}
// ── Skill CRUD (within eval edit) ──────────────────────
async function loadEvalSkills(evalId) {
  if (!evalId) {
    editingSkills.value = [];
    return;
  }
  editingSkills.value = getSkillsForEval(evalId);
}

function startEditSkill(skill, index) {
  editingNewSkillName.value = skill.name;
  if (skill.scale && skill.scale.length > 0) {
    const nums = skill.scale.map(Number).filter((n) => !isNaN(n));
    editingNewSkillMin.value = Math.min(...nums);
    editingNewSkillMax.value = Math.max(...nums);
    editingNewSkillStep.value = nums.length > 1 ? nums[1] - nums[0] : 1;
  } else {
    editingNewSkillMin.value = 1;
    editingNewSkillMax.value = 5;
    editingNewSkillStep.value = 1;
  }
  editingSkillIndex.value = index;
  showNewSkillForm.value = true;
}

function cancelSkillForm() {
  editingNewSkillName.value = "";
  editingNewSkillMin.value = 1;
  editingNewSkillMax.value = 5;
  editingNewSkillStep.value = 1;
  showNewSkillForm.value = false;
  editingSkillIndex.value = null;
}

async function addSkill() {
  if (!editingNewSkillName.value.trim()) return;
  const min = Number(editingNewSkillMin.value);
  const max = Number(editingNewSkillMax.value);
  const step = Number(editingNewSkillStep.value);
  const scale = [];
  for (let v = min; v <= max; v += step) {
    scale.push(String(v));
  }
  const name = editingNewSkillName.value.trim();
  const payload = {
    name,
    scale,
    evaluation_id: editingEvalId.value,
  };

  if (editingSkillIndex.value !== null) {
    // Update existing skill
    const skill = editingSkills.value[editingSkillIndex.value];
    if (!skill) return;
    await supabase.from("tu_skills").update(payload).eq("id", skill.id);
    editingSkills.value[editingSkillIndex.value] = { ...skill, name, scale };

    // Update in main skills list too
    const mainSkillIndex = skills.value.findIndex((s) => s.id === skill.id);
    if (mainSkillIndex !== -1) {
      skills.value[mainSkillIndex] = {
        ...skills.value[mainSkillIndex],
        name,
        scale,
      };
    }
  } else {
    // Create new skill
    const { data } = await supabase
      .from("tu_skills")
      .insert(payload)
      .select()
      .single();
    if (data) {
      editingSkills.value.push(data);
      // Add to main skills list too
      skills.value.push(data);
    }
  }
  cancelSkillForm();
}

async function saveSkill(skill, index) {
  if (!skill.name.trim()) return;
  const payload = {
    name: skill.name.trim(),
    scale: skill.scale,
    evaluation_id: editingEvalId.value,
  };
  if (skill._temp || !skill.id) {
    // Insert
    const { data } = await supabase
      .from("tu_skills")
      .insert(payload)
      .select()
      .single();
    if (data) {
      editingSkills.value[index] = data;
      // Add to main skills list
      skills.value.push(data);
    }
  } else {
    // Update
    await supabase.from("tu_skills").update(payload).eq("id", skill.id);
    // Update in editing skills
    editingSkills.value[index] = { ...editingSkills.value[index], ...payload };
    // Update in main skills list
    const mainIndex = skills.value.findIndex((s) => s.id === skill.id);
    if (mainIndex !== -1) {
      skills.value[mainIndex] = { ...skills.value[mainIndex], ...payload };
    }
  }
}

async function removeSkill(skill, index) {
  if (!confirm("Supprimer cette habileté?")) return;

  if (!skill._temp && skill.id) {
    try {
      // First, delete all session events for this skill
      await supabase
        .from("tu_session_events")
        .delete()
        .eq("skill_id", skill.id);

      // Then delete the skill
      await supabase.from("tu_skills").delete().eq("id", skill.id);
    } catch (err) {
      console.error("Failed to delete skill:", err);
      alert("Erreur lors de la suppression de l'habileté");
      return;
    }

    // Also remove from main skills array
    skills.value = skills.value.filter((s) => s.id !== skill.id);
  }

  editingSkills.value.splice(index, 1);
}

async function saveEvalTitle(item) {
  if (!editingEvalTitle.value.trim()) return;
  await supabase
    .from("tu_evaluations")
    .update({ title: editingEvalTitle.value })
    .eq("id", item.id);
  item.title = editingEvalTitle.value;
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

  // Delete all skills for this evaluation first
  await supabase.from("tu_skills").delete().eq("evaluation_id", id);

  // Then delete the evaluation
  await supabase.from("tu_evaluations").delete().eq("id", id);

  // Update local arrays
  evaluations.value = evaluations.value.filter((e) => e.id !== id);
  skills.value = skills.value.filter((s) => s.evaluation_id !== id);
  checkedEvalIds.value.delete(id);
  checkedEvalIds.value = new Set(checkedEvalIds.value);
}

async function handleDeleteEval() {
  if (!editingEvalId.value) return;

  // Delete the evaluation (includes confirm dialog)
  await deleteEval(editingEvalId.value);

  // Only proceed if the eval was actually deleted (check if it still exists)
  const stillExists = evaluations.value.find(
    (e) => e.id === editingEvalId.value,
  );
  if (!stillExists) {
    // Eval was deleted, cancel edit but keep modal open
    cancelEvalEdit();
    // Don't close the modal - let user select another eval or create new one
  }
  // If eval still exists, user cancelled - do nothing, stay in edit mode
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
const sortedStudents = computed(() =>
  [...currentStudents.value].sort((a, b) => {
    const field = sortBy.value === "lastname" ? "lastname" : "firstname";
    return (a[field] || "").localeCompare(b[field] || "", "fr-FR");
  }),
);

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
        if (activeModal.value === "report") {
          loadReportData();
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

function getInitials(firstname, lastname) {
  return (firstname?.[0] || "") + (lastname?.[0] || "");
}

// ── Student detail form ──────────────────────────────────
const studentDetailEditing = ref(null); // Local copy for editing

// Clear student detail when selected class changes
watch(selectedClassId, () => {
  studentDetailId.value = null;
});

watch(studentDetailId, async (id) => {
  if (!id) {
    studentDetailData.value = null;
    studentDetailEditing.value = null;
    return;
  }

  // Get student from allStudents (single source of truth)
  const student = allStudents.value.find((s) => s.id === id);

  if (student) {
    studentDetailData.value = { ...student };
    // Create a local copy for editing
    studentDetailEditing.value = { ...student };
  } else {
    // Fallback: load from Supabase if not in allStudents
    const { data } = await supabase
      .from("tu_students")
      .select("id, firstname, lastname, gender, class_id")
      .eq("id", id)
      .single();

    studentDetailData.value = data || {
      firstname: "",
      lastname: "",
      gender: null,
    };
    studentDetailEditing.value = studentDetailData.value
      ? { ...studentDetailData.value }
      : null;
  }
});

async function saveStudentDetail() {
  // Capture the ID immediately before it might be cleared
  const studentId = studentDetailId.value;

  console.log("saveStudentDetail called", studentDetailEditing.value);
  console.log("Captured student ID:", studentId);
  console.log("Current firstname:", studentDetailEditing.value?.firstname);
  console.log("Current lastname:", studentDetailEditing.value?.lastname);

  if (!studentDetailEditing.value || !studentId) {
    console.log("Early return: missing data");
    return;
  }
  const { firstname, lastname, gender } = studentDetailEditing.value;
  if (!firstname?.trim() && !lastname?.trim()) {
    console.log("Early return: empty names");
    return;
  }

  console.log("Saving student:", studentId, "New name:", firstname, lastname);
  const { error } = await supabase
    .from("tu_students")
    .update({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      gender: gender || null,
    })
    .eq("id", studentDetailId.value);
  if (error) {
    console.error("Failed to save student:", error);
    return;
  }

  console.log("Supabase update successful, updating local arrays...");
  console.log("allStudents length:", allStudents.value.length);
  console.log("Looking for student ID:", studentId);
  console.log(
    "First 5 student IDs in allStudents:",
    allStudents.value.slice(0, 5).map((s) => s.id),
  );

  // Update allStudents array directly (single source of truth)
  const idx = allStudents.value.findIndex((s) => s.id === studentId);
  console.log("Found student at index:", idx, "in allStudents");

  if (idx !== -1) {
    // Create a completely new array with the updated student
    const updatedStudent = {
      ...allStudents.value[idx],
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      gender: gender || null,
    };

    console.log("Updated student object:", updatedStudent);

    // Replace entire array to force reactivity
    allStudents.value = [
      ...allStudents.value.slice(0, idx),
      updatedStudent,
      ...allStudents.value.slice(idx + 1),
    ];

    console.log("allStudents updated, new length:", allStudents.value.length);
    console.log("Updated student in allStudents:", allStudents.value[idx]);
  } else {
    console.log("Student NOT found in allStudents!");
  }

  // Also update students array if a session is active
  const stuIdx = students.value.findIndex((s) => s.id === studentId);
  if (stuIdx !== -1) {
    const updatedStudentInSession = {
      ...students.value[stuIdx],
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      gender: gender || null,
    };

    students.value = [
      ...students.value.slice(0, stuIdx),
      updatedStudentInSession,
      ...students.value.slice(stuIdx + 1),
    ];
  }
}

function toggleGender(value) {
  if (!studentDetailEditing.value) return;
  studentDetailEditing.value.gender =
    studentDetailEditing.value.gender === value ? null : value;
  saveStudentDetail();
}

async function deleteStudentFromDetail() {
  if (!studentDetailId.value) return;
  if (!confirm("Supprimer cet élève ?")) return;

  try {
    // First, delete all session events for this student
    const { error: eventsError } = await supabase
      .from("tu_session_events")
      .delete()
      .eq("student_id", studentDetailId.value);

    if (eventsError) {
      console.error("Failed to delete session events:", eventsError);
      alert("Erreur lors de la suppression des événements de session");
      return;
    }

    // Then delete the student
    const { error } = await supabase
      .from("tu_students")
      .delete()
      .eq("id", studentDetailId.value);

    if (error) {
      console.error("Failed to delete student:", error);
      alert("Erreur lors de la suppression de l'élève");
      return;
    }

    // Remove from allStudents (single source of truth)
    allStudents.value = allStudents.value.filter(
      (s) => s.id !== studentDetailId.value,
    );

    // Reload live view if active
    if (hasStudentSelection.value && hasEvalSelection.value) startSession();
    studentDetailId.value = null;
  } catch (err) {
    console.error("Unexpected error while deleting student:", err);
    alert("Une erreur inattendue est survenue");
  }
}

// ── Skill detail form ──────────────────────────────────
const skillDetailEditing = ref(null); // Local copy for editing

watch(skillDetailId, async (id) => {
  if (!id) {
    skillDetailData.value = null;
    skillDetailEditing.value = null;
    return;
  }

  // Get skill from skills array (single source of truth)
  const skill = skills.value.find((s) => s.id === id);

  if (skill) {
    skillDetailData.value = { ...skill };
    // Create a local copy for editing
    skillDetailEditing.value = { ...skill };

    // Initialize scale inputs from skill's scale
    const nums = skill.scale.map(Number).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      editingNewSkillMin.value = Math.min(...nums);
      editingNewSkillMax.value = Math.max(...nums);
      editingNewSkillStep.value = nums.length > 1 ? nums[1] - nums[0] : 1;
    } else {
      editingNewSkillMin.value = 1;
      editingNewSkillMax.value = 5;
      editingNewSkillStep.value = 1;
    }
  } else {
    // Fallback: load from Supabase if not in skills
    const { data } = await supabase
      .from("tu_skills")
      .select("id, name, scale, icon")
      .eq("id", id)
      .single();

    skillDetailData.value = data || {
      name: "",
      scale: ["1", "2", "3", "4", "5"],
      icon: null,
    };
    skillDetailEditing.value = skillDetailData.value
      ? { ...skillDetailData.value }
      : null;

    // Initialize scale inputs from loaded skill's scale
    if (skillDetailEditing.value?.scale) {
      const nums = skillDetailEditing.value.scale
        .map(Number)
        .filter((n) => !isNaN(n));
      if (nums.length > 0) {
        editingNewSkillMin.value = Math.min(...nums);
        editingNewSkillMax.value = Math.max(...nums);
        editingNewSkillStep.value = nums.length > 1 ? nums[1] - nums[0] : 1;
      }
    }
  }
});

async function saveSkillDetail() {
  // Capture the ID immediately before it might be cleared
  const skillId = skillDetailId.value;

  if (!skillDetailEditing.value || !skillId) return;
  const { name, scale, icon } = skillDetailEditing.value;
  if (!name?.trim()) return;

  const { error } = await supabase
    .from("tu_skills")
    .update({ name: name.trim(), scale, icon: icon || null })
    .eq("id", skillId);
  if (error) {
    console.error("Failed to save skill:", error);
    return;
  }

  // Update skills array directly (single source of truth)
  const idx = skills.value.findIndex((s) => s.id === skillId);
  if (idx !== -1) {
    // Create a completely new array with the updated skill
    const updatedSkill = {
      ...skills.value[idx],
      name: name.trim(),
      scale,
      icon: icon || null,
    };

    skills.value = [
      ...skills.value.slice(0, idx),
      updatedSkill,
      ...skills.value.slice(idx + 1),
    ];
  }

  // Reload live view if active
  if (hasStudentSelection.value && hasEvalSelection.value) startSession();
}

function updateScaleFromInputs() {
  if (!skillDetailEditing.value) return;

  const min = Number(editingNewSkillMin.value);
  const max = Number(editingNewSkillMax.value);
  const step = Number(editingNewSkillStep.value);

  if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0) return;
  if (min >= max) return;

  // Generate scale array from min, max, step
  const scale = [];
  for (let val = min; val <= max + 0.0001; val += step) {
    // Round to avoid floating point errors
    scale.push(Math.round(val * 100) / 100);
  }

  skillDetailEditing.value.scale = scale;
}

const skillMin = computed(() => {
  const s = skillDetailEditing.value?.scale || skillDetailData.value?.scale;
  if (!s || s.length === 0) return 1;
  return Math.min(...s.map(Number).filter((n) => !isNaN(n)));
});

const skillMax = computed(() => {
  const s = skillDetailEditing.value?.scale || skillDetailData.value?.scale;
  if (!s || s.length === 0) return 5;
  return Math.max(...s.map(Number).filter((n) => !isNaN(n)));
});

const skillStep = computed(() => {
  const s = skillDetailEditing.value?.scale || skillDetailData.value?.scale;
  if (!s || s.length < 2) return 1;
  const nums = s.map(Number).filter((n) => !isNaN(n));
  return nums.length > 1 ? nums[1] - nums[0] : 1;
});

function skillMinEdit(e) {
  const val = parseFloat(e.target.value);
  if (isNaN(val)) return;
  const max = skillMax.value;
  if (val >= max) return;
  const step = skillStep.value;
  const scale = [];
  for (let v = val; v <= max; v += step) {
    scale.push(String(v));
  }
  skillDetailEditing.value.scale = scale;
  saveSkillDetail();
}

function skillMaxEdit(e) {
  const val = parseFloat(e.target.value);
  if (isNaN(val)) return;
  const min = skillMin.value;
  if (val <= min) return;
  const step = skillStep.value;
  const scale = [];
  for (let v = min; v <= val; v += step) {
    scale.push(String(v));
  }
  skillDetailEditing.value.scale = scale;
  saveSkillDetail();
}

function skillStepEdit(e) {
  const val = parseFloat(e.target.value);
  if (isNaN(val) || val <= 0) return;
  const min = skillMin.value;
  const max = skillMax.value;
  const scale = [];
  for (let v = min; v <= max; v += val) {
    scale.push(String(v));
  }
  skillDetailEditing.value.scale = scale;
  saveSkillDetail();
}

async function deleteSkillFromDetail() {
  if (!skillDetailId.value) return;
  if (!confirm("Supprimer cette habileté ?")) return;

  const skillId = skillDetailId.value;

  try {
    // First, delete all session events for this skill
    console.log("Deleting session events for skill:", skillId);
    const { error: eventsError } = await supabase
      .from("tu_session_events")
      .delete()
      .eq("skill_id", skillId);

    if (eventsError) {
      console.error("Failed to delete session events:", eventsError);
      alert("Erreur lors de la suppression des événements de session");
      return;
    }

    console.log("Session events deleted successfully");

    // Then delete the skill
    console.log("Deleting skill:", skillId);
    const { error } = await supabase
      .from("tu_skills")
      .delete()
      .eq("id", skillId);
    if (error) {
      console.error("Failed to delete skill:", error);
      console.error("Error details:", JSON.stringify(error));

      // Check if it's a foreign key constraint error
      if (error.code === "23503") {
        alert(
          "Cette habileté ne peut pas être supprimée car elle est encore utilisée dans des évaluations. Supprimez d'abord toutes les évaluations associées.",
        );
      } else {
        alert(`Erreur lors de la suppression de l'habileté: ${error.message}`);
      }
      return;
    }

    console.log("Skill deleted successfully");

    // Remove from skills array (single source of truth)
    skills.value = skills.value.filter((s) => s.id !== skillId);

    // Also remove from editingSkills if present
    editingSkills.value = editingSkills.value.filter((s) => s.id !== skillId);

    // Reload live view if active
    if (hasStudentSelection.value && hasEvalSelection.value) startSession();
    skillDetailId.value = null;
  } catch (err) {
    console.error("Unexpected error while deleting skill:", err);
    alert("Une erreur inattendue est survenue");
  }
}

const skillDetailName = computed(() => {
  if (!skillDetailId.value) return "";
  const found = skills.value.find((s) => s.id === skillDetailId.value);
  if (found) return found.name;
  return "";
});

// ── Undo history ────────────────────────────────────────
const actionHistory = ref([]); // { studentId, skillId, level, eventId }[]

// ── Report state ──────────────────────────────────────

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

const reportData = ref(null); // { sessions: [], students: [], skills: [], events: [] }
const reportLoading = ref(false);
const selectedSessionId = ref(null); // null = all sessions
const reportSelectedStudentId = ref(null); // null = list, id = student detail

const reportSelectedStudent = computed(
  () =>
    reportData.value?.students.find(
      (s) => s.id === reportSelectedStudentId.value,
    ) || null,
);

const filteredEvents = computed(() => {
  if (!reportData.value) return [];
  return reportData.value.events;
});

// Map student id → class id from allStudents
const studentClassMap = computed(() => {
  const map = {};
  for (const s of allStudents.value) {
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
      const cls = classes.value.find((c) => c.id === classId);
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

async function loadReportData() {
  const classIds = [...checkedClassIds.value];
  // Student IDs currently selected for the live view
  const selectedStudentIds = new Set(currentStudents.value.map((s) => s.id));
  // Skill IDs currently selected for the live view
  const selectedSkillIds = new Set(skills.value.map((sk) => sk.id));

  // Determine relevant eval IDs for the report (same logic as startSession)
  const relevantEvalIdsForReport = new Set([...checkedEvalIds.value]);
  for (const sk of skills.value) {
    if (checkedSkillIds.value.has(sk.id)) {
      relevantEvalIdsForReport.add(sk.evaluation_id);
    }
  }

  try {
    // Build events query — class filter is optional (supports individually picked students)
    let eventsQuery = supabase
      .from("tu_session_events")
      .select("student_id, skill_id, level, session_id, created_at");

    if (classIds.length > 0) {
      eventsQuery = eventsQuery.in("class_id", classIds);
    }
    eventsQuery = eventsQuery
      .in("evaluation_id", [...relevantEvalIdsForReport])
      .in("student_id", [...selectedStudentIds])
      .in("skill_id", [...selectedSkillIds])
      .order("created_at", { ascending: true });

    const [sessionsRes, studentsRes, skillsRes, eventsRes] = await Promise.all([
      classIds.length > 0
        ? supabase
            .from("tu_sessions")
            .select("id, started_at, ended_at")
            .in("class_id", classIds)
            .in("evaluation_id", [...relevantEvalIdsForReport])
            .order("started_at", { ascending: true })
        : { data: [] },
      supabase
        .from("tu_students")
        .select("id, firstname, lastname, class_id")
        .in("id", [...selectedStudentIds]),
      supabase
        .from("tu_skills")
        .select("id, name, scale, icon")
        .in("id", [...selectedSkillIds]),
      eventsQuery,
    ]);

    reportData.value = {
      sessions: sessionsRes.data || [],
      students: (studentsRes.data || []).sort((a, b) =>
        a.firstname.localeCompare(b.firstname, "fr-FR"),
      ),
      skills: skillsRes.data || [],
      events: eventsRes.data || [],
    };
  } catch (err) {
    console.error("Failed to load report:", err);
  }
}

async function openReport() {
  if (activeModal.value === "report") {
    activeModal.value = null;
    return;
  }
  if (!hasStudentSelection.value || !hasEvalSelection.value) return;

  toggleModal("report");
  selectedSessionId.value = null; // reset filter

  try {
    await loadReportData();
  } finally {
    reportLoading.value = false;
  }
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

function getStudentEvents(studentId) {
  if (!reportData.value) return [];
  return reportData.value.events
    .filter((e) => e.student_id === studentId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function studentSkillInSession(studentId, skillId, sessionId) {
  if (!reportData.value) return null;
  const evt = reportData.value.events.find(
    (e) =>
      e.student_id === studentId &&
      e.skill_id === skillId &&
      e.session_id === sessionId,
  );
  return evt ? evt.level : null;
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

  // Build SVG path: move to first valid point, then line to each subsequent
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

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}

// ── Export report ──────────────────────────────────────
function exportReport() {
  if (!reportData.value) return;
  const { students, skills, events } = reportData.value;

  // Build per-student per-skill stats
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

  // Build CSV rows
  const esc = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const header = ["Classe", "Élève", ...skills.map((sk) => sk.name)];
  const rows = students.map((s) => {
    const classId = studentClassMap.value[s.id];
    const cls = classes.value.find((c) => c.id === classId);
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

  // Trigger download
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const classLabel = selectedClass.value?.name || "classe";
  const evalLabel =
    selectedEvaluation.value?.title ||
    (checkedEvalIds.value.size > 0
      ? `activites-${checkedEvalIds.value.size}`
      : "evaluation");
  a.download = `${classLabel}_${evalLabel}_rapport.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

defineExpose({
  openClassModal,
  openEvalModal,
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
          @click="openEvalModal()"
        >
          <Sneaker :size="20" />
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

        <!-- Teams button -->
        <button
          class="fab fab--teams"
          :class="{ 'fab--modal-open': isTeamModalOpen }"
          :disabled="currentStudents.length === 0"
          title="Équipes"
          @click="openTeamModal"
        >
          <Users :size="24" />
        </button>
      </div>
      <div class="top-bar-spacer"></div>
      <div class="top-bar-right">
        <div v-if="userEmail" class="user-info">
          <span class="user-email">{{ userEmail }}</span>
        </div>
        <button class="logout-btn" title="Sign out" @click="handleLogout">
          <LogOut :size="20" />
          <span>Logout</span>
        </button>
      </div>
    </div>

    <!-- ── MAIN CONTENT (stacked layers) ────────────────── -->
    <div class="main-content">
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
            {{ drag.student.firstname }}
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
      >
        <Transition name="panel-drawer" mode="out-in">
          <div
            v-if="isClassModalOpen"
            key="class"
            class="picker-panel class-modal picker-panel--full class-modal--bg"
          >
            <div class="class-modal-body">
              <!-- Close button -->
              <button
                v-if="studentDetailId === null"
                class="close-modal-btn"
                @click="toggleModal('class')"
              >
                <ChevronUp :size="36" :stroke-width="3" />
              </button>

              <!-- 3-column layout for class management -->
              <div class="class-three-column-layout">
                <!-- Column 1: Classes list -->
                <div class="class-column">
                  <div class="column-header">
                    <h3>Classes</h3>
                    <button
                      class="picker-item picker-item--inline add-btn"
                      @click="handleAddNewClass"
                    >
                      <Plus :size="20" :stroke-width="3" />
                    </button>
                  </div>
                  <div class="class-list">
                    <div v-for="cls in classes" :key="cls.id">
                      <button
                        class="picker-item class-item"
                        :class="{
                          selected: selectedClassId === cls.id,
                        }"
                        @click="selectClassInModal(cls.id)"
                      >
                        <div>{{ cls.name }}</div>
                        <div class="class-item-buttons">
                          <div
                            class="edit-class-btn-small"
                            @click.stop="classDetailId = cls.id"
                            title="Modifier la classe"
                          >
                            <PenIcon :size="16" />
                          </div>
                          <div
                            class="row-checkbox"
                            :class="{ checked: checkedClassIds.has(cls.id) }"
                            @click.stop="handleClassCheck(cls)"
                          >
                            <Check
                              v-if="checkedClassIds.has(cls.id)"
                              :size="24"
                              :stroke-width="3"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Column 2: Students or Class Detail -->
                <div class="students-column">
                  <Transition name="fade-slide" mode="out-in">
                    <!-- Show ClassDetail form when editing a class -->
                    <div
                      v-if="classDetailId !== null"
                      :key="'class-detail'"
                      class="class-detail-container"
                    >
                      <ClassDetail
                        :class-id="
                          classDetailId === 'new' ? null : classDetailId
                        "
                        @close="classDetailId = null"
                        @saved="onClassDetailSaved"
                        @deleted="onClassDetailDeleted"
                        @edit-student="studentDetailId = $event"
                        @remove-student="handleRemoveStudent"
                      />
                    </div>
                    <!-- Otherwise show student list -->
                    <div
                      v-else
                      :key="'student-list'"
                      class="students-column-content"
                    >
                      <div class="column-header">
                        <h3>
                          {{
                            selectedClassId
                              ? `Élèves`
                              : "Sélectionnez une classe"
                          }}
                        </h3>
                        <button
                          v-if="selectedClassId"
                          class="picker-item picker-item--inline add-btn"
                          @click="handleAddStudentToClass(selectedClassId)"
                        >
                          <Plus :size="20" :stroke-width="3" />
                        </button>
                      </div>
                      <div v-if="selectedClassId" class="student-list">
                        <div
                          v-for="student in currentClassStudents"
                          :key="student.id"
                          class="student-item-row"
                        >
                          <button
                            class="picker-item student-item"
                            :class="{
                              selected: studentDetailId === student.id,
                            }"
                            @click="studentDetailId = student.id"
                          >
                            <span
                              >{{ student.firstname }}
                              {{ student.lastname }}</span
                            >
                            <span
                              class="row-checkbox"
                              :class="{
                                checked:
                                  checkedStudentIds.has(student.id) ||
                                  (checkedClassIds.has(selectedClassId) &&
                                    !excludedStudentIds.has(student.id)),
                              }"
                              @click.stop="
                                handleStudentCheck(
                                  { id: selectedClassId },
                                  student,
                                )
                              "
                            >
                              <Check
                                v-if="
                                  checkedStudentIds.has(student.id) ||
                                  (checkedClassIds.has(selectedClassId) &&
                                    !excludedStudentIds.has(student.id))
                                "
                                :size="24"
                                :stroke-width="3"
                              />
                            </span>
                          </button>
                        </div>
                        <div
                          v-if="!currentClassStudents?.length"
                          class="picker-empty"
                        >
                          Aucun élève dans cette classe
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>

                <!-- Column 3: Student details (when editing) -->
                <Transition name="fade-slide" mode="out-in">
                  <div
                    v-if="studentDetailId !== null && studentDetailData"
                    class="student-detail-column"
                  >
                    <div class="student-detail-layout">
                      <!-- Photo placeholder -->
                      <div class="student-detail-photo">
                        <div class="student-photo-circle">
                          <span class="student-photo-initials">{{
                            getInitials(
                              studentDetailEditing?.firstname ||
                                studentDetailData?.firstname,
                              studentDetailEditing?.lastname ||
                                studentDetailData?.lastname,
                            )
                          }}</span>
                        </div>
                      </div>

                      <!-- Right column: fields -->
                      <div class="student-detail-fields">
                        <div class="detail-section">
                          <label class="detail-label">Prénom</label>
                          <input
                            v-model="studentDetailEditing.firstname"
                            class="detail-input"
                            placeholder="Prénom"
                            @blur="saveStudentDetail"
                          />
                        </div>
                        <div class="detail-section">
                          <label class="detail-label">Nom</label>
                          <input
                            v-model="studentDetailEditing.lastname"
                            class="detail-input"
                            placeholder="Nom"
                            @blur="saveStudentDetail"
                          />
                        </div>
                        <div class="detail-section">
                          <label class="detail-label">Sexe</label>
                          <div class="gender-selector">
                            <button
                              class="gender-btn"
                              :class="{
                                active: studentDetailEditing.gender === 'M',
                              }"
                              @click="toggleGender('M')"
                            >
                              M
                            </button>
                            <button
                              class="gender-btn"
                              :class="{
                                active: studentDetailEditing.gender === 'F',
                              }"
                              @click="toggleGender('F')"
                            >
                              F
                            </button>
                          </div>
                        </div>
                        <div
                          v-if="studentDetailData.class_name"
                          class="detail-section"
                        >
                          <label class="detail-label">Classe</label>
                          <span class="class-pill">{{
                            studentDetailData.class_name
                          }}</span>
                        </div>
                      </div>
                    </div>
                    <!-- Navigation bar -->
                    <div class="detail-nav-bar detail-nav-bar--inline">
                      <!-- <button class="back-btn" @click="studentDetailId = null">
                        <ChevronLeft :size="36" :stroke-width="3" />
                      </button> -->
                      <div class="detail-actions">
                        <button
                          class="header-trash-btn"
                          title="Supprimer l'élève"
                          @click="deleteStudentFromDetail"
                        >
                          <Trash2 :size="36" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- Evaluation modal -->
          <div
            v-else-if="isEvalModalOpen"
            key="eval"
            class="picker-panel class-modal picker-panel--full eval-bg"
          >
            <div class="class-modal-body">
              <!-- Close button -->
              <button
                v-if="skillDetailId === null && editingEvalId === null"
                class="close-modal-btn"
                @click="toggleModal('eval')"
              >
                <ChevronUp :size="36" :stroke-width="3" />
              </button>

              <!-- 3-column layout for evaluation management -->
              <div class="class-three-column-layout">
                <!-- Column 1: Evaluations list -->
                <div class="class-column">
                  <div class="column-header">
                    <h3>Activités</h3>
                    <button
                      class="picker-item picker-item--inline add-btn"
                      @click="handleAddNewEval"
                    >
                      <Plus :size="20" :stroke-width="3" />
                    </button>
                  </div>
                  <div class="class-list">
                    <div v-for="ev in evaluations" :key="ev.id">
                      <button
                        class="picker-item class-item"
                        :class="{
                          selected: selectedEvalId === ev.id,
                        }"
                        @click="selectEvalInModal(ev.id)"
                      >
                        <div>{{ ev.title }}</div>
                        <div class="class-item-buttons">
                          <div
                            class="edit-class-btn-small"
                            @click.stop="editingEvalId = ev.id"
                            title="Modifier l'activité"
                          >
                            <PenIcon :size="16" />
                          </div>
                          <div
                            class="row-checkbox"
                            :class="{
                              checked:
                                checkedEvalIds.has(ev.id) ||
                                evalHasSelectedSkills(ev.id),
                            }"
                            @click.stop="handleEvalCheck(ev)"
                          >
                            <Check
                              v-if="
                                checkedEvalIds.has(ev.id) ||
                                evalHasSelectedSkills(ev.id)
                              "
                              :size="24"
                              :stroke-width="3"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Column 2: Skills or Eval Detail -->
                <div class="students-column">
                  <Transition name="fade-slide" mode="out-in">
                    <!-- Show eval editing form when editing -->
                    <div
                      v-if="editingEvalId !== null"
                      :key="'eval-detail'"
                      class="class-detail-container"
                    >
                      <div class="detail-section">
                        <div class="class-name-row">
                          <label class="detail-label">Titre</label>
                          <input
                            v-model="editingEvalTitle"
                            class="detail-input"
                            placeholder="Ex: Lecture"
                            @blur="saveEvalTitleInline"
                            @keyup.enter="saveEvalTitleInline"
                          />
                        </div>
                      </div>

                      <!-- Skills list for this evaluation -->
                      <div class="detail-section">
                        <label class="detail-label">
                          Habiletés
                          <span class="student-count">{{
                            getSkillsForEval(editingEvalId).length
                          }}</span>
                        </label>
                        <div class="students-list">
                          <div
                            v-for="skill in getSkillsForEval(editingEvalId)"
                            :key="skill.id"
                            class="student-row"
                          >
                            <span
                              class="student-name"
                              @click="skillDetailId = skill.id"
                            >
                              {{ skill.name }}
                            </span>
                            <span class="student-row-actions">
                              <PenIcon
                                :size="20"
                                @click="skillDetailId = skill.id"
                              />
                              <X
                                :size="20"
                                @click="deleteSkillInline(skill.id)"
                              />
                            </span>
                          </div>
                          <div
                            v-if="getSkillsForEval(editingEvalId).length === 0"
                            class="students-empty"
                          >
                            Aucune habileté
                          </div>
                        </div>

                        <!-- Add skill form -->
                        <div class="add-student-row">
                          <input
                            v-model="editingNewSkillName"
                            class="detail-input student-input"
                            placeholder="Nom de l'habileté"
                            @keyup.enter="addSkillToEval"
                          />
                          <button
                            class="btn-icon"
                            title="Ajouter"
                            @click="addSkillToEval"
                          >
                            <Plus :size="24" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <!-- Otherwise show skills list -->
                    <div v-else :key="'skills-list'">
                      <div class="column-header">
                        <h3>
                          {{
                            selectedEvalId
                              ? `Habiletés`
                              : "Sélectionnez une activité"
                          }}
                        </h3>
                        <button
                          v-if="selectedEvalId"
                          class="picker-item picker-item--inline add-btn"
                          @click="handleAddNewSkill(selectedEvalId)"
                        >
                          <Plus :size="20" :stroke-width="3" />
                        </button>
                      </div>
                      <div v-if="selectedEvalId" class="student-list">
                        <div
                          v-for="skill in getSkillsForEval(selectedEvalId)"
                          :key="skill.id"
                          class="student-item-row"
                        >
                          <button
                            class="picker-item student-item"
                            :class="{ selected: skillDetailId === skill.id }"
                            @click="skillDetailId = skill.id"
                          >
                            <span>{{ skill.name }}</span>
                            <span
                              class="row-checkbox"
                              :class="{
                                checked: checkedSkillIds.has(skill.id),
                              }"
                              @click.stop="toggleChecked(skill.id, 'skill')"
                            >
                              <Check
                                v-if="checkedSkillIds.has(skill.id)"
                                :size="24"
                                :stroke-width="3"
                              />
                            </span>
                          </button>
                        </div>
                        <div
                          v-if="!getSkillsForEval(selectedEvalId)?.length"
                          class="picker-empty"
                        >
                          Aucune habileté dans cette activité
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>

                <!-- Column 3: Skill details (when editing) -->
                <Transition name="fade-slide" mode="out-in">
                  <div
                    v-if="skillDetailId !== null && skillDetailData"
                    :key="skillDetailId"
                    class="student-detail-column"
                  >
                    <!-- Navigation bar -->
                    <div class="detail-nav-bar detail-nav-bar--inline">
                      <button class="back-btn" @click="skillDetailId = null">
                        <ChevronLeft :size="36" :stroke-width="3" />
                      </button>
                      <div class="detail-actions">
                        <button
                          class="header-trash-btn"
                          title="Supprimer l'habileté"
                          @click="deleteSkillFromDetail"
                        >
                          <Trash2 :size="24" />
                        </button>
                      </div>
                    </div>

                    <div class="student-detail-layout">
                      <!-- Icon picker -->
                      <div class="student-detail-photo">
                        <div
                          class="student-photo-circle"
                          :class="{ 'picker-open': showSkillIconPicker }"
                          @click="showSkillIconPicker = !showSkillIconPicker"
                          title="Choisir une icône"
                        >
                          <img
                            v-if="
                              skillDetailEditing?.icon || skillDetailData?.icon
                            "
                            :src="`${BASE}icons/skills/${skillDetailEditing?.icon || skillDetailData?.icon}.svg`"
                            class="skill-icon-img"
                            alt=""
                          />
                          <span v-else class="student-photo-initials">?</span>
                        </div>
                      </div>

                      <!-- Right column: fields -->
                      <div class="student-detail-fields">
                        <div class="detail-section">
                          <label class="detail-label">Nom</label>
                          <input
                            v-model="skillDetailEditing.name"
                            class="detail-input"
                            placeholder="Nom de l'habileté"
                            @blur="saveSkillDetail"
                          />
                        </div>
                        <div class="detail-section">
                          <label class="detail-label">Échelle</label>
                          <div class="skill-range-config">
                            <RangeInput
                              v-model:value="editingNewSkillMin"
                              :min="0"
                              label="Min"
                              size="small"
                              @change="updateScaleFromInputs"
                            />
                            <RangeInput
                              v-model:value="editingNewSkillMax"
                              :min="editingNewSkillMin + editingNewSkillStep"
                              label="Max"
                              size="small"
                              @change="updateScaleFromInputs"
                            />
                            <RangeInput
                              v-model:value="editingNewSkillStep"
                              :min="0.1"
                              :step="0.1"
                              label="Pas"
                              size="small"
                              @change="updateScaleFromInputs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Icon picker dropdown -->
                    <div v-if="showSkillIconPicker" class="icon-picker">
                      <div class="icon-picker-search">
                        <input
                          v-model="iconPickerSearch"
                          class="icon-picker-input"
                          placeholder="Chercher une icône…"
                          autofocus
                        />
                      </div>
                      <div class="icon-picker-grid">
                        <button
                          v-for="iconName in filteredSkillIcons"
                          :key="iconName"
                          class="icon-picker-option"
                          :class="{
                            selected: skillDetailEditing.icon === iconName,
                          }"
                          @click="selectSkillIcon(iconName)"
                        >
                          <img
                            :src="`${BASE}icons/skills/${iconName}.svg`"
                            class="icon-picker-img"
                            alt=""
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- Report modal -->
          <div
            v-else-if="isReportModalOpen"
            key="report"
            class="picker-panel report-modal picker-panel--full"
          >
            <div class="picker-panel-header">
              <div class="header-left">
                <button
                  v-if="reportSelectedStudentId"
                  class="back-btn"
                  @click="reportSelectedStudentId = null"
                >
                  <ChevronLeft :size="36" :stroke-width="3" />
                </button>
                <span v-if="reportSelectedStudent">{{
                  reportSelectedStudent.firstname +
                  " " +
                  reportSelectedStudent.lastname
                }}</span>
                <span v-else>Rapport</span>
              </div>
              <div class="header-actions">
                <button
                  class="export-btn"
                  :disabled="!reportData"
                  title="Exporter en CSV"
                  @click="exportReport"
                >
                  <Download :size="22" />
                </button>
                <button class="close-btn" @click="toggleModal('report')">
                  <ChevronUp :size="36" :stroke-width="3" />
                </button>
              </div>
            </div>

            <div class="report-body">
              <div v-if="reportLoading" class="report-loading">Chargement…</div>
              <div v-else-if="!reportData" class="report-empty">
                Aucune donnée.
              </div>
              <template v-else>
                <Transition name="slide-edit" mode="out-in">
                  <!-- Student detail: chart + sessions × skills table -->
                  <div
                    v-if="reportSelectedStudentId && reportSelectedStudent"
                    :key="'detail-' + reportSelectedStudentId"
                    class="report-student-detail"
                  >
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

                    <table class="report-detail-table">
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
                            <!-- Class header row -->
                            <tr class="report-class-header">
                              <td colspan="100%">
                                {{ group.className }}
                              </td>
                            </tr>
                            <tr
                              v-for="student in group.students"
                              :key="student.id"
                            >
                              <td
                                class="report-td-student report-td-student--clickable"
                                @click="reportSelectedStudentId = student.id"
                              >
                                {{ student.firstname + " " + student.lastname }}
                              </td>
                              <td
                                v-for="skill in reportData.skills"
                                :key="skill.id"
                                class="report-td-count"
                              >
                                <template
                                  v-if="
                                    studentSkillCount(student.id, skill.id) > 0
                                  "
                                >
                                  <div class="skill-stats">
                                    <span
                                      v-if="
                                        studentSkillLast(
                                          student.id,
                                          skill.id,
                                        ) != null
                                      "
                                      class="stat-latest"
                                    >
                                      <span class="stat-latest-value">{{
                                        studentSkillLast(student.id, skill.id)
                                      }}</span>
                                    </span>
                                    <span class="stat-group">
                                      <span class="stat-item"
                                        ><Eye :size="11" />
                                        <span class="stat-val">{{
                                          studentSkillCount(
                                            student.id,
                                            skill.id,
                                          )
                                        }}</span></span
                                      >
                                      <span class="stat-item stat-tri"
                                        ><span class="tri-down">▼</span>
                                        <span class="stat-val">{{
                                          fmtNum(
                                            studentSkillMin(
                                              student.id,
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
                                              student.id,
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
                                              student.id,
                                              skill.id,
                                            ),
                                          )
                                        }}</span></span
                                      >
                                    </span>
                                  </div>
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

          <!-- Teams modal -->
          <div
            v-else-if="isTeamModalOpen"
            key="teams"
            class="picker-panel class-modal picker-panel--full team-modal-bg"
          >
            <button class="close-modal-btn" @click="toggleModal('teams')">
              <ChevronUp :size="36" :stroke-width="3" />
            </button>

            <div class="class-modal-body">
              <TeamSetup
                :students="currentStudents"
                @done="onTeamsCreated"
                @cancel="toggleModal('teams')"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- ── PERMANENT STUDENTS ROW ───────────────────────── -->
    <div class="students-row">
      <!-- Left zone: filter toggle -->
      <div class="students-row-left">
        <button
          class="fab students-row-btn"
          :class="{ 'fab--filled': filterPanelOpen }"
          title="Filtrer"
          @click="filterPanelOpen = !filterPanelOpen"
        >
          <Funnel :size="16" />
        </button>

        <!-- Filter panel -->
        <div v-if="filterPanelOpen" class="filter-panel" @click.stop>
          <div class="filter-panel-section">
            <span class="filter-panel-label">Trier par</span>
            <div class="filter-panel-options">
              <label
                class="filter-option"
                :class="{ active: sortBy === 'firstname' }"
              >
                <input
                  type="radio"
                  name="sortBy"
                  value="firstname"
                  v-model="sortBy"
                />
                Prénom
              </label>
              <label
                class="filter-option"
                :class="{ active: sortBy === 'lastname' }"
              >
                <input
                  type="radio"
                  name="sortBy"
                  value="lastname"
                  v-model="sortBy"
                />
                Nom
              </label>
            </div>
          </div>
          <div class="filter-panel-section">
            <span class="filter-panel-label">Sexe</span>
            <div class="filter-panel-options">
              <label
                class="filter-option"
                :class="{ active: genderFilter === 'all' }"
              >
                <input
                  type="radio"
                  name="gender"
                  value="all"
                  v-model="genderFilter"
                />
                Tous
              </label>
              <label
                class="filter-option"
                :class="{ active: genderFilter === 'male' }"
              >
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  v-model="genderFilter"
                />
                M
              </label>
              <label
                class="filter-option"
                :class="{ active: genderFilter === 'female' }"
              >
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  v-model="genderFilter"
                />
                F
              </label>
            </div>
          </div>

          <!-- Team filter section -->
          <div v-if="teams.length > 0" class="filter-panel-section">
            <div class="filter-panel-header-row">
              <span class="filter-panel-label">Équipes</span>
              <button
                class="toggle-teams-btn"
                :class="{ active: teamsActive }"
                @click="toggleTeamsActive"
                title="Activer/désactiver les équipes"
              >
                {{ teamsActive ? "Désactiver" : "Activer" }}
              </button>
            </div>
            <div v-if="teamsActive" class="filter-panel-options">
              <label
                class="filter-option"
                :class="{ active: activeTeamId === null }"
              >
                <input
                  type="radio"
                  name="teamFilter"
                  :value="null"
                  v-model="activeTeamId"
                />
                Toutes
              </label>
              <label
                v-for="team in teams"
                :key="team.id"
                class="filter-option"
                :class="{ active: activeTeamId === team.id }"
                :style="{
                  borderLeft: `4px solid ${getTeamColor(team.id)}`,
                }"
              >
                <input
                  type="radio"
                  name="teamFilter"
                  :value="team.id"
                  v-model="activeTeamId"
                />
                {{ team.name }}
              </label>
            </div>
          </div>
        </div>
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
              {{ student.firstname }}
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
              {{ student.firstname }}
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
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Coiny&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Varela+Round&display=swap");

/* ── Global input styles ─────────────────────────── */
input,
textarea {
  font-size: 1.5rem;
}

/* Ensure all detail and edit inputs have consistent size */
.detail-input,
.edit-input,
.student-detail-fields .detail-input,
.skill-detail-fields .detail-input,
.class-edit-row .edit-input,
.skill-input,
.range-input,
.icon-picker-input,
.scale-input {
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

.user-email {
  font-size: 13px;
  color: var(--text-muted);
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
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
  padding: 0.8rem 2rem;
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
.class-modal--bg {
  /* --text-light: #1a0e04; */
  background: #457b9d;
}

/* ── Teams modal background (gray) ───────────────── */
.team-modal-bg {
  background: var(--team-gray);
}

.eval-bg .picker-item.selected {
  /* background: rgba(26, 14, 4, 0.12); */
  /* background: rgba(26, 14, 4, 0.15); */
  /* border-color: transparent; */
}
.eval-bg .row-checkbox {
  border-color: var(--text-light);
  opacity: 0.6;
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
  /* border: 2px dashed rgba(255, 200, 80, 0.2); */
  border-radius: 16px;
  background: rgba(20, 10, 2, 0.35);
  /* overflow: hidden; */
  transition:
    background 0.18s,
    border-color 0.18s,
    transform 0.15s;
  cursor: default;
}

.drop-zone:first-child {
  /* margin-top: 8px; */
}
.drop-zone:last-child {
  /* margin-bottom: 8px; */
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
  content: "\\";
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

/* Zone: hover (has prior evals) */
.zone-hover-prior {
  /* border-color: rgba(255, 200, 80, 0.45);
  background: rgba(30, 16, 3, 0.5);
  border-style: solid; */
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
.panel-drawer-leave-active {
  /* transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); */
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

.class-modal {
  width: 100vw;
  overflow: hidden;
}

.class-modal-body {
  /* padding: 1rem; */
  overflow-y: auto;
  overflow-x: hidden;
  /* max-height: calc(92dvh - 140px); */
  scrollbar-width: thin;
  /* scrollbar-color: rgba(232, 168, 32, 0.3) transparent; */
  /* display: flex; */
  flex-wrap: wrap;
  align-items: center;
  padding: 1rem;
  /* background: rgba(20, 10, 2, 0.45); */
  /* padding-bottom: 100px; */
}

.class-modal-body::-webkit-scrollbar {
  width: 4px;
}

.class-modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.class-modal-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.class-edit-row {
  padding: 0.75rem 0 0.75rem 1rem;
}

.class-name {
  flex: 1;
  font-size: 1.25rem;
  color: var(--text-light);
  opacity: 0.85;
  font-weight: 500;
}

.class-edit-row .edit-input {
  flex: 1;
  padding: 0.55rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 1.5rem;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
}

.class-edit-row .edit-input:focus {
  border-color: #e8a820;
  background: rgba(30, 16, 3, 0.7);
}

.class-edit-row .edit-input::placeholder {
  color: var(--text-light);
  opacity: 0.4;
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
  color: var(--text-light);
  opacity: 0.5;
  background: rgba(255, 200, 80, 0.04);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.picker-tab.active {
  color: var(--text-light);
  opacity: 1;
  background: rgba(255, 215, 0, 0.15);
}
.close-btn {
  background: transparent;
  border: none;
  color: var(--text-light);
  /* opacity: 0.5; */
  cursor: pointer;
  padding: 0.45rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  transition: all 0.2s;
}

.header-trash-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 0.45rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  transition: opacity 0.2s;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-light);
  /* opacity: 0.6; */
  cursor: pointer;
  padding: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.save-btn,
.cancel-btn {
  background: transparent;
  border: 1.5px solid rgba(255, 200, 80, 0.25);
  color: var(--text-light);
  opacity: 0.7;
  cursor: pointer;
  padding: 0.3rem 0.65rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
}

.save-btn,
.cancel-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.eval-label {
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-light);
  opacity: 0.5;
  cursor: pointer;
  padding: 0.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
}
.btn-icon--delete {
  color: #fff;
  opacity: 1;
}

.skill-name {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;
  padding: 0.25rem 0;
  transition: opacity 0.15s;
}

/* ── Skills section (eval edit) ───────────────────── */
.skills-section {
  width: 100%;
  margin-top: 1rem;
  padding-top: 0.75rem;
}
.skills-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.75rem;
}
.skills-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #a8dadc42;
  font-size: 0.8rem;
  font-weight: 700;
}
.skill-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 999px;
  background: #a8dadc42;
  color: var(--text-light);
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
  transition: background 0.15s;
}

.skill-row-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.skill-row-actions > * {
  cursor: pointer;
  opacity: 0.45;
  transition: opacity 0.15s;
}
.skill-input {
  flex: 1;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 215, 0, 0.2);
  background: rgba(33, 37, 41, 0.6);
  color: var(--text-light);
  font-size: 1.5rem;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
  min-width: 0;
}
.skill-input:focus {
  border-color: var(--stadium-yellow);
  background: rgba(33, 37, 41, 0.7);
}
.skill-scale-preview {
  font-size: 0.75rem;
  color: var(--text-light);
  opacity: 0.55;
  white-space: nowrap;
  flex-shrink: 0;
}
.skill-add-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem;
  margin-bottom: 0.4rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}
.skill-range-config {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.skill-range-config label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-light);
  opacity: 0.7;
}
.range-input {
  width: 60px;
  padding: 0.25rem 0.4rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.5);
  color: var(--text-light);
  font-size: 1.5rem;
  outline: none;
  font-family: inherit;
  text-align: center;
}
.range-input:focus {
  border-color: #e8a820;
}
.skill-add-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.2rem;
}
.add-skill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: #a8dadc42;
  color: var(--text-light);
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}

.add-btn {
  /* background: none; */
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}

/* ── Report modal ─────────────────────────────────── */
.report-modal {
  background: var(--text-light);
  color: var(--court-blue);
  display: flex;
  flex-direction: column;
  max-width: 100%;
}

.report-modal > .report-body,
.report-modal > .picker-panel-header {
  max-width: 100%;
}
.report-modal .picker-panel-header {
  color: var(--court-blue);
}
.report-modal .close-btn {
  color: var(--court-blue);
  border-color: var(--court-blue);
}

.report-modal .back-btn {
  color: var(--court-blue);
}

.export-btn {
  background: none;
  border: none;
  color: var(--court-blue);
  cursor: pointer;
  padding: 0.45rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  transition: opacity 0.2s;
}
.export-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.report-modal .report-loading,
.report-modal .report-empty {
  color: var(--court-blue);
}

.report-body {
  padding: 0.5rem 1rem 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.report-loading,
.report-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-light);
  font-size: 1.1rem;
}

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

.report-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  font-size: 0.82rem;
}

.report-table th,
.report-table td {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(38, 70, 83, 0.15);
  text-align: center;
}

.report-table thead th {
  background: rgba(38, 70, 83, 0.08);
  color: var(--court-blue);
  font-weight: 700;
  font-size: 1.1rem;
  /* letter-spacing: 0.05em; */
}

.report-table .report-th-student {
  min-width: 120px;
  text-align: left;
}

/* ── Class header row in report ─────────────────── */
.report-class-header td {
  background: var(--court-blue);
  color: var(--text-light);
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
  min-width: 60px;
  text-align: center;
}

.report-table .report-td-student {
  text-align: left;
  color: var(--court-blue);
  font-weight: 600;
}

.report-td-count {
  color: var(--court-blue);
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
  font-size: 0.55rem;
  line-height: 1;
}

.tri-up {
  color: rgba(100, 200, 130, 0.7);
  font-size: 0.55rem;
  line-height: 1;
}

.stat-tilde {
  color: var(--court-blue);
  font-weight: 600;
  font-size: 0.85rem;
  line-height: 1;
}

/* ── Latest mark (distinguished subcolumn) ──────── */
.stat-latest {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--court-blue);
  flex-shrink: 0;
}

.stat-latest-value {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-light);
  line-height: 1;
}

/* ── Group of min/max/avg/count ─────────────────── */
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

.report-session-detail {
  margin-top: 1rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(255, 200, 80, 0.08);
}

.report-session-header {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--court-blue);
  margin-bottom: 0.4rem;
}

.report-session-ended {
  color: var(--court-blue);
  font-weight: 400;
}

.report-session-active {
  color: #6bff6b;
  font-weight: 400;
  font-size: 0.75rem;
}

.report-table .report-td-student--clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}

.report-student-detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem 0;
  font-size: 0.9rem;
}

.report-detail-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  font-size: 0.82rem;
}

.report-detail-table th,
.report-detail-table td {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(38, 70, 83, 0.15);
  text-align: center;
}

.report-detail-table thead th {
  background: rgba(38, 70, 83, 0.08);
  color: var(--court-blue);
  font-weight: 700;
  font-size: 1.1rem;
}

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
  color: var(--text-light);
  opacity: 0.6;
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
    transform 0.15s;

  font-family: inherit;
}
.nav-circle--active {
  color: var(--text-light);
  opacity: 1;
  border-color: #e8a820;
  background: rgba(60, 34, 6, 0.9);
}
.nav-circle--filled {
  color: var(--text-light);
  opacity: 0.75;
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
  color: var(--track-red);
  opacity: 0.75;
  border-color: rgba(255, 100, 80, 0.3);
} /*
── Picker dropdowns (big popups) ──────────────────── */
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
.picker-panel--full > .class-modal-body,
.picker-panel--full > .report-body {
  width: 100%;
  max-width: 100%;
  flex: 1;
  overflow-y: auto;
}
.picker-panel--full > .picker-panel-header {
  width: 100%;
  max-width: 100%;
  flex-shrink: 0;
}

.picker-screen--modal {
  margin: 0;
  border-radius: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.picker-panel-header {
  padding-top: 1.2rem;
  padding-left: 2.4rem;
  padding-right: 1.2rem;
  /* padding: 1.2rem 1rem 0.6rem; */
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: none;
  color: var(--text-light);
  opacity: 0.55;
  cursor: pointer;
  transition: all 0.2s;
}
.header-btn.active {
  opacity: 1;
  border-color: var(--stadium-yellow);
  color: var(--stadium-yellow);
  background: rgba(241, 196, 15, 0.1);
}

.picker-item {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  /* border: 2px var(--text-light) solid; */
  border: none;

  border-radius: 999px;
  background: #a8dadc42;
  color: var(--text-light);
  font-size: 1.25rem;
  font-weight: 600;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    transform 0.12s;
}

.picker-item-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.4rem;
  margin: 0.4rem;
}

.picker-item--inline {
  width: auto;
  display: inline-flex;
  padding: 0.5rem;
  aspect-ratio: 1;
}

/* ── Header title with edit pen ──────────────────── */
.header-title-group {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

/* ── Folder row (expand/collapse) ────────────────── */
.folder-row {
  cursor: pointer;
}
.folder-row.expanded {
  /* background: #a8dadc80; */
}

.picker-item.folder-row.expanded {
  flex-direction: column;
  align-items: stretch;
  /* padding: 0.6rem 0.8rem; */
  gap: 0.5rem;
  border-radius: 24px;
}

.picker-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding-right: 0.37rem;
}

.folder-label-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.folder-chevron {
  flex-shrink: 0;
  transition: transform 0.2s;
}

/* ── Nested items (expanded children) ────────────── */
.nested-items {
}

.picker-item--nested {
  font-size: 1rem;
  padding: 0.4rem 0.8rem;
  padding-left: 1.4rem;
  background: rgba(168, 218, 220, 0.2);
  gap: 0.5rem;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.nested-row {
  gap: 0.2rem;
}

.nested-empty {
  padding: 0.6rem 1rem 0.6rem 1.5rem;
  color: var(--text-light);
  opacity: 0.4;
  font-style: italic;
  font-size: 0.9rem;
}

.nested-row-actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.nested-row-actions > * {
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.15s;
}

/* ── Detail placeholder (student/skill sub-views) ── */
.detail-placeholder {
  padding: 2rem;
  text-align: center;
}

.detail-placeholder-label {
  font-size: 1.2rem;
  font-weight: 700;
  opacity: 0.7;
}

/* ── Detail section / label / input (shared with class detail style) ── */
.student-detail-fields .detail-section,
.skill-detail-fields .detail-section {
  padding: 0.25rem 0;
}

.student-detail-fields .detail-label,
.skill-detail-fields .detail-label {
  display: block;
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.5rem;
}

.student-detail-fields .detail-input,
.skill-detail-fields .detail-input {
  flex: 1;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: 999px;
  background: rgba(33, 37, 41, 0.6);
  color: var(--text-light);
  font-size: 1.5rem;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
  border: none;
  box-sizing: border-box;
}
.student-detail-fields .detail-input:focus,
.skill-detail-fields .detail-input:focus {
  border-color: var(--stadium-yellow);
  background: rgba(33, 37, 41, 0.7);
}
.student-detail-fields .detail-input::placeholder,
.skill-detail-fields .detail-input::placeholder {
  color: var(--text-light);
  opacity: 0.4;
}

/* ── Student detail form ──────────────────────────── */
.student-detail-form {
  padding: 1.5rem;
}

.student-detail-layout {
  flex-direction: column;
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.student-detail-photo {
  flex-shrink: 0;
}

.student-photo-circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #1a3a5c;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.student-photo-initials {
  font-size: 1.8rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}

.student-detail-fields {
  flex: 1;
  width: 100%;
  min-width: 0;
}
.gender-selector {
  display: inline-flex;
  gap: 0.5rem;
}

.gender-btn {
  flex: 1;
  height: 60px;
  border: none;
  /* border: 1px solid rgba(255, 255, 255); */
  border-radius: 100%;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-light);
  font-size: 1.5rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  /* transition: all 0.2s; */
  opacity: 0.5;
  transform: scale(0.9);
}
.gender-btn.active {
  background: rgba(33, 37, 41, 0.6);
  opacity: 1;
  transform: scale(1);
}

.class-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  background: rgba(168, 218, 220, 0.25);
  color: var(--text-light);
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
}

/* ── Skill detail form ───────────────────────────── */
.skill-detail-form {
  padding: 1.5rem;
}

.skill-detail-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.skill-detail-icon {
  flex-shrink: 0;
}

.skill-icon-circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #2d4a3e;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}
.skill-icon-circle.picker-open {
  background: var(--stadium-yellow, #f1c40f);
  border-radius: 28px 28px 0 0;
}

.skill-icon-img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  mix-blend-mode: screen;
}

.skill-icon-letter {
  font-size: 2.2rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}

/* ── Icon picker ─────────────────────────────────── */
.icon-picker {
  margin-top: 0;
  background: #1e2a30;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top: none;
  border-radius: 0 0 16px 16px;
  padding: 0.5rem;
  max-height: 240px;
  overflow-y: auto;
  width: 280px;
}

.icon-picker-search {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #1e2a30;
  padding-bottom: 0.4rem;
}

.icon-picker-input {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: rgba(33, 37, 41, 0.6);
  color: var(--text-light);
  font-size: 1.5rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}
.icon-picker-input:focus {
  border-color: var(--stadium-yellow);
}

.icon-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.icon-picker-option {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  padding: 4px;
  transition: all 0.15s;
}
.icon-picker-option.selected {
  background: rgba(241, 196, 15, 0.2);
  border-color: var(--stadium-yellow);
}

.icon-picker-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  mix-blend-mode: screen;
  pointer-events: none;
}

/* ── Skill row icon (editing view) ──────────────── */
.skill-row-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  mix-blend-mode: screen;
  flex-shrink: 0;
  opacity: 0.7;
}

/* ── Picker item icon (eval modal tree) ──────────── */
.picker-item-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  mix-blend-mode: screen;
  flex-shrink: 0;
  opacity: 0.6;
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

.skill-detail-fields {
  flex: 1;
  min-width: 0;
}

.skill-scale-config {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.3rem;
}

.scale-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}

.scale-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scale-input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: rgba(33, 37, 41, 0.5);
  color: var(--text-light);
  font-size: 1.5rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}
.scale-input:focus {
  border-color: var(--stadium-yellow);
  background: rgba(33, 37, 41, 0.7);
}

.scale-preview {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.scale-preview-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scale-preview-values {
  font-size: 0.85rem;
  color: var(--stadium-yellow);
  font-weight: 600;
  opacity: 0.8;
}

.skill-scale-badge {
  font-size: 0.7rem;
  color: var(--text-light);
  opacity: 0.5;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.15);
}

/* ── Row checkbox ────────────────────────────────── */
.row-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 32px;
  border-radius: 50%;
  /* border: 2px solid var(--text-light); */
  background: var(--court-blue);
  opacity: 0.5;
  /* background: transparent; */
  cursor: pointer;
  transition: all 0.2s;
  /* padding: 12px; */
  margin: -12px;
}

.row-checkbox.checked {
  /* border: 2px solid var(--text-light);
  border-color: var(--text-light); */
  /* background: none; */

  opacity: 1;
}
/* .row-checkbox.checked :deep(svg) {
  color: #1a0e04;
  display: block;
} */

/* ── Edit class/eval button ──────────────────────── */
.edit-class-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  /* background: rgba(255, 255, 255, 0.1); */
  color: var(--text-light);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
  margin-left: 8px;
}

/* ── Detail navigation bar ───────────────────────── */
.detail-nav-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  /* gap: 12px; */
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.detail-nav-bar--inline {
  border-bottom: none;
}

.detail-nav-bar span {
  flex: 1;
  font-weight: 700;
  font-size: 1.1rem;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.class-detail-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.close-modal-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 10;
}

/* ── Two-column layout for classes ─────────────────── */
.class-two-column-layout {
  display: flex;
  /* gap: 20px; */
  /* height: 100%; */
  height: calc(100% - 24px);
}

/* ── Three-column layout for class modal ───────────── */
.class-three-column-layout {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  height: calc(100% - 24px);
  width: 100%;
}

.class-column,
.students-column,
.student-detail-column {
  /* background: rgba(4, 8, 26, 0.1); */
  border: 2px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* border-right: 2px solid rgba(255, 255, 255, 0.1); */
  position: relative;
}

/* Remove justify-content that might interfere with scrolling */
.students-column {
  animation: slideInFromLeft 0.3s ease-out;
  justify-content: flex-start;
}

.student-detail-column {
  border-right: none;
}

/* ClassDetail container in middle column */
.class-detail-container {
  flex: 1;
  overflow-y: auto;
  /* padding: 0.5rem; */
}

/* Student list needs explicit flex and overflow */
.students-column .student-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 0.5rem;
}

/* Wrapper for student list content */
.students-column-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Slide-in animation for columns */
@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Vue Transition for fade only */
.fade-slide-enter-active {
  transition: opacity 0.15s ease-out;
}

.fade-slide-leave-active {
  display: none;
}

.fade-slide-enter-from {
  opacity: 0;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* padding: 1rem; */
  /* border-bottom: 2px solid rgba(255, 255, 255, 0.1); */
  flex-shrink: 0;
}

.column-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.add-btn {
  padding: 0.4rem;
  min-width: auto;
}

.class-list,
.student-list {
  overflow-x: hidden;
  flex: 1;
  overflow-y: auto;
  /* background: rgba(255, 255, 255, 1); */
  margin-top: 1rem;
  /* padding: 0.5rem; */

  /* Custom scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }

  /* Firefox scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.class-item,
.student-item {
  width: 100%;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  gap: 8px;
  transition: opacity 0.2s ease-out;
  border: 1px solid transparent;
}

/* Dim unselected items when a selection is active */
.class-list:has(.class-item.selected) .class-item:not(.selected),
.student-list:has(.student-item.selected) .student-item:not(.selected) {
  opacity: 0.5;
}

.class-item.selected,
.student-item.selected {
  border-color: rgba(255, 255, 255, 1);
  opacity: 1;
}

.class-item-buttons {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
}

.edit-class-btn-small {
  min-width: 24px;
  text-align: center;

  min-height: 100%;
  /* padding: 6px; */
  /* border-radius: 50%; */
  /* background: rgba(255, 255, 255, 0.1); */
  cursor: pointer;
  transition: all 0.2s;
}

.select-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-style: italic;
  opacity: 0.6;
}

.picker-empty {
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--text-light);
  opacity: 0.45;
  font-style: italic;
  font-size: 1.1rem;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: -0.4rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.bubble {
  border: 2px solid var(--text-light);
  padding: 20px;
}
</style>
;
