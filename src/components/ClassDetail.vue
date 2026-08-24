<script setup>
import { computed, onMounted, ref } from "vue";
import { Trash2 } from "@lucide/vue";
import { supabase } from "../supabase";

const props = defineProps({
  classId: { type: String, default: null },
});

const emit = defineEmits(["saved", "deleted"]);

const className = ref("");
const studentCount = ref(0);
const loading = ref(false);
const originalClassName = ref("");
const isNewClass = computed(() => !props.classId);

onMounted(async () => {
  if (props.classId) await loadClass(props.classId);
});

async function loadClass(id) {
  loading.value = true;
  try {
    const [{ data: cls, error: classError }, { count, error: studentError }] =
      await Promise.all([
        supabase.from("tu_classes").select("id, name").eq("id", id).single(),
        supabase
          .from("tu_students")
          .select("id", { count: "exact", head: true })
          .eq("class_id", id),
      ]);
    if (classError) throw classError;
    if (studentError) throw studentError;
    className.value = cls?.name || "";
    originalClassName.value = className.value;
    studentCount.value = count || 0;
  } catch (error) {
    console.error("Failed to load class:", error);
  } finally {
    loading.value = false;
  }
}

async function saveClass() {
  const name = className.value.trim();
  if (
    !name ||
    name === originalClassName.value ||
    isNewClass.value ||
    loading.value
  )
    return;

  loading.value = true;
  try {
    const { error } = await supabase
      .from("tu_classes")
      .update({ name })
      .eq("id", props.classId);
    if (error) throw error;
    originalClassName.value = name;
    emit("saved");
  } catch (error) {
    console.error("Failed to save class:", error);
  } finally {
    loading.value = false;
  }
}

async function deleteClass() {
  if (isNewClass.value || loading.value) return;
  if (!confirm("Supprimer cette classe et tous ses élèves ?")) return;

  loading.value = true;
  try {
    const { error } = await supabase
      .from("tu_classes")
      .delete()
      .eq("id", props.classId);
    if (error) throw error;
    emit("deleted");
  } catch (error) {
    console.error("Failed to delete class:", error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="class-detail">
    <div v-if="loading && !className" class="detail-loading">Chargement...</div>
    <template v-else>
      <div class="detail-section">
        <div class="class-name-row">
          <label class="detail-label" for="class-name">Nom</label>
          <input
            id="class-name"
            v-model="className"
            class="detail-input"
            placeholder="Ex: 3A"
            :disabled="loading || isNewClass"
            @blur="saveClass"
            @keyup.enter="saveClass"
          />
          <button
            v-if="!isNewClass"
            class="btn-icon btn-icon--delete-class"
            title="Supprimer la classe"
            :disabled="loading"
            @click="deleteClass"
          >
            <Trash2 :size="24" />
          </button>
        </div>
      </div>
      <div class="detail-section student-count-section">
        <span class="detail-label">Élèves</span>
        <span class="student-count">{{ studentCount }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.class-detail {
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
  padding: 0.75rem 1rem;
}

.class-name-row,
.student-count-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 100%;
  min-width: 0;
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

.btn-icon--delete-class {
  color: #ffb4a2;
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
