<script setup>
import LiveSession from "./components/LiveSession.vue";
</script>

<template>
  <div id="app-shell">
    <LiveSession />
  </div>
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
  background: #fff;
  color: #111;
  font-family: system-ui, sans-serif;
}
</style>

<style scoped>
#app-shell {
  position: relative;
  min-height: 100vh;
}
</style>
