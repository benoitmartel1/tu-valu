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
} from "@lucide/vue";
import { supabase } from "../supabase";
import { skillIconNames } from "../data/skillIcons";

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
import ClassDetail from "./ClassDetail.vue";

// ── Setup state ───────────────────────────────────────
const classes = ref([]);
const evaluations = ref([]);
const selectedClassId = ref(null);
const loading = ref(false);

// ── Picker state ──────────────────────────────────────
const classModalOpen = ref(false);
const classModalTab = ref("select"); // 'select' | 'edit'
const evalModalOpen = ref(false);
const evalModalTab = ref("select"); // 'select' | 'edit'
const classEditMode = ref(false);
const evalEditMode = ref(false);

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
const classStudentsCache = ref({});
const evalSkillsCache = ref({});

async function toggleClassExpand(cls) {
  if (expandedClassId.value === cls.id) {
    expandedClassId.value = null;
    return;
  }
  expandedClassId.value = cls.id;
  if (!classStudentsCache.value[cls.id]) {
    const { data } = await supabase
      .from("tu_students")
      .select("id, firstname, lastname")
      .eq("class_id", cls.id)
      .order("firstname");
    classStudentsCache.value = {
      ...classStudentsCache.value,
      [cls.id]: data || [],
    };
  }
}

async function toggleEvalExpand(ev) {
  if (expandedEvalId.value === ev.id) {
    expandedEvalId.value = null;
    return;
  }
  expandedEvalId.value = ev.id;
  if (!evalSkillsCache.value[ev.id]) {
    const { data } = await supabase
      .from("tu_skills")
      .select("id, name, scale")
      .eq("evaluation_id", ev.id)
      .order("name");
    evalSkillsCache.value = { ...evalSkillsCache.value, [ev.id]: data || [] };
  }
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
  if (!skillDetailData.value) return;
  skillDetailData.value.icon = iconName;
  showSkillIconPicker.value = false;
  iconPickerSearch.value = "";
  saveSkillDetail();
}
function toggleGlobalEditMode() {
  if (
    classModalOpen.value &&
    classDetailId.value === null &&
    studentDetailId.value === null
  ) {
    classEditMode.value = !classEditMode.value;
  } else if (evalModalOpen.value && skillDetailId.value === null) {
    evalEditMode.value = !evalEditMode.value;
  }
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
const students = ref([]);
const classStudents = ref([]); // students preview when only class is selected
const skills = ref([]);
const counts = ref({}); // { studentId: { skillId: count } } — all events
const usedLevels = ref({}); // { studentId: { skillId: { level: true } } }
const levelCounts = ref({}); // { studentId: { skillId: { level: count } } }

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
  if (hasEvalSelection.value) startSession();
}

async function loadClassStudents(classId) {
  if (!classId) {
    classStudents.value = [];
    return;
  }
  const { data } = await supabase
    .from("tu_students")
    .select("id, firstname, lastname")
    .eq("class_id", classId)
    .order("firstname");
  classStudents.value = data || [];
}

function openClassModal() {
  if (classModalOpen.value) {
    classModalOpen.value = false;
    return;
  }
  evalModalOpen.value = false;
  reportModalOpen.value = false;
  classDetailId.value = null;
  classModalOpen.value = true;
  classModalTab.value = "select";
  classEditMode.value = false;
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
    classStudents.value = [];
  }
}

async function refreshClasses() {
  const { data } = await supabase
    .from("tu_classes")
    .select("id, name")
    .order("name");
  classes.value = data || [];
}

function onClassDetailSaved() {
  classDetailId.value = null;
  refreshClasses();
}

