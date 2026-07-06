<script setup>
import { ref, onMounted, computed } from "vue";
import { supabase } from "../supabase";
import { Plus, Trash2, Edit2, X, Check, ArrowLeft, Upload } from "@lucide/vue";

const props = defineProps({
  classId: { type: String, default: null },
});

const emit = defineEmits(["close", "saved", "deleted"]);

// ── State ─────────────────────────────────────────────
const className = ref("");
const students = ref([]); // { id, firstname, lastname, editing, editFirstname, editLastname }
const newFirstname = ref("");
const newLastname = ref("");
const addingStudent = ref(false);
const loading = ref(false);
const originalClassName = ref("");

// ── Excel import state ────────────────────────────────
const excelImportOpen = ref(false);
const excelRawText = ref("");
const excelLoading = ref(false);
const firstnameCol = ref(0); // which column index is firstname
const lastnameCol = ref(1); // which column index is lastname

// ── Computed ──────────────────────────────────────────
const isNewClass = computed(() => !props.classId);
const hasChanges = computed(() => className.value !== originalClassName.value);

// ── Load data ─────────────────────────────────────────
onMounted(async () => {
  if (props.classId) {
    await loadClass(props.classId);
  }
});

async function loadClass(id) {
  loading.value = true;
  try {
    const [{ data: cls }, { data: stu }] = await Promise.all([
      supabase.from("tu_classes").select("id, name").eq("id", id).single(),
      supabase
        .from("tu_students")
        .select("id, firstname, lastname")
        .eq("class_id", id)
        .order("firstname"),
    ]);
    if (cls) {
      className.value = cls.name;
      originalClassName.value = cls.name;
    }
    students.value = (stu || []).map((s) => ({
      ...s,
      editing: false,
      editFirstname: s.firstname,
      editLastname: s.lastname,
    }));
  } catch (err) {
    console.error("Failed to load class:", err);
  } finally {
    loading.value = false;
  }
}

// ── Class actions ─────────────────────────────────────
async function saveClass() {
  if (!className.value.trim()) return;
  loading.value = true;
  try {
    if (props.classId) {
      await supabase
        .from("tu_classes")
        .update({ name: className.value.trim() })
        .eq("id", props.classId);
    }
    emit("saved");
  } catch (err) {
    console.error("Failed to save class:", err);
  } finally {
    loading.value = false;
  }
}

async function deleteClass() {
  if (!confirm("Supprimer cette classe et tous ses élèves ?")) return;
  loading.value = true;
  try {
    await supabase.from("tu_classes").delete().eq("id", props.classId);
    emit("deleted");
  } catch (err) {
    console.error("Failed to delete class:", err);
  } finally {
    loading.value = false;
  }
}

// ── Student actions ───────────────────────────────────
async function addStudent() {
  const firstname = newFirstname.value.trim();
  const lastname = newLastname.value.trim();
  if (!firstname && !lastname) return;

  // If it's a new class (no id yet), we need to save the class first
  if (!props.classId) {
    const { data: cls, error } = await supabase
      .from("tu_classes")
      .insert({ name: className.value.trim() || "Nouvelle classe" })
      .select()
      .single();
    if (error) {
      console.error("Failed to create class:", error);
      return;
    }
    const { error: stuErr } = await supabase
      .from("tu_students")
      .insert({ firstname, lastname, class_id: cls.id })
      .select()
      .single();
    if (stuErr) {
      console.error("Failed to add student:", stuErr);
      return;
    }
    emit("saved");
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await supabase
      .from("tu_students")
      .insert({ firstname, lastname, class_id: props.classId })
      .select()
      .single();
    if (error) throw error;
    students.value.push({
      ...data,
      editing: false,
      editFirstname: data.firstname,
      editLastname: data.lastname,
    });
    newFirstname.value = "";
    newLastname.value = "";
    addingStudent.value = false;
  } catch (err) {
    console.error("Failed to add student:", err);
  } finally {
    loading.value = false;
  }
}

function startEditStudent(student) {
  student.editing = true;
  student.editFirstname = student.firstname;
  student.editLastname = student.lastname;
}

function cancelEditStudent(student) {
  student.editing = false;
  student.editFirstname = student.firstname;
  student.editLastname = student.lastname;
}

