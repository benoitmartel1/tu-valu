<script setup>
import { ref, computed, onMounted } from "vue";
import { supabase } from "../supabase";
import { Shuffle } from "@lucide/vue";
import RangeInput from "./RangeInput.vue";
import "../styles/shared.css";

const props = defineProps({
  students: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["done", "cancel"]);

// Team generation settings
const teamMode = ref("count"); // 'count' (number of teams) or 'size' (students per team)
const teamCount = ref(3);
const teamSize = ref(5);
const separationMethod = ref("random"); // 'random', 'strength', 'gender'
const genderGrouping = ref("separate"); // 'separate' (group together) or 'mix' (blend genders)

// Team colors palette - basic sports jersey colors
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

// Animal names and qualities for team naming
const animalNames = [
  "Faucons",
  "Serpents",
  "Loups",
  "Aigles",
  "Tigres",
  "Lions",
  "Ours",
  "Renards",
  "Panthères",
  "Requins",
  "Hiboux",
  "Cerfs",
  "Vautours",
  "Jaguars",
  "Corbeaux",
];

const qualities = [
  "audacieux",
  "agiles",
  "féroces",
  "rapides",
  "puissants",
  "rusés",
  "courageux",
  "vigilants",
  "intrépides",
  "majestueux",
  "déterminés",
  "sauvages",
  "stratégiques",
  "invincibles",
  "redoutables",
];

function generateRandomTeamName() {
  const animal = animalNames[Math.floor(Math.random() * animalNames.length)];
  const quality = qualities[Math.floor(Math.random() * qualities.length)];
  return `${animal} ${quality}`;
}

// Generated teams preview
const generatedTeams = ref([]);
const saving = ref(false);
const error = ref(null);
const showColorPicker = ref(null); // Track which team's color picker is open

// Unassigned students (dropped in empty space)
const unassignedStudents = ref([]);

// Generate teams automatically on mount
onMounted(() => {
  if (props.students.length > 0) {
    generateTeams();
  }
});

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

  // Get IDs of unassigned students to exclude them from team generation
  const unassignedIds = new Set(unassignedStudents.value.map((s) => s.id));

  const numTeams =
    teamMode.value === "count"
      ? teamCount.value
      : Math.ceil(props.students.length / teamSize.value);

  if (numTeams <= 0) {
    error.value = "Invalid team configuration.";
    return;
  }

  // Prepare students with additional data, excluding unassigned ones
  let studentsWithInfo = props.students.filter((s) => !unassignedIds.has(s.id));

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
    const males = studentsWithInfo.filter((s) => s.gender === "M");
    const females = studentsWithInfo.filter((s) => s.gender === "F");
    const others = studentsWithInfo.filter(
      (s) => s.gender !== "M" && s.gender !== "F",
    );

    if (genderGrouping.value === "separate") {
      // Group genders together: all males, then all females, then others
      studentsWithInfo = [...males, ...females, ...others];
    } else {
      // Mix genders: keep them separate for now, will distribute evenly in distribution phase
      // Don't concatenate - we'll handle distribution separately
      studentsWithInfo = []; // Will be handled in distribution logic
    }
  } else {
    // Random shuffle
    studentsWithInfo = studentsWithInfo.sort(() => Math.random() - 0.5);
  }

  // Distribute students into teams with random animal names
  const teams = Array.from({ length: numTeams }, (_, i) => ({
    id: `temp-${i}`,
    name: generateRandomTeamName(),
    students: [],
  }));

  // Distribution strategy based on separation method
  if (
    separationMethod.value === "gender" &&
    genderGrouping.value === "separate"
  ) {
    // For gender separate mode: each team must contain ONLY one gender
    // Strategy: assign entire teams to specific genders

    // Get unassigned student IDs to exclude them
    const unassignedIds = new Set(unassignedStudents.value.map((s) => s.id));

    // Separate by gender, excluding unassigned students
    const males = props.students.filter(
      (s) => s.gender === "M" && !unassignedIds.has(s.id),
    );
    const females = props.students.filter(
      (s) => s.gender === "F" && !unassignedIds.has(s.id),
    );
    const others = props.students.filter(
      (s) => s.gender !== "M" && s.gender !== "F" && !unassignedIds.has(s.id),
    );

    // Shuffle each gender group for randomness
    const shuffledMales = males.sort(() => Math.random() - 0.5);
    const shuffledFemales = females.sort(() => Math.random() - 0.5);
    const shuffledOthers = others.sort(() => Math.random() - 0.5);

    // Create gender groups with their counts
    const genderGroups = [];
    if (shuffledMales.length > 0)
      genderGroups.push({ gender: "M", students: shuffledMales });
    if (shuffledFemales.length > 0)
      genderGroups.push({ gender: "F", students: shuffledFemales });
    if (shuffledOthers.length > 0)
      genderGroups.push({ gender: "O", students: shuffledOthers });

    // Sort by count descending (most numerous first)
    genderGroups.sort((a, b) => b.students.length - a.students.length);

    // Assign teams to genders
    // If we have more teams than gender groups, distribute extra teams to larger groups
    let teamIndex = 0;

    // First pass: give at least one team to each gender group
    for (const group of genderGroups) {
      if (teamIndex < numTeams) {
        // Calculate how many teams this gender should get
        // Proportional to their count
        const remainingTeams = numTeams - teamIndex;
        const remainingGroups =
          genderGroups.length - genderGroups.indexOf(group);

        // Give this group teams proportional to their size
        const totalRemainingStudents = genderGroups
          .slice(genderGroups.indexOf(group))
          .reduce((sum, g) => sum + g.students.length, 0);

        let teamsForThisGender = Math.max(
          1,
          Math.round(
            (group.students.length / totalRemainingStudents) * remainingTeams,
          ),
        );

        // Ensure we don't exceed remaining teams
        teamsForThisGender = Math.min(teamsForThisGender, remainingTeams);

        // Distribute students across assigned teams
        const studentsPerTeam = Math.ceil(
          group.students.length / teamsForThisGender,
        );

        for (let t = 0; t < teamsForThisGender && teamIndex < numTeams; t++) {
          const startIdx = t * studentsPerTeam;
          const endIdx = Math.min(
            startIdx + studentsPerTeam,
            group.students.length,
          );
          const teamStudents = group.students.slice(startIdx, endIdx);

          if (teamStudents.length > 0) {
            teams[teamIndex].students = teamStudents;
            teamIndex++;
          }
        }
      }
    }

    // If there are still empty teams (shouldn't happen normally), leave them empty
  } else if (
    separationMethod.value === "gender" &&
    genderGrouping.value === "mix"
  ) {
    // For gender mix mode: distribute genders to create balanced team sizes
    const unassignedIds = new Set(unassignedStudents.value.map((s) => s.id));

    const males = props.students.filter(
      (s) => s.gender === "M" && !unassignedIds.has(s.id),
    );
    const females = props.students.filter(
      (s) => s.gender === "F" && !unassignedIds.has(s.id),
    );
    const others = props.students.filter(
      (s) => s.gender !== "M" && s.gender !== "F" && !unassignedIds.has(s.id),
    );

    // Shuffle each gender group for randomness
    const shuffledMales = males.sort(() => Math.random() - 0.5);
    const shuffledFemales = females.sort(() => Math.random() - 0.5);
    const shuffledOthers = others.sort(() => Math.random() - 0.5);

    // Distribute each gender by always adding to the smallest team
    function distributeToSmallestTeams(students) {
      students.forEach((student) => {
        // Find the team with the fewest students
        let smallestTeamIndex = 0;
        let smallestSize = teams[0].students.length;

        for (let i = 1; i < numTeams; i++) {
          if (teams[i].students.length < smallestSize) {
            smallestSize = teams[i].students.length;
            smallestTeamIndex = i;
          }
        }

        teams[smallestTeamIndex].students.push(student);
      });
    }

    // Distribute each gender group
    distributeToSmallestTeams(shuffledMales);
    distributeToSmallestTeams(shuffledFemales);
    distributeToSmallestTeams(shuffledOthers);
  } else {
    // For all other modes (random, strength): distribute round-robin for even spread
    studentsWithInfo.forEach((student, index) => {
      const teamIndex = index % numTeams;
      teams[teamIndex].students.push(student);
    });
  }

  generatedTeams.value = teams;
}

