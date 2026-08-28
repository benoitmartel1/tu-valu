<script setup>
import { ref, watch } from "vue";
import { Trash2 } from "@lucide/vue";
import { supabase, getStudentPhotoPresignedUrl } from "../../supabase";

const props = defineProps({
  studentId: { type: [String, Number], default: null },
  studentData: { type: Object, default: null },
  allStudents: { type: Array, required: true },
  students: { type: Array, required: true },
  hasStudentSelection: { type: Boolean, default: false },
  hasEvalSelection: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "deleted", "data-changed"]);

const studentDetailEditing = ref(null);
const studentPhotoUrl = ref(null);
const studentClassName = ref("");
let photoUrlRequest = 0;

async function loadStudentPhoto(photoUrl) {
  const requestId = ++photoUrlRequest;
  if (!photoUrl) {
    studentPhotoUrl.value = null;
    return;
  }

  const { presignedUrl } = await getStudentPhotoPresignedUrl(photoUrl);
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

    // Use prop data immediately for responsive UI
    studentDetailEditing.value = { ...data };
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
        "id, firstname, lastname, gender, birth_date, class_id, student_number, name_display_prefs, photo_url, custom_name",
      )
      .eq("id", id)
      .single();

    if (data) {
      studentDetailEditing.value = { ...data };
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
        props.allStudents[idx] = { ...data };
      }
    }
  },
);

function getInitials(firstname, lastname) {
  return (firstname?.[0] || "") + (lastname?.[0] || "");
}

async function saveStudentDetail() {
  const studentId = props.studentId;
  if (!studentDetailEditing.value || !studentId) return;

  const { firstname, lastname, gender } = studentDetailEditing.value;
  if (!firstname?.trim() && !lastname?.trim()) return;

  const { error } = await supabase
    .from("tu_students")
    .update({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      gender: gender || null,
      custom_name: studentDetailEditing.value.custom_name?.trim() || null,
      name_display_prefs: studentDetailEditing.value.name_display_prefs || {
        showFirstname: true,
        showInitial: false,
        showLastname: false,
        showCustomName: false,
      },
    })
    .eq("id", studentId);

  if (error) {
    console.error("Failed to save student:", error);
    return;
  }

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

async function deleteStudent() {
  if (!props.studentId) return;
  if (!confirm("Supprimer cet élève ?")) return;

  try {
    const { error: eventsError } = await supabase
      .from("tu_session_events")
      .delete()
      .eq("student_id", props.studentId);

    if (eventsError) {
      console.error("Failed to delete session events:", eventsError);
      alert("Erreur lors de la suppression des événements de session");
      return;
    }

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
  <div class="student-detail-column">
    <div class="student-detail-layout">
      <!-- Photo placeholder -->
      <div v-if="studentDetailEditing" class="student-detail-photo-group">
        <div class="student-detail-photo">
          <img
            v-if="studentPhotoUrl"
            :src="studentPhotoUrl"
            :alt="`${studentDetailEditing?.firstname || studentData?.firstname} ${studentDetailEditing?.lastname || studentData?.lastname}`"
            class="student-photo-img"
            @error="
              (e) => {
                console.log('Image load error:', e.target.src);
                e.target.style.display = 'none';
              }
            "
          />
          <div v-else class="student-photo-circle">
            <span class="student-photo-initials">{{
              getInitials(
                studentDetailEditing?.firstname || studentData?.firstname,
                studentDetailEditing?.lastname || studentData?.lastname,
              )
            }}</span>
          </div>
        </div>
        <div class="student-detail-identifiers">
          <div v-if="studentClassName || studentData?.class_name">
            <span>{{ studentClassName || studentData?.class_name }}</span>
          </div>
          <div
            v-if="
              studentDetailEditing.student_number || studentData?.student_number
            "
          >
            <span>{{
              studentDetailEditing.student_number || studentData?.student_number
            }}</span>
          </div>
        </div>
      </div>

      <!-- Right column: fields -->
      <div v-if="studentDetailEditing" class="student-detail-fields">
        <div class="detail-section">
          <input
            v-model="studentDetailEditing.firstname"
            class="detail-input"
            placeholder="Prénom"
            @blur="saveStudentDetail"
          />
        </div>
        <div class="detail-section">
          <input
            v-model="studentDetailEditing.lastname"
            class="detail-input"
            placeholder="Nom"
            @blur="saveStudentDetail"
          />
        </div>
        <div class="detail-section">
          <input
            v-model="studentDetailEditing.custom_name"
            class="detail-input detail-input--custom-name"
            placeholder="Surnom"
            @blur="saveStudentDetail"
          />
        </div>
        <div class="detail-section">
          <label class="detail-label">Sexe</label>
          <div class="gender-selector">
            <button
              class="gender-btn"
              :class="{ active: studentDetailEditing.gender === 'M' }"
              @click="toggleGender('M')"
            >
              M
            </button>
            <button
              class="gender-btn"
              :class="{ active: studentDetailEditing.gender === 'F' }"
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
        <div
          v-if="studentClassName || studentData.class_name"
          class="detail-section"
        >
          <label class="detail-label">Classe</label>
          <span class="class-pill">{{ studentData.class_name }}</span>
        </div>
      </div>
    </div>
    <!-- Navigation bar -->
    <button
      v-if="studentDetailEditing"
      class="header-trash-btn header-trash-btn--absolute"
      title="Supprimer l'élève"
      @click="deleteStudent"
    >
      <Trash2 :size="36" />
    </button>
  </div>
</template>

<style scoped>
.header-trash-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-light);
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

.student-detail-photo-group {
  display: flex;
  align-items: center;
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
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #1a3a5c;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.student-photo-img {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  object-fit: cover;
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

.detail-section {
  padding: 0.25rem 0;
}

.detail-label {
  display: block;
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.5rem;
}

.detail-input {
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

.detail-input:focus {
  border-color: var(--stadium-yellow);
  background: rgba(33, 37, 41, 0.7);
}

.detail-input::placeholder {
  color: var(--text-light);
  opacity: 0.4;
}

/* Custom name input with reduced opacity background */
.detail-input--custom-name {
  background: rgba(33, 37, 41, 0.5) !important;
}

.detail-input--custom-name:focus {
  background: rgba(33, 37, 41, 0.6) !important;
}

.field-hint {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
}

.gender-selector {
  display: inline-flex;
  gap: 0.5rem;
}

.gender-btn {
  flex: 1;
  height: 60px;
  border: none;
  border-radius: 100%;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-light);
  font-size: 1.5rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  opacity: 0.5;
  transform: scale(0.9);
}

.gender-btn.active {
  background: rgba(33, 37, 41, 0.6);
  opacity: 1;
  transform: scale(1);
}

/* Name display options */
.name-display-options {
  display: flex;
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

.checkbox-option:hover {
  opacity: 1;
}

.checkbox-circle {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 100%;
  background: rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  transition: all 0.2s;
}

.checkbox-option:has(input:checked) .checkbox-circle {
  background: rgba(33, 37, 41, 0.6);
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
  color: rgba(255, 255, 255, 0.9);
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
