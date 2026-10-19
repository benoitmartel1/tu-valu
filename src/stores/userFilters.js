import { ref, watch } from "vue";
import { userId } from "./auth";

// Account-scoped defaults on this browser; never reuse another account's filters.
export function useUserFilter(name, isValid) {
  const value = ref("");
  const key = () => userId.value ? `tu-valu-filter:${userId.value}:${name}` : null;
  watch(userId, () => {
    let saved = "";
    try {
      const stored = key() && localStorage.getItem(key());
      if (stored) saved = JSON.parse(stored);
    } catch { /* Fall back to an unfiltered view. */ }
    value.value = isValid(saved) ? saved : "";
  }, { immediate: true, flush: "sync" });
  watch(value, selected => {
    const storageKey = key();
    if (!storageKey) return;
    try {
      if (selected === "") localStorage.removeItem(storageKey);
      else if (isValid(selected)) localStorage.setItem(storageKey, JSON.stringify(selected));
    } catch { /* Filters still work when browser storage is unavailable. */ }
  }, { flush: "sync" });
  return value;
}
