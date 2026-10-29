<script setup>
import { ref, watch, computed } from "vue";
import StudentFields from "./StudentFields.vue";
import DetailHeaderActions from "./DetailHeaderActions.vue";
import { createProtectedStudents, updateProtectedStudent } from "../../stores/protectedStudents";
import { User, IdCard, Component, ChevronRight, ChevronLeft } from "@lucide/vue";
import { supabase } from "../../supabase";
import { loadStudentPhoto as loadCachedStudentPhoto, peekStudentPhoto } from "../../stores/studentPhotos";

const props = defineProps({
  activeSection: { type: String, default: "name" },
  studentId: { type: [String, Number], default: null },
  studentData: { type: Object, default: null },
  allStudents: { type: Array, required: true },
  students: { type: Array, required: true },
  hasStudentSelection: { type: Boolean, default: false },
  hasEvalSelection: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "deleted", "data-changed", "next-student", "previous-student", "update:activeSection"]);

const activeTab = computed({
  get: () => props.activeSection,
  set: value => emit("update:activeSection", value),
});
const previousStudent = computed(() => {
  const index = props.students.findIndex(student => student.id === props.studentId);
  return index > 0 ? props.students[index - 1] : null;
});
const nextStudent = computed(() => {
  const index = props.students.findIndex(student => student.id === props.studentId);
  return index < 0 ? null : props.students[index + 1] || null;
});
const detailTabs = [
  { id: "name", label: "Identité", icon: User },
  { id: "records", label: "Identifiants", icon: IdCard },
  { id: "teams", label: "Équipes", icon: Component },
];
function navigateTabs(event, index) {
  const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: detailTabs.length - 1 - index };
  if (!(event.key in offsets)) return;
  event.preventDefault();
  const next = (index + offsets[event.key] + detailTabs.length) % detailTabs.length;
  activeTab.value = detailTabs[next].id;
  event.currentTarget.parentElement.children[next].focus();
}
const studentDetailEditing = ref(null);
const saveError = ref("");
const savedIdentity = ref("");
let editingStudentId = null;
let pendingIdentitySave = Promise.resolve();
function identitySignature(student) {
  return JSON.stringify({
    firstname: student.firstname?.trim() || "",
    lastname: student.lastname?.trim() || "",
    gender: student.gender || null,
    custom_name: student.custom_name?.trim() || null,
    name_display_prefs: {
      showFirstname: student.name_display_prefs?.showFirstname ?? true,
      showInitial: student.name_display_prefs?.showInitial ?? false,
      showLastname: student.name_display_prefs?.showLastname ?? false,
      showCustomName: student.name_display_prefs?.showCustomName ?? false,
    },
  });
}
const studentPhotoUrl = ref(null);
const studentPhotoLoaded = ref(false);
const studentClassName = ref("");
let photoUrlRequest = 0;
let displayedPhotoPath = null;

async function loadStudentPhoto(photoUrl) {
  if (photoUrl && displayedPhotoPath === photoUrl && studentPhotoUrl.value) return;
  const requestId = ++photoUrlRequest;
  displayedPhotoPath = photoUrl;
  const cached = photoUrl && peekStudentPhoto(photoUrl);
  if (cached) {
    studentPhotoUrl.value = cached;
    studentPhotoLoaded.value = true;
    return;
  }
  studentPhotoLoaded.value = false;
  studentPhotoUrl.value = null;
  if (!photoUrl) {
    studentPhotoUrl.value = null;
    return;
  }

  const presignedUrl = await loadCachedStudentPhoto(photoUrl).catch(() => null);
  if (requestId === photoUrlRequest) {
    studentPhotoUrl.value = presignedUrl;
  }
}

// Initialize from props immediately for responsive UI
watch(
  () => [props.studentId, props.studentData],
  ([id, data]) => {
    if (!id || !data) {
      studentDetailEditing.value = null;
      return;
    }

    // A background refresh must not discard edits in the open form.
    if (editingStudentId === id && studentDetailEditing.value &&
        identitySignature(studentDetailEditing.value) !== savedIdentity.value) return;
    editingStudentId = id;
    // Use prop data immediately for responsive UI
    studentDetailEditing.value = {
      ...data,
      name_display_prefs: data.name_display_prefs ? { ...data.name_display_prefs } : null,
    };
    savedIdentity.value = identitySignature(studentDetailEditing.value);
    studentClassName.value = data.class_name || "";
    loadStudentPhoto(data.photo_url);
  },
  { immediate: true },
);

