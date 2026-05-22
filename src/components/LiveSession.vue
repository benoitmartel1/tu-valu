<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

// ── Setup state ───────────────────────────────────────
const classes     = ref([])
const evaluations = ref([])
const selectedClassId      = ref(null)
const selectedEvaluationId = ref(null)
const loading = ref(false)

// ── Live state ────────────────────────────────────────
const view     = ref('select')
const students = ref([])   // [{ id, name, x, y }]
const skills   = ref([])
const counts   = ref({})   // { studentId: { skillId: count } }

const activeStudentId = ref(null)  // circle with skill menu open
const flashing        = ref(null)

// ── Drag state ────────────────────────────────────────
let longPressTimer = null
let dragState = null  // { studentId, startPx, startPy, startSx, startSy, moved }

onMounted(async () => {
  const [{ data: cls }, { data: evs }] = await Promise.all([
    supabase.from('tu_classes').select('id, name').order('name'),
    supabase.from('tu_evaluations').select('id, title').order('title'),
  ])
  classes.value     = cls || []
  evaluations.value = evs || []
})

async function startSession() {
  if (!selectedClassId.value || !selectedEvaluationId.value) return
  loading.value = true

  const [{ data: stu }, { data: ski }, { data: events }] = await Promise.all([
    supabase.from('tu_students').select('id, name')
      .eq('class_id', selectedClassId.value).order('name'),
    supabase.from('tu_skills').select('id, name')
      .eq('evaluation_id', selectedEvaluationId.value),
    supabase.from('tu_session_events')
      .select('student_id, skill_id')
      .eq('class_id', selectedClassId.value)
      .eq('evaluation_id', selectedEvaluationId.value),
  ])

  skills.value = ski || []

  const c = {}
  for (const s of (stu || [])) c[s.id] = {}
  for (const ev of (events || [])) {
    if (!c[ev.student_id]) c[ev.student_id] = {}
    c[ev.student_id][ev.skill_id] = (c[ev.student_id][ev.skill_id] || 0) + 1
  }
  counts.value = c

  // Distribute initial positions in a grid across the arena
  const W = window.innerWidth
  const H = window.innerHeight - 56
  const n = (stu || []).length
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * W / H)))
  const rows = Math.ceil(n / cols)
  const cellW = W / cols
  const cellH = H / rows

  students.value = (stu || []).map((s, i) => ({
    ...s,
    x: (i % cols + 0.5) * cellW,
    y: (Math.floor(i / cols) + 0.5) * cellH,
  }))

  loading.value = false
  view.value    = 'active'
}

// ── Circle size / opacity (based on total evaluations) ─
function totalCount(studentId) {
  return Object.values(counts.value[studentId] || {}).reduce((a, b) => a + b, 0)
}

const maxTotal = computed(() =>
  Math.max(0, ...students.value.map(s => totalCount(s.id)))
)

function circleSize(studentId) {
  const min = 72, max = 128
  const count = totalCount(studentId)
  const mx    = maxTotal.value
  if (mx === 0) return (min + max) / 2
  const ratio = 1 - count / (mx + 1)
  return min + ratio * (max - min)
}

function circleOpacity(studentId) {
  const min = 0.45, max = 1.0
  const count = totalCount(studentId)
  const mx    = maxTotal.value
  if (mx === 0) return max
  const ratio = 1 - count / (mx + 1)
  return +(min + ratio * (max - min)).toFixed(2)
}

// ── Skill bubble radial positions ─────────────────────
function skillBubbleStyle(index, total) {
  const radius = 115
  const angle  = (index / total) * 2 * Math.PI - Math.PI / 2
  return {
    left:           `calc(50% + ${(Math.cos(angle) * radius).toFixed(1)}px)`,
    top:            `calc(50% + ${(Math.sin(angle) * radius).toFixed(1)}px)`,
    animationDelay: `${index * 35}ms`,
  }
}

// ── Pointer interactions ──────────────────────────────
function onPointerDown(e, student) {
  e.currentTarget.setPointerCapture(e.pointerId)
  e.stopPropagation()

  dragState = {
    studentId: student.id,
    startPx: e.clientX,
    startPy: e.clientY,
    startSx: student.x,
    startSy: student.y,
    moved: false,
  }

  longPressTimer = setTimeout(() => {
    if (dragState && !dragState.moved) {
      activeStudentId.value = student.id
    }
  }, 450)
}