// Drag and drop state
const dragState = ref(null);
const isDraggingOverEmptySpace = ref(false);

function handleDragStart(event, student, fromTeamIndex) {
  dragState.value = { student, fromTeamIndex };
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleDragEnterEmptySpace(event) {
  isDraggingOverEmptySpace.value = true;
}

function handleDragLeaveEmptySpace(event) {
  // Only set to false if we're actually leaving the teams-column
  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDraggingOverEmptySpace.value = false;
  }
}

function handleDrop(event, toTeamIndex) {
  event.preventDefault();
  if (!dragState.value) return;

  const { student, fromTeamIndex } = dragState.value;

  // Remove from source team or unassigned list
  if (fromTeamIndex === -1) {
    // Student was in unassigned list
    const studentIndex = unassignedStudents.value.findIndex(
      (s) => s.id === student.id,
    );
    if (studentIndex !== -1) {
      unassignedStudents.value.splice(studentIndex, 1);
    }
  } else {
    // Student was in a team
    const fromTeam = generatedTeams.value[fromTeamIndex];
    const studentIndex = fromTeam.students.findIndex(
      (s) => s.id === student.id,
    );
    if (studentIndex !== -1) {
      fromTeam.students.splice(studentIndex, 1);
    }
  }

  // Add to target team
  const toTeam = generatedTeams.value[toTeamIndex];
  toTeam.students.push(student);

  dragState.value = null;
}

