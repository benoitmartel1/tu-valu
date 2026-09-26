<script setup>
import { ref, computed, watch } from "vue";
import {
  ChevronUp,
  Plus,
  Check,
  PenIcon,
  ArrowUp,
  ArrowDown,
} from "@lucide/vue";
import { mutate } from "../../lib/data";
import { supabase } from "../../supabase";
import EvalDetail from "../detail/EvalDetail.vue";
import SkillDetail from "../detail/SkillDetail.vue";

const props = defineProps({
  evaluations: { type: Array, required: true },
  selectedEvalId: { type: [String, Number], default: null },
  skills: { type: Array, required: true },
  checkedEvalIds: { type: Set, required: true },
  checkedSkillIds: { type: Set, required: true },
  baseUrl: { type: String, required: true },
  skillIconNames: { type: Array, required: true },
});

const emit = defineEmits([
  "close",
  "skill-check",
  "select-eval",
  "data-changed",
  "eval-check",
]);

// ── Internal state ──────────────────────────────────────
const editingEvalId = ref(null);
const skillDetailId = ref(null);
const showArchived = ref(false),
  termFilter = ref(""),
  moveError = ref(""),
  moving = ref(false),
  draggedEval = ref(null);
const orderedEvaluations = computed(() =>
  [...props.evaluations].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.title.localeCompare(b.title, "fr"),
  ),
);
const filteredEvaluations = computed(() =>
  orderedEvaluations.value.filter(
    (ev) =>
      Boolean(ev.archived_at) === showArchived.value &&
      (!termFilter.value || Number(termFilter.value) === ev.school_term),
  ),
);
async function moveEval(id, targetId) {
  if (!id || id === targetId || moving.value) return;
  const ids = orderedEvaluations.value.map((ev) => ev.id);
  const from = ids.indexOf(id),
    to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return;
  ids.splice(from, 1);
  ids.splice(to, 0, id);
  moving.value = true;
  moveError.value = "";
  try {
    await mutate(supabase.rpc("tu_reorder_evaluations", { ids }));
    emit("data-changed");
  } catch (e) {
    moveError.value = e.message;
  } finally {
    moving.value = false;
    draggedEval.value = null;
  }
}
function moveBy(id, delta) {
  const rows = filteredEvaluations.value;
  const target = rows[rows.findIndex((ev) => ev.id === id) + delta];
  if (target) moveEval(id, target.id);
}

// ── Helper functions ────────────────────────────────────
function getSkillsForEval(evalId) {
  return props.skills.filter((s) => s.evaluation_id === evalId);
}

function evalHasSelectedSkills(evalId) {
  const evalSkills = getSkillsForEval(evalId);
  return evalSkills.some((s) => props.checkedSkillIds.has(s.id));
}

// ── Event handlers ──────────────────────────────────────
function selectEval(id) {
  console.log("selectEval called with id:", id);
  emit("select-eval", id);
}

// Watch for evaluation selection changes to close detail views

watch(
  () => props.selectedEvalId,
  (newId, oldId) => {
    // When a different evaluation is selected, close any open detail views
    if (newId !== oldId && newId !== null) {
      editingEvalId.value = null;
      skillDetailId.value = null;
    }
  },
);

async function addEval() {
  // Create a new evaluation with default name
  const { data, error } = await supabase
    .from("tu_evaluations")
    .insert({ title: "Nouvelle activité" })
    .select()
    .single();

  if (error) {
    console.error("Failed to create evaluation:", error);
    alert("Erreur lors de la création de l'activité");
    return;
  }

  // Open the eval detail for editing
  editingEvalId.value = data.id;

  // Notify parent to reload data
  emit("data-changed");
}

