<script setup>
import { ref } from 'vue'
import { Users, Dumbbell } from '@lucide/vue'
import ClassSetup  from './components/ClassSetup.vue'
import SkillSetup  from './components/SkillSetup.vue'
import LiveSession from './components/LiveSession.vue'

const modal = ref(null) // null | 'classes' | 'skills'
</script>

<template>
  <div id="app-shell">

    <LiveSession />

    <!-- Floating action buttons -->
    <div class="fabs">
      <button
        class="fab"
        :class="{ active: modal === 'classes' }"
        title="Classes"
        @click="modal = modal === 'classes' ? null : 'classes'"
      >
        <Users :size="22" />
      </button>
      <button
        class="fab"
        :class="{ active: modal === 'skills' }"
        title="Évaluations"
        @click="modal = modal === 'skills' ? null : 'skills'"
      >
        <Dumbbell :size="22" />
      </button>
    </div>

    <!-- Modal overlay -->
    <Teleport to="body">
      <div v-if="modal" class="modal-overlay" @click.self="modal = null">
        <div class="modal-card">
          <button class="modal-close" @click="modal = null">✕</button>
          <ClassSetup v-if="modal === 'classes'" @done="modal = null" />
          <SkillSetup v-if="modal === 'skills'"  @done="modal = null" />
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #fff; color: #111; font-family: system-ui, sans-serif; }
</style>

<style scoped>
#app-shell {
  position: relative;
  min-height: 100vh;
}

/* ── FABs ───────────────────────────────────────────── */
.fabs {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 50;
}

.fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: rgba(20, 10, 2, 0.72);
  backdrop-filter: blur(8px);
  color: rgba(255, 220, 120, 0.85);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s, transform 0.15s;
}
.fab:hover  { background: rgba(40, 22, 4, 0.88); color: #ffe090; transform: scale(1.08); }
.fab.active { background: #e8a820; color: #1a0e04; }

/* ── Modal overlay ──────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-card {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-close {
  position: sticky;
  top: 0.75rem;
  float: right;
  margin: 0.75rem 0.75rem 0 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f0f0f0;
  cursor: pointer;
  font-size: 0.85rem;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.modal-close:hover { background: #e0e0e0; }
</style>
