<script setup>
import { ref } from "vue";
import { supabase } from "../supabase";

const emit = defineEmits(["done"]);

const evaluations = ref([
  { title: "", rawText: "", scaleText: "1\n2\n3\n4\n5" },
]);
const saving = ref(false);
const error = ref(null);

function parseSkills(rawText) {
  return rawText
    .split("\n")
    .map((line) => line.split("\t")[0].trim())
    .filter((name) => name.length > 0);
}

function parseScale(scaleText) {
  return scaleText
    .split("\n")
    .map((line) => line.trim())
    .filter((l) => l.length > 0);
}

function addEvaluation() {
  evaluations.value.push({
    title: "",
    rawText: "",
    scaleText: "1\n2\n3\n4\n5",
  });
}

function removeEvaluation(index) {
  evaluations.value.splice(index, 1);
}

async function saveAll() {
  error.value = null;
  const valid = evaluations.value.filter(
    (e) => e.title.trim() && parseSkills(e.rawText).length > 0,
  );
  if (valid.length === 0) {
    error.value = "Add at least one evaluation with a title and skills.";
    return;
  }
  saving.value = true;
  try {
    for (const ev of valid) {
      const { data: evData, error: evError } = await supabase
        .from("tu_evaluations")
        .insert({ title: ev.title.trim() })
        .select()
        .single();
      if (evError) throw evError;

      const scale = parseScale(ev.scaleText || "");
      const { error: skillsError } = await supabase.from("tu_skills").insert(
        parseSkills(ev.rawText).map((name) => ({
          name,
          evaluation_id: evData.id,
          scale: scale.length > 0 ? scale : ["1", "2", "3", "4", "5"],
        })),
      );
      if (skillsError) throw skillsError;
    }
    emit("done");
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="setup">
    <h2>Evaluations &amp; skills</h2>

    <div v-for="(ev, i) in evaluations" :key="i" class="eval-block">
      <div class="eval-header">
        <input
          v-model="ev.title"
          placeholder="Evaluation title (e.g. Basketball, Gymnastics L1)"
          class="eval-title-input"
        />
        <button
          v-if="evaluations.length > 1"
          class="remove-btn"
          @click="removeEvaluation(i)"
        >
          ✕
        </button>
      </div>

      <textarea
        v-model="ev.rawText"
        placeholder="Paste skills here — one per line.
e.g. Dribbling, Shooting, Passing…"
        rows="6"
      />

      <label class="scale-label">Evaluation scale (one level per line)</label>
      <textarea
        v-model="ev.scaleText"
        placeholder="1
2
3
4
5"
        rows="5"
        class="scale-input"
      />

      <div v-if="parseSkills(ev.rawText).length" class="preview">
        <span
          v-for="skill in parseSkills(ev.rawText)"
          :key="skill"
          class="skill-chip"
        >
          {{ skill }}
        </span>
      </div>
    </div>

    <button class="add-eval-btn" @click="addEvaluation">
      + Add another evaluation
    </button>

    <p v-if="error" class="error">{{ error }}</p>

    <button class="save-btn" :disabled="saving" @click="saveAll">
      {{ saving ? "Saving…" : "Save evaluations" }}
    </button>
  </div>
</template>

<style scoped>
.setup {
  max-width: 560px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: sans-serif;
}

h2 {
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
}

.eval-block {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.eval-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.eval-title-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}

.remove-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0 0.6rem;
  cursor: pointer;
  color: #888;
  font-size: 0.9rem;
}
.remove-btn:hover {
  color: #c00;
  border-color: #c00;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: vertical;
  font-family: monospace;
  line-height: 1.5;
}

.preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
}

.skill-chip {
  background: #fef3e2;
  color: #b45309;
  border-radius: 20px;
  padding: 0.2rem 0.7rem;
  font-size: 0.85rem;
}

.add-eval-btn {
  background: none;
  border: 2px dashed #aaa;
  border-radius: 8px;
  padding: 0.6rem 1.2rem;
  width: 100%;
  cursor: pointer;
  color: #555;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}
.add-eval-btn:hover {
  border-color: #555;
  color: #222;
}

.error {
  color: #c00;
  margin-bottom: 0.8rem;
  font-size: 0.9rem;
}

.save-btn {
  width: 100%;
  padding: 0.8rem;
  background: #1a56db;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.save-btn:hover:not(:disabled) {
  background: #1446b8;
}
.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.scale-label {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #666;
}

.scale-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: vertical;
  font-family: monospace;
  line-height: 1.4;
  margin-top: 0.3rem;
  margin-bottom: 0.5rem;
}
</style>
