<script setup>
import { vGlideSelect } from "../../lib/glideSelect";
import { ref, watch, computed } from "vue";
import { ChevronUp, ChevronDown, Upload, Plus, Check, PenIcon, X, LayoutGrid, List } from "@lucide/vue";
import FavoriteButton from "../FavoriteButton.vue";
import { useFavorites } from "../../stores/favorites";
import StudentAvatar from "../StudentAvatar.vue";
import { preferences } from "../../stores/preferences";
import { useUserFilter } from "../../stores/userFilters";
import { belongsTo, fullName } from "../../lib/domain";
import { mutate } from "../../lib/data";
import { supabase } from "../../supabase";
import { createProtectedStudents } from "../../stores/protectedStudents";
import Popup from "../popup/Popup.vue";
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
  "deselect-all",
  "student-check",
  "select-class",
  "data-changed",
  "class-check",
]);

// ── Internal state ──────────────────────────────────────
const classDetailId = ref(null);
const studentDetailId = ref(null);
const studentDetailSection = ref("name");
const studentImportOpen = ref(false);
const levelPickerOpen = ref(false);
const search = ref(""),
  grade = useUserFilter("niveau", value => typeof value === "string" && /^[0-6]$/.test(value)),
  bankSearch = ref(""),
  attachingStudent = ref(false),
  selectionError = ref("");
const { onlyFavorites, isFavorite, toggleFavorite } = useFavorites("classes");
const filteredClasses = computed(() => {
  const query = search.value.trim().toLocaleLowerCase("fr");
  const startsWithDigit = /^\d/.test(query);
  return props.classes.filter((c) => {
    const name = c.name.trim().toLocaleLowerCase("fr");
    const matchesSearch = startsWithDigit
      ? name.startsWith(query)
      : name.includes(query);
    const matchesGrade = !grade.value ||
      name.startsWith(grade.value);
    return matchesSearch && matchesGrade && (!onlyFavorites.value || isFavorite(c.id));
  });
});
const grades = Array.from({ length: 7 }, (_, level) => String(level));
const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
const bankStudents = computed(() => {
  const query = normalizeSearch(bankSearch.value.trim());
  if (!query) return [];
  const terms = query.split(/\s+/);
  return props.allStudents.filter((student) => (!props.selectedClassId || !belongsTo(student, props.selectedClassId)) &&
    terms.every((term) => normalizeSearch(fullName(student) + " " + (student.record_number || "")).includes(term)))
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "fr"));
});
watch(() => props.selectedClassId, () => {
  bankSearch.value = "";
  selectionError.value = "";
});
async function attachStudent(student) {
  const classId = props.selectedClassId;
  if (!classId || attachingStudent.value || belongsTo(student, classId)) return;
  attachingStudent.value = true;
  selectionError.value = "";
  try {
    await mutate(supabase.from("tu_student_classes")
      .insert({ student_id: student.id, class_id: classId }));
    if (props.selectedClassId === classId) bankSearch.value = "";
    emit("data-changed");
  } catch (e) {
    selectionError.value = e.message;
  } finally {
    attachingStudent.value = false;
  }
}

// ── Helper functions ────────────────────────────────────
function getClassName(classId) {
  const cls = props.classes.find((c) => c.id === classId);
  return cls ? cls.name : "";
}

