<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'

const emit = defineEmits(['done'])

const classes = ref([{ name: '', rawText: '' }])
const saving = ref(false)
const error = ref(null)

function parseNames(rawText) {
  return rawText
    .split('\n')
    .map(line => line.split('\t')[0].trim())
    .filter(name => name.length > 0)
}

function addClass() {
  classes.value.push({ name: '', rawText: '' })
}

function removeClass(index) {
  classes.value.splice(index, 1)
}

async function saveAll() {
  error.value = null
  const valid = classes.value.filter(c => c.name.trim() && parseNames(c.rawText).length > 0)
  if (valid.length === 0) {
    error.value = 'Add at least one class with a name and students.'
    return
  }
  saving.value = true
  try {
    for (const cls of valid) {
      const { data: classData, error: classError } = await supabase
        .from('tu_classes')
        .insert({ name: cls.name.trim() })
        .select()
        .single()
      if (classError) throw classError

      const { error: studentsError } = await supabase
        .from('tu_students')
        .insert(parseNames(cls.rawText).map(name => ({ firstname: name, lastname: '', class_id: classData.id })))
      if (studentsError) throw studentsError
    }
    emit('done')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="setup">
    <h2>Classes &amp; students</h2>

    <div v-for="(cls, i) in classes" :key="i" class="class-block">
      <div class="class-header">
        <input
          v-model="cls.name"
          placeholder="Class name (e.g. 3A)"
          class="class-name-input"
        />
        <button v-if="classes.length > 1" class="remove-btn" @click="removeClass(i)">✕</button>
      </div>

      <textarea
        v-model="cls.rawText"
        placeholder="Paste student names here — one per line.
Copying a single Excel column works directly."
        rows="7"
      />

      <div v-if="parseNames(cls.rawText).length" class="preview">
        <span v-for="name in parseNames(cls.rawText)" :key="name" class="student-chip">
          {{ name }}
        </span>
      </div>
    </div>

    <button class="add-class-btn" @click="addClass">+ Add another class</button>

    <p v-if="error" class="error">{{ error }}</p>

    <button class="save-btn" :disabled="saving" @click="saveAll">
      {{ saving ? 'Saving…' : 'Save classes' }}
    </button>
  </div>
</template>

<style scoped>
.setup {
  max-width: 560px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: sans-serif;
}

h2 {
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
}

.class-block {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.class-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.class-name-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}

.remove-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0 0.6rem;
  cursor: pointer;
  color: #888;
  font-size: 0.9rem;
}
.remove-btn:hover { color: #c00; border-color: #c00; }

textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: vertical;
  font-family: monospace;
  line-height: 1.5;
}

.preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
}

.student-chip {
  background: #e8f0fe;
  color: #1a56db;
  border-radius: 20px;
  padding: 0.2rem 0.7rem;
  font-size: 0.85rem;
}

.add-class-btn {
  background: none;
  border: 2px dashed #aaa;
  border-radius: 8px;
  padding: 0.6rem 1.2rem;
  width: 100%;
  cursor: pointer;
  color: #555;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}
.add-class-btn:hover { border-color: #555; color: #222; }

.error {
  color: #c00;
  margin-bottom: 0.8rem;
  font-size: 0.9rem;
}

.save-btn {
  width: 100%;
  padding: 0.8rem;
  background: #1a56db;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.save-btn:hover:not(:disabled) { background: #1446b8; }
.save-btn:disabled { opacity: 0.6; cursor: default; }
</style>
