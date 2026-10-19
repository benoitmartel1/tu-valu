<script setup>
import { ref, computed, onMounted } from "vue";
import { Copy, ChevronLeft, ChevronRight } from "@lucide/vue";
import { supabase } from "../../supabase";
import { mutate, duplicateRecord } from "../../lib/data";
import ScalePreview from "../ScalePreview.vue";
import { gradeScale } from "../../lib/domain";
const props = defineProps({ id: String, section: { type: String, default: "scale" } });
const emit = defineEmits(["changed", "duplicated"]);
const skill = ref(null),
  modifiers = ref(true),
  categories = ref("Respect\nEsprit sportif\nEffort"),
  error = ref(""),
  busy = ref(true),
  hasHistory = ref(false);
const letterMin = ref("D"), letterMax = ref("A"), letterStep = ref(1);
const letterGrades = computed(() => {
  const letters = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").reverse();
  return modifiers.value
    ? letters.flatMap((letter) => [letter + "-", letter, letter + "+"])
    : letters;
});
const letterScale = computed(() => {
  const grades = letterGrades.value;
  const from = Math.max(0, grades.indexOf(letterMin.value));
  const to = grades.indexOf(letterMax.value);
  if (grades.indexOf(letterMin.value) < 0 || to <= from || !Number.isInteger(letterStep.value) || letterStep.value < 1 || letterStep.value > to - from) return [];
  return grades.slice(from, to + 1).filter((_, index) => index % letterStep.value === 0);
});
const categoryLabels = computed(() => [...new Set(categories.value.split("\n").map((label) => label.trim()).filter(Boolean))]);
function shiftLetter(bound, delta) {
  const grades = letterGrades.value;
  const current = bound === "min" ? letterMin.value : letterMax.value;
  const index = grades.indexOf(current) + delta;
  if (index < 0 || index >= grades.length) return;
  if (bound === "min") {
    if (index >= grades.indexOf(letterMax.value)) return;
    letterMin.value = grades[index];
  } else {
    if (index <= grades.indexOf(letterMin.value)) return;
    letterMax.value = grades[index];
  }
  saveLetterInputs();
}
function saveLetterInputs() {
  letterMin.value = String(letterMin.value).trim().toUpperCase();
  letterMax.value = String(letterMax.value).trim().toUpperCase();
  if (!letterScale.value.length) {
    error.value = "Choisissez des cotes Min / Max valides et un pas entier compris entre les deux.";
    return;
  }
  save(true);
}
function shiftLetterStep(delta) {
  const next = letterStep.value + delta;
  const distance = letterGrades.value.indexOf(letterMax.value) - letterGrades.value.indexOf(letterMin.value);
  if (next < 1 || next > distance) return;
  letterStep.value = next;
  saveLetterInputs();
}
function changeModifiers() {
  letterStep.value = 1;
  letterMin.value = letterGrades.value[0];
  letterMax.value = letterGrades.value.at(-1);
  save(true);
}
onMounted(async () => {
  try {
    skill.value = await mutate(
      supabase.from("tu_skills").select("*").eq("id", props.id).single(),
    );
    modifiers.value = skill.value.scale?.some((label) => /[+-]/.test(label)) || false;
    if (skill.value.grading_mode === "letter") {
      letterMin.value = skill.value.scale?.[0] || "D";
      letterMax.value = skill.value.scale?.at(-1) || "A";
      if (skill.value.scale?.length > 1) {
        letterStep.value = Math.max(1, letterGrades.value.indexOf(skill.value.scale[1]) - letterGrades.value.indexOf(skill.value.scale[0]));
      }
    }
    if (skill.value.grading_mode === "category")
      categories.value = skill.value.scale.join("\n");
    if (skill.value.grading_mode === "rubric")
      categories.value = skill.value.criteria.join("\n");
    const events = await mutate(
      supabase
        .from("tu_session_events")
        .select("id")
        .eq("skill_id", props.id)
        .neq("level", "abs")
        .limit(1),
    );
    hasHistory.value = events.length > 0;
  } catch (e) {
    error.value = e.message;
    hasHistory.value = true;
  } finally {
    busy.value = false;
  }
});
async function save(changeScale = false) {
  busy.value = true;
  error.value = "";
  try {
    const values = {
      grading_mode: skill.value.grading_mode,
      max_observations: skill.value.max_observations || null,
    };
    if (changeScale) {
      if (values.grading_mode === "letter")
        values.scale = [...letterScale.value];
      else if (values.grading_mode === "rubric") {
        values.criteria = [
          ...new Set(
            categories.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ];
        values.scale = ["-3", "-2", "-1", "0", "1", "2", "3"];
        if (!values.criteria.length)
          throw new Error("Ajoutez au moins un critère.");
      } else if (values.grading_mode === "category")
        values.scale = [
          ...new Set(
            categories.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ];
      else values.scale = ["1", "2", "3", "4", "5"];
      if (!values.scale.length)
        throw new Error("Ajoutez au moins une catégorie.");
    }
    await mutate(supabase.from("tu_skills").update(values).eq("id", props.id));
    Object.assign(skill.value, values);
    emit("changed");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function duplicate() {
  busy.value = true;
  try {
    const id = await duplicateRecord("skill", props.id);
    emit("changed");
    emit("duplicated", id);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <fieldset v-if="skill" class="feature-fields skill-options" :disabled="busy">
    <legend class="skill-options-legend">{{ section === 'info' ? 'Informations' : 'Notation' }}</legend>
    <div v-show="section === 'scale'" id="skill-panel-scale" role="tabpanel" aria-labelledby="skill-tab-scale" class="skill-options-panel">
    <label
      >Type<PopupSelect
        v-model="skill.grading_mode"
        :disabled="hasHistory"
        @change="save(true)"
      >
        <option value="numeric">Chiffres</option>
        <option value="letter">Cotes</option>
        <option value="category">Observations / comportement</option>
      </PopupSelect></label
    >
    <small v-if="hasHistory"
      >Pour changer de type après des observations, dupliquez cette
      habileté.</small
    >
    <template v-if="skill.grading_mode === 'letter'"
      ><label
        ><input
          type="checkbox"
          v-model="modifiers"
          :disabled="hasHistory"
          @change="changeModifiers"
        />
        Cotes avec + et −</label
      >
      <ScalePreview :levels="letterScale" />
      <div class="letter-bounds">
        <div v-for="bound in ['min', 'max']" :key="bound" class="letter-bound">
          <span>{{ bound === 'min' ? 'Min' : 'Max' }}</span>
          <div class="letter-bound-controls">
            <button type="button" :aria-label="`Diminuer ${bound}`"
              :disabled="bound === 'min' ? letterGrades.indexOf(letterMin) <= 0 : letterGrades.indexOf(letterMax) <= letterGrades.indexOf(letterMin) + 1"
              @click="shiftLetter(bound, -1)"><ChevronLeft :size="20" /></button>
                        <input v-if="bound === 'min'" v-model="letterMin" aria-label="Cote minimum" @change="saveLetterInputs" />
            <input v-else v-model="letterMax" aria-label="Cote maximum" @change="saveLetterInputs" />
            <button type="button" :aria-label="`Augmenter ${bound}`"
              :disabled="bound === 'max' ? letterGrades.indexOf(letterMax) >= letterGrades.length - 1 : letterGrades.indexOf(letterMin) >= letterGrades.indexOf(letterMax) - 1"
              @click="shiftLetter(bound, 1)"><ChevronRight :size="20" /></button>
          </div>
        </div>
        <div class="letter-bound">
          <span>Pas</span>
          <div class="letter-bound-controls">
            <button type="button" aria-label="Diminuer le pas" :disabled="letterStep <= 1" @click="shiftLetterStep(-1)"><ChevronLeft :size="20" /></button>
            <input v-model.number="letterStep" type="number" min="1" :max="letterGrades.indexOf(letterMax) - letterGrades.indexOf(letterMin)" step="1" aria-label="Pas des cotes" @change="saveLetterInputs" />
            <button type="button" aria-label="Augmenter le pas" :disabled="letterStep >= letterGrades.indexOf(letterMax) - letterGrades.indexOf(letterMin)" @click="shiftLetterStep(1)"><ChevronRight :size="20" /></button>
          </div>
        </div>
      </div>
      </template>
    <ScalePreview v-if="skill.grading_mode === 'category'" :levels="categoryLabels" />
    <ScalePreview v-if="skill.grading_mode === 'rubric'" :levels="['-3', '-2', '-1', '0', '1', '2', '3']" :criteria="categoryLabels" />
    <label v-if="['category', 'rubric'].includes(skill.grading_mode)" class="category-editor"
      >Critères / catégories (un par ligne)<textarea
        v-model="categories"
        @change="save(true)"
      ></textarea>
    </label>
    <slot name="scale" :skill="skill" />
    </div>
    <div v-show="section === 'info'" id="skill-panel-info" role="tabpanel" aria-labelledby="skill-tab-info" class="skill-options-panel">
    <slot name="info" />
    <button @click="duplicate"><Copy :size="18" /> Dupliquer l’habileté</button>
    <label
      >Maximum de traces par élève<input
        type="number"
        min="1"
        step="1"
        v-model.number="skill.max_observations"
        placeholder="Illimité"
        @change="save()"
    /></label>
    <small
      >Le maximum s’applique à tout l’historique de cette habileté. Une absence
      ne compte pas.</small
    >
    
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
.skill-options { flex: 1; min-height: 0; margin-bottom: 0; }
.skill-options-panel { flex: 1; min-height: 0; overflow-y: auto; }
.skill-options-panel > :not(.category-editor) { flex-shrink: 0; }
.skill-options-panel > .category-editor {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 0 160px;
  min-height: 160px;
}
.category-editor textarea {
  flex: 1;
  width: 100%;
  min-height: 120px;
  resize: vertical;
}
.letter-bounds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
.letter-bound { min-width: 0; }
.letter-bound > span { font-size: 0.85rem; color: var(--text-muted); }
.letter-bound-controls { display: flex; align-items: center; justify-content: space-between; gap: 0; }
.letter-bound-controls button { flex: 0 0 22px; width: 22px; min-width: 22px; height: 38px; padding: 0; border: 0; background: transparent; }
.letter-bound-controls input { width: 100%; min-width: 0; text-align: center; font-size: 1rem; padding: 0.5rem 0 !important; }
.skill-options-legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.skill-options-panel { display: flex; flex-direction: column; gap: 0.65rem; min-width: 0; }
</style>