function getCurrentClassStudents() {
  if (!props.selectedClassId) return [];
  return props.allStudents
    .filter((s) => belongsTo(s, props.selectedClassId))
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
    if (newId !== oldId) {
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
  const { data: created, error } = await createProtectedStudents([{
      firstname: "Nouvel",
      lastname: "Élève",
      class_id: classId,
    }]);
  const data = created?.[0];

  if (error || !data?.id) {
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
              <div class="favorite-header-actions">
              <FavoriteButton :active="!!onlyFavorites" :label="onlyFavorites ? 'Afficher tous les groupes' : 'Afficher les groupes favoris'" @toggle="onlyFavorites = !onlyFavorites" />
              <button
                class="picker-item picker-item--inline add-btn"
                @click="addClass"
              >
                <Plus :size="20" :stroke-width="3" />
              </button>
              </div>
            </div>
            <div class="class-filter-row">
              <div class="class-search-bar">
                <input v-model="search" placeholder="Rechercher un groupe" aria-label="Rechercher un groupe" />
                <div class="class-level-picker"
                  @keydown.esc.stop.prevent="levelPickerOpen = false"
                  @focusout="!$event.currentTarget.contains($event.relatedTarget) && (levelPickerOpen = false)">
                  <button type="button" class="class-level-trigger"
                    aria-label="Niveau scolaire" :aria-expanded="levelPickerOpen"
                    aria-controls="class-level-grid"
                    @click="levelPickerOpen = !levelPickerOpen">
                    <span>{{ grade === "" ? "Niveau" : grade }}</span>
                    <ChevronDown :size="14" aria-hidden="true" />
                  </button>
                  <div v-if="levelPickerOpen" id="class-level-grid" class="class-level-grid" role="group" aria-label="Choisir un niveau">
                    <button v-for="g in grades" :key="g" type="button"
                      :aria-pressed="grade === g" :aria-label="'Niveau ' + g"
                      @click="grade = g; levelPickerOpen = false">{{ g }}</button>
                    <button type="button" class="class-level-all" :aria-pressed="grade === ''"
                      aria-label="Tous les niveaux" @click="grade = ''; levelPickerOpen = false">X</button>
                  </div>
                </div>
              </div>
              <button type="button" class="row-checkbox class-clear-selection" aria-label="Effacer la recherche, le niveau et les sélections" title="Tout effacer" @click="search = ''; grade = ''; levelPickerOpen = false; emit('deselect-all')">
                <X :size="20" :stroke-width="3" />
              </button>
            </div>
            <div class="class-list">
              <p v-if="onlyFavorites && !filteredClasses.length" role="status">Aucun groupe favori ne correspond aux filtres.</p>
              <div v-for="cls in filteredClasses" :key="cls.id">
                <div role="button" tabindex="0" @keydown.enter.self.prevent="selectClass(cls.id)" @keydown.space.self.prevent="selectClass(cls.id)"
                  class="picker-item class-item"
                  :class="{
                    selected: selectedClassId === cls.id,
                  }"
                  @click="selectClass(cls.id)"
                >
                  <div class="class-name-with-favorite">
                    <FavoriteButton compact :active="isFavorite(cls.id)" :label="(isFavorite(cls.id) ? 'Retirer des favoris : ' : 'Ajouter aux favoris : ') + cls.name" @toggle="toggleFavorite(cls.id)" />
                    <span>{{ cls.name }}</span>
                  </div>
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
                      v-glide-select="{ group: 'classes', checked: checkedClassIds.has(cls.id), toggle: () => handleClassCheck(cls) }"
                      @click.stop="handleClassCheck(cls)"
                    >
                      <Check
                        v-if="checkedClassIds.has(cls.id)"
                        :size="24"
                        :stroke-width="3"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 2: Students or Class Detail -->
          <div class="students-column">
            <Transition name="fade-in" mode="out-in">
              <!-- Show ClassDetail form when editing a class -->

              <!-- Otherwise show student list -->
              <div :key="'student-list'" class="students-column-content">
                <Transition name="fade-in" mode="out-in">
                  <div
                    :key="selectedClassId || 'no-class'"
                    class="students-column-inner"
                  >
                    <div class="column-header">
                      <h3>
                        Élèves
                      </h3>
                      <div class="student-header-actions">
                        <button class="picker-item picker-item--inline add-btn"
                          :title="preferences.gallery ? 'Vue liste' : 'Vue galerie'"
                          :aria-label="preferences.gallery ? 'Vue liste' : 'Vue galerie'"
                          :aria-pressed="preferences.gallery"
                          @click="preferences.gallery = !preferences.gallery">
                          <List v-if="preferences.gallery" :size="20" />
                          <LayoutGrid v-else :size="20" />
                        </button>
                        <button class="picker-item picker-item--inline add-btn"
                          title="Créer un élève" aria-label="Créer un élève" :disabled="!selectedClassId"
                          @click="addStudent(selectedClassId)">
                          <Plus :size="20" :stroke-width="3" />
                        </button>
                      </div>
                    </div>
                    <div class="student-bank-search">
                      <input v-model="bankSearch" type="search" placeholder="Nom ou n° de fiche"
                        aria-label="Rechercher dans tous les élèves" :disabled="attachingStudent"
                        @keydown.esc="bankSearch = ''" />
                      <div v-if="bankSearch.trim()" class="student-bank-suggestions" :aria-busy="attachingStudent">
                        <button v-for="student in bankStudents" :key="student.id"
                          :disabled="attachingStudent" @click="selectedClassId ? attachStudent(student) : (studentDetailId = student.id)">
                          <span>{{ fullName(student) }}</span>
                          <small>{{ student.record_number || 'Sans n° de fiche' }}</small>
                        </button>
                        <p v-if="!bankStudents.length">{{ selectedClassId ? 'Aucun élève à ajouter' : 'Aucun élève trouvé' }}</p>
                      </div>
                      <p v-if="selectionError" role="alert">{{ selectionError }}</p>
                    </div>
                    <div
                      v-if="selectedClassId"
                      class="student-list"
                      :class="{ 'student-gallery': preferences.gallery }"
                    >
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
                          @click="studentDetailId = studentDetailId === student.id ? null : student.id"
                        >
                          <!-- <span>{{ student.student_number }}</span> -->
                          <StudentAvatar
                            v-if="preferences.gallery"
                            :student="student"
                          />
                          <span class="student-name" :title="fullName(student)">
                            <template v-if="preferences.gallery">
                              <span class="student-firstname">{{ student.firstname }}</span>
                              <span class="student-lastname">{{ student.lastname }}</span>
                          <span
                            class="row-checkbox gallery-checkbox"
                            :class="{
                              checked:
                                checkedStudentIds.has(student.id) ||
                                (checkedClassIds.has(selectedClassId) &&
                                  !excludedStudentIds.has(student.id)),
                            }"
                            v-glide-select="{ group: 'students', checked: checkedStudentIds.has(student.id) || (checkedClassIds.has(selectedClassId) && !excludedStudentIds.has(student.id)), toggle: () => handleStudentCheck(student) }"
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
                            </template>
                            <template v-else>{{ fullName(student) }}</template>
                          </span>
                          <span
                            v-if="!preferences.gallery"
                            class="row-checkbox"
                            :class="{
                              checked:
                                checkedStudentIds.has(student.id) ||
                                (checkedClassIds.has(selectedClassId) &&
                                  !excludedStudentIds.has(student.id)),
                            }"
                            v-glide-select="{ group: 'students', checked: checkedStudentIds.has(student.id) || (checkedClassIds.has(selectedClassId) && !excludedStudentIds.has(student.id)), toggle: () => handleStudentCheck(student) }"
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
              <StudentDetail
                v-if="studentDetailId !== null"
                :key="studentDetailId"
                v-model:active-section="studentDetailSection"
                @next-student="studentDetailId = $event"
                @previous-student="studentDetailId = $event"
                :student-id="studentDetailId"
                :student-data="
                  allStudents.find((s) => s.id === studentDetailId)
                "
                :all-students="allStudents"
                :students="selectedClassId ? getCurrentClassStudents() : bankStudents"
                :has-student-selection="
                  checkedClassIds.size > 0 || checkedStudentIds.size > 0
                "
                :has-eval-selection="false"
                @close="studentDetailId = null"
                @deleted="onStudentDeleted"
                @data-changed="emit('data-changed')"
              />
          </div>
        </div>
      </div>
      <StudentImportModal
        v-if="studentImportOpen"
        @close="studentImportOpen = false"
        @imported="onStudentImported"
        @photos-imported="emit('data-changed')"
      />
    </div>
    <Teleport to="body">
      <Popup v-if="classDetailId !== null" title="Modifier le groupe" @close="classDetailId = null">
                <ClassDetail
                  :key="classDetailId"
                  @data-changed="emit('data-changed')"
                  :class-id="classDetailId === 'new' ? null : classDetailId"
                  :all-students="allStudents"
                  @close="classDetailId = null"
                  @saved="onClassDetailSaved"
                  @duplicated="classDetailId = $event"
                  @deleted="onClassDetailDeleted"
                />
      </Popup>
    </Teleport>
  </div>