function onClassDetailDeleted() {
  const deletedId = classDetailId.value;
  classDetailId.value = null;
  refreshClasses();
  // If the deleted class was selected, reset selection
  if (deletedId !== "new" && selectedClassId.value === deletedId) {
    selectedClassId.value = null;
    classStudents.value = [];
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
  classStudents.value = [];
}

function clearEvalSelection() {
  checkedEvalIds.value = new Set();
  checkedSkillIds.value = new Set();
  excludedSkillIds.value = new Set();
  skills.value = [];
}

function selectEval(id) {
  toggleChecked(id, "eval");
  evalModalOpen.value = false;
  if (hasStudentSelection.value) startSession();
}

function openEvalModal() {
  if (evalModalOpen.value) {
    evalModalOpen.value = false;
    return;
  }
  classModalOpen.value = false;
  reportModalOpen.value = false;
  classDetailId.value = null;
  evalModalOpen.value = true;
  evalModalTab.value = "select";
  evalEditMode.value = false;
  if (!editingEvalId.value && !isAddingNewEval.value) {
    cancelEvalEdit();
  }
}

function handleClassClick(cls) {
  toggleClassExpand(cls);
}

function handleEvalClick(ev) {
  toggleEvalExpand(ev);
}

// ── Evaluation CRUD ────────────────────────────────────
async function startEvalEdit(item) {
  editingEvalId.value = item.id;
  editingEvalTitle.value = item.title;
  isAddingNewEval.value = false;
  showNewSkillForm.value = false;
  await loadEvalSkills(item.id);
}

function cancelEvalEdit() {
  editingEvalId.value = null;
  editingEvalTitle.value = "";
  isAddingNewEval.value = false;
  editingSkills.value = [];
  showNewSkillForm.value = false;
  editingSkillIndex.value = null;
}

// ── Skill CRUD (within eval edit) ──────────────────────
async function loadEvalSkills(evalId) {
  if (!evalId) {
    editingSkills.value = [];
    return;
  }
  const { data } = await supabase
    .from("tu_skills")
    .select("id, name, scale, icon")
    .eq("evaluation_id", evalId)
    .order("name");
  editingSkills.value = data || [];
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
  } else {
    // Create new skill
    const { data } = await supabase
      .from("tu_skills")
      .insert(payload)
      .select()
      .single();
    if (data) {
      editingSkills.value.push(data);
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
    if (data) editingSkills.value[index] = data;
  } else {
    // Update
    await supabase.from("tu_skills").update(payload).eq("id", skill.id);
  }
}

async function removeSkill(skill, index) {
  if (!confirm("Supprimer cette habileté?")) return;
  if (!skill._temp && skill.id) {
    await supabase.from("tu_skills").delete().eq("id", skill.id);
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
  await supabase.from("tu_evaluations").delete().eq("id", id);
  evaluations.value = evaluations.value.filter((e) => e.id !== id);
  checkedEvalIds.value.delete(id);
  checkedEvalIds.value = new Set(checkedEvalIds.value);
  // Also clean up cached skills
  delete evalSkillsCache.value[id];
  evalSkillsCache.value = { ...evalSkillsCache.value };
}

async function startSession() {
  if (!hasStudentSelection.value) return;
  loading.value = true;

  // Load students from all checked classes (minus excluded) and individually checked students
  const classIds = [...checkedClassIds.value];
  const excluded = excludedStudentIds.value;

  // Load students from each checked class
  const studentsMap = new Map();
  if (classIds.length > 0) {
    for (const cid of classIds) {
      await ensureClassStudentsLoaded(cid);
      for (const s of classStudentsCache.value[cid] || []) {
        if (!excluded.has(s.id)) {
          studentsMap.set(s.id, s);
        }
      }
    }
  }

  // Also add individually checked students not already included
  if (checkedStudentIds.value.size > 0) {
    for (const students of Object.values(classStudentsCache.value)) {
      for (const s of students) {
        if (checkedStudentIds.value.has(s.id) && !studentsMap.has(s.id)) {
          studentsMap.set(s.id, s);
        }
      }
    }
  }

  const stu = [...studentsMap.values()].sort((a, b) =>
    (a.firstname || "").localeCompare(b.firstname || ""),
  );

  // ── Determine which evaluations are relevant ────────────
  const relevantEvalIds = new Set([...checkedEvalIds.value]);

  // Also include evals of individually checked skills
  if (checkedSkillIds.value.size > 0) {
    // Check the cache first
    for (const [evalId, skills] of Object.entries(evalSkillsCache.value)) {
      for (const sk of skills) {
        if (checkedSkillIds.value.has(sk.id)) {
          relevantEvalIds.add(evalId);
          break;
        }
      }
    }
    // For any individually checked skills not found in cache, load their eval_id from DB
    const foundSkillIds = new Set();
    for (const skills of Object.values(evalSkillsCache.value)) {
      for (const sk of skills) {
        if (checkedSkillIds.value.has(sk.id)) {
          foundSkillIds.add(sk.id);
        }
      }
    }
    const missingSkillIds = [...checkedSkillIds.value].filter(
      (id) => !foundSkillIds.has(id),
    );
    if (missingSkillIds.length > 0) {
      const { data: missingSkills } = await supabase
        .from("tu_skills")
        .select("id, evaluation_id")
        .in("id", missingSkillIds);
      if (missingSkills) {
        for (const sk of missingSkills) {
          relevantEvalIds.add(sk.evaluation_id);
        }
      }
    }
  }

  if (relevantEvalIds.size === 0 && checkedSkillIds.value.size === 0) {
    skills.value = [];
    students.value = stu;
    counts.value = {};
    usedLevels.value = {};
    levelCounts.value = {};
    loading.value = false;
    return;
  }

  // ── Load skills from all relevant evals ────────────────
  const skillsQuery = supabase
    .from("tu_skills")
    .select("id, name, scale, evaluation_id, icon");

  if (relevantEvalIds.size > 0) {
    skillsQuery.in("evaluation_id", [...relevantEvalIds]);
  }

  // ── Load events for all relevant evals and classes ─────
  let eventsQuery = supabase
    .from("tu_session_events")
    .select("student_id, skill_id, level, session_id");

  if (relevantEvalIds.size > 0) {
    eventsQuery = eventsQuery.in("evaluation_id", [...relevantEvalIds]);
  }

  if (classIds.length > 0) {
    eventsQuery = eventsQuery.in("class_id", classIds);
  }

  const [skillsRes, eventsRes] = await Promise.all([skillsQuery, eventsQuery]);

  // Filter skills to only show selected ones
  const allSkills = skillsRes.data || [];
  const selectedSkills = allSkills.filter((sk) => {
    // Skill is selected if individually checked
    if (checkedSkillIds.value.has(sk.id)) return true;
    // Or if its eval is checked and it's not excluded
    if (
      checkedEvalIds.value.has(sk.evaluation_id) &&
      !excludedSkillIds.value.has(sk.id)
    )
      return true;
    return false;
  });
  const selectedSkillIdSet = new Set(selectedSkills.map((sk) => sk.id));

  skills.value = selectedSkills;
  const events = (eventsRes.data || []).filter((e) =>
    selectedSkillIdSet.has(e.skill_id),
  );

  const c = {};
  const ul = {};
  const lc = {};
  for (const s of stu) {
    c[s.id] = {};
    ul[s.id] = {};
    lc[s.id] = {};
  }
  for (const ev of events) {
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

  students.value = stu;
  loading.value = false;
}

// ── Sorted students ───────────────────────────────────
const sortedStudents = computed(() =>
  [...students.value].sort((a, b) => {
    const field = sortBy.value === "lastname" ? "lastname" : "firstname";
    return (a[field] || "").localeCompare(b[field] || "");
  }),
);

// ── Session evaluation stats ──────────────────────────
const maxSessionCount = computed(() => {
  // Read counts.value explicitly to ensure dependency tracking
  void counts.value;
  let max = 0;
  for (const s of students.value) {
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

function hasUsedLevel(studentId, skillId, level) {
  return !!usedLevels.value[studentId]?.[skillId]?.[level];
}

// ── Opacity helper ─────────────────────────────────────
const studentOpacityMap = computed(() => {
  void counts.value;
  void students.value;
  const map = {};
  const max = maxSessionCount.value;
  for (const s of students.value) {
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
    const absentStudent = students.value.find((s) => s.id === studentId);
    if (absentStudent) {
      // Find which class this student belongs to
      let foundClass = null;
      for (const cls of classes.value) {
        const cached = classStudentsCache.value[cls.id];
        if (cached?.some((s) => s.id === studentId)) {
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
        if (reportModalOpen.value) {
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

// ── Selection-based student list ───────────────────────
// Union of: all students from checked classes (minus excluded) + individually checked students
const selectedStudentList = computed(() => {
  const map = new Map();
  const excluded = excludedStudentIds.value;
  // Students from checked classes (minus excluded)
  for (const classId of checkedClassIds.value) {
    const students = classStudentsCache.value[classId] || [];
    for (const s of students) {
      if (!excluded.has(s.id)) {
        map.set(s.id, s);
      }
    }
  }
  // Individually checked students (from any class)
  if (checkedStudentIds.value.size > 0) {
    for (const students of Object.values(classStudentsCache.value)) {
      for (const s of students) {
        if (checkedStudentIds.value.has(s.id) && !map.has(s.id)) {
          map.set(s.id, s);
        }
      }
    }
  }
  return [...map.values()];
});

const hasStudentSelection = computed(
  () => checkedClassIds.value.size > 0 || checkedStudentIds.value.size > 0,
);

const hasEvalSelection = computed(
  () => checkedEvalIds.value.size > 0 || checkedSkillIds.value.size > 0,
);

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
  const classCount = checkedClassIds.value.size;
  const extraStudentCount = checkedStudentIds.value.size;
  if (classCount === 0 && extraStudentCount === 0) return "";
  const parts = [];
  if (classCount > 0) {
    parts.push(`${classCount} groupe${classCount > 1 ? "s" : ""}`);
  }
  if (extraStudentCount > 0) {
    parts.push(`${extraStudentCount} élève${extraStudentCount > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
});

async function ensureClassStudentsLoaded(classId) {
  if (classStudentsCache.value[classId]) return;
  const { data } = await supabase
    .from("tu_students")
    .select("id, firstname, lastname, class_id")
    .eq("class_id", classId)
    .order("firstname");
  classStudentsCache.value = {
    ...classStudentsCache.value,
    [classId]: data || [],
  };
}

async function handleClassCheck(cls) {
  // Ensure students are loaded when checking a class
  await ensureClassStudentsLoaded(cls.id);
  const wasChecked = checkedClassIds.value.has(cls.id);
  toggleChecked(cls.id, "class");
  // Clear any excluded students for this class
  const students = classStudentsCache.value[cls.id] || [];
  const newExcluded = new Set(excludedStudentIds.value);
  for (const s of students) {
    newExcluded.delete(s.id);
  }
  excludedStudentIds.value = newExcluded;

  if (wasChecked) {
    // Unchecking — clear students from live view if none selected
    if (
      checkedClassIds.value.size === 0 &&
      checkedStudentIds.value.size === 0
    ) {
      students.value = [];
    } else if (hasEvalSelection.value) {
      startSession();
    }
  } else if (hasEvalSelection.value) {
    // Checking — reload live view
    startSession();
  }
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
      students.value = [];
      return;
    }
  }
  // Reload live view to reflect exclusion changes
  if (hasEvalSelection.value) startSession();
}

async function handleEvalCheck(ev) {
  // Ensure skills are loaded when checking an eval
  if (!evalSkillsCache.value[ev.id]) {
    const { data } = await supabase
      .from("tu_skills")
      .select("id, name, scale, icon")
      .eq("evaluation_id", ev.id)
      .order("name");
    evalSkillsCache.value = { ...evalSkillsCache.value, [ev.id]: data || [] };
  }
  const wasChecked = checkedEvalIds.value.has(ev.id);
  toggleChecked(ev.id, "eval");
  // Clear any excluded skills for this eval
  const evSkills = evalSkillsCache.value[ev.id] || [];
  const newExcluded = new Set(excludedSkillIds.value);
  for (const sk of evSkills) {
    newExcluded.delete(sk.id);
  }
  excludedSkillIds.value = newExcluded;

  if (wasChecked) {
    // Unchecking — clear live view if no eval or skill remains selected
    if (!hasEvalSelection.value) {
      students.value = [];
      skills.value = [];
      counts.value = {};
      usedLevels.value = {};
      levelCounts.value = {};
      // Close report if it was open
      reportModalOpen.value = false;
    } else if (hasStudentSelection.value) {
      startSession();
    }
  } else if (hasStudentSelection.value) {
    // Checking — reload live view
    startSession();
  }
}

function handleSkillCheck(ev, skill) {
  if (checkedEvalIds.value.has(ev.id)) {
    // Eval is checked — toggle this skill's exclusion
    const newExcluded = new Set(excludedSkillIds.value);
    if (newExcluded.has(skill.id)) {
      newExcluded.delete(skill.id);
    } else {
      newExcluded.add(skill.id);
    }
    excludedSkillIds.value = newExcluded;
  } else {
    // Eval is not checked — toggle individual skill
    toggleChecked(skill.id, "skill");
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
  for (const cls of classes.value) {
    const students = classStudentsCache.value[cls.id] || [];
    const found = students.find((s) => s.id === studentDetailId.value);
    if (found) return `${found.firstname} ${found.lastname}`;
  }
  return "";
});

function getInitials(firstname, lastname) {
  return (firstname?.[0] || "") + (lastname?.[0] || "");
}

// ── Student detail form ──────────────────────────────────
watch(studentDetailId, async (id) => {
  if (!id) {
    studentDetailData.value = null;
    return;
  }
  const { data } = await supabase
    .from("tu_students")
    .select("id, firstname, lastname, gender")
    .eq("id", id)
    .single();
  studentDetailData.value = data || {
    firstname: "",
    lastname: "",
    gender: null,
  };
});

async function saveStudentDetail() {
  if (!studentDetailData.value || !studentDetailId.value) return;
  const { firstname, lastname, gender } = studentDetailData.value;
  if (!firstname?.trim() && !lastname?.trim()) return;
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
  // Update cache
  for (const cls of classes.value) {
    const cache = classStudentsCache.value[cls.id];
    if (cache) {
      const idx = cache.findIndex((s) => s.id === studentDetailId.value);
      if (idx !== -1) {
        cache[idx] = {
          ...cache[idx],
          firstname: firstname.trim(),
          lastname: lastname.trim(),
        };
        classStudentsCache.value = { ...classStudentsCache.value };
        break;
      }
    }
  }
  // Reload live view if active
  if (hasStudentSelection.value && hasEvalSelection.value) startSession();
}

function toggleGender(value) {
  if (!studentDetailData.value) return;
  studentDetailData.value.gender =
    studentDetailData.value.gender === value ? null : value;
  saveStudentDetail();
}

async function deleteStudentFromDetail() {
  if (!studentDetailId.value) return;
  if (!confirm("Supprimer cet élève ?")) return;
  const { error } = await supabase
    .from("tu_students")
    .delete()
    .eq("id", studentDetailId.value);
  if (error) {
    console.error("Failed to delete student:", error);
    return;
  }
  // Remove from cache
  for (const cls of classes.value) {
    const cache = classStudentsCache.value[cls.id];
    if (cache) {
      const idx = cache.findIndex((s) => s.id === studentDetailId.value);
      if (idx !== -1) {
        cache.splice(idx, 1);
        classStudentsCache.value = { ...classStudentsCache.value };
        break;
      }
    }
  }
  // Also remove from classStudents
  classStudents.value = classStudents.value.filter(
    (s) => s.id !== studentDetailId.value,
  );
  // Reload live view if active
  if (hasStudentSelection.value && hasEvalSelection.value) startSession();
  studentDetailId.value = null;
}

// ── Skill detail form ───────────────────────────────────
watch(skillDetailId, (id) => {
  showSkillIconPicker.value = false;
  iconPickerSearch.value = "";
});
watch(skillDetailId, async (id) => {
  if (!id) {
    skillDetailData.value = null;
    return;
  }
  const { data } = await supabase
    .from("tu_skills")
    .select("id, name, scale")
    .eq("id", id)
    .single();
  skillDetailData.value = data || {
    name: "",
    scale: ["1", "2", "3", "4", "5"],
  };
});

async function saveSkillDetail() {
  if (!skillDetailData.value || !skillDetailId.value) return;
  const { name, scale, icon } = skillDetailData.value;
  if (!name?.trim()) return;
  const { error } = await supabase
    .from("tu_skills")
    .update({ name: name.trim(), scale, icon: icon || null })
    .eq("id", skillDetailId.value);
  if (error) {
    console.error("Failed to save skill:", error);
    return;
  }
  // Update cache
  for (const ev of evaluations.value) {
    const cache = evalSkillsCache.value[ev.id];
    if (cache) {
      const idx = cache.findIndex((s) => s.id === skillDetailId.value);
      if (idx !== -1) {
        cache[idx] = {
          ...cache[idx],
          name: name.trim(),
          scale,
          icon: skillDetailData.value.icon || null,
        };
        evalSkillsCache.value = { ...evalSkillsCache.value };
        break;
      }
    }
  }
  // Reload live view if active
  if (hasStudentSelection.value && hasEvalSelection.value) startSession();
}

const skillMin = computed(() => {
  const s = skillDetailData.value?.scale;
  if (!s || s.length === 0) return 1;
  return Math.min(...s.map(Number).filter((n) => !isNaN(n)));
});

const skillMax = computed(() => {
  const s = skillDetailData.value?.scale;
  if (!s || s.length === 0) return 5;
  return Math.max(...s.map(Number).filter((n) => !isNaN(n)));
});

const skillStep = computed(() => {
  const s = skillDetailData.value?.scale;
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
  skillDetailData.value.scale = scale;
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
  skillDetailData.value.scale = scale;
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
  skillDetailData.value.scale = scale;
  saveSkillDetail();
}

async function deleteSkillFromDetail() {
  if (!skillDetailId.value) return;
  if (!confirm("Supprimer cette habileté ?")) return;
  const { error } = await supabase
    .from("tu_skills")
    .delete()
    .eq("id", skillDetailId.value);
  if (error) {
    console.error("Failed to delete skill:", error);
    return;
  }
  // Remove from cache
  for (const ev of evaluations.value) {
    const cache = evalSkillsCache.value[ev.id];
    if (cache) {
      const idx = cache.findIndex((s) => s.id === skillDetailId.value);
      if (idx !== -1) {
        cache.splice(idx, 1);
        evalSkillsCache.value = { ...evalSkillsCache.value };
        break;
      }
    }
  }
  // Also remove from skills live view
  skills.value = skills.value.filter((s) => s.id !== skillDetailId.value);
  // Reload live view if active
  if (hasStudentSelection.value && hasEvalSelection.value) startSession();
  skillDetailId.value = null;
}

const skillDetailName = computed(() => {
  if (!skillDetailId.value) return "";
  for (const ev of evaluations.value) {
    const skills = evalSkillsCache.value[ev.id] || [];
    const found = skills.find((s) => s.id === skillDetailId.value);
    if (found) return found.name;
  }
  return "";
});

// ── Undo history ────────────────────────────────────────
const actionHistory = ref([]); // { studentId, skillId, level, eventId }[]

// ── Report state ──────────────────────────────────────
const reportModalOpen = ref(false);

// ── Live preview animation ────────────────────────────
const liveAnimating = ref(false);

watch(
  () => [classModalOpen.value, evalModalOpen.value, reportModalOpen.value],
  ([curClass, curEval, curReport], [prevClass, prevEval, prevReport]) => {
    // Re-trigger enter animation when any modal closes
    if (
      (prevClass || prevEval || prevReport) &&
      !(curClass || curEval || curReport)
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
  const all = reportData.value.events;
  if (!selectedSessionId.value) return all;
  return all.filter((e) => e.session_id === selectedSessionId.value);
});

// Map student id → class id from the cache
const studentClassMap = computed(() => {
  const map = {};
  for (const [classId, students] of Object.entries(classStudentsCache.value)) {
    for (const s of students) {
      map[s.id] = classId;
    }
  }
  // Also cover individually-picked students whose class might not be in cache
  for (const sid of checkedStudentIds.value) {
    if (!map[sid]) {
      // Try to find them in any class cache
      for (const students of Object.values(classStudentsCache.value)) {
        const found = students.find((s) => s.id === sid);
        if (found) {
          map[sid] = found.class_id;
          break;
        }
      }
    }
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
  return Object.values(groups);
});

async function loadReportData() {
  const classIds = [...checkedClassIds.value];
  // Student IDs currently selected for the live view
  const selectedStudentIds = new Set(
    selectedStudentList.value.map((s) => s.id),
  );
  // Skill IDs currently selected for the live view
  const selectedSkillIds = new Set(skills.value.map((sk) => sk.id));

  // Determine relevant eval IDs for the report (same logic as startSession)
  const relevantEvalIdsForReport = new Set([...checkedEvalIds.value]);
  for (const [evalId, skills] of Object.entries(evalSkillsCache.value)) {
    for (const sk of skills) {
      if (checkedSkillIds.value.has(sk.id)) {
        relevantEvalIdsForReport.add(evalId);
        break;
      }
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
        .in("id", [...selectedStudentIds])
        .order("firstname"),
      supabase
        .from("tu_skills")
        .select("id, name, scale, icon")
        .in("id", [...selectedSkillIds]),
      eventsQuery,
    ]);

    reportData.value = {
      sessions: sessionsRes.data || [],
      students: studentsRes.data || [],
      skills: skillsRes.data || [],
      events: eventsRes.data || [],
    };
  } catch (err) {
    console.error("Failed to load report:", err);
  }
}

async function openReport() {
  if (reportModalOpen.value) {
    reportModalOpen.value = false;
    return;
  }
  if (!hasStudentSelection.value || !hasEvalSelection.value) return;
  // Close any other open modal first
  classModalOpen.value = false;
  evalModalOpen.value = false;
  reportLoading.value = true;
  reportModalOpen.value = true;
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
  const filtered = selectedSessionId.value
    ? events.filter((e) => e.session_id === selectedSessionId.value)
    : events;

  // Build per-student per-skill stats
  const stats = {};
  for (const s of students) {
    stats[s.id] = {};
    for (const sk of skills) {
      const evts = filtered.filter(
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
    <!-- ── TOP BAR (menu buttons) ──────────────────────── -->
    <div class="top-bar">
      <div class="top-bar-left">
        <button
          class="undo-btn"
          :disabled="actionHistory.length === 0"
          title="Annuler la dernière action"
          @click="undoLastAction"
        >
          <Undo2 :size="16" />
        </button>
      </div>
      <div class="top-bar-center">
        <button
          class="fab"
          :class="{
            'fab--filled': hasStudentSelection,
            'fab--modal-open': classModalOpen,
          }"
          title="Classes"
          @click="openClassModal()"
        >
          <template v-if="hasStudentSelection">
            <Users :size="18" />
            <span class="fab-selected-name">{{ selectionSummary }}</span>
          </template>
          <template v-else>
            <Users :size="18" />
          </template>
        </button>
        <button
          class="fab fab--eval"
          :class="{
            'fab--filled': hasEvalSelection,
            'fab--modal-open': evalModalOpen,
          }"
          title="Évaluations"
          @click="openEvalModal()"
        >
          <template v-if="hasEvalSelection">
            <Sneaker :size="18" />
            <span class="fab-selected-name">{{ evalSelectionSummary }}</span>
          </template>
          <template v-else>
            <Sneaker :size="18" />
          </template>
        </button>

        <!-- Report button -->
        <button
          class="fab"
          :class="{ 'fab--modal-report': reportModalOpen }"
          :disabled="!hasStudentSelection || !hasEvalSelection"
          title="Rapport"
          @click="openReport"
        >
          <BarChart3 :size="18" />
        </button>
      </div>
      <div class="top-bar-spacer"></div>

      <button
        class="modifier-toggle"
        :class="{ active: classEditMode || evalEditMode }"
        :disabled="!classModalOpen && !evalModalOpen"
        @click="toggleGlobalEditMode"
        title="Mode modification"
      >
        <span v-show="classEditMode || evalEditMode" class="mode-edition-label"
          >Mode Édition</span
        >
        <PenIcon :size="16" />
      </button>
    </div>

    <!-- ── MAIN CONTENT (stacked layers) ────────────────── -->
    <div class="main-content">
      <!-- LIVE SCREEN (always visible) -->
      <div class="live-screen">
        <!-- Drop zones -->
        <div
          v-if="skills.length > 0 && students.length > 0"
          class="zones-container"
          :class="{
            'zones-container--enter': liveAnimating,
            'zones-container--grid': skills.length > 3,
          }"
        >
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
          <div class="bubble">
            Sélectionnez une classe et une activité pour commencer
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
        v-show="classModalOpen || evalModalOpen || reportModalOpen"
        class="picker-screen picker-screen--modal"
      >
        <Transition name="panel-drawer" mode="out-in">
          <div
            v-if="classModalOpen"
            key="class"
            class="picker-panel class-modal picker-panel--full class-modal--bg"
            :class="{ 'class-modal--editing': classEditMode }"
          >
            <div class="picker-panel-header">
              <div v-if="studentDetailId !== null" class="header-left">
                <button class="back-btn" @click="studentDetailId = null">
                  <ChevronLeft :size="36" :stroke-width="3" />
                </button>
                <span>{{ studentDetailName }}</span>
              </div>
              <div v-else-if="classDetailId !== null" class="header-left">
                <button class="back-btn" @click="classDetailId = null">
                  <ChevronLeft :size="36" :stroke-width="3" />
                </button>
                <span>{{ editingClassTitle }}</span>
              </div>
              <span v-else class="header-title-group">
                <span>Groupes</span>
              </span>
              <div class="header-actions">
                <button
                  v-if="studentDetailId !== null"
                  class="header-trash-btn"
                  title="Supprimer l'élève"
                  @click="deleteStudentFromDetail"
                >
                  <Trash2 :size="24" />
                </button>
                <button
                  v-if="
                    classDetailId !== null &&
                    classDetailId !== 'new' &&
                    studentDetailId === null
                  "
                  class="header-trash-btn"
                  title="Supprimer la classe"
                  @click="deleteClass(classDetailId)"
                >
                  <Trash2 :size="24" />
                </button>
                <button class="close-btn" @click="classModalOpen = false">
                  <ChevronUp :size="36" :stroke-width="3" />
                </button>
              </div>
            </div>

            <div class="class-modal-body">
              <Transition name="slide-edit" mode="out-in">
                <div
                  v-if="studentDetailId !== null && studentDetailData"
                  key="student-detail"
                  class="student-detail-form"
                >
                  <div class="student-detail-layout">
                    <!-- Photo placeholder -->
                    <div class="student-detail-photo">
                      <div class="student-photo-circle">
                        <span class="student-photo-initials">{{
                          getInitials(
                            studentDetailData.firstname,
                            studentDetailData.lastname,
                          )
                        }}</span>
                      </div>
                    </div>

                    <!-- Right column: fields -->
                    <div class="student-detail-fields">
                      <div class="detail-section">
                        <label class="detail-label">Prénom</label>
                        <input
                          v-model="studentDetailData.firstname"
                          class="detail-input"
                          placeholder="Prénom"
                          @blur="saveStudentDetail"
                        />
                      </div>
                      <div class="detail-section">
                        <label class="detail-label">Nom</label>
                        <input
                          v-model="studentDetailData.lastname"
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
                              active: studentDetailData.gender === 'M',
                            }"
                            @click="toggleGender('M')"
                          >
                            M
                          </button>
                          <button
                            class="gender-btn"
                            :class="{
                              active: studentDetailData.gender === 'F',
                            }"
                            @click="toggleGender('F')"
                          >
                            F
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <ClassDetail
                  v-else-if="classDetailId !== null"
                  key="edit"
                  :class-id="classDetailId === 'new' ? null : classDetailId"
                  @close="classDetailId = null"
                  @saved="onClassDetailSaved"
                  @deleted="onClassDetailDeleted"
                  @edit-student="studentDetailId = $event"
                  @remove-student="handleRemoveStudent"
                />
                <div v-else key="list">
                  <!-- ── Class rows ──────────────────────────────── -->
                  <div v-for="cls in classes" :key="cls.id">
                    <div class="picker-item-row">
                      <button
                        class="picker-item"
                        :class="{
                          selected:
                            !classEditMode && selectedClassId === cls.id,
                          'folder-row': true,
                          expanded: expandedClassId === cls.id,
                        }"
                        @click="handleClassClick(cls)"
                      >
                        <span class="picker-header-row">
                          <span class="folder-label-wrap">
                            <ChevronRight
                              v-if="expandedClassId !== cls.id"
                              :size="20"
                              :stroke-width="3"
                              class="folder-chevron"
                            />
                            <ChevronDown
                              v-else
                              :size="20"
                              :stroke-width="3"
                              class="folder-chevron"
                            />
                            <span>{{ cls.name }}</span>
                          </span>
                          <template v-if="classEditMode">
                            <span
                              class="row-edit-btn"
                              title="Modifier"
                              @click.stop="classDetailId = cls.id"
                            >
                              <PenIcon :size="22" />
                            </span>
                          </template>
                          <template v-else>
                            <span
                              class="row-checkbox"
                              :class="{ checked: checkedClassIds.has(cls.id) }"
                              @click.stop="handleClassCheck(cls)"
                            >
                              <Check
                                v-if="checkedClassIds.has(cls.id)"
                                :size="18"
                              />
                            </span>
                          </template>
                        </span>
                        <!-- Expanded students -->
                        <div
                          @click.stop
                          v-if="expandedClassId === cls.id"
                          class="nested-items"
                        >
                          <div
                            v-if="!classStudentsCache[cls.id]?.length"
                            class="nested-empty"
                          >
                            Aucun élève
                          </div>
                          <div
                            v-for="student in classStudentsCache[cls.id] || []"
                            :key="student.id"
                            class="picker-item-row nested-row"
                          >
                            <button
                              class="picker-item picker-item--nested"
                              @click="studentDetailId = student.id"
                            >
                              <span
                                >{{ student.firstname }}
                                {{ student.lastname }}</span
                              >
                              <template v-if="classEditMode">
                                <span
                                  class="row-edit-btn"
                                  title="Modifier"
                                  @click.stop="studentDetailId = student.id"
                                >
                                  <PenIcon :size="18" />
                                </span>
                              </template>
                              <template v-else>
                                <span
                                  class="row-checkbox"
                                  :class="{
                                    checked:
                                      checkedStudentIds.has(student.id) ||
                                      (checkedClassIds.has(cls.id) &&
                                        !excludedStudentIds.has(student.id)),
                                  }"
                                  @click.stop="handleStudentCheck(cls, student)"
                                >
                                  <Check
                                    v-if="
                                      checkedStudentIds.has(student.id) ||
                                      (checkedClassIds.has(cls.id) &&
                                        !excludedStudentIds.has(student.id))
                                    "
                                    :size="18"
                                  />
                                </span>
                              </template>
                            </button>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div v-if="classes.length === 0" class="picker-empty">
                    Aucune classe
                  </div>
                  <div v-if="classEditMode" class="picker-item-row">
                    <button
                      class="picker-item picker-item--inline"
                      @click="classDetailId = 'new'"
                    >
                      <Plus :size="28" :stroke-width="3" />
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Evaluation modal -->
          <div
            v-else-if="evalModalOpen"
            key="eval"
            class="picker-panel class-modal picker-panel--full eval-bg"
            :class="{ 'class-modal--editing': evalEditMode }"
          >
            <div class="picker-panel-header">
              <div class="header-left">
                <button
                  v-if="skillDetailId !== null"
                  class="back-btn"
                  @click="skillDetailId = null"
                >
                  <ChevronLeft :size="36" :stroke-width="3" />
                </button>
                <button
                  v-else-if="editingEvalId || isAddingNewEval"
                  class="back-btn"
                  @click="
                    cancelEvalEdit();
                    isAddingNewEval = false;
                  "
                >
                  <ChevronLeft :size="36" :stroke-width="3" />
                </button>
                <span v-if="skillDetailId !== null">{{ skillDetailName }}</span>
                <span v-else-if="editingEvalId && !isAddingNewEval">{{
                  editingEvalTitle
                }}</span>
                <span v-else class="header-title-group">
                  <span>Activités</span>
                </span>
              </div>
              <div class="header-actions">
                <button
                  v-if="skillDetailId !== null"
                  class="header-trash-btn"
                  title="Supprimer l'habileté"
                  @click="deleteSkillFromDetail"
                >
                  <Trash2 :size="24" />
                </button>
                <button
                  v-if="editingEvalId && !isAddingNewEval"
                  class="header-trash-btn"
                  @click="
                    deleteEval(editingEvalId);
                    cancelEvalEdit();
                    evalModalOpen = false;
                  "
                  title="Supprimer l'évaluation"
                >
                  <Trash2 :size="24" />
                </button>
                <button class="close-btn" @click="evalModalOpen = false">
                  <ChevronUp :size="36" :stroke-width="3" />
                </button>
              </div>
            </div>

            <div class="class-modal-body">
              <Transition name="slide-edit" mode="out-in">
                <div
                  v-if="skillDetailId !== null && skillDetailData"
                  key="skill-detail"
                  class="skill-detail-form"
                >
                  <div class="skill-detail-layout">
                    <!-- Icon picker -->
                    <div class="skill-detail-icon">
                      <div
                        class="skill-icon-circle"
                        :class="{ 'picker-open': showSkillIconPicker }"
                        @click="showSkillIconPicker = !showSkillIconPicker"
                        title="Choisir une icône"
                      >
                        <img
                          v-if="skillDetailData.icon"
                          :src="`${BASE}icons/skills/${skillDetailData.icon}.svg`"
                          class="skill-icon-img"
                          alt=""
                        />
                        <span v-else class="skill-icon-letter">?</span>
                      </div>
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
                              selected: skillDetailData.icon === iconName,
                            }"
                            @click="selectSkillIcon(iconName)"
                            :title="iconName"
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

                    <!-- Right column: fields -->
                    <div class="skill-detail-fields">
                      <div class="detail-section">
                        <label class="detail-label">Nom</label>
                        <input
                          v-model="skillDetailData.name"
                          class="detail-input"
                          placeholder="Nom de l'habileté"
                          @blur="saveSkillDetail"
                        />
                      </div>
                      <div class="detail-section">
                        <label class="detail-label">Échelle d'évaluation</label>
                        <div class="skill-scale-config">
                          <label class="scale-field">
                            <span class="scale-label">Min</span>
                            <input
                              :value="skillMin"
                              type="number"
                              class="scale-input"
                              min="0"
                              @change="skillMinEdit($event)"
                            />
                          </label>
                          <label class="scale-field">
                            <span class="scale-label">Max</span>
                            <input
                              :value="skillMax"
                              type="number"
                              class="scale-input"
                              min="0"
                              @change="skillMaxEdit($event)"
                            />
                          </label>
                          <label class="scale-field">
                            <span class="scale-label">Pas</span>
                            <input
                              :value="skillStep"
                              type="number"
                              class="scale-input"
                              min="0.1"
                              step="0.1"
                              @change="skillStepEdit($event)"
                            />
                          </label>
                        </div>
                        <div class="scale-preview">
                          <span class="scale-preview-label">Aperçu :</span>
                          <span class="scale-preview-values">
                            {{ skillDetailData.scale?.join(" · ") }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else-if="editingEvalId || isAddingNewEval" key="edit">
                  <template v-if="isAddingNewEval">
                    <div class="class-edit-row">
                      <input
                        v-model="editingEvalTitle"
                        class="edit-input"
                        autofocus
                        placeholder="Titre de l'évaluation"
                        @blur="addNewEval"
                        @keyup.enter="addNewEval"
                        @keyup.escape="
                          cancelEvalEdit();
                          isAddingNewEval = false;
                        "
                      />
                    </div>
                  </template>

                  <template v-else>
                    <div
                      v-for="ev in evaluations"
                      :key="ev.id"
                      class="class-edit-row"
                    >
                      <template v-if="editingEvalId === ev.id">
                        <div class="eval-name-row">
                          <label class="eval-label">Nom</label>
                          <input
                            v-model="editingEvalTitle"
                            class="edit-input"
                            autofocus
                            @blur="saveEvalTitle(ev)"
                            @keyup.enter="saveEvalEdit(ev)"
                            @keyup.escape="cancelEvalEdit"
                          />
                        </div>
                        <div class="skills-section">
                          <div class="skills-header">
                            Habiletés
                            <span class="skills-count">{{
                              editingSkills.length
                            }}</span>
                          </div>
                          <div
                            v-for="(sk, si) in editingSkills"
                            :key="sk.id || si"
                            class="skill-row"
                          >
                            <img
                              v-if="sk.icon"
                              :src="`${BASE}icons/skills/${sk.icon}.svg`"
                              class="skill-row-icon"
                              alt=""
                            />
                            <span
                              class="skill-name"
                              @click="skillDetailId = sk.id"
                            >
                              {{ sk.name }}
                            </span>
                            <span class="skill-scale-preview">
                              {{ sk.scale?.[0] || "?" }} →
                              {{ sk.scale?.[sk.scale.length - 1] || "?" }}
                              ({{ sk.scale?.length || 0 }}
                              niveaux)
                            </span>
                            <span class="skill-row-actions">
                              <PenIcon
                                :size="20"
                                @click="skillDetailId = sk.id"
                              />
                              <X :size="20" @click="removeSkill(sk, si)" />
                            </span>
                          </div>

                          <template v-if="showNewSkillForm">
                            <div class="skill-add-form">
                              <input
                                v-model="editingNewSkillName"
                                class="skill-input"
                                placeholder="Nom de l'habileté"
                                @keyup.enter="addSkill"
                              />
                              <div class="skill-range-config">
                                <label
                                  >Min
                                  <input
                                    v-model.number="editingNewSkillMin"
                                    type="number"
                                    class="range-input"
                                    min="0"
                                /></label>
                                <label
                                  >Max
                                  <input
                                    v-model.number="editingNewSkillMax"
                                    type="number"
                                    class="range-input"
                                    min="0"
                                /></label>
                                <label
                                  >Pas
                                  <input
                                    v-model.number="editingNewSkillStep"
                                    type="number"
                                    class="range-input"
                                    min="0.1"
                                    step="0.1"
                                /></label>
                              </div>
                              <div class="skill-add-actions">
                                <button class="save-btn" @click="addSkill">
                                  +
                                </button>
                                <button
                                  class="cancel-btn"
                                  @click="cancelSkillForm"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </template>
                          <button
                            v-else
                            class="add-skill-btn"
                            title="Ajouter une habileté"
                            @click="showNewSkillForm = true"
                          >
                            <Plus :size="28" :stroke-width="3" />
                          </button>
                        </div>
                      </template>
                    </div>
                  </template>
                </div>

                <div v-else key="list">
                  <!-- ── Eval rows ───────────────────────────────── -->
                  <div v-for="ev in evaluations" :key="ev.id">
                    <div class="picker-item-row">
                      <button
                        class="picker-item"
                        :class="{
                          selected:
                            !evalEditMode &&
                            checkedEvalIds.has(ev.id) &&
                            checkedEvalIds.size === 1,
                          'folder-row': true,
                          expanded: expandedEvalId === ev.id,
                        }"
                        @click="handleEvalClick(ev)"
                      >
                        <span class="picker-header-row">
                          <span class="folder-label-wrap">
                            <ChevronRight
                              v-if="expandedEvalId !== ev.id"
                              :size="20"
                              :stroke-width="3"
                              class="folder-chevron"
                            />
                            <ChevronDown
                              v-else
                              :size="20"
                              :stroke-width="3"
                              class="folder-chevron"
                            />
                            <span>{{ ev.title }}</span>
                          </span>
                          <template v-if="evalEditMode">
                            <span
                              class="row-edit-btn"
                              title="Modifier"
                              @click.stop="startEvalEdit(ev)"
                            >
                              <PenIcon :size="22" />
                            </span>
                          </template>
                          <template v-else>
                            <span
                              class="row-checkbox"
                              :class="{ checked: checkedEvalIds.has(ev.id) }"
                              @click.stop="handleEvalCheck(ev)"
                            >
                              <Check
                                v-if="checkedEvalIds.has(ev.id)"
                                :size="18"
                              />
                            </span>
                          </template>
                        </span>
                        <!-- Expanded skills -->
                        <div
                          @click.stop
                          v-if="expandedEvalId === ev.id"
                          class="nested-items"
                        >
                          <div
                            v-if="!evalSkillsCache[ev.id]?.length"
                            class="nested-empty"
                          >
                            Aucune habileté
                          </div>
                          <div
                            v-for="skill in evalSkillsCache[ev.id] || []"
                            :key="skill.id"
                            class="picker-item-row nested-row"
                          >
                            <button
                              class="picker-item picker-item--nested"
                              @click="skillDetailId = skill.id"
                            >
                              <img
                                v-if="skill.icon"
                                :src="`${BASE}icons/skills/${skill.icon}.svg`"
                                class="picker-item-icon"
                                alt=""
                              />
                              <span>{{ skill.name }}</span>
                              <span class="skill-scale-badge">
                                {{ skill.scale?.[0] || "?" }}→{{
                                  skill.scale?.[skill.scale.length - 1] || "?"
                                }}
                              </span>
                              <template v-if="evalEditMode">
                                <span
                                  class="row-edit-btn"
                                  title="Modifier"
                                  @click.stop="skillDetailId = skill.id"
                                >
                                  <PenIcon :size="18" />
                                </span>
                              </template>
                              <template v-else>
                                <span
                                  class="row-checkbox"
                                  :class="{
                                    checked:
                                      checkedSkillIds.has(skill.id) ||
                                      (checkedEvalIds.has(ev.id) &&
                                        !excludedSkillIds.has(skill.id)),
                                  }"
                                  @click.stop="handleSkillCheck(ev, skill)"
                                >
                                  <Check
                                    v-if="
                                      checkedSkillIds.has(skill.id) ||
                                      (checkedEvalIds.has(ev.id) &&
                                        !excludedSkillIds.has(skill.id))
                                    "
                                    :size="18"
                                  />
                                </span>
                              </template>
                            </button>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div v-if="evaluations.length === 0" class="picker-empty">
                    Aucune évaluation
                  </div>
                  <div v-if="evalEditMode" class="picker-item-row">
                    <button
                      class="picker-item picker-item--inline"
                      @click="
                        isAddingNewEval = true;
                        editingEvalTitle = '';
                      "
                    >
                      <Plus :size="28" :stroke-width="3" />
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Report modal -->
          <div
            v-else-if="reportModalOpen"
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
                <button class="close-btn" @click="reportModalOpen = false">
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
                          <th class="detail-th-date">Session</th>
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
                          v-for="session in reportData.sessions"
                          :key="session.id"
                        >
                          <td class="detail-td-date">
                            {{ formatDateTime(session.started_at) }}
                          </td>
                          <td
                            v-for="skill in reportData.skills"
                            :key="skill.id"
                            class="detail-td-level"
                          >
                            <template
                              v-if="
                                studentSkillInSession(
                                  reportSelectedStudent.id,
                                  skill.id,
                                  session.id,
                                ) != null
                              "
                            >
                              {{
                                studentSkillInSession(
                                  reportSelectedStudent.id,
                                  skill.id,
                                  session.id,
                                )
                              }}
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
                class="filter-option filter-option--disabled"
                title="À venir"
              >
                <input type="radio" disabled />
                M
              </label>
              <label
                class="filter-option filter-option--disabled"
                title="À venir"
              >
                <input type="radio" disabled />
                F
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Middle zone: student bubbles -->
      <div class="students-row-center">
        <template v-if="students.length > 0">
          <div
            v-for="student in sortedStudents"
            :key="student.id"
            class="student-wrapper"
            :class="{ 'is-ghost': drag?.student?.id === student.id }"
            :data-student-id="student.id"
            :style="{ opacity: studentOpacity(student.id) }"
            @pointerdown="onDragStart($event, student)"
          >
            <div class="student-bubble">
              {{ student.firstname }}
            </div>
          </div>
        </template>
        <template v-else-if="selectedStudentList.length > 0">
          <div
            v-for="student in selectedStudentList"
            :key="student.id"
            class="student-wrapper"
          >
            <div class="student-bubble-preview">
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

/* ── App root ─────────────────────────────────────── */
.app-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

/* ── Top bar & bottom bar ──────────────────────────── */
.top-bar,
.students-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  /* padding: 6px 20px 0 20px; */

  height: 80px;
}
.top-bar {
  margin: 6px 20px 0 20px;
  position: relative;
  height: 60px;
}
.students-row {
  padding: 15px;
  gap: 10px;
  min-height: 100px;
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
  align-items: center;
  gap: 10px;
}

/* ── Menu buttons ──────────────────────────────────── */
.fab {
  border: 2px var(--text-light) solid;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  color: var(--text-light);
  background: none;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
}

.fab:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.fab--filled {
  background: #457b9d;
  border-color: #457b9d;
  color: var(--text-light);
  font-weight: 700;
}

.fab--modal-open {
  /* border-radius: 16px 16px 0 0; */
  border-bottom: none;
  background: #457b9d;
  border-color: #457b9d;
  /* border-color: var(--text-light); */
  color: var(--text-light);
}

.fab--modal-report {
  background: var(--text-light);
  border-color: var(--text-light);
  color: var(--court-blue);
}

/* ── Eval button (yellow) ─────────────────────────── */
.fab--eval.fab--filled,
.fab--eval.fab--modal-open {
  background: var(--stadium-yellow);
  border-color: var(--stadium-yellow);

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
  border: 2px var(--text-light) solid;
  border-radius: 999px;
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
}
.undo-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.undo-btn:not(:disabled):hover {
  opacity: 0.85;
}

/* ── Student bubble preview (picker screen) ───────── */
.student-bubble-preview {
  border-radius: 999px;
  background: #457b9d;
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 8px 18px;
  white-space: nowrap;
}

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
.row-edit-btn {
  height: 28px;
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
  overflow: hidden;
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

/* ── Student bubble (label/pill) ──────────────────── */
.student-bubble,
.drag-clone {
  border-radius: 999px;
  /* border: 2px var(--text-light) solid; */
  background: #457b9d;
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  font-size: 0.75rem;
  line-height: 1.2;
  padding: 8px 18px;
  transition: opacity 0.3s ease;
  pointer-events: none;
  white-space: nowrap;
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
  display: flex;
  flex: 1;
  width: 100%;
  gap: 2px;
  /* padding: 12px; */
  padding-top: 0;
  /* border-radius: 8px; */
  overflow: hidden;
}

.zone-segment {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  /* border: 1px dashed rgba(255, 200, 80, 0.3); */
  /* border-radius: 8px; */
  background: rgba(30, 16, 3, 0.4);
  color: rgba(224, 72, 1, 0.6);
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-family: "Coiny", sans-serif;
  opacity: 0.6;
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
  padding: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(92vh - 140px);
  scrollbar-width: thin;
  /* scrollbar-color: rgba(232, 168, 32, 0.3) transparent; */
  /* display: flex; */
  flex-wrap: wrap;
  align-items: center;
  padding-bottom: 100px;
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

.class-modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
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
  font-size: 0.95rem;
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

.picker-tab:hover {
  color: var(--text-light);
  opacity: 0.8;
  background: rgba(255, 200, 80, 0.1);
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
.header-trash-btn:hover {
  opacity: 0.7;
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

.save-btn:hover {
  background: rgba(232, 168, 32, 0.3);
  border-color: #e8a820;
  color: var(--text-light);
  opacity: 1;
}

.cancel-btn:hover {
  background: rgba(255, 80, 60, 0.2);
  border-color: rgba(255, 100, 80, 0.5);
  color: var(--text-light);
  opacity: 0.8;
}

.eval-name-row {
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
.btn-icon:hover {
  color: var(--text-light);
  opacity: 0.85;
  background: rgba(255, 215, 0, 0.15);
  transform: scale(1.08);
}
.btn-icon--delete {
  color: #fff;
  opacity: 1;
}
.btn-icon--delete:hover {
  color: var(--track-red);
  opacity: 0.8;
  background: rgba(255, 75, 75, 0.18);
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
.skill-name:hover {
  opacity: 0.7;
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
.skill-row:hover {
  background: #a8dadc80;
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

.skill-row-actions > *:hover {
  opacity: 1;
}
.skill-input {
  flex: 1;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 215, 0, 0.2);
  background: rgba(33, 37, 41, 0.6);
  color: var(--text-light);
  font-size: 0.9rem;
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
  font-size: 0.8rem;
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
.add-skill-btn:hover {
  background: #a8dadc80;
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
  color: var(--text-light);
  opacity: 0.65;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.add-btn:hover {
  color: var(--text-light);
  opacity: 1;
  background: rgba(232, 168, 32, 0.15);
  border-color: rgba(255, 200, 80, 0.45);
  transform: translateY(-1px);
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
.export-btn:hover {
  opacity: 0.6;
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
.report-table .report-td-student--clickable:hover {
  opacity: 0.7;
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

.report-detail-table tbody tr:hover {
  background: rgba(38, 70, 83, 0.04);
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
.nav-circle:hover {
  color: var(--text-light);
  opacity: 0.85;
  border-color: rgba(255, 200, 80, 0.4);
  transform: scale(1.08);
  background: rgba(40, 22, 4, 0.85);
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
}
.nav-circle--stop:hover {
  color: var(--track-red);
  opacity: 1;
  border-color: rgba(255, 100, 80, 0.5);
  background: rgba(255, 80, 60, 0.12);
} /*
── Picker dropdowns (big popups) ──────────────────── */
.picker-panel {
  /* border: 2px solid var(--text-light); */
  /* background: var(--track-red); */
  /* border-radius: 28px; */
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
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
  max-width: 800px;
  flex: 1;
  overflow-y: auto;
}
.picker-panel--full > .picker-panel-header {
  width: 100%;
  max-width: 800px;
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
.header-btn:hover {
  opacity: 0.85;
  border-color: rgba(255, 255, 255, 0.6);
}
.header-btn.active {
  opacity: 1;
  border-color: var(--stadium-yellow);
  color: var(--stadium-yellow);
  background: rgba(241, 196, 15, 0.1);
}

.class-modal--editing {
  /* border: 2px solid var(--stadium-yellow); */
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

.row-edit-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--text-light);
  cursor: pointer;
}
.row-edit-btn:hover {
  opacity: 0.7;
}

/* ── Modifier toggle button (top bar) ─────────────── */
.modifier-toggle {
  position: absolute;
  right: 0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--text-light);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  color: var(--text-light);
  background: none;
  font-family: inherit;
  cursor: pointer;
  gap: 6px;
  transition:
    background 0.2s,
    opacity 0.2s;
}
.modifier-toggle:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.modifier-toggle:disabled:hover {
  background: none;
}
.modifier-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
}
.modifier-toggle.active {
  background: var(--text-light);
  border-color: var(--text-light);
  color: var(--court-blue);
}

/* ── Header title with edit pen ──────────────────── */
.header-title-group {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.mode-edition-label {
  font-family: inherit;
  font-weight: 700;
  /* font-size: 1rem; */
  /* font-weight: 600; */
  /* color: var(--stadium-yellow); */
  white-space: nowrap;
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

.nested-row-actions > *:hover {
  opacity: 1;
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
  font-size: 0.95rem;
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
  min-width: 0;
}
.gender-selector {
  display: flex;
  gap: 0.5rem;
}

.gender-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: transparent;
  color: var(--text-light);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.5;
}
.gender-btn:hover {
  opacity: 0.8;
  border-color: rgba(255, 255, 255, 0.4);
}
.gender-btn.active {
  opacity: 1;
  border-color: var(--stadium-yellow);
  background: rgba(241, 196, 15, 0.15);
  color: var(--stadium-yellow);
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
.skill-icon-circle:hover {
  background: #3a5e4e;
  transform: scale(1.05);
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
  font-size: 0.8rem;
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
.icon-picker-option:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
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
  font-size: 0.9rem;
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
  width: 28px;
  height: 28px;
  border-radius: 50%;
  /* border: 2px solid var(--text-light); */
  background: var(--court-blue);
  opacity: 0.5;
  /* background: transparent; */
  cursor: pointer;
  transition: all 0.2s;
}

.row-checkbox.checked {
  border: 2px solid var(--text-light);
  border-color: var(--text-light);
  background: none;
  opacity: 1;
}
/* .row-checkbox.checked :deep(svg) {
  color: #1a0e04;
  display: block;
} */

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
