<script setup>
import { computed, ref } from "vue";
import { ArrowLeft, Upload, X } from "@lucide/vue";
import { supabase } from "../supabase";

const emit = defineEmits(["close", "imported"]);

const rawText = ref("");
const loading = ref(false);
const errorMessage = ref("");
const step = ref("paste");
const columnMap = ref({ group: 0, name: 1, gender: 2, birthDate: 3 });

const headers = computed(() => {
  const firstRow = rows.value[0] || [];
  return firstRow.map((value, index) => value || `Colonne ${index + 1}`);
});

const rows = computed(() => {
  const lines = rawText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) =>
    delimiter ? line.split(delimiter).map((cell) => cell.trim()) : [line],
  );
});

const dataRows = computed(() => {
  if (rows.value.length === 0) return [];
  const first = rows.value[0].map(normalizeHeader).join(" ");
  const hasHeader =
    first.includes("groupe") ||
    first.includes("nom") ||
    first.includes("prenom");
  return rows.value.slice(hasHeader ? 1 : 0);
});

const parsedStudents = computed(() =>
  dataRows.value
    .map((row) => {
      const fullName = row[columnMap.value.name] || "";
      const nameParts = fullName.split(",").map((part) => part.trim());
      const lastname = nameParts.length > 1 ? nameParts[0] : "";
      const firstname =
        nameParts.length > 1 ? nameParts.slice(1).join(", ") : fullName;
      return {
        group: (row[columnMap.value.group] || "").trim(),
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        gender: normalizeGender(row[columnMap.value.gender]),
        birthDate: parseDate(row[columnMap.value.birthDate]),
      };
    })
    .filter(
      (student) => student.group && (student.firstname || student.lastname),
    ),
);

const previewRows = computed(() => parsedStudents.value.slice(0, 100));
const groupCount = computed(
  () => new Set(parsedStudents.value.map((student) => student.group)).size,
);

function detectDelimiter(line) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  if (line.includes(",")) return ",";
  return null;
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function normalizeGender(value) {
  const gender = String(value || "")
    .trim()
    .toUpperCase();
  return gender === "M" || gender === "F" ? gender : null;
}