</template>

<style scoped>
.class-name-with-favorite { display: flex; align-items: center; gap: 0.2rem; min-width: 0; }
.row-checkbox,
.row-checkbox svg {
  transition: none;
  animation: none;
}
.student-header-actions { display: flex; gap: 0.4rem; }
.student-bank-search { position: relative; flex-shrink: 0; margin-bottom: 0.65rem; }
.student-bank-search input {
  box-sizing: border-box; width: 100%; min-height: 38px;
  padding: 0.5rem 0.75rem; border: none;
  border-radius: var(--field-radius); background: var(--surface);
  color: var(--text-light); font: inherit;
}
.student-bank-search input::placeholder { color: var(--text-light); opacity: 0.6; }
.student-bank-suggestions {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  z-index: 10;
  max-height: 384px;
  overflow-y: auto;
  border-radius: var(--field-radius);
  background: var(--surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.student-bank-suggestions button {
  display: flex; flex-direction: column; width: 100%; text-align: left;
  box-sizing: border-box; height: 48px; flex-shrink: 0;
  justify-content: center;
  padding: 0.5rem 0.75rem; margin: 0; border: none;
  border-radius: 0; background: transparent;
  color: var(--text-light); font: inherit; cursor: pointer;
}
.student-bank-suggestions span,
.student-bank-suggestions small {
  max-width: 100%; overflow: hidden; white-space: nowrap;
}
.student-bank-suggestions small { opacity: 0.65; }
.student-bank-suggestions button + button {
  border-top: 1px solid color-mix(in srgb, var(--text-light) 12%, transparent);
}
.student-bank-suggestions button:focus-visible {
  outline: 2px solid var(--text-light);
  outline-offset: -2px;
}
.student-bank-suggestions p { margin: 0; padding: 0.5rem 0.75rem; }

.class-filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
  padding-right: calc(0.3rem + 2px);
}
.class-search-bar {
  position: relative;
  padding-right: calc(7rem + 8px);
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  min-height: 38px;
  border: none;
  border-radius: var(--field-radius);
  background: var(--surface);
}
.class-search-bar input {
  flex: 1;
  min-width: 0;
  width: 0;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-light);
}
.class-search-bar input::placeholder {
  color: var(--text-light);
  opacity: 0.5;
}
.class-level-picker {
  position: absolute;
  right: 4px;
  top: 4px;
  bottom: 4px;
  width: 7rem;
}
.class-level-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 15px 0 1rem;
  border: none;
  border-radius: var(--field-radius);
  background: color-mix(in srgb, var(--text-light) 20%, var(--student-bg));
  color: var(--text-light);
  font-weight: 600;
  line-height: 1.2;
}
.class-level-trigger svg { flex-shrink: 0; }
.class-level-grid {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  width: 12rem;
  max-width: 70vw;
  padding: 0.5rem;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--text-light) 15%, transparent);
}
.class-level-grid button {
  min-height: 36px;
  border: none;
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-light);
}
.class-level-grid button[aria-pressed="true"] {
  background: var(--accent);
  color: var(--bg-dark);
}
.class-clear-selection {
  flex: 0 0 32px;
  padding: 0;
  background: transparent;
  color: var(--text-light);
}

