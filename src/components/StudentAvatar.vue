<script setup>
import { ref, watch } from "vue";
import { getStudentPhotoPresignedUrl } from "../supabase";
import { fullName } from "../lib/domain";
const props = defineProps({ student: { type: Object, required: true } });
const url = ref(null);
const cache = new Map();
let request = 0;
watch(
  () => props.student.photo_url,
  async (path) => {
    const current = ++request;
    url.value = null;
    if (!path) return;
    try {
      const cached = cache.get(path);
      const result =
        cached && cached.expires > Date.now()
          ? cached.url
          : (await getStudentPhotoPresignedUrl(path)).presignedUrl;
      if (current === request) url.value = result;
      if (result)
        cache.set(path, { url: result, expires: Date.now() + 240000 });
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
      @error="url = null"
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
}
</style>
