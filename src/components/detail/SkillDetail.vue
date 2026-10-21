<script setup>
import { ref, computed, watch } from "vue";
import SkillOptions from "./SkillOptions.vue";
import DetailHeaderActions from "./DetailHeaderActions.vue";
import Sneaker from "../Sneaker.js";
import { BarChart3, ChevronLeft, ChevronRight } from "@lucide/vue";
import { supabase } from "../../supabase";
import ScalePreview from "../ScalePreview.vue";
import RangeInput from "../RangeInput.vue";
import IconSelector from "../popup/IconSelector.vue";

const props = defineProps({
  skillId: { type: [String, Number], default: null },
  initialTab: { type: String, default: "scale" },
  skillData: { type: Object, default: null },
  skills: { type: Array, required: true },
  editingSkills: { type: Array, required: true },
  hasStudentSelection: { type: Boolean, default: false },
  hasEvalSelection: { type: Boolean, default: false },
  baseUrl: { type: String, required: true },
  icons: { type: Array, required: true },
});

const emit = defineEmits(["close", "deleted", "data-changed", "duplicated", "navigate-skill"]);

const skillOptions = ref(null);
const activeTab = ref(props.initialTab);
const skillIndex = computed(() => props.editingSkills.findIndex(skill => skill.id === props.skillId));
const previousSkill = computed(() => skillIndex.value > 0 ? props.editingSkills[skillIndex.value - 1] : null);
const nextSkill = computed(() => skillIndex.value < 0 ? null : props.editingSkills[skillIndex.value + 1] || null);
function navigateSkill(skill) {
  if (skill) emit("navigate-skill", { id: skill.id, tab: activeTab.value });
}
watch(() => props.initialTab, (tab) => { activeTab.value = tab; });
const detailTabs = [
  { id: "info", label: "Informations", icon: Sneaker },
  { id: "scale", label: "Type et échelle", icon: BarChart3 },
];
function navigateTabs(event, index) {
  const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: detailTabs.length - 1 - index };
  if (!(event.key in offsets)) return;
  event.preventDefault();
  const next = (index + offsets[event.key] + detailTabs.length) % detailTabs.length;
  activeTab.value = detailTabs[next].id;
  event.currentTarget.parentElement.children[next].focus();
}
const skillDetailEditing = ref(null);
const showSkillIconPicker = ref(false);
const editingNewSkillMin = ref(1);
const editingNewSkillMax = ref(5);
const editingNewSkillStep = ref(1);

// Initialize from props immediately for responsive UI
watch(
  () => [props.skillId, props.skillData],
  ([id, data]) => {
    if (!id || !data) {
      skillDetailEditing.value = null;
      return;
    }

    // Use prop data immediately for responsive UI
    skillDetailEditing.value = { ...data };

    // Initialize scale inputs from skill's scale
    const nums = data.scale.map(Number).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      editingNewSkillMin.value = Math.min(...nums);
      editingNewSkillMax.value = Math.max(...nums);
      editingNewSkillStep.value = nums.length > 1 ? nums[1] - nums[0] : 1;
    } else {
      editingNewSkillMin.value = 1;
      editingNewSkillMax.value = 5;
      editingNewSkillStep.value = 1;
    }
  },
  { immediate: true },
);

// Fetch fresh data in background if not in skills array
watch(
  () => props.skillId,
  async (id) => {
    if (!id) return;

    // Get skill from skills array (single source of truth)
    const skill = props.skills.find((s) => s.id === id);

    if (skill) {
      skillDetailEditing.value = { ...skill };

      // Initialize scale inputs from skill's scale
      const nums = skill.scale.map(Number).filter((n) => !isNaN(n));
      if (nums.length > 0) {
        editingNewSkillMin.value = Math.min(...nums);
        editingNewSkillMax.value = Math.max(...nums);
        editingNewSkillStep.value = nums.length > 1 ? nums[1] - nums[0] : 1;
      } else {
        editingNewSkillMin.value = 1;
        editingNewSkillMax.value = 5;
        editingNewSkillStep.value = 1;
      }
    } else {
      // Fallback: load from Supabase if not in skills
      const { data } = await supabase
        .from("tu_skills")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        skillDetailEditing.value = { ...data };

        // Initialize scale inputs from loaded skill's scale
        if (data.scale) {
          const nums = data.scale.map(Number).filter((n) => !isNaN(n));
          if (nums.length > 0) {
            editingNewSkillMin.value = Math.min(...nums);
            editingNewSkillMax.value = Math.max(...nums);
            editingNewSkillStep.value = nums.length > 1 ? nums[1] - nums[0] : 1;
          }
        }
      }
    }
  },
);

async function saveSkillDetail() {
  const skillId = props.skillId;
  if (!skillDetailEditing.value || !skillId) return;

  const { name, scale, icon } = skillDetailEditing.value;
  if (!name?.trim()) return;

  const { error } = await supabase
    .from("tu_skills")
    .update({ name: name.trim(), scale, icon: icon || null })
    .eq("id", skillId);

  if (error) {
    console.error("Failed to save skill:", error);
    return;
  }

  // Notify parent to reload data
  emit("data-changed");
}