// Fetch fresh data in background
watch(
  () => props.studentId,
  async (id) => {
    if (!id) return;

    // Always fetch fresh data from Supabase to get latest photo_url
    const { data } = await supabase
      .from("tu_students")
      .select(
        "id, birth_date, class_id, student_number, photo_url",
      )
      .eq("id", id)
      .single();

    if (data && id === props.studentId) {
      studentDetailEditing.value = { ...studentDetailEditing.value, ...data };
      loadStudentPhoto(data.photo_url);

      const { data: classData } = await supabase
        .from("tu_classes")
        .select("name")
        .eq("id", data.class_id)
        .maybeSingle();
      studentClassName.value = classData?.name || "";

      // Also update the cached allStudents with fresh data
      const idx = props.allStudents.findIndex((s) => s.id === id);
      if (idx !== -1) {
        props.allStudents[idx] = { ...props.allStudents[idx], ...data };
      }
    }
  },
  { immediate: true },
);

function getInitials(firstname, lastname) {
  return (firstname?.[0] || "") + (lastname?.[0] || "");
}

function handleIdentityBlur(field) {
  console.info("[StudentDetail] Field blurred", { field });
  return saveStudentDetail();
}

function saveStudentDetail() {
  const studentId = props.studentId;
  if (!studentDetailEditing.value || !studentId) return Promise.resolve();
  const identity = identitySignature(studentDetailEditing.value);
  const student = { id: studentId, ...JSON.parse(identity) };
  pendingIdentitySave = pendingIdentitySave.catch(() => {}).then(() => persistStudentIdentity(student, identity));
  return pendingIdentitySave;
}

async function persistStudentIdentity(student, identity) {
  const studentId = student.id;
  if (studentId !== props.studentId) return;
  if (!student.firstname && !student.lastname) return;
  if (identity === savedIdentity.value) {
    console.info("[StudentDetail] Save skipped: identity unchanged");
    return;
  }
  console.info("[StudentDetail] Saving identity");

  saveError.value = "";
  const { data, error } = await updateProtectedStudent(student);

  if (error) {
    saveError.value = error.message || "Impossible d’enregistrer les modifications de l’élève.";
    console.error("Failed to save student:", error);
    return;
  }

  const saved = data?.find(row => row.id === studentId);
  if (!saved || saved.firstname !== student.firstname) {
    saveError.value = "Le serveur n’a pas confirmé le nouveau prénom. Rechargez la fiche et réessayez.";
    console.error("[StudentDetail] First-name save was not confirmed");
    return;
  }

  if (props.studentId === studentId) savedIdentity.value = identity;
  console.info("[StudentDetail] Identity saved; requesting app refresh");
  // Notify parent to reload data
  emit("data-changed");
}

function toggleGender(value) {
  if (!studentDetailEditing.value) return;
  studentDetailEditing.value.gender =
    studentDetailEditing.value.gender === value ? null : value;
  saveStudentDetail();
}

function toggleNamePref(prefKey) {
  if (!studentDetailEditing.value) return;

  if (!studentDetailEditing.value.name_display_prefs) {
    studentDetailEditing.value.name_display_prefs = {
      showFirstname: true,
      showInitial: false,
      showLastname: false,
      showCustomName: false,
    };
  }

  studentDetailEditing.value.name_display_prefs[prefKey] =
    !studentDetailEditing.value.name_display_prefs[prefKey];

  saveStudentDetail();
}

const duplicating = ref(false);
async function duplicateStudent() {
  if (!studentDetailEditing.value || duplicating.value) return;
  duplicating.value = true;
  try {
    const student = studentDetailEditing.value;
    const { data, error } = await createProtectedStudents([{
      firstname: student.firstname,
      lastname: (student.lastname || "") + " (copie)",
      class_id: student.class_id,
      gender: student.gender,
      birth_date: student.birth_date,
      custom_name: student.custom_name,
      name_display_prefs: student.name_display_prefs,
    }]);
    if (error) throw error;
    if (!data?.[0]?.id) throw new Error("Impossible de dupliquer l’élève.");
    emit("data-changed");
    emit("next-student", data[0].id);
  } catch (error) {
    alert(error.message);
  } finally {
    duplicating.value = false;
  }
}

async function deleteStudent() {
  if (!props.studentId) return;
  if (
    !confirm(
      "Supprimer définitivement cette fiche, ses appartenances à tous les groupes et ses traces ? Pour un seul groupe, utilisez « Retirer du groupe ».",
    )
  )
    return;

  try {
    // Existing database cascades remove memberships and events in one transaction.
    const { error } = await supabase
      .from("tu_students")
      .delete()
      .eq("id", props.studentId);

    if (error) {
      console.error("Failed to delete student:", error);
      alert("Erreur lors de la suppression de l'élève");
      return;
    }

    emit("deleted", props.studentId);
    emit("data-changed");
    emit("close");
  } catch (err) {
    console.error("Unexpected error while deleting student:", err);
    alert("Une erreur inattendue est survenue");
  }
}
</script>

