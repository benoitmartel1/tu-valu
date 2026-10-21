<script setup>
import { vGlideSelect } from "../../lib/glideSelect";
import { ref, computed, watch } from "vue";
import {
  ChevronUp,
  Plus,
  Check,
  PenIcon,
  Equal,
  Archive,
  X,
} from "@lucide/vue";
import { mutate } from "../../lib/data";
import { useUserFilter } from "../../stores/userFilters";
import { supabase } from "../../supabase";
import FavoriteButton from "../FavoriteButton.vue";
import { useFavorites } from "../../stores/favorites";
import Popup from "../popup/Popup.vue";
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
const skillInitialTab = ref("scale");
const search = ref("");
const termPickerOpen = ref(false);
const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
const searchQuery = computed(() => normalizeSearch(search.value.trim()));
const showArchived = ref(false),
  termFilter = useUserFilter("etape", value => [1, 2, 3].includes(value)),
  moveError = ref(""),
  moving = ref(false),
  draggedEval = ref(null);
const optimisticOrder = ref(null);
const savedEvaluations = computed(() =>
  [...props.evaluations].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.title.localeCompare(b.title, "fr"),
  ),
);
const orderedEvaluations = computed(() => {
  if (!optimisticOrder.value) return savedEvaluations.value;
  const positions = new Map(optimisticOrder.value.map((id, index) => [id, index]));
  return [...savedEvaluations.value].sort((a, b) =>
    (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
});
watch(savedEvaluations, (rows) => {
  if (optimisticOrder.value && rows.length === optimisticOrder.value.length &&
      rows.every((row, index) => row.id === optimisticOrder.value[index])) {
    optimisticOrder.value = null;
  }
});
const { onlyFavorites, isFavorite, toggleFavorite } = useFavorites("activities");
const filteredEvaluations = computed(() =>
  orderedEvaluations.value.filter(
    (ev) =>
      Boolean(ev.archived_at) === showArchived.value &&
      (!onlyFavorites.value || isFavorite(ev.id)) &&
      (!termFilter.value || Number(termFilter.value) === Number(ev.school_term)) &&
      (!searchQuery.value || normalizeSearch(ev.title).includes(searchQuery.value) ||
        props.skills.some((skill) => skill.evaluation_id === ev.id && normalizeSearch(skill.name).includes(searchQuery.value))),
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
  const previousOrder = optimisticOrder.value;
  optimisticOrder.value = ids;
  moving.value = true;
  moveError.value = "";
  try {
    await mutate(supabase.rpc("tu_reorder_evaluations", { ids }));
    emit("data-changed");
  } catch (e) {
    optimisticOrder.value = previousOrder;
    moveError.value = e.message;
  } finally {
    moving.value = false;
    draggedEval.value = null;
  }
}
function startEvalDrag(event, id) {
  if (!event.isPrimary || event.button !== 0 || moving.value) return;
  const list = event.currentTarget.closest(".eval-sort-list");
  const bounds = list.getBoundingClientRect();
  const slots = [...list.querySelectorAll("[data-eval-id]")].map((row) => {
    const rect = row.getBoundingClientRect();
    return { id: row.dataset.evalId, top: rect.top - bounds.top, height: rect.height };
  });
  const from = slots.findIndex((slot) => slot.id === String(id));
  if (from < 0) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  draggedEval.value = {
    id, pointerId: event.pointerId, startY: event.clientY, offset: 0,
    targetId: id, active: false, slots, from, to: from,
  };
}
function updateEvalDrag(event) {
  const drag = draggedEval.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.offset = event.clientY - drag.startY;
  if (Math.abs(drag.offset) > 6) drag.active = true;
  if (!drag.active) return;
  const list = event.currentTarget.closest(".eval-sort-list");
  const y = event.clientY - list.getBoundingClientRect().top;
  let to = 0;
  for (let index = 0; index < drag.slots.length; index++) {
    if (index === drag.from) continue;
    const slot = drag.slots[index];
    if (y > slot.top + slot.height / 2) to++;
  }
  drag.to = to;
  drag.targetId = filteredEvaluations.value.find((ev) => String(ev.id) === drag.slots[to].id)?.id || drag.id;
}
function evalDragStyle(id) {
  const drag = draggedEval.value;
  if (!drag?.active) return {};
  const index = drag.slots.findIndex((slot) => slot.id === String(id));
  let offset = 0;
  if (index === drag.from) offset = drag.offset;
  else if (drag.to > drag.from && index > drag.from && index <= drag.to) {
    offset = drag.slots[index - 1].top - drag.slots[index].top;
  } else if (drag.to < drag.from && index >= drag.to && index < drag.from) {
    offset = drag.slots[index + 1].top - drag.slots[index].top;
  }
  return { transform: `translateY(${offset}px)` };
}
const insertionStyle = computed(() => {
  const drag = draggedEval.value;
  if (!drag?.active) return {};
  const slot = drag.slots[drag.to];
  // Mark the top edge of the space opened for the dragged item.
  const top = drag.to > drag.from
    ? slot.top + slot.height - drag.slots[drag.from].height
    : slot.top;
  return { top: `${top}px` };
});
function endEvalDrag(event) {
  const drag = draggedEval.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  draggedEval.value = null;
  if (drag.active) moveEval(drag.id, drag.targetId);
}
function reorderWithKeyboard(event, id) {
  if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const rows = filteredEvaluations.value;
  const target = rows[rows.findIndex((ev) => ev.id === id) + (event.key === "ArrowUp" ? -1 : 1)];
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
    if (newId !== oldId) {
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
  skillInitialTab.value = "info";
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
              <div class="favorite-header-actions">
                <button type="button" class="picker-item picker-item--inline add-btn archive-toggle"
                  :class="{ 'archive-toggle--active': showArchived }"
                  :aria-pressed="showArchived"
                  :aria-label="showArchived ? 'Afficher les activités courantes' : 'Afficher les archives'"
                  :title="showArchived ? 'Afficher les activités courantes' : 'Afficher les archives'"
                  @click="showArchived = !showArchived">
                  <Archive :size="20" />
                </button>
              <FavoriteButton :active="!!onlyFavorites" :label="onlyFavorites ? 'Afficher toutes les activités' : 'Afficher les activités favorites'" @toggle="onlyFavorites = !onlyFavorites" />
              <button
                class="picker-item picker-item--inline add-btn"
                @click="addEval"
              >
                <Plus :size="20" :stroke-width="3" />
              </button>
              </div>
            </div>
            <div class="class-filter-row">
              <div class="class-search-bar">
                <input v-model="search" placeholder="Rechercher par habileté" aria-label="Rechercher par habileté" />
                <div class="class-level-picker"
                  @keydown.esc.stop.prevent="termPickerOpen = false"
                  @focusout="!$event.currentTarget.contains($event.relatedTarget) && (termPickerOpen = false)">
                  <button type="button" class="class-level-trigger" aria-label="Étape"
                    :aria-expanded="termPickerOpen" aria-controls="eval-term-grid"
                    @click="termPickerOpen = !termPickerOpen">
                    {{ termFilter === '' ? 'Étape' : `Étape ${termFilter}` }}
                  </button>
                  <div v-if="termPickerOpen" id="eval-term-grid" class="class-level-grid" role="group" aria-label="Choisir une étape">
                    <button v-for="n in 3" :key="n" type="button" :aria-pressed="termFilter === n"
                      @click="termFilter = n; termPickerOpen = false">{{ n }}</button>
                    <button type="button" :aria-pressed="termFilter === ''" aria-label="Toutes les étapes"
                      @click="termFilter = ''; termPickerOpen = false"><X :size="16" /></button>
                  </div>
                </div>
              </div>
              <button type="button" class="row-checkbox class-clear-selection" aria-label="Effacer la recherche et l’étape" title="Effacer les filtres"
                @click="search = ''; termFilter = ''; termPickerOpen = false"><X :size="20" :stroke-width="3" /></button>
            </div>

            <p v-if="moveError" role="alert">{{ moveError }}</p>
            <p v-if="onlyFavorites && !filteredEvaluations.length" role="status">Aucune activité favorite ne correspond aux filtres.</p>
            <div class="class-list eval-sort-list" :class="{ 'eval-sort-list--dragging': draggedEval?.active }">
              <div v-if="draggedEval?.active" class="eval-insertion-mark" :style="insertionStyle" aria-hidden="true"></div>
              <div
                v-for="ev in filteredEvaluations"
                :key="ev.id"
                class="eval-sort-row picker-item class-item"
                :data-eval-id="ev.id"
                :style="evalDragStyle(ev.id)"
                :class="{ selected: selectedEvalId === ev.id, 'eval-dragging': draggedEval?.active && draggedEval.id === ev.id }"
              >
                <button
                  type="button"
                  class="eval-drag-handle"
                  :disabled="moving"
                  :aria-label="`Déplacer ${ev.title}`"
                  title="Glisser pour réordonner"
                  @pointerdown.stop="startEvalDrag($event, ev.id)"
                  @pointermove="updateEvalDrag"
                  @pointerup="endEvalDrag"
                  @pointercancel="draggedEval = null"
                  @lostpointercapture="draggedEval = null"
                  @keydown="reorderWithKeyboard($event, ev.id)"
                  @contextmenu.prevent
                >
                  <Equal :size="24" />
                </button>
                <FavoriteButton compact :active="isFavorite(ev.id)" :label="(isFavorite(ev.id) ? 'Retirer des favoris : ' : 'Ajouter aux favoris : ') + ev.title" @toggle="toggleFavorite(ev.id)" />
                <button
                  class="eval-item-content"
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
                      v-glide-select="{ group: 'activities', checked: checkedEvalIds.has(ev.id), toggle: () => handleEvalCheck(ev) }"
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

              <!-- Otherwise show skills list -->
              <div :key="'skills-list'">
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
                          @click="skillInitialTab = 'scale'; skillDetailId = skillDetailId === skill.id ? null : skill.id"
                        >
                          <span>{{ skill.name }}</span>
                          <span
                            class="row-checkbox"
                            :class="{
                              checked: checkedSkillIds.has(skill.id),
                            }"
                            v-glide-select="{ group: 'skills', checked: checkedSkillIds.has(skill.id), toggle: () => handleSkillCheck(skill.id) }"
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
                :initial-tab="skillInitialTab"
                @navigate-skill="skillInitialTab = $event.tab; skillDetailId = $event.id"
                :skill-data="skills.find((s) => s.id === skillDetailId)"
                :skills="skills"
                :editing-skills="getSkillsForEval(selectedEvalId)"
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
    <Teleport to="body">
      <Popup v-if="editingEvalId !== null" title="Modifier l’activité" @close="editingEvalId = null">
      <template #actions><div id="eval-editor-actions" class="eval-editor-actions"></div></template>
                <EvalDetail
                  :key="editingEvalId"
                  @data-changed="emit('data-changed')"
                  :eval-id="editingEvalId"
                  actions-target="#eval-editor-actions"
                  @saved="onEvalSaved"
                  @duplicated="editingEvalId = $event"
                  @deleted="onEvalDeleted"
                />
      </Popup>
    </Teleport>
  </div>
</template>

<style scoped>
.eval-bg :deep(.favorite-button.favorite-button--active) {
  color: var(--modal-accent, #55b880);
}
.class-filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
  padding-right: calc(0.3rem + 2px);
}
.class-search-bar {
  position: relative;
  padding-right: calc(7rem + 8px);
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  min-height: 38px;
  border: none;
  border-radius: var(--field-radius);
  background: var(--surface);
}
.class-search-bar input {
  flex: 1;
  min-width: 0;
  width: 0;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-light);
}
.class-search-bar input::placeholder {
  color: var(--text-light);
  opacity: 0.5;
}
.class-level-picker {
  position: absolute;
  right: 4px;
  top: 4px;
  bottom: 4px;
  width: 7rem;
}
.class-level-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 15px 0 1rem;
  border: none;
  border-radius: var(--field-radius);
  background: color-mix(in srgb, var(--text-light) 20%, var(--student-bg));
  color: var(--text-light);
  font-weight: 600;
  line-height: 1.2;
}
.class-level-trigger svg { flex-shrink: 0; }
.class-level-grid {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  width: 12rem;
  max-width: 70vw;
  padding: 0.5rem;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--text-light) 15%, transparent);
}
.class-level-grid button {
  min-height: 36px;
  border: none;
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-light);
}
.class-level-grid button[aria-pressed="true"] {
  background: var(--accent);
  color: var(--bg-dark);
}