const scalePreview = computed(() => {
  const min = Number(editingNewSkillMin.value);
  const max = Number(editingNewSkillMax.value);
  const step = Number(editingNewSkillStep.value);
  if (![min, max, step].every(Number.isFinite) || step <= 0 || max < min) return [];
  const count = Math.floor((max - min) / step + 0.000001) + 1;
  if (count > 1000) return [];
  return Array.from({ length: count }, (_, index) => Math.round((min + index * step) * 100) / 100);
});

function updateScaleFromInputs() {
  if (!skillDetailEditing.value) return;

  const min = Number(editingNewSkillMin.value);
  const max = Number(editingNewSkillMax.value);
  const step = Number(editingNewSkillStep.value);

  if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0) return;
  if (min >= max) return;

  if (scalePreview.value.length) skillDetailEditing.value.scale = [...scalePreview.value];
}

async function deleteSkill() {
  if (!props.skillId) return;
  if (!confirm("Supprimer cette habileté ?")) return;

  const skillId = props.skillId;

  try {
    const { error: eventsError } = await supabase
      .from("tu_session_events")
      .delete()
      .eq("skill_id", skillId);

    if (eventsError) {
      console.error("Failed to delete session events:", eventsError);
      alert("Erreur lors de la suppression des événements de session");
      return;
    }

    const { error } = await supabase
      .from("tu_skills")
      .delete()
      .eq("id", skillId);

    if (error) {
      console.error("Failed to delete skill:", error);

      if (error.code === "23503") {
        alert(
          "Cette habileté ne peut pas être supprimée car elle est encore utilisée dans des évaluations. Supprimez d'abord toutes les évaluations associées.",
        );
      } else {
        alert(`Erreur lors de la suppression de l'habileté: ${error.message}`);
      }
      return;
    }

    emit("deleted", skillId);
    emit("data-changed");
    emit("close");
  } catch (err) {
    console.error("Unexpected error while deleting skill:", err);
    alert("Une erreur inattendue est survenue");
  }
}

function selectSkillIcon(iconName) {
  if (!skillDetailEditing.value) return;
  skillDetailEditing.value.icon = iconName;
  saveSkillDetail();
  showSkillIconPicker.value = false;
}
</script>

<template>
  <div class="student-detail-column skill-detail">
    <div class="skill-detail-scroll">
    <div v-if="skillDetailEditing" class="skill-detail-header">
      <button type="button" class="student-photo-circle"
        :class="{ 'picker-open': showSkillIconPicker }"
        @click="showSkillIconPicker = !showSkillIconPicker" title="Choisir une icône" aria-label="Choisir une icône">
        <img v-if="skillDetailEditing.icon" :src="`${baseUrl}icons/skills/${skillDetailEditing.icon}.svg`"
          class="skill-icon-img" alt="" />
        <Sneaker v-else :size="64" aria-hidden="true" />
      </button>
      <DetailHeaderActions duplicate-label="Dupliquer l’habileté" delete-label="Supprimer l’habileté" :busy="!skillOptions || skillOptions.busy" @duplicate="skillOptions.duplicate()" @delete="deleteSkill" />
    </div>
    <div v-if="skillDetailEditing" class="skill-detail-tabs" role="tablist" aria-label="Détails de l’habileté">
      <button v-for="(tab, index) in detailTabs" :key="tab.id" :id="`skill-tab-${tab.id}`"
        type="button" role="tab" :aria-label="tab.label" :title="tab.label"
        :aria-selected="activeTab === tab.id" :aria-controls="`skill-panel-${tab.id}`"
        :tabindex="activeTab === tab.id ? 0 : -1" :class="['skill-detail-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id" @keydown="navigateTabs($event, index)">
        <component :is="tab.icon" :size="36" :stroke-width="1.5" aria-hidden="true" />
      </button>
    </div>
    <SkillOptions ref="skillOptions" v-if="skillDetailEditing" :key="skillId" :id="skillId" :section="activeTab"
      @changed="emit('data-changed')" @duplicated="emit('duplicated', $event)">
      <template #info>
        <div class="detail-section">
          <input v-model="skillDetailEditing.name" class="detail-input" placeholder="Nom de l’habileté"
            aria-label="Nom de l’habileté" @blur="saveSkillDetail" />
        </div>
      </template>
      <template #scale="{ skill: gradingSkill }">
        <div v-if="!gradingSkill.grading_mode || gradingSkill.grading_mode === 'numeric'" class="detail-section">
          <label class="detail-label">Échelle</label>
          <ScalePreview v-if="!gradingSkill.grading_mode || gradingSkill.grading_mode === 'numeric'" :levels="scalePreview" />
          <div
              v-if="
                !gradingSkill.grading_mode ||
                gradingSkill.grading_mode === 'numeric'
              "
              class="skill-range-config"
            >
              <RangeInput
                v-model:value="editingNewSkillMin"
                :min="0"
                :max="editingNewSkillMax - editingNewSkillStep"
                label="Min"
                size="small"
                @change="
                  () => {
                    updateScaleFromInputs();
                    saveSkillDetail();
                  }
                "
              />
              <RangeInput
                v-model:value="editingNewSkillMax"
                :min="editingNewSkillMin + editingNewSkillStep"
                label="Max"
                size="small"
                @change="
                  () => {
                    updateScaleFromInputs();
                    saveSkillDetail();
                  }
                "
              />
              <RangeInput
                v-model:value="editingNewSkillStep"
                :min="0.1"
                :step="0.1"
                label="Pas"
                size="small"
                @change="
                  () => {
                    updateScaleFromInputs();
                    saveSkillDetail();
                  }
                "
              />
            </div>
        </div>
      </template>
    </SkillOptions>
    </div>
    <footer class="skill-detail-footer" aria-label="Navigation des habiletés">
      <button type="button" :disabled="!previousSkill" @click="navigateSkill(previousSkill)">
        <ChevronLeft :size="20" aria-hidden="true" /> Précédent
      </button>
      <button type="button" :disabled="!nextSkill" @click="navigateSkill(nextSkill)">
        Prochain <ChevronRight :size="20" aria-hidden="true" />
      </button>
    </footer>
    <IconSelector v-if="showSkillIconPicker" :show="showSkillIconPicker" :icons="icons" :base-url="baseUrl"
      @close="showSkillIconPicker = false" @select="selectSkillIcon" />
  </div>
