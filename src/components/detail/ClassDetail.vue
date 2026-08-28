<script setup>
import { computed, onMounted, ref } from "vue";
import { Trash2 } from "@lucide/vue";
import { supabase } from "../../supabase";

const props = defineProps({
  classId: { type: String, default: null },
  allStudents: { type: Array, required: true },
});

const emit = defineEmits(["saved", "deleted"]);

const className = ref("");
const loading = ref(false);
const originalClassName = ref("");
const isNewClass = computed(() => !props.classId);
const studentCount = computed(
  () =>
    props.allStudents.filter((student) => student.class_id === props.classId)
      .length,
);

onMounted(async () => {
  if (props.classId) await loadClass(props.classId);
});

async function loadClass(id) {
  loading.value = true;
  try {
    const { data: cls, error: classError } = await supabase
      .from("tu_classes")
      .select("id, name")
      .eq("id", id)
      .single();
    if (classError) throw classError;
    className.value = cls?.name || "";
    originalClassName.value = className.value;
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
    <div v-if="loading && !className" class="detail-loading"></div>
    <template v-else>
      <div class="detail-section">
        <div class="row">
          <button
            v-if="!isNewClass"
            class="btn-icon btn-icon--delete-class"
            title="Supprimer la classe"
            :disabled="loading"
            @click="deleteClass"
          >
            <Trash2 :size="32" />
          </button>
        </div>
        <div class="row">
          <input
            id="class-name"
            v-model="className"
            class="detail-input"
            placeholder="Nom de la classe"
            :disabled="loading || isNewClass"
            @blur="saveClass"
            @keyup.enter="saveClass"
          />
        </div>
        <div class="row">
          <span class="detail-label">Élèves</span>
          <span class="student-count">{{ studentCount }}</span>
        </div>
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

/* .class-name-row,
.student-count-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 100%;
  min-width: 0;
} */

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

.btn-icon--delete-class {
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
