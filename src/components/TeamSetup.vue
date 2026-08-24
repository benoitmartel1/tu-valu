<script setup>
import { ref, computed } from "vue";
import { supabase } from "../supabase";

const props = defineProps({
  students: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["done", "cancel"]);

// Team generation settings
const teamMode = ref("count"); // 'count' (number of teams) or 'size' (students per team)
const teamCount = ref(4);
const teamSize = ref(5);
const separationMethod = ref("random"); // 'random', 'strength', 'gender'

// Generated teams preview
const generatedTeams = ref([]);
const saving = ref(false);
const error = ref(null);

// Calculate student strength based on existing evaluations
async function calculateStudentStrength(studentId) {
  const { data: events } = await supabase
    .from("tu_session_events")
    .select("level")
    .eq("student_id", studentId);

  if (!events || events.length === 0) return 0;

  const levels = events
    .map((e) => parseFloat(e.level))
    .filter((l) => !isNaN(l));
  if (levels.length === 0) return 0;

  return levels.reduce((sum, l) => sum + l, 0) / levels.length;
}

// Generate teams based on settings
async function generateTeams() {
  error.value = null;

  if (props.students.length === 0) {
    error.value = "No students available to create teams.";
    return;
  }

  const numTeams =
    teamMode.value === "count"
      ? teamCount.value
      : Math.ceil(props.students.length / teamSize.value);

  if (numTeams <= 0) {
    error.value = "Invalid team configuration.";
    return;
  }

  // Prepare students with additional data
  let studentsWithInfo = [...props.students];

  if (separationMethod.value === "strength") {
    // Calculate strength for each student
    const strengths = await Promise.all(
      studentsWithInfo.map(async (s) => ({
        ...s,
        strength: await calculateStudentStrength(s.id),
      })),
    );
    // Sort by strength descending
    studentsWithInfo = strengths.sort((a, b) => b.strength - a.strength);
  } else if (separationMethod.value === "gender") {
    // Group by gender first
    const males = studentsWithInfo.filter((s) => s.gender === "male");
    const females = studentsWithInfo.filter((s) => s.gender === "female");
    const others = studentsWithInfo.filter(
      (s) => s.gender !== "male" && s.gender !== "female",
    );
    // Interleave genders
    studentsWithInfo = [];
    const maxLen = Math.max(males.length, females.length, others.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < males.length) studentsWithInfo.push(males[i]);
      if (i < females.length) studentsWithInfo.push(females[i]);
      if (i < others.length) studentsWithInfo.push(others[i]);
    }
  } else {
    // Random shuffle
    studentsWithInfo = studentsWithInfo.sort(() => Math.random() - 0.5);
  }

  // Distribute students into teams
  const teams = Array.from({ length: numTeams }, (_, i) => ({
    id: `temp-${i}`,
    name: `Équipe ${i + 1}`,
    students: [],
  }));

  studentsWithInfo.forEach((student, index) => {
    const teamIndex = index % numTeams;
    teams[teamIndex].students.push(student);
  });

  generatedTeams.value = teams;
}

// Drag and drop state
const dragState = ref(null);