function onPointerMove(e, student) {
  if (!dragState || dragState.studentId !== student.id) return

  const dx = e.clientX - dragState.startPx
  const dy = e.clientY - dragState.startPy

  if (!dragState.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    dragState.moved = true
    clearTimeout(longPressTimer)
    activeStudentId.value = null
  }

  if (dragState.moved) {
    student.x = dragState.startSx + dx
    student.y = dragState.startSy + dy
  }
}

function onPointerUp(e, student) {
  clearTimeout(longPressTimer)
  const wasDrag = dragState?.moved
  dragState = null
  if (!wasDrag && activeStudentId.value !== student.id) {
    activeStudentId.value = null
  }
}

async function selectSkill(student, skill) {
  activeStudentId.value = null

  counts.value = {
    ...counts.value,
    [student.id]: {
      ...counts.value[student.id],
      [skill.id]: (counts.value[student.id]?.[skill.id] || 0) + 1,
    },
  }

  flashing.value = student.id
  setTimeout(() => { flashing.value = null }, 400)

  supabase.from('tu_session_events').insert({
    class_id:      selectedClassId.value,
    evaluation_id: selectedEvaluationId.value,
    student_id:    student.id,
    skill_id:      skill.id,
  })
}

const selectedEvaluation = computed(() =>
  evaluations.value.find(e => e.id === selectedEvaluationId.value)
)
const selectedClass = computed(() =>
  classes.value.find(c => c.id === selectedClassId.value)
)
</script>

<template>

  <!-- ── SESSION PICKER ─────────────────────────────── -->
  <div v-if="view === 'select'" class="wood-bg picker-screen">
    <div class="picker-card">
      <h2>Start a session</h2>

      <label>
        Class
        <select v-model="selectedClassId">
          <option disabled :value="null">— choose —</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>

      <label>
        Evaluation
        <select v-model="selectedEvaluationId">
          <option disabled :value="null">— choose —</option>
          <option v-for="e in evaluations" :key="e.id" :value="e.id">{{ e.title }}</option>
        </select>
      </label>

      <button
        class="start-btn"
        :disabled="!selectedClassId || !selectedEvaluationId || loading"
        @click="startSession"
      >
        {{ loading ? 'Loading…' : 'Start' }}
      </button>
    </div>
  </div>

  <!-- ── LIVE SCREEN ────────────────────────────────── -->
  <div v-else-if="view === 'active'" class="wood-bg live-screen">

    <div class="top-bar">
      <span class="session-label">
        {{ selectedClass?.name }} · {{ selectedEvaluation?.title }}
      </span>
      <div class="skill-legend">
        <span v-for="skill in skills" :key="skill.id" class="skill-pill">
          {{ skill.name }}
        </span>
      </div>
      <button class="stop-btn" @click="view = 'select'">Stop</button>
    </div>

    <!-- Arena: free-position canvas for student circles -->
    <div class="arena" @pointerdown.self="activeStudentId = null">

      <div
        v-for="student in students"
        :key="student.id"
        class="student-wrapper"
        :style="{ left: student.x + 'px', top: student.y + 'px' }"
        @pointerdown="onPointerDown($event, student)"
        @pointermove="onPointerMove($event, student)"
        @pointerup="onPointerUp($event, student)"
      >
        <!-- Circle -->
        <div
          class="student-circle"
          :class="{
            flash:     flashing === student.id,
            'is-open': activeStudentId === student.id,
          }"
          :style="{
            width:    circleSize(student.id) + 'px',
            height:   circleSize(student.id) + 'px',
            opacity:  circleOpacity(student.id),
            fontSize: Math.max(10, circleSize(student.id) * 0.165) + 'px',
          }"
        >
          {{ student.name }}
        </div>

        <!-- Skill bubbles (radial menu) -->
        <template v-if="activeStudentId === student.id">
          <button
            v-for="(skill, i) in skills"
            :key="skill.id"
            class="skill-bubble"
            :style="skillBubbleStyle(i, skills.length)"
            @pointerdown.stop
            @pointerup.stop="selectSkill(student, skill)"
          >
            {{ skill.name }}
          </button>
        </template>
      </div>

    </div>
  </div>

</template>

<style scoped>

