import { reactive, watch } from "vue";
const defaults = {
  theme: "dark",
  gallery: false,
  showPhoto: false,
  individual: true,
  showFirstname: true,
  showLastname: false,
  showInitial: false,
  showCustomName: false,
  pasteHeight: 280,
};
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("tu-valu-preferences") || "{}");
} catch {
  /* Storage may be unavailable. */
}
export const preferences = reactive({ ...defaults, ...saved });
watch(
  preferences,
  (value) => {
    document.documentElement.dataset.theme = value.theme;
    try {
      localStorage.setItem("tu-valu-preferences", JSON.stringify(value));
    } catch {
      /* Session preferences still work. */
    }
  },
  { deep: true, immediate: true },
);
