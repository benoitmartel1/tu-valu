<script setup>
import { ref, onMounted, computed } from "vue";
import { supabase } from "../../supabase";
import { allRows, mutate } from "../../lib/data";
const props = defineProps({ id: String });
const emit = defineEmits(["changed"]);
const student = ref(null),
  classes = ref([]),
  memberships = ref([]),
  teams = ref([]),
  relationships = ref([]);
const error = ref(""),
  busy = ref(false),
  classToAdd = ref(""),
  batch = ref("");
const batches = computed(() => [
  ...new Set(teams.value.map((t) => t.batch_id || "legacy")),
]);
const currentTeams = computed(() =>
  teams.value.filter((t) => (t.batch_id || "legacy") === batch.value),
);
const selectedTeam = computed(
  () =>
    relationships.value.find((r) =>
      currentTeams.value.some((t) => t.id === r.team_id),
    )?.team_id || "",
);
async function load() {
  try {
    [
      student.value,
      classes.value,
      memberships.value,
      teams.value,
      relationships.value,
    ] = await Promise.all([
      mutate(
        supabase.from("tu_students").select("*").eq("id", props.id).single(),
      ),
      allRows(() =>
        supabase.from("tu_classes").select("*").order("name").order("id"),
      ),
      mutate(
        supabase
          .from("tu_student_classes")
          .select("*")
          .eq("student_id", props.id),
      ),
      allRows(() =>
        supabase
          .from("tu_teams")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id"),
      ),
      mutate(
        supabase
          .from("tu_student_teams")
          .select("*")
          .eq("student_id", props.id),
      ),
    ]);
    if (!batch.value) batch.value = batches.value[0] || "";
  } catch (e) {
    error.value = e.message;
  }
}
onMounted(load);
async function action(fn) {
  busy.value = true;
  error.value = "";
  try {
    await fn();
    await load();
    emit("changed");
  } catch (e) {
    error.value =
      e.code === "23505"
        ? "Cette fiche existe déjà. Ajoutez l’élève existant depuis la banque."
        : e.message;
  } finally {
    busy.value = false;
  }
}
function save() {
  return action(() =>
    mutate(
      supabase
        .from("tu_students")
        .update({
          record_number: student.value.record_number?.trim() || null,
          student_number: student.value.student_number?.trim() || null,
          ability_level: student.value.ability_level || null,
          birth_date: student.value.birth_date || null,
        })
        .eq("id", props.id),
    ),
  );
}
function saveMembership(membership) {
  return action(() =>
    mutate(
      supabase
        .from("tu_student_classes")
        .update({ student_number: membership.student_number || null })
        .eq("student_id", props.id)
        .eq("class_id", membership.class_id),
    ),
  );
}
function addClass() {
  if (classToAdd.value)
    return action(() =>
      mutate(
        supabase
          .from("tu_student_classes")
          .insert({ student_id: props.id, class_id: classToAdd.value }),
      ),
    );
}
function removeClass(id) {
  return action(async () => {
    if (student.value.class_id === id)
      await mutate(
        supabase
          .from("tu_students")
          .update({ class_id: null })
          .eq("id", props.id),
      );
    await mutate(
      supabase
        .from("tu_student_classes")
        .delete()
        .eq("student_id", props.id)
        .eq("class_id", id),
    );
  });
}
function assignTeam(event) {
  return action(() =>
    mutate(
      supabase.rpc("tu_assign_team", {
        student: props.id,
        team: event.target.value || null,
        batch: batch.value === "legacy" ? null : batch.value,
      }),
    ),
  );
}
</script>
<template>
  <fieldset class="feature-fields" v-if="student" :disabled="busy">
    <legend>Fiche permanente</legend>
    <label
      >N° de fiche<input v-model="student.record_number" @change="save"
    /></label>
    <label
      >Numéro d’origine<input v-model="student.student_number" @change="save"
    /></label>
    <label
      >Date de naissance<input
        type="date"
        v-model="student.birth_date"
        @change="save"
    /></label>
    <label
      >Niveau d’habileté<select v-model="student.ability_level" @change="save">
        <option :value="null">Non évalué</option>
        <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
      </select></label
    >
    <div v-for="membership in memberships" :key="membership.class_id">
      {{ classes.find((c) => c.id === membership.class_id)?.name }}
      {{ classes.find((c) => c.id === membership.class_id)?.school_year }}
      <input
        v-model="membership.student_number"
        aria-label="Numéro dans ce groupe"
        @change="saveMembership(membership)"
      />
      <button @click="removeClass(membership.class_id)">
        Retirer du groupe
      </button>
    </div>
    <label
      >Ajouter à un groupe<select v-model="classToAdd">
        <option value="">Choisir</option>
        <option
          v-for="group in classes.filter(
            (c) => !memberships.some((m) => m.class_id === c.id),
          )"
          :key="group.id"
          :value="group.id"
        >
          {{ group.name }} {{ group.school_year }}
        </option>
      </select></label
    ><button :disabled="!classToAdd" @click="addClass">Ajouter</button>
    <template v-if="teams.length">
      <label
        >Ensemble d’équipes<select v-model="batch">
          <option v-for="(id, index) in batches" :key="id" :value="id">
            {{
              id === "legacy"
                ? "Anciennes équipes"
                : `Ensemble ${batches.length - index}`
            }}
          </option>
        </select></label
      >
      <label
        >Équipe<select :value="selectedTeam" @change="assignTeam">
          <option value="">Aucune</option>
          <option v-for="team in currentTeams" :key="team.id" :value="team.id">
            {{ team.name }}
          </option>
        </select></label
      >
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </fieldset>
</template>
