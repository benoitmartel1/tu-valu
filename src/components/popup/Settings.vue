<script setup>
import { computed } from "vue";
import { UserRound } from "@lucide/vue";
import { studentName } from "../../lib/domain";
import { preferences } from "../../stores/preferences";
import Popup from "./Popup.vue";

const props = defineProps({
  activeTeamIds: { type: Array, default: () => [] },
  teamBatches: { type: Array, default: () => [] },
  teamBatchId: String,
  show: { type: Boolean, required: true },
  sortBy: { type: String, required: true },
  genderFilter: { type: String, required: true },
  teamsActive: { type: Boolean, required: true },
  activeTeamId: { type: [String, null], default: null },
  teams: { type: Array, default: () => [] },
});

const emit = defineEmits([
  "close",
  "update:activeTeamIds",
  "update:teamBatchId",
  "reset-priorities",
  "update:sortBy",
  "update:genderFilter",
  "update:teamsActive",
  "update:activeTeamId",
]);

const displayOptions = [
  { key: "individual", label: "Choix individuels" },
  { key: "showPhoto", label: "Photos des élèves" },
  { key: "showFirstname", label: "Prénom", name: true },
  { key: "showLastname", label: "Nom", name: true },
  { key: "showCustomName", label: "Surnom", name: true },
];
const previewStudent = {
  firstname: "Alex", lastname: "M", custom_name: "Alexou",
  name_display_prefs: { showFirstname: true, showLastname: false, showCustomName: false },
};
const previewName = computed(() => studentName(previewStudent, preferences));
function getTeamColor(teamId) {
  // This will be passed as a prop or we can use a simpler approach
  const teamColors = [
    "#FF0000",
    "#0066CC",
    "#00AA00",
    "#FFD700",
    "#FF8C00",
    "#000000",
    "#FF69B4",
    "#9932CC",
    "#FFFFFF",
    "#00CED1",
  ];
  if (!teamId) return null;
  const teamIndex = props.teams.findIndex((t) => t.id === teamId);
  return teamColors[teamIndex % teamColors.length];
}
</script>

