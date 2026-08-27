<script setup>
import { computed, onMounted, ref } from "vue";
import { Trash2 } from "@lucide/vue";
import { supabase } from "../../supabase";

const props = defineProps({
  evalId: { type: String, default: null },
});

const emit = defineEmits(["saved", "deleted"]);

const evalTitle = ref("");
const skillCount = ref(0);
const loading = ref(false);
const originalEvalTitle = ref("");
const isNewEval = computed(() => !props.evalId);

onMounted(async () => {
  if (props.evalId) await loadEval(props.evalId);
});

async function loadEval(id) {
  loading.value = true;
  try {
    const [{ data: ev, error: evalError }, { count, error: skillError }] =
      await Promise.all([
        supabase
          .from("tu_evaluations")
          .select("id, title")
          .eq("id", id)
          .single(),
        supabase
          .from("tu_skills")
          .select("id", { count: "exact", head: true })
          .eq("evaluation_id", id),
      ]);
    if (evalError) throw evalError;
    if (skillError) throw skillError;
    evalTitle.value = ev?.title || "";
    originalEvalTitle.value = evalTitle.value;
    skillCount.value = count || 0;
  } catch (error) {
    console.error("Failed to load evaluation:", error);
  } finally {
    loading.value = false;
  }
}

async function saveEval() {
  const title = evalTitle.value.trim();
  if (
    !title ||
    title === originalEvalTitle.value ||
    isNewEval.value ||
    loading.value
  )
    return;

  loading.value = true;
  try {
    const { error } = await supabase
      .from("tu_evaluations")
      .update({ title })
      .eq("id", props.evalId);
    if (error) throw error;
    originalEvalTitle.value = title;
    emit("saved");
  } catch (error) {
    console.error("Failed to save evaluation:", error);
  } finally {
    loading.value = false;
  }
}

async function deleteEval() {
  if (isNewEval.value || loading.value) return;
  if (!confirm("Supprimer cette activité et toutes ses habiletés ?")) return;

  loading.value = true;
  try {
    // Delete all skills for this evaluation first
    await supabase.from("tu_skills").delete().eq("evaluation_id", props.evalId);

    // Then delete the evaluation
    const { error } = await supabase
      .from("tu_evaluations")
      .delete()
      .eq("id", props.evalId);
    if (error) throw error;
    emit("deleted");
  } catch (error) {
    console.error("Failed to delete evaluation:", error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="eval-detail">
    <div v-if="loading && !evalTitle" class="detail-loading"></div>
    <template v-else>
      <div class="detail-section">
        <div class="row">
          <!-- <label class="detail-label" for="eval-title">Titre</label> -->
          <button
            v-if="!isNewEval"
            class="btn-icon btn-icon--delete-eval"
            title="Supprimer l'activité"
            :disabled="loading"
            @click="deleteEval"
          >
            <Trash2 :size="32" />
          </button>
        </div>
        <div class="row">
          <input
            id="eval-title"
            v-model="evalTitle"
            class="detail-input"
            placeholder="Nom de l'activité"
            :disabled="loading || isNewEval"
            @blur="saveEval"
            @keyup.enter="saveEval"
          />
        </div>
        <div class="row">
          <span class="detail-label">Habiletés</span>
          <span class="student-count">{{ skillCount }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.eval-detail {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
  padding: 0 0 1rem;
  color: var(--text-light);
}

.detail-loading {
  padding: 2rem;
  text-align: center;
  color: var(--text-light);
  opacity: 0.55;
  font-style: italic;
}

.detail-section {
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.row {
  width: 100%;
  display: flex;
  /* display: flex;
  align-items: center; */
  gap: 0.75rem;
}

.detail-label {
  display: block;
  flex-shrink: 0;
  margin: 0;
  color: #fff;
  font-size: 1.125rem;
  font-weight: 700;
}

.detail-input {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 0;
  border-radius: 999px;
  background: rgba(33, 37, 41, 0.6);
  color: var(--text-light);
  font: inherit;
  font-size: 1.5rem;
  outline: none;
}

.detail-input:disabled {
  opacity: 0.65;
}

.btn-icon {
  margin-left: auto;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0.3rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-light);
  cursor: pointer;
}

.btn-icon--delete-eval {
  color: white;
}

.btn-icon:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.student-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #a8dadc42;
  font-size: 0.8rem;
  font-weight: 700;
}
</style>
