<script setup>
import { ref } from 'vue'
import ClassSetup  from './components/ClassSetup.vue'
import SkillSetup  from './components/SkillSetup.vue'
import LiveSession from './components/LiveSession.vue'

const view = ref('live')
</script>

<template>
  <div id="app-shell" :class="{ 'no-chrome': view === 'live' }">
    <header v-if="view !== 'live'">
      <span class="logo">tu&amp;valu</span>
      <nav>
        <button :class="{ active: view === 'classes' }" @click="view = 'classes'">Classes</button>
        <button :class="{ active: view === 'skills'  }" @click="view = 'skills'">Evaluations</button>
        <button :class="{ active: view === 'live'    }" @click="view = 'live'">▶ Live</button>
      </nav>
    </header>

    <!-- Live button overlay when in live mode -->
    <button v-if="view === 'live'" class="exit-live-btn" @click="view = 'classes'">
      ✕
    </button>

    <ClassSetup  v-if="view === 'classes'" @done="view = 'skills'" />
    <SkillSetup  v-if="view === 'skills'"  @done="view = 'live'" />
    <LiveSession v-if="view === 'live'" />
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #fff; color: #111; font-family: system-ui, sans-serif; }
</style>

<style scoped>
#app-shell { min-height: 100vh; display: flex; flex-direction: column; }
#app-shell.no-chrome { overflow: hidden; }

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.logo { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.02em; }

nav { display: flex; gap: 0.25rem; }

nav button {
  padding: 0.35rem 0.9rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #555;
}
nav button:hover { background: #f5f5f5; }
nav button.active { background: #1a56db; color: white; border-color: #1a56db; }

/* Subtle exit button in live mode for emergencies */
.exit-live-btn {
  position: fixed;
  top: 0.5rem;
  right: 0.6rem;
  z-index: 100;
  background: rgba(0,0,0,0.25);
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 0.75rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
}
.exit-live-btn:hover { color: rgba(255,255,255,0.7); }
</style>