.class-clear-selection { flex: 0 0 32px; padding: 0; color: var(--text-muted); }
:global(:root .picker-screen--modal .archive-toggle.archive-toggle--active) { background: var(--class-accent); color: #ffffff; }

.eval-editor-actions { display: flex; align-items: center; gap: 0.5rem; }
.eval-sort-list { position: relative; isolation: isolate; }
.eval-sort-row {
  position: relative;
  display: flex;
  align-items: center;
  padding-left: 0.65rem;
  gap: 0.2rem;
  flex-shrink: 0;
}
.eval-sort-list--dragging .eval-sort-row {
  transition: transform 160ms ease;
}
.eval-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.eval-insertion-mark {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 999px;
  background: var(--modal-accent, var(--text-light));
  box-shadow: 0 0 0 2px var(--surface);
  pointer-events: none;
  z-index: 3;
}
.eval-insertion-mark::before {
  content: "";
  position: absolute;
  left: -3px;
  top: -3px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--modal-accent, var(--text-light));
}
.eval-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 24px;
  min-height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--text-light);
  background: transparent;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.eval-drag-handle svg { opacity: 0.2; }
.eval-drag-handle:active { cursor: grabbing; }
.eval-drag-handle:focus-visible { outline: 2px solid var(--text-light); }
.eval-sort-row.eval-dragging {
  z-index: 2;
  opacity: 0.85;
  transition: none;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
}
@media (prefers-reduced-motion: reduce) {
  .eval-sort-row { transition: none; }
}
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