/* Modal background */
.class-modal--bg {
  background: var(--student-bg);
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

.student-gallery {
  --gallery-card-bg: var(--surface-muted);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: start;
  align-items: stretch;
  gap: 0.5rem;
}
.student-gallery .student-item-row {
  min-width: 0;
  align-items: stretch;
}
.student-gallery .student-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  align-content: start;
  gap: 0.4rem;
  min-width: 0;
  border-radius: 12px;
  padding: 0.35rem;
  background: var(--gallery-card-bg);
}
.student-gallery :deep(.student-avatar) {
  grid-column: 1 / -1;
  display: flex;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  min-width: 0;
  flex: none;
  border-radius: 8px;
  font-size: 1.5rem;
}
.student-gallery :deep(.student-avatar img) {
  transform: scale(1.3);
  transform-origin: center;
}
.student-gallery .student-name {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 26px;
  column-gap: 4px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  min-width: 0;
  margin-top: -1.25rem;
  padding: 0.3rem 0 0;
  border-radius: 0;
  background: var(--gallery-card-bg);
  text-align: left;
}
.student-gallery .student-firstname,
.student-gallery .student-lastname {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  line-height: 1.2;
}
.student-gallery .student-firstname {
  grid-column: 1 / -1;
  font-size: 1.1rem;
  font-weight: 700;
}
.student-gallery .student-lastname {
  min-width: 0;
  min-height: 26px;
  box-sizing: border-box;
  font-size: 0.8rem;
}
.student-gallery .row-checkbox {
  grid-column: 2;
  grid-row: 2;
  justify-self: end;
  width: 26px;
  height: 26px;
  box-sizing: border-box;
  border-width: 1.5px;
  transform: translate(2px, 2px);
  margin: 0;
}
.student-gallery .row-checkbox svg {
  width: 19px;
  height: 19px;
}
.student-gallery .picker-empty {
  grid-column: 1 / -1;
}
</style>
