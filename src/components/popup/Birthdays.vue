<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";
import Popup from "./Popup.vue";
import StudentAvatar from "../StudentAvatar.vue";
import { birthdayInDays, fullName } from "../../lib/domain";
const props = defineProps({ students: Array, selectedStudents: Array });
const all = ref(false),
  upcoming = ref(false),
  today = ref(new Date());
let timer;
onMounted(() => {
  timer = setInterval(() => {
    today.value = new Date();
  }, 60000);
});
onUnmounted(() => clearInterval(timer));
defineEmits(["close"]);
const birthdays = computed(() =>
  (all.value ? props.students : props.selectedStudents)
    .map((student) => ({
      student,
      days: birthdayInDays(student.birth_date, today.value),
    }))
    .filter((row) => row.days !== null && row.days <= (upcoming.value ? 30 : 0))
    .sort(
      (a, b) =>
        a.days - b.days ||
        fullName(a.student).localeCompare(fullName(b.student), "fr"),
    ),
);
</script>
<template>
  <Popup title="Anniversaires" @close="$emit('close')">
    <div class="feature-toolbar">
      <label><input type="checkbox" v-model="all" /> Tous les groupes</label
      ><label
        ><input type="checkbox" v-model="upcoming" /> Les 30 prochains
        jours</label
      >
    </div>
    <p v-if="!birthdays.length">Aucun anniversaire dans cette sélection.</p>
    <div v-for="row in birthdays" :key="row.student.id" class="birthday-row">
      <StudentAvatar :student="row.student" /><span
        >{{ fullName(row.student) }} —
        {{ row.days === 0 ? "Aujourd’hui" : `Dans ${row.days} jour(s)` }}</span
      >
    </div>
    <small
      >Les anniversaires du 29 février sont affichés le 1er mars les années non
      bissextiles.</small
    >
  </Popup>
</template>
<style scoped>
.birthday-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.6rem;
}
</style>