function parseDate(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  if (/^\d+(\.\d+)?$/.test(input)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(input) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  return null;
}

function close() {
  if (loading.value) return;
  rawText.value = "";
  errorMessage.value = "";
  step.value = "paste";
  emit("close");
}

function openVerification() {
  errorMessage.value = "";
  if (parsedStudents.value.length === 0) {
    errorMessage.value = "Aucun élève valide détecté.";
    return;
  }
  step.value = "verify";
}

function backToPaste() {
  if (loading.value) return;
  errorMessage.value = "";
  step.value = "paste";
}

async function importStudents() {
  if (parsedStudents.value.length === 0 || loading.value) return;
  loading.value = true;
  errorMessage.value = "";

  try {
    const { data: existingClasses, error: classLoadError } = await supabase
      .from("tu_classes")
      .select("id, name");
    if (classLoadError) throw classLoadError;

    const classByName = new Map(
      (existingClasses || []).map((cls) => [String(cls.name).trim(), cls]),
    );
    const groups = [
      ...new Set(parsedStudents.value.map((student) => student.group)),
    ];
    const missingGroups = groups.filter((group) => !classByName.has(group));

    if (missingGroups.length > 0) {
      const { data: createdClasses, error: classInsertError } = await supabase
        .from("tu_classes")
        .insert(missingGroups.map((name) => ({ name })))
        .select("id, name");
      if (classInsertError) throw classInsertError;
      for (const cls of createdClasses || [])
        classByName.set(String(cls.name).trim(), cls);
    }

    const studentsToInsert = parsedStudents.value.map((student) => ({
      firstname: student.firstname,
      lastname: student.lastname,
      gender: student.gender,
      birth_date: student.birthDate,
      class_id: classByName.get(student.group)?.id,
    }));
    const { error: studentInsertError } = await supabase
      .from("tu_students")
      .insert(studentsToInsert);
    if (studentInsertError) throw studentInsertError;

    rawText.value = "";
    step.value = "paste";
    emit("imported");
  } catch (error) {
    const details = [error?.message, error?.details, error?.hint, error?.code]
      .filter(Boolean)
      .join(" | ");
    console.error("Student import failed:", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    errorMessage.value = details || "Erreur lors de l'import. Réessayez.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="student-import-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="student-import-title"
  >
    <section class="student-import-modal">
      <div class="student-import-header">
        <div>
          <h2 id="student-import-title">
            {{ step === "paste" ? "Coller les élèves" : "Vérifier l'import" }}
          </h2>
        </div>
        <button
          class="student-import-icon-button"
          title="Fermer"
          @click="close"
        >
          <X :size="24" />
        </button>
      </div>

      <div v-if="step === 'paste'" class="student-import-paste-step">
        <label class="student-import-label" for="student-import-text"
          >Collez les lignes copiées depuis Excel</label
        >
        <textarea
          id="student-import-text"
          v-model="rawText"
          class="student-import-textarea"
          autofocus
          placeholder="Groupe\tNom de l'élève\tSexe\tDate de naissance"
        ></textarea>
      </div>

      <div v-else class="student-import-verify-step">
        <div class="student-import-mapping">
          <div
            v-for="field in [
              { key: 'group', label: 'Groupe' },
              { key: 'name', label: 'Nom de l\'élève' },
              { key: 'gender', label: 'Sexe' },
              { key: 'birthDate', label: 'Date de naissance' },
            ]"
            :key="field.key"
            class="student-import-field"
          >
            <label :for="`import-${field.key}`">{{ field.label }}</label>
            <select
              :id="`import-${field.key}`"
              v-model.number="columnMap[field.key]"
            >
              <option
                v-for="(header, index) in headers"
                :key="index"
                :value="index"
              >
                {{ header }}
              </option>
              <option :value="-1">Ignorer</option>
            </select>
          </div>
        </div>

        <div v-if="previewRows.length > 0" class="student-import-preview">
          <div class="student-import-summary">
            {{ parsedStudents.length }} élève(s), {{ groupCount }} classe(s)
          </div>
          <div class="student-import-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Groupe</th>
                  <th>Nom de l'élève</th>
                  <th>Sexe</th>
                  <th>Date de naissance</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(student, index) in previewRows" :key="index">
                  <td>{{ student.group }}</td>
                  <td>{{ student.firstname }} {{ student.lastname }}</td>
                  <td>{{ student.gender || "-" }}</td>
                  <td>{{ student.birthDate || "-" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p v-if="errorMessage" class="student-import-error">{{ errorMessage }}</p>

      <div class="student-import-actions">
        <button
          v-if="step === 'verify'"
          class="student-import-back"
          :disabled="loading"
          @click="backToPaste"
        >
          <ArrowLeft :size="18" /> Retour
        </button>
        <button
          v-else
          class="student-import-cancel"
          :disabled="loading"
          @click="close"
        >
          Annuler
        </button>
        <button
          v-if="step === 'paste'"
          class="student-import-submit"
          :disabled="loading || !rawText.trim()"
          @click="openVerification"
        >
          Vérifier
        </button>
        <button
          v-else
          class="student-import-submit"
          :disabled="loading || parsedStudents.length === 0"
          @click="importStudents"
        >
          <Upload :size="18" />{{ loading ? "Import…" : "Importer" }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.student-import-backdrop {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(10, 20, 30, 0.72);
}
.student-import-modal {
  box-sizing: border-box;
  width: 80%;
  height: 80%;
  max-width: 1100px;
  max-height: 80%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 1.4rem;
  /* border: 1px solid rgba(255, 255, 255, 0.2); */
  border-radius: 16px;
  background: #ffffff;
  color: #333;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
}
.student-import-header,
.student-import-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.student-import-header {
  flex: 0 0 auto;
  margin-bottom: 1rem;
}
.student-import-kicker {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.65;
}
.student-import-modal h2 {
  margin: 0.2rem 0 0;
  font-size: 1.45rem;
}
.student-import-icon-button,
.student-import-cancel,
.student-import-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 0;
  border-radius: 9px;
  padding: 0.65rem 0.9rem;
  color: var(--text-light);
  font: inherit;
  cursor: pointer;
}
.student-import-icon-button {
  padding: 0.45rem;
  background: rgba(255, 255, 255, 0.1);
}
.student-import-label,
.student-import-field label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
}
.student-import-textarea,
.student-import-field select {
  box-sizing: border-box;
  width: 100%;
  border: none;
  /* border: 1px solid rgba(255, 255, 255, 0.2); */
  border-radius: 9px;
  background: rgba(10, 20, 30, 0.2);
  color: #333;
  font: inherit;
}
.student-import-textarea {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  padding: 0.75rem;
  overflow-y: auto;
  resize: none;
  line-height: 1.45;
}
.student-import-paste-step,
.student-import-verify-step {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.student-import-paste-step .student-import-label {
  flex: 0 0 auto;
}
.student-import-mapping {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.55rem;
  margin-top: 0.9rem;
}
.student-import-field select {
  padding: 0.5rem;
  font-size: 0.8rem;
}
.student-import-preview {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-top: 1rem;
}
.student-import-summary {
  margin-bottom: 0.45rem;
  font-size: 0.82rem;
  font-weight: 700;
}
.student-import-table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
}
.student-import-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
  background: #ddd;
}
.student-import-table-wrap th,
.student-import-table-wrap td {
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: left;
}
.student-import-table-wrap th {
  position: sticky;
  top: 0;
  background: #ddd;
}
.student-import-empty,
.student-import-error {
  font-size: 0.82rem;
  opacity: 0.8;
}
.student-import-error {
  color: #ffb4a2;
}
.student-import-actions {
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-top: 1rem;
}
.student-import-cancel {
  background: rgba(255, 255, 255, 0.08);
}
.student-import-submit {
  background: var(--stadium-yellow);
  color: #1a0e04;
  font-weight: 700;
}
.student-import-submit:disabled,
.student-import-cancel:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
@media (max-width: 700px) {
  .student-import-modal {
    width: 94%;
    height: 88%;
    max-height: 88%;
  }

  .student-import-mapping {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
