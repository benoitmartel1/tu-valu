<script setup>
import { ref, onMounted } from "vue";
import AuthGuard from "./components/AuthGuard.vue";
import LiveSession from "./components/LiveSession.vue";
import ResetPassword from "./components/ResetPassword.vue";

const showResetPassword = ref(false);

onMounted(() => {
  // Check if we're on the reset password page
  const hash = window.location.hash;
  const pathname = window.location.pathname;

  if (hash.includes("access_token") && hash.includes("type=recovery")) {
    showResetPassword.value = true;
  } else if (pathname.includes("/reset-password")) {
    showResetPassword.value = true;
  }
});
</script>

<template>
  <!-- Show reset password page if URL contains recovery token -->
  <ResetPassword v-if="showResetPassword" />

  <!-- Otherwise show normal app with auth guard -->
  <AuthGuard v-else>
    <div id="app-shell">
      <LiveSession />
    </div>
  </AuthGuard>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  color: var(--text-light);
}
</style>

<style scoped>
#app-shell {
  position: relative;
  min-height: 100vh;
}
</style>