<template>
  <Popup v-if="show" title="Paramètres" @close="$emit('close')">
    <div class="settings-content">
      <section class="feature-fields">
        <h3>Affichage global</h3>
        <div class="display-toggles" role="group" aria-label="Affichage global">
          <button v-for="option in displayOptions" :key="option.key" type="button"
            class="display-toggle" :aria-pressed="preferences[option.key]"
            :disabled="option.name && preferences.individual"
            @click="preferences[option.key] = !preferences[option.key]">
            {{ option.label }}
          </button>
        </div>
        <div class="display-preview" aria-live="polite">
          <span class="display-preview-label">Aperçu</span>
          <div class="student-pill display-preview-pill">
            <span v-if="preferences.showPhoto" class="display-preview-avatar" aria-label="Exemple de photo">
              <UserRound :size="24" aria-hidden="true" />
            </span>
            <span v-if="previewName">{{ previewName }}</span>
            <span v-else-if="!preferences.showPhoto">AM</span>
          </div>
          <small v-if="preferences.individual">Désactivez « Choix individuels » pour personnaliser votre affichage.</small>
        </div>
        <button @click="$emit('reset-priorities')">
          Réinitialiser les priorités
        </button>
      </section>
      <!-- Sort by section -->
      <div class="settings-section">
        <h3 class="settings-section-title">Trier par</h3>
        <label
          ><input
            type="radio"
            name="sortBy"
            :checked="sortBy === 'ability'"
            @change="$emit('update:sortBy', 'ability')"
          />
          Niveau d’habileté</label
        >
        <div class="settings-options">
          <label
            class="settings-option"
            :class="{ active: sortBy === 'firstname' }"
          >
            <input
              type="radio"
              name="sortBy"
              value="firstname"
              :checked="sortBy === 'firstname'"
              @change="$emit('update:sortBy', 'firstname')"
            />
            <span>Prénom</span>
          </label>
          <label
            class="settings-option"
            :class="{ active: sortBy === 'lastname' }"
          >
            <input
              type="radio"
              name="sortBy"
              value="lastname"
              :checked="sortBy === 'lastname'"
              @change="$emit('update:sortBy', 'lastname')"
            />
            <span>Nom</span>
          </label>
          <label
            class="settings-option"
            :class="{ active: sortBy === 'team' }"
            v-if="teamsActive && teams.length > 0"
          >
            <input
              type="radio"
              name="sortBy"
              value="team"
              :checked="sortBy === 'team'"
              @change="$emit('update:sortBy', 'team')"
            />
            <span>Équipe</span>
          </label>
        </div>
      </div>

      <!-- Gender filter section -->
      <div class="settings-section">
        <h3 class="settings-section-title">Sexe</h3>
        <div class="settings-options">
          <label
            class="settings-option"
            :class="{ active: genderFilter === 'all' }"
          >
            <input
              type="radio"
              name="gender"
              value="all"
              :checked="genderFilter === 'all'"
              @change="$emit('update:genderFilter', 'all')"
            />
            <span>Tous</span>
          </label>
          <label
            class="settings-option"
            :class="{ active: genderFilter === 'male' }"
          >
            <input
              type="radio"
              name="gender"
              value="male"
              :checked="genderFilter === 'male'"
              @change="$emit('update:genderFilter', 'male')"
            />
            <span>M</span>
          </label>
          <label
            class="settings-option"
            :class="{ active: genderFilter === 'female' }"
          >
            <input
              type="radio"
              name="gender"
              value="female"
              :checked="genderFilter === 'female'"
              @change="$emit('update:genderFilter', 'female')"
            />
            <span>F</span>
          </label>
        </div>
      </div>

      <!-- Team filter section -->
      <div v-if="teams.length > 0" class="settings-section">
        <div class="settings-section-header">
          <h3 class="settings-section-title">Équipes</h3>
          <button
            class="toggle-teams-btn"
            :class="{ active: teamsActive }"
            @click="$emit('update:teamsActive', !teamsActive)"
            title="Activer/désactiver les équipes"
          >
            {{ teamsActive ? "Désactiver" : "Activer" }}
          </button>
        </div>
        <label
          >Ensemble d’équipes<PopupSelect
            :value="teamBatchId"
            @change="$emit('update:teamBatchId', $event.target.value)"
          >
            <option v-for="(id, index) in teamBatches" :key="id" :value="id">
              {{
                id === "legacy"
                  ? "Anciennes équipes"
                  : `Ensemble ${teamBatches.length - index}`
              }}
            </option>
          </PopupSelect></label
        >
        <div v-if="teamsActive" class="settings-options">
          <label
            class="settings-option"
            :class="{ active: !activeTeamIds.length }"
          >
            <input
              type="checkbox"
              name="teamFilter"
              :value="null"
              :checked="!activeTeamIds.length"
              @change="$emit('update:activeTeamIds', [])"
            />
            <span>Toutes</span>
          </label>
          <label
            v-for="team in teams"
            :key="team.id"
            class="settings-option"
            :class="{ active: activeTeamIds.includes(team.id) }"
            :style="{
              borderLeft: `4px solid ${getTeamColor(team.id)}`,
            }"
          >
            <input
              type="checkbox"
              name="teamFilter"
              :value="team.id"
              :checked="activeTeamIds.includes(team.id)"
              @change="
                $emit(
                  'update:activeTeamIds',
                  activeTeamIds.includes(team.id)
                    ? activeTeamIds.filter((id) => id !== team.id)
                    : [...activeTeamIds, team.id],
                )
              "
            />
            <span>{{ team.name }}</span>
          </label>
        </div>
      </div>
    </div>
  </Popup>
</template>

<style scoped>
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-section-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-light);
}

.settings-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.settings-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.95rem;
}

.settings-option:focus-visible {
  background: #e8f0fe;
  border-color: #4a90d9;
}

.settings-option.active {
  background: #fff3cd;
  border-color: #ffc107;
  font-weight: 600;
}

.settings-option input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.settings-option span {
  flex: 1;
}

.toggle-teams-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-light);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-teams-btn:focus-visible {
  background: #e8f0fe;
  border-color: #4a90d9;
}

.toggle-teams-btn.active {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}
</style>

<style scoped>
.display-toggles { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.feature-fields .display-toggle {
  border: none; border-radius: 24px; padding: 0.65rem 0.9rem;
  background: var(--surface-muted); color: var(--text-light);
}
.feature-fields .display-toggle[aria-pressed="true"] { background: var(--class-accent, #5599e0); color: #fff; }
.display-preview { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.75rem 0; }
.display-preview-label { color: var(--text-muted); font-size: 0.85rem; }
.display-preview-pill { width: fit-content; min-height: 40px; gap: 0.5rem; background: var(--student-bg); color: var(--text-light); cursor: default; }
.display-preview-avatar { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--surface-muted); color: var(--text-light); }
.display-preview small { flex-basis: 100%; }
</style>