function handleDropToEmptySpace(event) {
  event.preventDefault();
  isDraggingOverEmptySpace.value = false;

  if (!dragState.value) return;

  const { student, fromTeamIndex } = dragState.value;

  // Remove from source team or unassigned list
  if (fromTeamIndex === -1) {
    // Already unassigned, just update position
    const studentIndex = unassignedStudents.value.findIndex(
      (s) => s.id === student.id,
    );
    if (studentIndex !== -1) {
      unassignedStudents.value[studentIndex].x = event.offsetX;
      unassignedStudents.value[studentIndex].y = event.offsetY;
    }
  } else {
    // Remove from team and add to unassigned
    const fromTeam = generatedTeams.value[fromTeamIndex];
    const studentIndex = fromTeam.students.findIndex(
      (s) => s.id === student.id,
    );
    if (studentIndex !== -1) {
      fromTeam.students.splice(studentIndex, 1);
    }

    // Add to unassigned with position
    unassignedStudents.value.push({
      ...student,
      x: event.offsetX,
      y: event.offsetY,
    });
  }

  dragState.value = null;
}

function updateTeamName(teamIndex, newName) {
  generatedTeams.value[teamIndex].name = newName;
}

// Reshuffle teams with current settings (random assignment while respecting constraints)
async function reshuffleTeams() {
  if (generatedTeams.value.length === 0) return;

  // Save current team names
  const teamNames = generatedTeams.value.map((t) => t.name);

  // Regenerate teams with current settings (this will shuffle and redistribute)
  await generateTeams();

  // Restore team names
  generatedTeams.value.forEach((team, index) => {
    if (teamNames[index]) {
      team.name = teamNames[index];
    }
  });
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
          color: team.color || null,
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

// Color picker functions
function toggleColorPicker(teamIndex) {
  showColorPicker.value =
    showColorPicker.value === teamIndex ? null : teamIndex;
}

function selectTeamColor(teamIndex, color) {
  generatedTeams.value[teamIndex].color = color;
  showColorPicker.value = null;
}

function getTeamColor(teamIndex) {
  return (
    generatedTeams.value[teamIndex]?.color ||
    teamColors[teamIndex % teamColors.length]
  );
}
</script>

<template>
  <div class="team-setup-container">
    <!-- 2-Column Layout -->
    <div class="team-setup-layout">
      <!-- Left Column: Settings (1/3) -->
      <div class="settings-column">
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
            <RangeInput
              v-model:value="teamCount"
              :min="2"
              :max="students.length"
              label="Nombre d'équipes:"
              @change="generateTeams"
            />
          </div>
          <div v-else class="number-input">
            <RangeInput
              v-model:value="teamSize"
              :min="2"
              :max="students.length"
              label="Élèves par équipe:"
              @change="generateTeams"
            />
          </div>
        </div>

        <div class="setting-group">
          <label class="setting-label">Distribution</label>
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
              Niveau
            </label>
            <label class="radio-option">
              <input
                type="radio"
                v-model="separationMethod"
                value="gender"
                @change="generateTeams"
              />
              Genre
            </label>
          </div>

          <!-- Gender grouping sub-options -->
          <div v-if="separationMethod === 'gender'" class="sub-options">
            <label class="sub-option-label">Regroupement</label>
            <div class="radio-group radio-group--small">
              <label class="radio-option radio-option--small">
                <input
                  type="radio"
                  v-model="genderGrouping"
                  value="separate"
                  @change="generateTeams"
                />
                Séparer les genres
              </label>
              <label class="radio-option radio-option--small">
                <input
                  type="radio"
                  v-model="genderGrouping"
                  value="mix"
                  @change="generateTeams"
                />
                Mélanger les genres
              </label>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <p v-if="error" class="error">{{ error }}</p>

        <!-- Action Buttons -->
        <div class="actions">
          <button
            class="reshuffle-btn"
            :disabled="generatedTeams.length === 0"
            @click="reshuffleTeams"
            title="Mélanger les équipes"
          >
            <Shuffle :size="20" />
          </button>
          <button
            class="apply-btn"
            :disabled="saving || generatedTeams.length === 0"
            @click="applyTeams"
          >
            {{ saving ? "Enregistrement..." : "Appliquer" }}
          </button>
        </div>
      </div>

      <!-- Right Column: Teams Preview (2/3) -->
      <div
        class="teams-column"
        :class="{ 'drag-over': isDraggingOverEmptySpace }"
        @dragover="handleDragOver"
        @drop="handleDropToEmptySpace"
        @dragenter="handleDragEnterEmptySpace"
        @dragleave="handleDragLeaveEmptySpace"
      >
        <!-- Empty State -->
        <div v-if="students.length === 0" class="empty-state">
          <p>
            Aucun élève disponible. Ajoutez des élèves à une classe d'abord.
          </p>
        </div>
        <div v-else-if="generatedTeams.length === 0" class="empty-state">
          <p>Cliquez sur "Générer les équipes" pour créer les équipes.</p>
        </div>

        <!-- Teams Grid -->
        <div v-else class="teams-grid">
          <div
            v-for="(team, teamIndex) in generatedTeams"
            :key="team.id"
            class="team-card"
            @dragover="handleDragOver"
            @drop="handleDrop($event, teamIndex)"
          >
            <div class="team-header">
              <!-- Color picker circle -->
              <div
                class="color-picker-circle"
                :style="{ backgroundColor: getTeamColor(teamIndex) }"
                @click="toggleColorPicker(teamIndex)"
                title="Changer la couleur"
              ></div>
              <input
                v-model="team.name"
                @input="updateTeamName(teamIndex, team.name)"
                class="team-name-input"
                placeholder="Nom de l'équipe"
              />

              <!-- Color picker dropdown -->
              <div
                v-if="showColorPicker === teamIndex"
                class="color-picker-dropdown"
              >
                <div
                  v-for="(color, colorIndex) in teamColors"
                  :key="colorIndex"
                  class="color-option"
                  :style="{ backgroundColor: color }"
                  @click="selectTeamColor(teamIndex, color)"
                ></div>
              </div>
              <span class="team-count">{{ team.students.length }}</span>
            </div>

            <div class="team-students">
              <div
                v-for="student in team.students"
                :key="student.id"
                class="student-pill"
                draggable="true"
                @dragstart="handleDragStart($event, student, teamIndex)"
              >
                {{ student.firstname }}
              </div>
            </div>
          </div>
        </div>

        <!-- Unassigned Students (floating pills) -->
        <div
          v-for="(student, index) in unassignedStudents"
          :key="`unassigned-${student.id}`"
          class="unassigned-student-pill"
          :style="{
            left: student.x + 'px',
            top: student.y + 'px',
          }"
          draggable="true"
          @dragstart="handleDragStart($event, student, -1)"
        >
          {{ student.firstname }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.team-setup-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 2-Column Layout */
.team-setup-layout {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
  height: 100%;
  overflow: hidden;
}

/* Left Column: Settings */
.settings-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem;
  border: 2px solid rgba(167, 165, 164, 0.4);

  border-radius: 16px;
  overflow-y: auto;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-light);
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.radio-group {
  display: flex;
  /* flex-direction: column; */
  gap: 0.5rem;
}