<template>
  <div class="student-detail-column student-detail-with-next">
    <div class="student-detail-scroll">
      <!-- Photo placeholder -->
      <div v-if="studentDetailEditing" class="student-detail-photo-group">
        <div class="student-detail-photo">
          <img
            v-if="studentPhotoUrl"
            :src="studentPhotoUrl"
            :alt="`${studentDetailEditing?.firstname || studentData?.firstname} ${studentDetailEditing?.lastname || studentData?.lastname}`"
            class="student-photo-img"
            :class="{ 'is-loaded': studentPhotoLoaded }"
            @load="studentPhotoLoaded = true"
            @error="studentPhotoLoaded = false"
          />
          <div class="student-photo-circle" aria-hidden="true">
            <span class="student-photo-initials">{{
              getInitials(
                studentDetailEditing?.firstname || studentData?.firstname,
                studentDetailEditing?.lastname || studentData?.lastname,
              )
            }}</span>
          </div>
        </div>
        <DetailHeaderActions duplicate-label="Dupliquer l’élève" delete-label="Supprimer l’élève" :busy="duplicating" @duplicate="duplicateStudent" @delete="deleteStudent" />
      </div>

    <div v-if="studentDetailEditing" class="student-detail-tabs" role="tablist" aria-label="Détails de l’élève">
      <button v-for="(tab, index) in detailTabs" :key="tab.id"
        :id="`student-tab-${tab.id}`" type="button" role="tab"
        :aria-label="tab.label" :title="tab.label"
        :aria-selected="activeTab === tab.id" :aria-controls="`student-panel-${tab.id}`"
        :tabindex="activeTab === tab.id ? 0 : -1"
        :class="['student-detail-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id" @keydown="navigateTabs($event, index)">
        <component :is="tab.icon" :size="36" :stroke-width="1.5" aria-hidden="true" />
      </button>
    </div>
    <div v-if="studentDetailEditing" v-show="activeTab === 'name'" id="student-panel-name"
      role="tabpanel" aria-labelledby="student-tab-name" class="student-detail-layout">
      <!-- Right column: fields -->
      <div v-if="studentDetailEditing" class="student-detail-fields">

        <div class="detail-section">
          <input
            v-model="studentDetailEditing.firstname"
            class="detail-input"
            placeholder="Prénom"
            @blur="handleIdentityBlur('firstname')"
          />
        </div>
        <div class="detail-section">
          <input
            v-model="studentDetailEditing.lastname"
            class="detail-input"
            placeholder="Nom"
            @blur="handleIdentityBlur('lastname')"
          />
        </div>
        <div class="detail-section">
          <input
            v-model="studentDetailEditing.custom_name"
            class="detail-input detail-input--custom-name"
            placeholder="Surnom"
            @blur="handleIdentityBlur('custom_name')"
          />
        </div>
        <div class="detail-section">
          <label class="detail-label">Sexe</label>
          <div class="gender-selector">
            <button
              class="gender-btn"
              :class="{ active: studentDetailEditing.gender === 'M' }"
              :aria-pressed="studentDetailEditing.gender === 'M'"
              @click="toggleGender('M')"
            >
              M
            </button>
            <button
              class="gender-btn"
              :class="{ active: studentDetailEditing.gender === 'F' }"
              :aria-pressed="studentDetailEditing.gender === 'F'"
              @click="toggleGender('F')"
            >
              F
            </button>
          </div>
        </div>
        <div class="detail-section">
          <label class="detail-label">Affichage du nom</label>
          <div class="name-display-options">
            <label class="checkbox-option">
              <div class="checkbox-circle">
                <input
                  type="checkbox"
                  :checked="
                    studentDetailEditing.name_display_prefs?.showCustomName ??
                    false
                  "
                  @change="toggleNamePref('showCustomName')"
                />
              </div>
              <span>Surnom</span>
            </label>
            <label class="checkbox-option">
              <div class="checkbox-circle">
                <input
                  type="checkbox"
                  :checked="
                    studentDetailEditing.name_display_prefs?.showFirstname ??
                    true
                  "
                  @change="toggleNamePref('showFirstname')"
                />
              </div>
              <span>Prénom</span>
            </label>
            <label class="checkbox-option">
              <div class="checkbox-circle">
                <input
                  type="checkbox"
                  :checked="
                    studentDetailEditing.name_display_prefs?.showInitial ??
                    false
                  "
                  @change="toggleNamePref('showInitial')"
                />
              </div>
              <span>Initiale</span>
            </label>
            <label class="checkbox-option">
              <div class="checkbox-circle">
                <input
                  type="checkbox"
                  :checked="
                    studentDetailEditing.name_display_prefs?.showLastname ??
                    false
                  "
                  @change="toggleNamePref('showLastname')"
                />
              </div>
              <span>Nom</span>
            </label>
          </div>
        </div>

      </div>
    </div>
    <p v-if="saveError" role="alert">{{ saveError }}</p>
    <StudentFields v-if="studentDetailEditing" v-show="activeTab !== 'name'"
      :key="studentId" :id="studentId" :section="activeTab" @changed="emit('data-changed')" />
    </div>
    <footer class="student-detail-footer" aria-label="Navigation des élèves">
      <button type="button" class="next-student-btn" :disabled="!previousStudent"
        @click="emit('previous-student', previousStudent.id)">
        <ChevronLeft :size="20" aria-hidden="true" /> Précédent
      </button>
      <button type="button" class="next-student-btn" :disabled="!nextStudent"
        @click="emit('next-student', nextStudent.id)">
        Prochain <ChevronRight :size="20" aria-hidden="true" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.student-detail-with-next { height: 100%; min-height: 0; }
