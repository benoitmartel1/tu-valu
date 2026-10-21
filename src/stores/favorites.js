import { computed } from "vue";
import { useUserFilter } from "./userFilters";

export function useFavorites(kind) {
  const saved = useUserFilter(`${kind}-favorites`, value =>
    Array.isArray(value) && value.every(id => typeof id === "string"));
  const onlyFavorites = useUserFilter(`${kind}-favorites-only`, value => typeof value === "boolean");
  const ids = computed(() => new Set(saved.value || []));
  const isFavorite = id => ids.value.has(String(id));
  function toggleFavorite(id) {
    const next = new Set(ids.value);
    if (next.has(String(id))) next.delete(String(id));
    else next.add(String(id));
    saved.value = [...next];
  }
  return { onlyFavorites, isFavorite, toggleFavorite };
}