function handleDragStart(event, student, fromTeamIndex) {
  dragState.value = { student, fromTeamIndex };
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleDrop(event, toTeamIndex) {
  event.preventDefault();
  if (!dragState.value) return;

  const { student, fromTeamIndex } = dragState.value;

  // Remove from source team
  const fromTeam = generatedTeams.value[fromTeamIndex];
  const studentIndex = fromTeam.students.findIndex((s) => s.id === student.id);
  if (studentIndex !== -1) {
    fromTeam.students.splice(studentIndex, 1);
  }

  // Add to target team
  const toTeam = generatedTeams.value[toTeamIndex];
  toTeam.students.push(student);

  dragState.value = null;
}

function updateTeamName(teamIndex, newName) {
  generatedTeams.value[teamIndex].name = newName;
}

// Save teams to database
async function applyTeams() {
  if (generatedTeams.value.length === 0) {
    error.value = "Generate teams first before applying.";
    return;
  }

  saving.value = true;
  error.value = null;

  try {
    // Get current user ID
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Create teams in database
    const teamRecords = [];
    for (const team of generatedTeams.value) {
      const { data: teamData, error: teamError } = await supabase
        .from("tu_teams")
        .insert({
          name: team.name,
          user_id: user.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;
      teamRecords.push({ tempId: team.id, realId: teamData.id });
    }

    // Create student-team relationships
    for (const team of generatedTeams.value) {
      const teamRecord = teamRecords.find((t) => t.tempId === team.id);
      if (!teamRecord) continue;

      const relationships = team.students.map((student) => ({
        student_id: student.id,
        team_id: teamRecord.realId,
      }));

      if (relationships.length > 0) {
        const { error: relError } = await supabase
          .from("tu_student_teams")
          .insert(relationships);

        if (relError) throw relError;
      }
    }

    emit("done", generatedTeams.value);
  } catch (e) {
    error.value = e.message;
    console.error("Failed to save teams:", e);
  } finally {
    saving.value = false;
  }
}

function cancel() {
  emit("cancel");
}
</script>

<template>
  <div class="team-setup">
    <h2>Créer des équipes</h2>

    <!-- Settings Section -->
    <div class="settings-section">
      <div class="setting-group">
        <label class="setting-label">Mode de création</label>
        <div class="radio-group">
          <label class="radio-option">
            <input
              type="radio"
              v-model="teamMode"
              value="count"
              @change="generateTeams"
            />
            Nombre d'équipes
          </label>
          <label class="radio-option">
            <input
              type="radio"
              v-model="teamMode"
              value="size"
              @change="generateTeams"
            />
            Taille des équipes
          </label>
        </div>

        <div v-if="teamMode === 'count'" class="number-input">
          <label>Nombre d'équipes:</label>
          <input
            type="number"
            v-model.number="teamCount"
            min="2"
            :max="students.length"
            @change="generateTeams"
          />
        </div>
        <div v-else class="number-input">
          <label>Élèves par équipe:</label>
          <input
            type="number"
            v-model.number="teamSize"
            min="2"
            :max="students.length"
            @change="generateTeams"
          />
        </div>
      </div>

      <div class="setting-group">
        <label class="setting-label">Méthode de séparation</label>
        <div class="radio-group">
          <label class="radio-option">
            <input
              type="radio"
              v-model="separationMethod"
              value="random"
              @change="generateTeams"
            />
            Aléatoire
          </label>
          <label class="radio-option">
            <input
              type="radio"
              v-model="separationMethod"
              value="strength"
              @change="generateTeams"
            />
            Par niveau
          </label>
          <label class="radio-option">
            <input
              type="radio"
              v-model="separationMethod"
              value="gender"
              @change="generateTeams"
            />
            Par genre
          </label>
        </div>
      </div>

      <button class="generate-btn" @click="generateTeams">
        Générer les équipes
      </button>
    </div>

    <!-- Preview Section -->
    <div v-if="generatedTeams.length > 0" class="preview-section">
      <h3>Aperçu des équipes</h3>
      <p class="preview-hint">
        Glissez-déposez les élèves pour réorganiser les équipes
      </p>

      <div class="teams-grid">
        <div
          v-for="(team, teamIndex) in generatedTeams"
          :key="team.id"
          class="team-card"
          @dragover="handleDragOver"
          @drop="handleDrop($event, teamIndex)"
        >
          <div class="team-header">
            <input
              v-model="team.name"
              @input="updateTeamName(teamIndex, team.name)"
              class="team-name-input"
              placeholder="Nom de l'équipe"
            />
            <span class="team-count">{{ team.students.length }} élèves</span>
          </div>

          <div class="team-students">
            <div
              v-for="student in team.students"
              :key="student.id"
              class="student-pill"
              draggable="true"
              @dragstart="handleDragStart($event, student, teamIndex)"
            >
              {{ student.firstname }} {{ student.lastname }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="students.length === 0" class="empty-state">
      <p>Aucun élève disponible. Ajoutez des élèves à une classe d'abord.</p>
    </div>
    <div v-else class="empty-state">
      <p>Cliquez sur "Générer les équipes" pour créer les équipes.</p>
    </div>

    <!-- Error Message -->
    <p v-if="error" class="error">{{ error }}</p>

    <!-- Action Buttons -->
    <div class="actions">
      <button class="cancel-btn" @click="cancel">Annuler</button>
      <button
        class="apply-btn"
        :disabled="saving || generatedTeams.length === 0"
        @click="applyTeams"
      >
        {{ saving ? "Enregistrement..." : "Appliquer les équipes" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.team-setup {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: sans-serif;
}

h2 {
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
  color: var(--text-light);
}

h3 {
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  color: var(--text-light);
}

/* Settings Section */
.settings-section {
  background: rgba(20, 10, 2, 0.4);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.setting-group {
  margin-bottom: 1.25rem;
}

.setting-label {
  display: block;
  font-weight: 600;
  color: var(--text-light);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.radio-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-light);
  cursor: pointer;
  font-size: 0.9rem;
}

.radio-option input[type="radio"] {
  cursor: pointer;
}

.number-input {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.number-input label {
  color: var(--text-light);
  font-size: 0.9rem;
}

.number-input input {
  width: 80px;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 200, 80, 0.3);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 0.9rem;
}

.generate-btn {
  width: 100%;
  padding: 0.75rem;
  background: #457b9d;
  color: var(--text-light);
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.generate-btn:hover {
  opacity: 0.9;
}

/* Preview Section */
.preview-section {
  margin-bottom: 1.5rem;
}

.preview-hint {
  color: var(--text-light);
  opacity: 0.6;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  font-style: italic;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.team-card {
  background: rgba(20, 10, 2, 0.5);
  border: 2px dashed rgba(255, 200, 80, 0.2);
  border-radius: 12px;
  padding: 1rem;
  transition: border-color 0.2s;
}

.team-card:hover {
  border-color: rgba(255, 200, 80, 0.4);
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  gap: 0.5rem;
}

.team-name-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 200, 80, 0.3);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 0.9rem;
  font-weight: 600;
}

.team-count {
  font-size: 0.8rem;
  color: var(--text-light);
  opacity: 0.6;
  white-space: nowrap;
}

.team-students {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 60px;
}

.student-pill {
  padding: 0.5rem 0.75rem;
  background: #a8dadc42;
  border-radius: 999px;
  color: var(--text-light);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: grab;
  transition: background 0.15s;
}

.student-pill:hover {
  background: #a8dadc80;
}

.student-pill:active {
  cursor: grabbing;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-light);
  opacity: 0.6;
  font-style: italic;
}

/* Error */
.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

/* Actions */
.actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.cancel-btn,
.apply-btn {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.cancel-btn {
  background: transparent;
  border: 1.5px solid rgba(255, 200, 80, 0.25);
  color: var(--text-light);
}

.cancel-btn:hover {
  background: rgba(255, 80, 60, 0.2);
  border-color: rgba(255, 100, 80, 0.5);
}

.apply-btn {
  background: #457b9d;
  border: none;
  color: var(--text-light);
}

.apply-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