.student-detail-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.student-detail-footer { position: sticky; bottom: 0; z-index: 1; display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; flex-shrink: 0; margin-top: auto; padding: 0.75rem 0 0.25rem; background: var(--surface); }
.next-student-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  border: none; border-radius: 24px; padding: 0.6rem 0.8rem;
  background: var(--surface-muted); color: var(--text-light); font: inherit;
}
.student-detail-tabs { display: flex; justify-content: space-around; width: 100%; gap: 0.35rem; margin: 0.75rem 0 1rem; flex-shrink: 0; }
.student-detail-tab {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  width: 56px; height: 56px; padding: 0.5rem; border: none; border-radius: 999px;
  background: transparent; color: var(--text-light); font: inherit; font-size: 0.85rem; cursor: pointer;
}
.student-detail-tab.active {
  background: color-mix(in srgb, var(--modal-accent, var(--stadium-yellow)) 16%, transparent);
}
.student-detail-tab:focus-visible { outline: 2px solid var(--modal-accent, var(--stadium-yellow)); outline-offset: 2px; }


.student-detail-layout {
  flex-direction: column;
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.student-detail-photo {
  position: relative;
  width: 150px;
  height: 150px;
  flex-shrink: 0;
}

.student-detail-photo-group {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  width: 100%;
  padding: 1rem 0 0.5rem;
  gap: 1rem;
}

.student-detail-identifiers {
  display: grid;
  gap: 0.5rem;
  color: var(--text-light);
}

.student-detail-identifiers > div {
  display: grid;
  gap: 0.1rem;
}

.student-detail-identifier-label {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.student-detail-identifiers strong {
  font-size: 1.15rem;
}

.student-photo-circle {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: var(--photo-placeholder-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  /* box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); */
}

.student-photo-img {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  transition: opacity 240ms ease;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  /* box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); */
}

.student-photo-img.is-loaded {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .student-photo-img { transition: none; }
}

.student-photo-initials {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.student-detail-fields {
  flex: 1;
  width: 100%;
  min-width: 0;
}

.detail-section {
  padding: 0.25rem 0;
}

.detail-label {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-light);
  margin-bottom: 0.5rem;
}

.detail-input {
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--input-border);
  border-radius: var(--field-radius);
  background: var(--input-surface);
  color: var(--text-light);
  font: inherit;
  box-sizing: border-box;
}

.detail-input::placeholder {
  color: var(--text-muted);
  opacity: 0.75;
}

.gender-selector {
  display: inline-flex;
  gap: 0.5rem;
}

.gender-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  color: var(--text-light);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.gender-btn.active {
  background: var(--modal-accent, #5599e0);
  color: #ffffff;
}

/* Name display options */
.name-display-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-light);
  opacity: 0.8;
  transition: opacity 0.2s;
  user-select: none;
}

.checkbox-option:focus-visible {
  opacity: 1;
}

.checkbox-circle {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 100%;
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  flex-shrink: 0;
  transition: all 0.2s;
}

.checkbox-option:has(input:checked) .checkbox-circle {
  background: color-mix(in srgb, var(--text-muted) 20%, transparent);
}

.checkbox-option input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkbox-circle::after {
  content: "✓";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-light);
  opacity: 0;
  transition: opacity 0.2s;
}

.checkbox-option:has(input:checked) .checkbox-circle::after {
  opacity: 1;
}

.name-preview {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 168px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 0.85rem;
  opacity: 0.7;
  font-style: italic;
}
</style>
