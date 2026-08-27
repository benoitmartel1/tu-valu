<script setup>
import Popup from "./Popup.vue";

const props = defineProps({
  show: { type: Boolean, required: true },
  sortBy: { type: String, required: true },
  genderFilter: { type: String, required: true },
  teamsActive: { type: Boolean, required: true },
  activeTeamId: { type: [String, null], default: null },
  teams: { type: Array, default: () => [] },
});

const emit = defineEmits([
  "close",
  "update:sortBy",
  "update:genderFilter",
  "update:teamsActive",
  "update:activeTeamId",
]);

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
      <!-- Sort by section -->
      <div class="settings-section">
        <h3 class="settings-section-title">Trier par</h3>
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
        <div v-if="teamsActive" class="settings-options">
          <label
            class="settings-option"
            :class="{ active: activeTeamId === null }"
          >
            <input
              type="radio"
              name="teamFilter"
              :value="null"
              :checked="activeTeamId === null"
              @change="$emit('update:activeTeamId', null)"
            />
            <span>Toutes</span>
          </label>
          <label
            v-for="team in teams"
            :key="team.id"
            class="settings-option"
            :class="{ active: activeTeamId === team.id }"
            :style="{
              borderLeft: `4px solid ${getTeamColor(team.id)}`,
            }"
          >
            <input
              type="radio"
              name="teamFilter"
              :value="team.id"
              :checked="activeTeamId === team.id"
              @change="$emit('update:activeTeamId', team.id)"
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
  color: #333;
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
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.95rem;
}

.settings-option:hover {
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
  background: #f8f9fa;
  color: #333;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-teams-btn:hover {
  background: #e8f0fe;
  border-color: #4a90d9;
}

.toggle-teams-btn.active {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}
</style>