/* ── Wood background ──────────────────────────────── */
.wood-bg {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 90% 35% at 50% 0%, rgba(255,235,140,.18) 0%, transparent 65%),
    repeating-linear-gradient(
      180deg,
      transparent 0px, transparent 53px,
      rgba(80,38,4,.28) 53px, rgba(80,38,4,.28) 56px
    ),
    repeating-linear-gradient(
      94deg,
      transparent 0%, rgba(255,255,255,.03) 12%,
      transparent 25%, rgba(0,0,0,.025) 38%, transparent 50%
    ),
    linear-gradient(168deg, #e0a830 0%, #c88820 35%, #b07018 70%, #c08828 100%);
}

/* ── Picker ───────────────────────────────────────── */
.picker-screen {
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker-card {
  background: rgba(20,12,4,.72);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,200,80,.2);
  border-radius: 16px;
  padding: 2.5rem 2rem;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  color: #f5e8c8;
}

.picker-card h2 {
  font-size: 1.3rem;
  font-weight: 600;
  color: #ffe8a0;
  text-align: center;
}

.picker-card label {
  display: flex;
  flex-direction: column;
  gap: .4rem;
  font-size: .85rem;
  letter-spacing: .05em;
  text-transform: uppercase;
  color: #c8b080;
}

.picker-card select {
  padding: .6rem .8rem;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,200,80,.3);
  border-radius: 8px;
  color: #f5e8c8;
  font-size: 1rem;
}
.picker-card select option { background: #2a1a08; }

.start-btn {
  margin-top: .5rem;
  padding: .85rem;
  background: #e8a820;
  color: #1a0e04;
  font-size: 1.1rem;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}
.start-btn:hover:not(:disabled) { background: #f0b828; }
.start-btn:disabled { opacity: .45; cursor: default; }

/* ── Live layout ──────────────────────────────────── */
.live-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.top-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .55rem 1rem;
  height: 56px;
  background: rgba(10,5,0,.65);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255,200,80,.15);
}

.session-label {
  color: #f0d890;
  font-size: .85rem;
  font-weight: 600;
  white-space: nowrap;
}

.skill-legend {
  display: flex;
  gap: .35rem;
  flex: 1;
  flex-wrap: wrap;
}

.skill-pill {
  padding: .2rem .65rem;
  border: 1px solid rgba(255,200,80,.25);
  border-radius: 20px;
  color: #c8a860;
  font-size: .78rem;
}

.stop-btn {
  padding: .3rem .85rem;
  border: 1px solid rgba(255,100,80,.4);
  border-radius: 20px;
  background: transparent;
  color: #f09080;
  font-size: .85rem;
  cursor: pointer;
  margin-left: auto;
  flex-shrink: 0;
}
.stop-btn:hover { background: rgba(255,80,60,.15); }

/* ── Arena ────────────────────────────────────────── */
.arena {
  flex: 1;
  position: relative;
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

/* ── Student wrapper (absolutely positioned) ─────── */
.student-wrapper {
  position: absolute;
  transform: translate(-50%, -50%);
  touch-action: none;
  cursor: grab;
}
.student-wrapper:active { cursor: grabbing; }

/* ── Circle ───────────────────────────────────────── */
.student-circle {
  border-radius: 50%;
  background: rgba(255, 248, 220, 0.88);
  box-shadow:
    0 4px 16px rgba(60, 28, 4, 0.45),
    0 1px 3px  rgba(60, 28, 4, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: .4em;
  font-weight: 700;
  color: #3a1e06;
  line-height: 1.2;
  word-break: break-word;
  transition: width .45s ease, height .45s ease, opacity .45s ease, font-size .45s ease, box-shadow .2s;
  pointer-events: none; /* parent handles events */
}

.student-circle.is-open {
  box-shadow:
    0 0 0 3px rgba(255,200,60,.8),
    0 4px 20px rgba(60,28,4,.5);
}

@keyframes flash-tap {
  0%   { background: rgba(255,220,80,.95); box-shadow: 0 0 24px rgba(255,200,50,.9); }
  100% { background: rgba(255,248,220,.88); }
}
.student-circle.flash {
  animation: flash-tap .4s ease-out forwards;
}

/* ── Skill bubbles ────────────────────────────────── */
.skill-bubble {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid rgba(255,200,80,.6);
  background: rgba(20,10,2,.82);
  backdrop-filter: blur(6px);
  color: #ffe090;
  font-size: .72rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: .3em;
  line-height: 1.2;

  animation: bubble-in .2s ease-out both;
}
.skill-bubble:hover  { background: rgba(232,168,32,.85); color: #1a0e04; border-color: #e8a820; }
.skill-bubble:active { transform: translate(-50%, -50%) scale(.92); }

@keyframes bubble-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(.4); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