async function saveStudent(student) {
  const firstname = student.editFirstname.trim();
  const lastname = student.editLastname.trim();
  if (!firstname && !lastname) return;
  loading.value = true;
  try {
    const { error } = await supabase
      .from("tu_students")
      .update({ firstname, lastname })
      .eq("id", student.id);
    if (error) throw error;
    student.firstname = firstname;
    student.lastname = lastname;
    student.editing = false;
  } catch (err) {
    console.error("Failed to update student:", err);
  } finally {
    loading.value = false;
  }
}

async function deleteStudent(studentId) {
  if (!confirm("Supprimer cet élève ?")) return;
  loading.value = true;
  try {
    const { error } = await supabase
      .from("tu_students")
      .delete()
      .eq("id", studentId);
    if (error) throw error;
    students.value = students.value.filter((s) => s.id !== studentId);
  } catch (err) {
    console.error("Failed to delete student:", err);
  } finally {
    loading.value = false;
  }
}

function handleExcelImport() {
  excelImportOpen.value = true;
  excelRawText.value = "";
}

function cancelExcelImport() {
  excelImportOpen.value = false;
  excelRawText.value = "";
}

function parseExcelData(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  // Detect delimiter
  const tabCount = lines[0].split("\t").length;
  const semicolonCount = lines[0].split(";").length;
  const commaCount = lines[0].split(",").length;

  let delimiter;
  if (tabCount > semicolonCount && tabCount > commaCount && tabCount >= 2) {
    delimiter = "\t";
  } else if (semicolonCount > commaCount && semicolonCount >= 2) {
    delimiter = ";";
  } else if (commaCount >= 2) {
    delimiter = ",";
  } else {
    delimiter = null; // single column
  }

  return lines
    .map((line) => {
      const parts = delimiter
        ? line.split(delimiter).map((p) => p.trim())
        : [line.trim()];
      return {
        firstname: parts[firstnameCol.value] || "",
        lastname: parts[lastnameCol.value] || "",
        cols: parts,
      };
    })
    .filter((entry) => entry.firstname || entry.lastname);
}

function getColumnCount() {
  const lines = excelRawText.value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return 0;
  const tabCount = lines[0].split("\t").length;
  const semicolonCount = lines[0].split(";").length;
  const commaCount = lines[0].split(",").length;
  return Math.max(tabCount, semicolonCount, commaCount);
}

const columnCount = computed(getColumnCount);

async function confirmExcelImport() {
  const entries = parseExcelData(excelRawText.value);
  if (entries.length === 0) return;

  if (!confirm(`${entries.length} élève(s) détecté(s). Confirmer l'import ?`))
    return;

  excelLoading.value = true;
  try {
    let targetClassId = props.classId;

    // If no class yet, create it first
    if (!targetClassId) {
      const { data: cls, error } = await supabase
        .from("tu_classes")
        .insert({ name: className.value.trim() || "Nouvelle classe" })
        .select()
        .single();
      if (error) throw error;
      targetClassId = cls.id;
    }

    // Insert all students
    const studentsToInsert = entries.map((e) => ({
      firstname: e.firstname,
      lastname: e.lastname,
      class_id: targetClassId,
    }));

    const { error } = await supabase
      .from("tu_students")
      .insert(studentsToInsert);

    if (error) throw error;

    console.log("=== Import Excel réussi ===");
    console.log(
      `${studentsToInsert.length} élève(s) ajouté(s) à la classe ${className.value} (id: ${targetClassId})`,
    );
    console.log(JSON.stringify(studentsToInsert, null, 2));

    // Reload students and close import
    excelImportOpen.value = false;
    excelRawText.value = "";

    if (!props.classId) {
      // New class was created — let parent know
      emit("saved");
    } else {
      await loadClass(props.classId);
    }
  } catch (err) {
    console.error("Import Excel échoué:", err);
    alert("Erreur lors de l'import. Voir la console pour les détails.");
  } finally {
    excelLoading.value = false;
  }
}

const parsedEntries = computed(() => {
  if (!excelRawText.value.trim()) return [];
  return parseExcelData(excelRawText.value);
});
</script>

