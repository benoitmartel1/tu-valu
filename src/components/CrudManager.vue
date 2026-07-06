<script setup>
import { ref, onMounted } from "vue";
import { X, Plus, Trash2, Edit2 } from "@lucide/vue";
import { supabase } from "../supabase";

const emit = defineEmits(["close"]);

const tab = ref("classes"); // 'classes' | 'evaluations'
const classes = ref([]);
const evaluations = ref([]);
const loading = ref(true);

const editingId = ref(null);
const editingName = ref("");
const isAddingNew = ref(false);

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  const [{ data: cls }, { data: evals }] = await Promise.all([
    supabase.from("tu_classes").select("id, name").order("name"),
    supabase.from("tu_evaluations").select("id, title").order("title"),
  ]);
  classes.value = cls || [];
  evaluations.value = evals || [];
  loading.value = false;
}

function startEdit(item) {
  editingId.value = item.id;
  editingName.value = tab.value === "classes" ? item.name : item.title;
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = "";
  isAddingNew.value = false;
}

async function saveEdit(item) {
  if (!editingName.value.trim()) return;

  const field = tab.value === "classes" ? "name" : "title";
  const table = tab.value === "classes" ? "tu_classes" : "tu_evaluations";

  await supabase
    .from(table)
    .update({ [field]: editingName.value })
    .eq("id", item.id);

  if (tab.value === "classes") {
    item.name = editingName.value;
  } else {
    item.title = editingName.value;
  }

  cancelEdit();
}

async function addNew() {
  if (!editingName.value.trim()) return;

  const field = tab.value === "classes" ? "name" : "title";
  const table = tab.value === "classes" ? "tu_classes" : "tu_evaluations";

  const { data } = await supabase
    .from(table)
    .insert({ [field]: editingName.value })
    .select();

  if (data && data[0]) {
    if (tab.value === "classes") {
      classes.value.push(data[0]);
      classes.value.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      evaluations.value.push(data[0]);
      evaluations.value.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  cancelEdit();
}

async function deleteItem(id) {
  if (!confirm("Êtes-vous sûr?")) return;

  const table = tab.value === "classes" ? "tu_classes" : "tu_evaluations";
  await supabase.from(table).delete().eq("id", id);

  if (tab.value === "classes") {
    classes.value = classes.value.filter((c) => c.id !== id);
  } else {
    evaluations.value = evaluations.value.filter((e) => e.id !== id);
  }
}
</script>

<template>
  <div class="crud-overlay" @click.self="emit('close')">
    <div class="crud-modal">
      <div class="crud-header">
        <h2>Modifier</h2>
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="crud-tabs">
        <button
          class="tab-btn"
          :class="{ active: tab === 'classes' }"
          @click="
            tab = 'classes';
            cancelEdit();
          "
        >
          Classes
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'evaluations' }"
          @click="
            tab = 'evaluations';
            cancelEdit();
          "
        >
          Activités
        </button>
      </div>

      <div class="crud-content">
        <div v-if="loading" class="loading">…</div>

        <!-- Classes Tab -->
        <div v-else-if="tab === 'classes'" class="items-list">
          <div v-for="item in classes" :key="item.id" class="item-row">
            <div v-if="editingId === item.id" class="item-edit">
              <input
                v-model="editingName"
                type="text"
                class="edit-input"
                placeholder="Nom de classe"
                @keyup.enter="saveEdit(item)"
                @keyup.escape="cancelEdit"
              />
              <button class="save-btn" @click="saveEdit(item)">✓</button>
              <button class="cancel-btn" @click="cancelEdit">✕</button>
            </div>
            <div v-else class="item-display">
              <span>{{ item.name }}</span>
              <div class="item-actions">
                <button
                  class="action-btn"
                  title="Modifier"
                  @click="startEdit(item)"
                >
                  <Edit2 :size="16" />
                </button>
                <button
                  class="action-btn delete"
                  title="Supprimer"
                  @click="deleteItem(item.id)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
          </div>

          <!-- Add new class -->
          <div v-if="isAddingNew" class="item-row">
            <div class="item-edit">
              <input
                v-model="editingName"
                type="text"
                class="edit-input"
                placeholder="Nom de classe"
                autofocus
                @keyup.enter="addNew"
                @keyup.escape="cancelEdit"
              />
              <button class="save-btn" @click="addNew">+</button>
              <button class="cancel-btn" @click="cancelEdit">✕</button>
            </div>
          </div>

          <button
            v-if="!isAddingNew && !editingId"
            class="add-btn"
            @click="
              isAddingNew = true;
              editingName = '';
            "
          >
            <Plus :size="18" /> Ajouter une classe
          </button>
        </div>

        <!-- Evaluations Tab -->
        <div v-else class="items-list">
          <div v-for="item in evaluations" :key="item.id" class="item-row">
            <div v-if="editingId === item.id" class="item-edit">
              <input
                v-model="editingName"
                type="text"
                class="edit-input"
                placeholder="Titre d'évaluation"
                @keyup.enter="saveEdit(item)"
                @keyup.escape="cancelEdit"
              />
              <button class="save-btn" @click="saveEdit(item)">✓</button>
              <button class="cancel-btn" @click="cancelEdit">✕</button>
            </div>
            <div v-else class="item-display">
              <span>{{ item.title }}</span>
              <div class="item-actions">
                <button
                  class="action-btn"
                  title="Modifier"
                  @click="startEdit(item)"
                >
                  <Edit2 :size="16" />
                </button>
                <button
                  class="action-btn delete"
                  title="Supprimer"
                  @click="deleteItem(item.id)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
          </div>

          <!-- Add new evaluation -->
          <div v-if="isAddingNew" class="item-row">
            <div class="item-edit">
              <input
                v-model="editingName"
                type="text"
                class="edit-input"
                placeholder="Titre d'évaluation"
                autofocus
                @keyup.enter="addNew"
                @keyup.escape="cancelEdit"
              />
              <button class="save-btn" @click="addNew">+</button>
              <button class="cancel-btn" @click="cancelEdit">✕</button>
            </div>
          </div>

          <button
            v-if="!isAddingNew && !editingId"
            class="add-btn"
            @click="
              isAddingNew = true;
              editingName = '';
            "
          >
            <Plus :size="18" /> Ajouter une évaluation
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Overlay ────────────────────────────────────────── */
.crud-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

/* ── Modal ──────────────────────────────────────────── */
.crud-modal {
  background:
    radial-gradient(
      ellipse 90% 35% at 50% 0%,
      rgba(255, 235, 140, 0.12) 0%,
      transparent 65%
    ),
    repeating-linear-gradient(
      180deg,
      transparent 0px,
      transparent 53px,
      rgba(80, 38, 4, 0.28) 53px,
      rgba(80, 38, 4, 0.28) 56px
    ),
    repeating-linear-gradient(
      94deg,
      transparent 0%,
      rgba(255, 255, 255, 0.03) 12%,
      transparent 25%,
      rgba(0, 0, 0, 0.025) 38%,
      transparent 50%
    ),
    linear-gradient(168deg, #e0a830 0%, #c88820 35%, #b07018 70%, #c08828 100%);
  border-radius: 16px;
  width: 100%;
  max-width: 80vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;

  border: 1px solid rgba(255, 200, 80, 0.2);
}

/* ── Header ─────────────────────────────────────────── */
.crud-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 200, 80, 0.15);
}

