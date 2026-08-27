import { createApp } from "vue";
import "./style.css";
import "./styles/shared.css";
import App from "./App.vue";
import { initAuth } from "./stores/auth";

// Initialize authentication before mounting the app
initAuth().then(() => {
  createApp(App).mount("#app");
});
