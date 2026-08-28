<script setup>
import { ref, watch } from "vue";
import { ChevronUp, Upload, Plus, Check, PenIcon } from "@lucide/vue";
import { supabase } from "../../supabase";
import ClassDetail from "../detail/ClassDetail.vue";
import StudentDetail from "../detail/StudentDetail.vue";
import StudentImportModal from "../popup/StudentImportModal.vue";

const props = defineProps({
  classes: { type: Array, required: true },
  selectedClassId: { type: [String, Number], default: null },
  allStudents: { type: Array, required: true },
  checkedClassIds: { type: Set, required: true },
  checkedStudentIds: { type: Set, required: true },
  excludedStudentIds: { type: Set, required: true },
});

const emit = defineEmits([
  "close",
  "select-class",
  "data-changed",
  "class-check",
]);

// ── Internal state ──────────────────────────────────────
const classDetailId = ref(null);
const studentDetailId = ref(null);
const studentImportOpen = ref(false);

// ── Helper functions ────────────────────────────────────
function getClassName(classId) {
  const cls = props.classes.find((c) => c.id === classId);
  return cls ? cls.name : "";
}

function getCurrentClassStudents() {
  if (!props.selectedClassId) return [];
  return props.allStudents
    .filter((s) => s.class_id === props.selectedClassId)
    .sort((a, b) =>
      (a.firstname || "").localeCompare(b.firstname || "", "fr-FR"),
    );
}

// ── Event handlers ──────────────────────────────────────
function selectClass(id) {
  emit("select-class", id);
}

// Watch for class selection changes to close detail views
watch(
  () => props.selectedClassId,
  (newId, oldId) => {
    // When a different class is selected, close any open detail views
    if (newId !== oldId && newId !== null) {
      classDetailId.value = null;
      studentDetailId.value = null;
    }
  },
);

async function addClass() {
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

  // Open the class detail for editing
  classDetailId.value = data.id;

  // Notify parent to reload data
  emit("data-changed");
}

async function addStudent(classId) {
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

  // Select the new student to show details immediately
  studentDetailId.value = data.id;

  // Notify parent to reload data
  emit("data-changed");
}

function handleClassCheck(cls) {
  emit("class-check", cls);
}

function handleStudentCheck(student) {
  const isSelected =
    props.checkedStudentIds.has(student.id) ||
    (props.checkedClassIds.has(props.selectedClassId) &&
      !props.excludedStudentIds.has(student.id));
  emit("student-check", props.selectedClassId, student, isSelected);
}

function onClassDetailSaved() {
  classDetailId.value = null;
  emit("data-changed");
}

function onClassDetailDeleted(id) {
  classDetailId.value = null;
  emit("data-changed");
}

function onStudentDeleted(id) {
  studentDetailId.value = null;
  emit("data-changed");
}

function openStudentImport() {
  studentImportOpen.value = true;
}

function onStudentImported() {
  studentImportOpen.value = false;
  emit("data-changed");
}
</script>

<template>
  <div class="picker-panel class-modal picker-panel--full class-modal--bg">
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
            class="class-modal-rail-button"
            title="Importer des élèves"
            @click="openStudentImport"
          >
            <Upload :size="24" :stroke-width="2.5" />
          </button>
        </aside>

        <!-- 3-column layout for class management -->
        <div class="class-three-column-layout">
          <!-- Column 1: Classes list -->
          <div class="class-column">
            <div class="column-header">
              <h3>Groupes</h3>
              <button
                class="picker-item picker-item--inline add-btn"
                @click="addClass"
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
                  @click="selectClass(cls.id)"
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
            <Transition name="fade-in" mode="out-in">
              <!-- Show ClassDetail form when editing a class -->
              <div
                v-if="classDetailId !== null"
                :key="'class-detail'"
                class="class-detail-container"
              >
                <ClassDetail
                  :class-id="classDetailId === 'new' ? null : classDetailId"
                  :all-students="allStudents"
                  @close="classDetailId = null"
                  @saved="onClassDetailSaved"
                  @deleted="onClassDetailDeleted"
                />
              </div>
              <!-- Otherwise show student list -->
              <div v-else :key="'student-list'" class="students-column-content">
                <Transition name="fade-in" mode="out-in">
                  <div
                    :key="selectedClassId || 'no-class'"
                    class="students-column-inner"
                  >
                    <div class="column-header">
                      <h3>
                        {{ selectedClassId ? `Élèves` : "" }}
                      </h3>
                      <button
                        v-if="selectedClassId"
                        class="picker-item picker-item--inline add-btn"
                        @click="addStudent(selectedClassId)"
                      >
                        <Plus :size="20" :stroke-width="3" />
                      </button>
                    </div>
                    <div v-if="selectedClassId" class="student-list">
                      <div
                        v-for="student in getCurrentClassStudents()"
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
                          <!-- <span>{{ student.student_number }}</span> -->
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
                            @click.stop="handleStudentCheck(student)"
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
                        v-if="!getCurrentClassStudents()?.length"
                        class="picker-empty"
                      >
                        Aucun élève dans cette classe
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </Transition>
          </div>

          <!-- Column 3: Student details (when editing) -->
          <div class="student-detail-column">
            <Transition name="fade-in" mode="out-in">
              <StudentDetail
                v-if="studentDetailId !== null"
                :key="studentDetailId"
                :student-id="studentDetailId"
                :student-data="
                  allStudents.find((s) => s.id === studentDetailId)
                "
                :all-students="allStudents"
                :students="getCurrentClassStudents()"
                :has-student-selection="
                  checkedClassIds.size > 0 || checkedStudentIds.size > 0
                "
                :has-eval-selection="false"
                @close="studentDetailId = null"
                @deleted="onStudentDeleted"
                @data-changed="emit('data-changed')"
              />
            </Transition>
          </div>
        </div>
      </div>
      <StudentImportModal
        v-if="studentImportOpen"
        @close="studentImportOpen = false"
        @imported="onStudentImported"
      />
    </div>
  </div>
</template>

<style scoped>
/* Modal background */
.class-modal--bg {
  background: #457b9d;
}

/* Modal-specific styles */
.class-modal-body {
  width: 100%;
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
  color: var(--text-light);
  cursor: pointer;
}

.class-modal-rail-button.close {
  background: none;
}

/* Class edit row */
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

/* Transition for fade-slide */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
