const controls = new WeakMap();

// One gesture paints a single selection state within one picker column.
export const vGlideSelect = {
  mounted(el, binding) {
    const state = { value: binding.value, cleanup: null };
    controls.set(el, state);
    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.setAttribute('role', 'checkbox');
    el.tabIndex = 0;
    el.setAttribute('aria-checked', String(state.value.checked));
    const keydown = (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        state.value.toggle();
      }
    };
    const click = (event) => {
      // Pointer selection is handled on down; retain programmatic activation.
      if (event.detail > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const down = (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      state.cleanup?.();
      const group = state.value.group;
      const selected = !state.value.checked;
      const visited = new Set();
      const apply = (target) => {
        const control = controls.get(target);
        if (!control || control.value.group !== group || visited.has(target)) return;
        visited.add(target);
        if (control.value.checked !== selected) control.value.toggle();
      };
      apply(el);
      let x = event.clientX, y = event.clientY;
      const move = (next) => {
        if (next.pointerId !== event.pointerId) return;
        next.preventDefault();
        const steps = Math.max(1, Math.ceil(Math.hypot(next.clientX - x, next.clientY - y) / 6));
        for (let i = 1; i <= steps; i++) {
          const hit = el.ownerDocument.elementFromPoint(x + (next.clientX - x) * i / steps, y + (next.clientY - y) * i / steps);
          const target = hit?.closest('.row-checkbox');
          if (target) apply(target);
        }
        x = next.clientX;
        y = next.clientY;
      };
      const finish = (next) => {
        if (next && next.pointerId !== event.pointerId) return;
        doc.removeEventListener('pointermove', move, { capture: true });
        doc.removeEventListener('pointerup', finish, { capture: true });
        doc.removeEventListener('pointercancel', finish, { capture: true });
        doc.defaultView.removeEventListener('blur', cancel);
        state.cleanup = null;
      };
      const cancel = () => finish();
      const doc = el.ownerDocument;
      doc.addEventListener('pointermove', move, { capture: true, passive: false });
      doc.addEventListener('pointerup', finish, true);
      doc.addEventListener('pointercancel', finish, true);
      doc.defaultView.addEventListener('blur', cancel);
      state.cleanup = cancel;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('click', click, true);
    el.addEventListener('keydown', keydown);
    state.destroy = () => {
      state.cleanup?.();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('click', click, { capture: true });
      el.removeEventListener('keydown', keydown);
    };
  },
  updated(el, binding) {
    controls.get(el).value = binding.value;
    el.setAttribute('aria-checked', String(binding.value.checked));
  },
  beforeUnmount(el) {
    controls.get(el)?.destroy();
    controls.delete(el);
  },
};

