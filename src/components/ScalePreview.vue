<script setup>
defineProps({ levels: { type: Array, default: () => [] }, criteria: { type: Array, default: () => [] } });
</script>
<template>
  <div class="scale-preview" role="img" :aria-label="`Aperçu de l’échelle : ${levels.join(', ')}`">
    <template v-if="criteria.length">
      <div v-for="criterion in criteria" :key="criterion" class="preview-criterion">
        <span class="preview-criterion-label">{{ criterion }}</span>
        <div class="preview-segments">
          <div v-for="level in levels" :key="level" class="preview-segment">{{ level }}</div>
        </div>
      </div>
    </template>
    <div v-else class="preview-segments">
      <div v-for="level in levels" :key="level" class="preview-segment">{{ level }}</div>
    </div>
  </div>
</template>
<style scoped>
.scale-preview { margin: 0.5rem 0 1rem; border-radius: 12px; overflow: hidden; background: var(--surface); }
.preview-segments { display: flex; gap: 4px; min-height: 110px; overflow-x: auto; }
.preview-segment {
  display: flex; flex: 1 0 36px; align-items: center; justify-content: center;
  padding: 0.5rem 0.2rem; background: color-mix(in srgb, var(--surface-muted) 88%, var(--text-muted));
  color: var(--text-muted); font-family: "Coiny", sans-serif; font-size: 2rem;
}
.preview-criterion + .preview-criterion { margin-top: 0.5rem; }
.preview-criterion-label { display: block; padding: 0.4rem; font-weight: 600; }
.preview-criterion .preview-segments { min-height: 65px; }
</style>
