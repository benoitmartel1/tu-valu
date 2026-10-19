<script setup>
import { ref, onMounted } from "vue";
import { Copy } from "@lucide/vue";
import { supabase } from "../../supabase";
import { mutate, duplicateRecord } from "../../lib/data";
import { gradeScale } from "../../lib/domain";
const props = defineProps({ id: String, section: { type: String, default: "scale" } });
const emit = defineEmits(["changed", "duplicated"]);
const skill = ref(null),
  modifiers = ref(true),
  categories = ref("Respect\nEsprit sportif\nEffort"),
  error = ref(""),
  busy = ref(true),
  hasHistory = ref(false);
onMounted(async () => {
  try {
    skill.value = await mutate(
      supabase.from("tu_skills").select("*").eq("id", props.id).single(),
    );
    modifiers.value = skill.value.scale?.includes("A+");
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
        values.scale = gradeScale("letter", modifiers.value);
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
  <fieldset v-if="skill" class="feature-fields" :disabled="busy">
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
        <option value="rubric">Grille multi-score (+3 à −3)</option>
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
          @change="save(true)"
        />
        Cotes avec + et −</label
      ><small
        >{{ modifiers ? "D=1 à A+=10" : "D=2,5 · C=5 · B=7,5 · A=10" }}. Moyenne
        arrondie à la cote supérieure.</small
      ></template
    >
    <label v-if="['category', 'rubric'].includes(skill.grading_mode)"
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
.skill-options-legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.skill-options-panel { display: flex; flex-direction: column; gap: 0.65rem; min-width: 0; }
</style>