<template>
  <div class="class-detail">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('close')">
        <ArrowLeft :size="18" />
      </button>
      <span class="detail-title">
        {{ isNewClass ? "Nouvelle classe" : className || "Chargement…" }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading && students.length === 0" class="detail-loading">
      Chargement…
    </div>

    <template v-else>
      <!-- Class name -->
      <div class="detail-section">
        <label class="detail-label">Nom de la classe</label>
        <div class="class-name-row">
          <input
            v-model="className"
            class="detail-input"
            placeholder="Ex: 3A"
            @keyup.enter="saveClass"
          />
          <button
            v-if="!isNewClass"
            class="btn btn-delete-class"
            title="Supprimer la classe"
            @click="deleteClass"
          >
            <Trash2 :size="16" />
          </button>
        </div>
        <button
          v-if="!isNewClass && hasChanges"
          class="btn btn-save-class"
          @click="saveClass"
        >
          <Check :size="16" /> Enregistrer
        </button>
      </div>

      <!-- Students list -->
      <div class="detail-section">
        <label class="detail-label">
          Élèves
          <span class="student-count">({{ students.length }})</span>
        </label>

        <div class="students-list">
          <div
            v-for="student in students"
            :key="student.id"
            class="student-row"
          >
            <template v-if="student.editing">
              <input
                v-model="student.editFirstname"
                class="detail-input student-input"
                placeholder="Prénom"
                autofocus
                @keyup.enter="saveStudent(student)"
                @keyup.escape="cancelEditStudent(student)"
              />
              <input
                v-model="student.editLastname"
                class="detail-input student-input"
                placeholder="Nom"
                @keyup.enter="saveStudent(student)"
                @keyup.escape="cancelEditStudent(student)"
              />
              <button
                class="btn-icon"
                title="Confirmer"
                @click="saveStudent(student)"
              >
                <Check :size="15" />
              </button>
              <button
                class="btn-icon"
                title="Annuler"
                @click="cancelEditStudent(student)"
              >
                <X :size="15" />
              </button>
            </template>
            <template v-else>
              <span class="student-name"
                >{{ student.firstname }} {{ student.lastname }}</span
              >
              <button
                class="btn-icon"
                title="Modifier"
                @click="startEditStudent(student)"
              >
                <Edit2 :size="14" />
              </button>
              <button
                class="btn-icon btn-icon--delete"
                title="Supprimer"
                @click="deleteStudent(student.id)"
              >
                <Trash2 :size="14" />
              </button>
            </template>
          </div>

          <div v-if="students.length === 0" class="students-empty">
            Aucun élève dans cette classe
          </div>
        </div>

        <!-- Excel import form -->
        <div v-if="excelImportOpen" class="excel-import-section">
          <label class="detail-label">Copier-coller depuis Excel</label>
          <textarea
            v-model="excelRawText"
            class="excel-textarea"
            placeholder="Collez ici les données copiées d'Excel&#10;Une ligne par élève. Colonnes détectées automatiquement."
            rows="5"
            autofocus
          ></textarea>

          <!-- Column mapping (when multiple columns) -->
          <div
            v-if="columnCount >= 2 && parsedEntries.length > 0"
            class="column-mapping"
          >
            <label class="detail-label">Correspondance des colonnes</label>
            <div class="mapping-row">
              <span class="mapping-label">Prénom (colonne)</span>
              <select v-model.number="firstnameCol" class="mapping-select">
                <option
                  v-for="i in columnCount"
                  :key="'fn-' + i"
                  :value="i - 1"
                >
                  Colonne {{ i }}
                </option>
              </select>
            </div>
            <div class="mapping-row">
              <span class="mapping-label">Nom (colonne)</span>
              <select v-model.number="lastnameCol" class="mapping-select">
                <option value="-1">— Aucune —</option>
                <option
                  v-for="i in columnCount"
                  :key="'ln-' + i"
                  :value="i - 1"
                >
                  Colonne {{ i }}
                </option>
              </select>
            </div>
          </div>

          <!-- Preview of parsed entries -->
          <div v-if="parsedEntries.length > 0" class="excel-preview">
            <span class="excel-preview-label">
              {{ parsedEntries.length }} élève(s) détecté(s)
            </span>
            <div class="excel-preview-list">
              <div
                v-for="(entry, i) in parsedEntries"
                :key="i"
                class="excel-preview-row"
              >
                <span class="excel-preview-name"
                  >{{ entry.firstname }} {{ entry.lastname }}</span
                >
                <span v-if="entry.cols.length > 2" class="excel-preview-extra">
                  + {{ entry.cols.length - 2 }} colonne(s) ignorée(s)
                </span>
              </div>
            </div>
          </div>
          <div v-else-if="excelRawText.length > 0" class="excel-preview-empty">
            Aucun nom valide détecté
          </div>

          <div class="excel-actions">
            <button
              class="btn btn-excel-confirm"
              :disabled="excelLoading || parsedEntries.length === 0"
              @click="confirmExcelImport"
            >
              <Upload :size="16" />
              {{ excelLoading ? "Import…" : "Ajouter à Supabase" }}
            </button>
            <button
              class="btn btn-excel-cancel"
              :disabled="excelLoading"
              @click="cancelExcelImport"
            >
              <X :size="16" /> Annuler
            </button>
          </div>
        </div>

        <!-- Add student manually (only when not in excel mode) -->
        <div v-if="addingStudent && !excelImportOpen" class="add-student-row">
          <input
            v-model="newFirstname"
            class="detail-input student-input"
            placeholder="Prénom"
            autofocus
            @keyup.enter="addStudent"
            @keyup.escape="addingStudent = false"
          />
          <input
            v-model="newLastname"
            class="detail-input student-input"
            placeholder="Nom"
            @keyup.enter="addStudent"
            @keyup.escape="addingStudent = false"
          />
          <button class="btn-icon" title="Ajouter" @click="addStudent">
            <Check :size="15" />
          </button>
          <button
            class="btn-icon"
            title="Annuler"
            @click="addingStudent = false"
          >
            <X :size="15" />
          </button>
        </div>

        <div class="add-actions">
          <button
            v-if="!addingStudent && !excelImportOpen"
            class="btn btn-add"
            @click="addingStudent = true"
          >
            <Plus :size="16" /> Ajouter un élève
          </button>
          <button
            v-if="!excelImportOpen"
            class="btn btn-excel"
            title="Importer depuis Excel (copier-coller)"
            @click="handleExcelImport"
          >
            <Upload :size="16" /> Importer d'Excel
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.class-detail {
  padding: 0 0 1rem;
  color: var(--text-light);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem 0.75rem;
  border-bottom: 1px solid rgba(255, 200, 80, 0.08);
  margin-bottom: 0.5rem;
}

.back-btn {
  background: rgba(0, 119, 254, 0.08);
  border: none;
  color: var(--text-light);
  opacity: 0.6;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.back-btn:hover {
  background: rgba(0, 119, 254, 0.18);
  color: var(--text-light);
  opacity: 0.85;
}

.detail-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-light);
}

