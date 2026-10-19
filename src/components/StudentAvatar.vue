<script setup>
import { ref, watch } from "vue";
import { loadStudentPhoto, peekStudentPhoto } from "../stores/studentPhotos";
import { fullName } from "../lib/domain";
const props = defineProps({ student: { type: Object, required: true } });
const url = ref(null);
let request = 0;
watch(
  () => props.student.photo_url,
  async (path) => {
    const current = ++request;
    const cached = path && peekStudentPhoto(path);
    url.value = cached || null;
    if (cached) return;
    if (!path) return;
    try {
      const result = await loadStudentPhoto(path);
      if (current === request) url.value = result;
    } catch {
      /* Keep initials on network failure. */
    }
  },
  { immediate: true },
);
</script>
<template>
  <span class="student-avatar" :aria-label="fullName(student)">
    <img
      v-if="url"
      :src="url"
      :alt="fullName(student)"
      draggable="false"
      @error="url = null; console.warn('[Student photos] Image download failed after signing.')"
    />
    <span v-else>{{
      (student.firstname?.[0] || "") + (student.lastname?.[0] || "")
    }}</span>
  </span>
</template>
<style scoped>
.student-avatar {
  display: inline-flex;
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-muted);
  color: var(--text-light);
}
.student-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 38%;
  border-radius: 0;
}
</style>
