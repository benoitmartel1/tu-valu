<script setup>
import { computed } from "vue";

const props = defineProps({ events: { type: Array, required: true } });
const latest = computed(() => props.events.at(-1));
const history = computed(() => props.events.slice(0, -1));
const average = computed(() => {
  const marks = props.events
    .map((event) => Number.parseFloat(event.level))
    .filter(Number.isFinite);
  if (!marks.length) return "—";
  const value = marks.reduce((sum, mark) => sum + mark, 0) / marks.length;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
});
const displayMark = (level) => (level === "abs" ? "ABS" : level);
</script>

<template>
  <div class="evaluation-marks">
    <span class="evaluation-history" aria-label="Évaluations précédentes">
      <span v-for="event in history" :key="event.id" class="evaluation-mark">{{
        displayMark(event.level)
      }}</span>
    </span>
    <strong
      class="evaluation-mark evaluation-latest"
      aria-label="Dernière évaluation"
      title="Dernière évaluation"
      >{{ displayMark(latest?.level) }}</strong
    >
    <span
      class="evaluation-average"
      :aria-label="`Moyenne : ${average}`"
      title="Moyenne des notes (absences exclues)"
    >
      <span class="evaluation-average-label">Moy.</span>
      <span>{{ average }}</span>
    </span>
  </div>
</template>

<style scoped>
.evaluation-marks {
  --mark-height: 2.5rem;
  --mark-gap: 0.375rem;
  display: grid;
  grid-template-columns: minmax(3rem, 1fr) var(--mark-height) 5rem;
  align-items: center;
  gap: var(--mark-gap);
  min-width: 11.5rem;
  height: var(--mark-height);
  color: var(--court-blue);
  font-variant-numeric: tabular-nums;
}
.evaluation-history {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  white-space: nowrap;
  justify-content: flex-end;
  gap: var(--mark-gap);
  font-size: 0.9rem;
  font-weight: 400;
}
.evaluation-mark {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 0 0 var(--mark-height);
  height: var(--mark-height);
  aspect-ratio: 1;
  /* padding: 0.15rem; */
  border: 1px solid color-mix(in srgb, var(--court-blue) 45%, transparent);
  border-radius: 0.35rem;
  box-sizing: border-box;
  font-size: 0.9rem;
}
.evaluation-latest {
  border-width: 2px;
  font-weight: 800;
}
.evaluation-average {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.6rem;
  box-sizing: border-box;
  text-align: center;
  height: var(--mark-height);
  border-radius: 0.35rem;
  background: color-mix(in srgb, var(--court-blue) 12%, transparent);
  font-size: 0.9rem;
  font-weight: 600;
}
.evaluation-average-label {
  justify-self: start;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 400;
}
</style>
