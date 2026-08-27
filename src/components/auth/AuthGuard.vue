<script setup>
import { computed } from "vue";
import { Loader2 } from "@lucide/vue";
import AuthModal from "./AuthModal.vue";
import { loading, isAuthenticated, showAuthModal } from "../../stores/auth";

const isReady = computed(() => !loading.value);
</script>

<template>
  <div class="auth-guard">
    <!-- Loading state -->
    <div v-if="!isReady" class="loading-screen">
      <Loader2 :size="48" class="spinner" />
      <p>Loading...</p>
    </div>

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

.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
  color: var(--text-light);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.auth-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--text-muted);
}
</style>
