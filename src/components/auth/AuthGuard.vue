<script setup>
import { computed } from "vue";
import LoadingPopup from "../popup/LoadingPopup.vue";
import AuthModal from "./AuthModal.vue";
import { loading, isAuthenticated, showAuthModal } from "../../stores/auth";

const isReady = computed(() => !loading.value);
</script>

<template>
  <div class="auth-guard">
    <!-- Loading state -->
    <LoadingPopup v-if="!isReady" />

    <!-- Authenticated content -->
    <template v-else-if="isAuthenticated">
      <slot></slot>
    </template>

    <!-- Not authenticated - show auth modal -->
    <template v-else>
      <slot name="fallback">
        <div class="auth-prompt">
          <p>Please sign in to continue</p>
        </div>
      </slot>
    </template>

    <!-- Auth modal (always rendered but controlled by store) -->
    <AuthModal />
  </div>
</template>

<style scoped>
.auth-guard {
  min-height: 100vh;
}

.auth-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--text-muted);
}
</style>