</template>

<style scoped>
.skill-detail-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.skill-detail-footer {
  position: sticky; bottom: 0; z-index: 1; display: flex; justify-content: space-between;
  gap: 0.5rem; flex-wrap: wrap; flex-shrink: 0; margin-top: auto;
  padding: 0.75rem 0 0.25rem; background: var(--surface);
}
.skill-detail-footer button {
  display: inline-flex; align-items: center; gap: 0.4rem;
  border: none; border-radius: 24px; padding: 0.6rem 0.8rem;
  background: var(--surface-muted); color: var(--text-light); font: inherit;
}
.skill-detail { height: 100%; min-height: 0; }
.skill-detail-header { flex-shrink: 0; }
.skill-detail-header { display: flex; align-items: flex-start; width: 100%; padding: 1rem 0 0.5rem; gap: 1rem; }
.skill-detail-tabs { display: flex; justify-content: space-around; width: 100%; gap: 0.35rem; margin: 0.75rem 0 1rem; flex-shrink: 0; }
.skill-detail-tab {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; padding: 0.5rem; border: none; border-radius: 999px;
  background: transparent; color: var(--text-light); cursor: pointer;
}
.skill-detail-tab.active { background: color-mix(in srgb, var(--modal-accent, #55b880) 16%, transparent); }
.skill-detail-tab:focus-visible { outline: 2px solid var(--modal-accent, #55b880); outline-offset: 2px; }

.skill-zone-preview {
  display: flex;
  gap: 4px;
  min-height: 110px;
  margin-bottom: 1rem;
  overflow-x: auto;
  border-radius: 12px;
  background: var(--surface);
}
.skill-zone-preview-segment {
  display: flex;
  flex: 1 0 36px;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.2rem;
  background: color-mix(in srgb, var(--surface-muted) 88%, var(--text-muted));
  color: var(--text-muted);
  font-family: "Coiny", sans-serif;
  font-size: 2rem;
}
.skill-range-config {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}
.skill-range-config :deep(.range-input-wrapper) { min-width: 0; }
.skill-range-config :deep(.custom-number-input) { gap: 0; min-width: 0; }
.skill-range-config :deep(.number-btn) {
  display: flex;
  flex: 0 0 22px;
  width: 22px;
  height: 38px;
  padding: 0;
  background: transparent;
  color: var(--text-light);
}
.skill-range-config :deep(.number-input-field) {
  width: 100%;
  min-width: 0;
  padding: 0.5rem 0 !important;
  font-size: 1rem;
}

.skill-range-config label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-light);
  opacity: 0.7;
}

.range-input {
  width: 60px;
  padding: 0.25rem 0.4rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.5);
  color: var(--text-light);
  font-size: 1.5rem;
  outline: none;
  font-family: inherit;
  text-align: center;
}

.range-input:focus {
  border-color: #e8a820;
}

.detail-section {
  padding: 0.25rem 0;
}

.detail-label {
  display: block;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-light);
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

.student-detail-photo {
  flex-shrink: 0;
}

.student-photo-circle {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-light);
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  transition: all 0.2s;
}

.student-photo-circle.picker-open {
  transform: scale(1.05);
  box-shadow: 0 0 0 3px rgba(255, 200, 80, 0.5);
}

.skill-icon-img {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
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
</style>
