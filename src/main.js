import { createApp } from "vue";
import "./style.css";
import "./styles/shared.css";
import "./styles/themes.css";
import "./stores/preferences";
import App from "./App.vue";
import PopupSelect from "./components/PopupSelect.js";
import { initAuth } from "./stores/auth";

// Initialize authentication before mounting the app
initAuth().then(() => {
  createApp(App).component("PopupSelect", PopupSelect).mount("#app");
});
