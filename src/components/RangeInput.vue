<script setup>
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "@lucide/vue";

const props = defineProps({
  value: {
    type: Number,
    required: true,
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: Infinity,
  },
  step: {
    type: Number,
    default: 1,
  },
  label: {
    type: String,
    default: "",
  },
  size: {
    type: String,
    default: "medium", // 'small' or 'medium'
  },
});

const emit = defineEmits(["update:value", "change"]);

function increment() {
  const newValue = props.value + props.step;
  if (newValue <= props.max) {
    emit("update:value", newValue);
    emit("change", newValue);
  }
}

function decrement() {
  const newValue = props.value - props.step;
  if (newValue >= props.min) {
    emit("update:value", newValue);
    emit("change", newValue);
  }
}

function handleInput(event) {
  const newValue = Number(event.target.value);
  emit("update:value", newValue);
  emit("change", newValue);
}

const canDecrement = computed(() => props.value > props.min);
const canIncrement = computed(() => props.value < props.max);

const iconSize = props.size === "small" ? 20 : 24;
</script>

<template>
  <div class="range-input-wrapper">
    <label v-if="label" class="range-label">{{ label }}</label>
    <div class="custom-number-input">
      <button class="number-btn" @click="decrement" :disabled="!canDecrement">
        <ChevronLeft :size="iconSize" :stroke-width="3" />
      </button>
      <input
        type="number"
        :value="value"
        @input="handleInput"
        :min="min"
        :max="max"
        :step="step"
        class="number-input-field"
        :class="{ 'size-small': size === 'small' }"
      />
      <button class="number-btn" @click="increment" :disabled="!canIncrement">
        <ChevronRight :size="iconSize" :stroke-width="3" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.range-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.range-label {
  color: var(--text-light);
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.8;
}

.custom-number-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.number-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  font-family: "Nunito", sans-serif;
  font-weight: 800;
}

.number-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.number-btn.size-small {
  width: 32px;
  height: 32px;
}

.number-input-field {
  width: 80px;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 200, 80, 0.2);
  background: rgba(20, 10, 2, 0.6);
  color: var(--text-light);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  text-align: center;
  -moz-appearance: textfield;
}

.number-input-field.size-small {
  width: 60px;
  padding: 0.25rem 0.4rem;
  font-size: 1.5rem;
}

.number-input-field::-webkit-outer-spin-button,
.number-input-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input-field:focus {
  border-color: #e8a820;
}
</style>
