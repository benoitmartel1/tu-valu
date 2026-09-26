<script setup>
import { ref, onMounted } from "vue";
import { Copy, Archive, ArchiveRestore } from "@lucide/vue";
import { supabase } from "../../supabase";
import { duplicateRecord, mutate } from "../../lib/data";
const props = defineProps({ kind: String, id: String });
const emit = defineEmits(["changed", "duplicated"]);
const row = ref(null),
  busy = ref(false),
  error = ref(""),
  includeMembers = ref(false);
const table = props.kind === "class" ? "tu_classes" : "tu_evaluations";
onMounted(async () => {
  try {
    row.value = await mutate(
      supabase.from(table).select("*").eq("id", props.id).single(),
    );
  } catch (e) {
    error.value = e.message;
  }
});
async function save() {
  busy.value = true;
  error.value = "";
  try {
    const values =
      props.kind === "class"
        ? {
            school_grade: row.value.school_grade || null,
            school_year: row.value.school_year || null,
          }
        : {
            school_term: row.value.school_term || null,
            archived_at: row.value.archived_at,
          };
    await mutate(supabase.from(table).update(values).eq("id", props.id));
    emit("changed");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function duplicate() {
  busy.value = true;
  error.value = "";
  try {
    const id = await duplicateRecord(
      props.kind,
      props.id,
      includeMembers.value,
    );
    emit("changed");
    emit("duplicated", id);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function archive() {
  const before = row.value.archived_at;
  row.value.archived_at = before ? null : new Date().toISOString();
  await save();
  if (error.value) row.value.archived_at = before;
}
</script>
<template>
  <div class="feature-fields" v-if="row">
    <template v-if="kind === 'class'">
      <label
        >Niveau scolaire<input
          v-model="row.school_grade"
          placeholder="Ex. 5e année"
          @change="save"
      /></label>
      <label
        >Année scolaire<input
          v-model="row.school_year"
          placeholder="2026–2027"
          @change="save"
      /></label>
      <label
        ><input type="checkbox" v-model="includeMembers" /> Inclure les élèves
        dans la copie (mêmes fiches)</label
      >
    </template>
    <template v-else>
      <label
        >Étape<select v-model="row.school_term" @change="save">
          <option :value="null">Non précisée</option>
          <option v-for="n in 3" :key="n" :value="n">{{ n }}</option>
        </select></label
      >
      <button :disabled="busy" @click="archive">
        <ArchiveRestore v-if="row.archived_at" :size="18" /><Archive
          v-else
          :size="18"
        />
        {{ row.archived_at ? "Restaurer" : "Archiver" }}
      </button>
    </template>
    <button :disabled="busy" @click="duplicate">
      <Copy :size="18" /> Dupliquer
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