/* Sub-options for gender grouping */
.sub-options {
  margin-top: 0.75rem;
  padding-left: 1rem;
  border-left: 2px solid rgba(255, 200, 80, 0.2);
}

.sub-option-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-light);
  opacity: 0.6;
  margin-bottom: 0.5rem;
  display: block;
}

.radio-group--small {
  gap: 0.4rem;
}

.radio-option--small {
  padding: 6px 10px;
  font-size: 0.9rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-light);
  opacity: 0.7;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.15s;
}

.radio-option input[type="radio"] {
  display: none;
}

.radio-option:has(input:checked) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.5);
}

.number-input {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.number-input label {
  color: var(--text-light);
  font-size: 0.9rem;
  font-weight: 600;
  opacity: 0.8;
}

.custom-number-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.number-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  font-family: "Nunito", sans-serif;
  font-weight: 800;
}

.number-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.number-input-field {
  width: 80px;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  text-align: center;
  -moz-appearance: textfield;
}

.number-input-field::-webkit-outer-spin-button,
.number-input-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input input:focus {
  border-color: #e8a820;
  background: rgba(30, 16, 3, 0.7);
}

.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: auto;
}

.reshuffle-btn {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 200, 80, 0.25);
  background: transparent;
  color: var(--text-light);
  opacity: 0.7;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
}

