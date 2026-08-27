<script setup>
import { ref, computed } from "vue";
import Popup from "./Popup.vue";

const props = defineProps({
  show: { type: Boolean, required: true },
  icons: { type: Array, required: true },
  selectedIcon: { type: String, default: "" },
  baseUrl: { type: String, default: "/" },
});

const emit = defineEmits(["close", "select"]);

const search = ref("");

const filteredIcons = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return props.icons;
  return props.icons.filter((icon) => icon.includes(q));
});

function handleSelect(iconName) {
  emit("select", iconName);
}

function resetSearch() {
  search.value = "";
}
</script>

<template>
  <Popup
    v-if="show"
    title="Choisir une icône"
    @close="
      $emit('close');
      resetSearch();
    "
  >
    <div class="icon-selector">
      <div class="icon-selector-search">
        <input
          v-model="search"
          class="icon-selector-input"
          placeholder="Chercher une icône…"
          autofocus
        />
      </div>
      <div class="icon-selector-grid">
        <button
          v-for="iconName in filteredIcons"
          :key="iconName"
          class="icon-selector-option"
          :class="{ selected: selectedIcon === iconName }"
          @click="handleSelect(iconName)"
        >
          <img
            :src="`${baseUrl}icons/skills/${iconName}.svg`"
            class="icon-selector-img"
            alt=""
          />
        </button>
      </div>
    </div>
  </Popup>
</template>

<style scoped>
/* Icon Selector specific styles only */
.icon-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.icon-selector-search {
  flex: 0 0 auto;
}

.icon-selector-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 999px;
  background: #f8f9fa;
  color: #333;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.icon-selector-input:focus {
  border-color: #4a90d9;
  background: #fff;
}

.icon-selector-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding: 0.5rem;
}

.icon-selector-option {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 2px solid transparent;
  background: #f8f9fa;
  cursor: pointer;
  padding: 8px;
  transition: all 0.15s;
}

.icon-selector-option:hover {
  background: #e8f0fe;
  transform: scale(1.05);
}

.icon-selector-option.selected {
  background: #fff3cd;
  border-color: #ffc107;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}

.icon-selector-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