.detail-loading {
  padding: 2rem;
  text-align: center;
  color: var(--text-light);
  opacity: 0.55;
  font-style: italic;
}

.detail-section {
  padding: 0.75rem 1rem;
}

.detail-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-light);
  opacity: 0.55;
  margin-bottom: 0.5rem;
}

.student-count {
  font-weight: 400;
  font-size: 0.8rem;
  margin-left: 0.3rem;
}

.class-name-row {
  display: flex;
  gap: 0.5rem;
}

.detail-input {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  border: 1.5px solid rgba(255, 215, 0, 0.2);
  background: rgba(33, 37, 41, 0.6);
  color: var(--text-light);
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
}
.detail-input:focus {
  border-color: var(--stadium-yellow);
  background: rgba(33, 37, 41, 0.7);
}
.detail-input::placeholder {
  color: var(--text-light);
  opacity: 0.4;
}

.student-input {
  font-size: 0.9rem;
  padding: 0.45rem 0.65rem;
}

/* ── Buttons ────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1.5px solid rgba(255, 215, 0, 0.2);
  border-radius: 10px;
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  color: var(--text-light);
  opacity: 0.7;
  background: transparent;
}
.btn:hover {
  color: var(--text-light);
  opacity: 0.9;
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.4);
}

.btn-delete-class {
  border-color: rgba(255, 75, 75, 0.3);
  color: rgba(255, 75, 75, 0.7);
  padding: 0.45rem 0.65rem;
}
.btn-delete-class:hover {
  background: rgba(255, 75, 75, 0.18);
  border-color: rgba(255, 75, 75, 0.5);
  color: var(--track-red);
}

.btn-save-class {
  margin-top: 0.5rem;
  width: 100%;
  border-color: rgba(255, 215, 0, 0.3);
  background: rgba(255, 215, 0, 0.1);
  color: var(--text-light);
  opacity: 0.8;
}
.btn-save-class:hover {
  background: rgba(255, 215, 0, 0.25);
  border-color: var(--stadium-yellow);
  color: var(--text-light);
  opacity: 1;
}

.btn-add {
  border-style: dashed;
}
.btn-excel {
  border-color: rgba(80, 200, 120, 0.3);
  color: rgba(100, 200, 130, 0.7);
}
.btn-excel:hover {
  background: rgba(80, 200, 120, 0.15);
  border-color: rgba(80, 200, 120, 0.5);
  color: #80d8a0;
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
.btn-icon--delete:hover {
  color: var(--track-red);
  opacity: 0.8;
  background: rgba(255, 75, 75, 0.18);
}

/* ── Students list ──────────────────────────────────── */
.students-list {
  margin-bottom: 0.75rem;
}