async function addSkill(evalId) {
  if (!evalId) return;

  // Create a new skill with default name
  const { data, error } = await supabase
    .from("tu_skills")
    .insert({
      name: "Nouvelle habileté",
      evaluation_id: evalId,
      scale: ["1", "2", "3", "4", "5"],
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add skill:", error);
    alert("Erreur lors de l'ajout de l'habileté");
    return;
  }

  // Select the new skill to show details immediately
  skillDetailId.value = data.id;

  // Notify parent to reload data
  emit("data-changed");
}

function handleEvalCheck(ev) {
  // Toggle eval check - parent will handle via event
  emit("eval-check", ev);
}

function handleSkillCheck(skillId) {
  // Toggle skill check - parent will handle via event
  emit("skill-check", skillId);
}

function onEvalSaved() {
  editingEvalId.value = null;
  emit("data-changed");
}

function onEvalDeleted(id) {
  editingEvalId.value = null;
  emit("data-changed");
}

function onSkillDeleted(id) {
  skillDetailId.value = null;
  emit("data-changed");
}
</script>

<template>
  <div class="picker-panel class-modal picker-panel--full eval-bg">
    <div class="class-modal-body">
      <div class="class-modal-content">
        <aside class="class-modal-rail" aria-label="Actions de classe">
          <button
            class="class-modal-rail-button close"
            title="Fermer"
            @click="$emit('close')"
          >
            <ChevronUp :size="28" :stroke-width="3" />
          </button>
        </aside>

        <!-- 3-column layout for evaluation management -->
        <div class="class-three-column-layout">
          <!-- Column 1: Evaluations list -->
          <div class="class-column">
            <div class="column-header">
              <h3>Moyens d'action</h3>
              <button
                class="picker-item picker-item--inline add-btn"
                @click="addEval"
              >
                <Plus :size="20" :stroke-width="3" />
              </button>
            </div>
            <div class="feature-fields">
              <label
                ><input type="checkbox" v-model="showArchived" />
                Archives</label
              ><select v-model="termFilter" aria-label="Étape">
                <option value="">Toutes les étapes</option>
                <option v-for="n in 3" :key="n" :value="n">
                  Étape {{ n }}
                </option>
              </select>
              <p v-if="moveError" role="alert">{{ moveError }}</p>
            </div>
            <div class="class-list">
              <div
                v-for="ev in filteredEvaluations"
                :key="ev.id"
                draggable="true"
                @dragstart="draggedEval = ev.id"
                @dragover.prevent
                @drop.prevent="moveEval(draggedEval, ev.id)"
              >
                <div class="feature-toolbar">
                  <button
                    :disabled="moving"
                    @click="moveBy(ev.id, -1)"
                    title="Monter"
                  >
                    <ArrowUp :size="16" /></button
                  ><button
                    :disabled="moving"
                    @click="moveBy(ev.id, 1)"
                    title="Descendre"
                  >
                    <ArrowDown :size="16" />
                  </button>
                </div>
                <button
                  class="picker-item class-item"
                  :class="{
                    selected: selectedEvalId === ev.id,
                  }"
                  @click="selectEval(ev.id)"
                >
                  <div>{{ ev.title }}</div>
                  <div class="class-item-buttons">
                    <div
                      class="edit-class-btn-small"
                      @click.stop="editingEvalId = ev.id"
                      title="Modifier l'activité"
                    >
                      <PenIcon :size="16" />
                    </div>
                    <div
                      class="row-checkbox"
                      :class="{
                        checked:
                          checkedEvalIds.has(ev.id) ||
                          evalHasSelectedSkills(ev.id),
                      }"
                      @click.stop="handleEvalCheck(ev)"
                    >
                      <Check
                        v-if="
                          checkedEvalIds.has(ev.id) ||
                          evalHasSelectedSkills(ev.id)
                        "
                        :size="24"
                        :stroke-width="3"
                      />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Column 2: Skills or Eval Detail -->
          <div class="students-column">
            <Transition name="fade-in" mode="out-in">
              <!-- Show eval details when editing -->
              <div
                v-if="editingEvalId !== null"
                :key="'eval-detail'"
                class="class-detail-container"
              >
                <EvalDetail
                  :key="editingEvalId"
                  @data-changed="emit('data-changed')"
                  :eval-id="editingEvalId"
                  @saved="onEvalSaved"
                  @duplicated="editingEvalId = $event"
                  @deleted="onEvalDeleted"
                />
              </div>
              <!-- Otherwise show skills list -->
              <div v-else :key="'skills-list'">
                <Transition name="fade-in" mode="out-in">
                  <div
                    :key="selectedEvalId || 'no-eval'"
                    class="students-column-inner"
                  >
                    <div class="column-header">
                      <h3>
                        {{ selectedEvalId ? `Habiletés` : "" }}
                      </h3>
                      <button
                        v-if="selectedEvalId"
                        class="picker-item picker-item--inline add-btn"
                        @click="addSkill(selectedEvalId)"
                      >
                        <Plus :size="20" :stroke-width="3" />
                      </button>
                    </div>
                    <div v-if="selectedEvalId" class="student-list">
                      <div
                        v-for="skill in getSkillsForEval(selectedEvalId)"
                        :key="skill.id"
                        class="student-item-row"
                      >
                        <button
                          class="picker-item student-item"
                          :class="{ selected: skillDetailId === skill.id }"
                          @click="skillDetailId = skill.id"
                        >
                          <span>{{ skill.name }}</span>
                          <span
                            class="row-checkbox"
                            :class="{
                              checked: checkedSkillIds.has(skill.id),
                            }"
                            @click.stop="handleSkillCheck(skill.id)"
                          >
                            <Check
                              v-if="checkedSkillIds.has(skill.id)"
                              :size="24"
                              :stroke-width="3"
                            />
                          </span>
                        </button>
                      </div>
                      <div
                        v-if="!getSkillsForEval(selectedEvalId)?.length"
                        class="picker-empty"
                      >
                        Aucune habileté dans cette activité
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </Transition>
          </div>

          <!-- Column 3: Skill details (when editing) -->
          <div class="student-detail-column">
            <Transition name="fade-in" mode="out-in">
              <SkillDetail
                v-if="skillDetailId !== null"
                :key="skillDetailId"
                :skill-id="skillDetailId"
                :skill-data="skills.find((s) => s.id === skillDetailId)"
                :skills="skills"
                :editing-skills="
                  skills.filter((s) => s.evaluation_id === selectedEvalId)
                "
                :has-student-selection="false"
                :has-eval-selection="
                  checkedEvalIds.size > 0 || checkedSkillIds.size > 0
                "
                :base-url="baseUrl"
                :icons="skillIconNames"
                @close="skillDetailId = null"
                @deleted="onSkillDeleted"
                @duplicated="skillDetailId = $event"
                @data-changed="emit('data-changed')"
              />
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Modal background */
.eval-bg {
  background: var(--stadium-yellow);
}

/* Modal layout styles */
.class-modal-body {
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  padding: 1rem;
  position: relative;
}

.class-modal-content {
  width: 100%;
  display: flex;
  gap: 0.65rem;
  height: 100%;
  min-height: 0;
  align-items: flex-start;
  justify-content: flex-start;
}

.class-modal-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.class-modal-rail-button {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-light);
  cursor: pointer;
}

.class-modal-rail-button.close {
  background: none;
}
</style>
