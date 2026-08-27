<script setup>
import { ref, computed, watch } from "vue";
import { Trash2 } from "@lucide/vue";
import { supabase } from "../../supabase";
import RangeInput from "../RangeInput.vue";
import IconSelector from "../popup/IconSelector.vue";

const props = defineProps({
  skillId: { type: [String, Number], default: null },
  skillData: { type: Object, default: null },
  skills: { type: Array, required: true },
  editingSkills: { type: Array, required: true },
  hasStudentSelection: { type: Boolean, default: false },
  hasEvalSelection: { type: Boolean, default: false },
  baseUrl: { type: String, required: true },
  icons: { type: Array, required: true },
});

const emit = defineEmits(["close", "deleted", "data-changed"]);

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
        .select("id, name, scale, icon")
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

function updateScaleFromInputs() {
  if (!skillDetailEditing.value) return;

  const min = Number(editingNewSkillMin.value);
  const max = Number(editingNewSkillMax.value);
  const step = Number(editingNewSkillStep.value);

  if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0) return;
  if (min >= max) return;

  // Generate scale array from min, max, step
  const scale = [];
  for (let val = min; val <= max + 0.0001; val += step) {
    scale.push(Math.round(val * 100) / 100);
  }

  skillDetailEditing.value.scale = scale;
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
  <div>
    <div class="student-detail-column">
      <div :key="skillId" class="student-detail-layout">
        <!-- Trash button -->
        <button
          v-if="skillDetailEditing"
          class="header-trash-btn header-trash-btn--absolute"
          title="Supprimer l'habileté"
          @click="deleteSkill"
        >
          <Trash2 :size="36" />
        </button>

        <!-- Icon picker -->
        <div class="student-detail-photo">
          <div
            v-if="skillDetailEditing"
            class="student-photo-circle"
            :class="{ 'picker-open': showSkillIconPicker }"
            @click="showSkillIconPicker = !showSkillIconPicker"
            title="Choisir une icône"
          >
            <img
              v-if="skillDetailEditing?.icon || skillData?.icon"
              :src="`${baseUrl}icons/skills/${skillDetailEditing?.icon || skillData?.icon}.svg`"
              class="skill-icon-img"
              alt=""
            />
            <span v-else class="student-photo-initials">?</span>
          </div>
        </div>

        <!-- Right column: fields -->
        <div v-if="skillDetailEditing" class="student-detail-fields">
          <div class="detail-section">
            <label class="detail-label">Nom</label>
            <input
              v-model="skillDetailEditing.name"
              class="detail-input"
              placeholder="Nom de l'habileté"
              @blur="saveSkillDetail"
            />
          </div>
          <div class="detail-section">
            <label class="detail-label">Échelle</label>
            <div class="skill-range-config">
              <RangeInput
                v-model:value="editingNewSkillMin"
                :min="0"
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
        </div>
      </div>
    </div>

    <!-- Icon selector modal -->
    <IconSelector
      v-if="showSkillIconPicker"
      :show="showSkillIconPicker"
      :icons="icons"
      :base-url="baseUrl"
      @close="showSkillIconPicker = false"
      @select="selectSkillIcon"
    />
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

.skill-range-config {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
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

.student-detail-photo {
  flex-shrink: 0;
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
  cursor: pointer;
  transition: all 0.2s;
}

.student-photo-circle.picker-open {
  transform: scale(1.05);
  box-shadow: 0 0 0 3px rgba(255, 200, 80, 0.5);
}

.skill-icon-img {
  width: 90px;
  height: 90px;
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