.student-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  background: rgba(0, 119, 254, 0.04);
  margin-bottom: 0.25rem;
  transition: background 0.15s;
}
.student-row:hover {
  background: rgba(0, 119, 254, 0.08);
}

.student-name {
  flex: 1;
  font-size: 0.95rem;
  color: var(--text-light);
}

.students-empty {
  padding: 1.25rem;
  text-align: center;
  color: var(--text-light);
  opacity: 0.45;
  font-style: italic;
  font-size: 0.9rem;
}

.add-student-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0;
}

.add-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

/* ── Excel import ───────────────────────────────────── */
.excel-import-section {
  margin-bottom: 0.75rem;
}

.excel-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  border: 1.5px solid rgba(80, 200, 120, 0.25);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 0.9rem;
  font-family: inherit;
  line-height: 1.5;
  outline: none;
  resize: vertical;
  transition: all 0.2s;
}
.excel-textarea:focus {
  border-color: rgba(80, 200, 120, 0.6);
  background: rgba(30, 16, 3, 0.7);
}
.excel-textarea::placeholder {
  color: var(--text-light);
  opacity: 0.35;
}

.excel-preview {
  margin-top: 0.6rem;
}

.excel-preview-label {
  display: block;
  font-size: 0.75rem;
  color: rgba(100, 200, 130, 0.7);
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.excel-preview-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.excel-preview-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
  background: rgba(80, 200, 120, 0.06);
  font-size: 0.85rem;
}

.excel-preview-name {
  color: var(--text-light);
  opacity: 0.85;
  font-weight: 500;
}

.excel-preview-extra {
  color: var(--text-light);
  opacity: 0.45;
  font-size: 0.75rem;
  font-style: italic;
}

.excel-preview-empty {
  margin-top: 0.5rem;
  padding: 0.6rem;
  text-align: center;
  color: var(--text-light);
  opacity: 0.45;
  font-size: 0.82rem;
  font-style: italic;
}

.excel-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.btn-excel-confirm {
  border-color: rgba(80, 200, 120, 0.35);
  color: rgba(100, 200, 130, 0.8);
  background: rgba(80, 200, 120, 0.08);
}
.btn-excel-confirm:hover {
  background: rgba(80, 200, 120, 0.2);
  border-color: rgba(80, 200, 120, 0.6);
  color: #80d8a0;
}

.btn-excel-cancel {
  border-color: rgba(255, 200, 80, 0.15);
  color: var(--text-light);
  opacity: 0.55;
}
.btn-excel-cancel:hover {
  background: rgba(255, 80, 60, 0.15);
  border-color: rgba(255, 80, 60, 0.4);
  color: var(--track-red);
  opacity: 0.8;
}

/* ── Column mapping ─────────────────────────────────── */
.column-mapping {
  margin-top: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: rgba(80, 200, 120, 0.04);
  border: 1px solid rgba(80, 200, 120, 0.12);
}

.mapping-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}
.mapping-row:last-child {
  margin-bottom: 0;
}

.mapping-label {
  font-size: 0.8rem;
  color: var(--text-light);
  opacity: 0.6;
  min-width: 100px;
  flex-shrink: 0;
}

.mapping-select {
  flex: 1;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  border: 1.5px solid rgba(80, 200, 120, 0.2);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 0.82rem;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}
.mapping-select:focus {
  border-color: rgba(80, 200, 120, 0.5);
}
.mapping-select option {
  background: #1a0e04;
  color: var(--text-light);
}
</style>