.crud-header h2 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-light);
  opacity: 0.9;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-light);
  opacity: 0.6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}
.close-btn:hover {
  color: var(--text-light);
  opacity: 0.9;
}

/* ── Tabs ───────────────────────────────────────────── */
.crud-tabs {
  flex-shrink: 0;
  display: flex;
  border-bottom: 1px solid rgba(255, 200, 80, 0.15);
  padding: 0;
  background: rgba(20, 10, 2, 0.3);
}

.tab-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-light);
  opacity: 0.6;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
}
.tab-btn:hover {
  color: var(--text-light);
  opacity: 0.8;
}
.tab-btn.active {
  color: var(--text-light);
  opacity: 1;
  border-bottom: 2px solid #e8a820;
  background: rgba(232, 168, 32, 0.1);
}

/* ── Content ────────────────────────────────────────── */
.crud-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-light);
  opacity: 0.6;
  font-size: 1.5rem;
}

/* ── Items list ─────────────────────────────────────── */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-row {
  display: flex;
  flex-direction: column;
}

.item-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.4);
  backdrop-filter: blur(6px);
  color: var(--text-light);
  opacity: 0.85;
  font-weight: 500;
}

.item-actions {
  display: flex;
  gap: 0.4rem;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 200, 80, 0.15);
  color: var(--text-light);
  opacity: 0.7;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.action-btn:hover {
  background: rgba(255, 200, 80, 0.3);
  color: var(--text-light);
  opacity: 0.9;
}
.action-btn.delete:hover {
  background: rgba(255, 100, 80, 0.3);
  color: var(--track-red);
  opacity: 0.8;
}

.item-edit {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.edit-input {
  flex: 1;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #e8a820;
  background: rgba(255, 248, 220, 0.95);
  color: #3a1e06;
  font-weight: 500;
  font-size: 0.95rem;
}
.edit-input:focus {
  outline: none;
}

.save-btn,
.cancel-btn {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn {
  background: #e8a820;
  color: #1a0e04;
}
.save-btn:hover {
  background: #f0b830;
  transform: scale(1.05);
}

.cancel-btn {
  background: rgba(255, 100, 80, 0.3);
  color: #ff9080;
}
.cancel-btn:hover {
  background: rgba(255, 100, 80, 0.5);
}

.add-btn {
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  border: 2px dashed rgba(255, 200, 80, 0.4);
  background: transparent;
  color: var(--text-light);
  opacity: 0.7;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.add-btn:hover {
  border-color: rgba(255, 200, 80, 0.7);
  color: var(--text-light);
  opacity: 0.9;
  background: rgba(255, 200, 80, 0.08);
}
</style>