.reshuffle-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.apply-btn {
  flex: 1;
  padding: 0.75rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  background: #457b9d;
  border: none;
  color: var(--text-light);
}

.apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Right Column: Teams */
.teams-column {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  /* padding: 1rem; */
  transition:
    background-color 0.2s,
    border-color 0.2s;
  border-radius: 16px;
  position: relative;
}

.teams-column.drag-over {
  background-color: rgba(255, 200, 80, 0.1);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-light);
  opacity: 0.6;
  font-style: italic;
  font-size: 1.1rem;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.5rem;
  align-content: start;
}

.team-card {
  background: #5f5f5f;
  /* background: rgba(20, 10, 2, 0.1); */
  /* border: 2px solid rgba(255, 200, 80, 0.2); */
  border-radius: 16px;
  padding: 1rem;
  transition: background-color 0.2s;
  /* border: 2px solid rgba(167, 165, 164, 1); */
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  gap: 0.5rem;
  position: relative;
}

.color-picker-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  outline: 2px solid rgba(255, 255, 255, 0.6);
  outline-offset: 3px;
  /* box-shadow: 0 0 3px 4px rgba(241, 241, 241, 0.2); */
}

.color-picker-dropdown {
  position: absolute;
  top: 100%;
  right: 60px;
  background: rgba(20, 10, 2, 0.95);
  border: 1.5px solid rgba(255, 200, 80, 0.3);
  border-radius: 12px;
  padding: 0.5rem;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.team-name-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
}

.team-name-input:focus {
  border-color: #e8a820;
  background: rgba(30, 16, 3, 0.7);
}

.team-count {
  font-size: 1rem;
  color: var(--text-light);
  opacity: 0.6;
  white-space: nowrap;
  font-weight: 600;
  margin: 0 0.5rem;
}

.team-students {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-height: 60px;
  align-content: flex-start;
}

/* Unassigned students (floating pills) */
.unassigned-student-pill {
  position: absolute;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(255, 200, 80, 0.3);
  border: 2px solid rgba(255, 200, 80, 0.6);
  color: var(--text-light);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: grab;
  user-select: none;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
  z-index: 10;
}

.unassigned-student-pill:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 200, 80, 0.3);
}

.unassigned-student-pill:active {
  cursor: grabbing;
}
</style>
