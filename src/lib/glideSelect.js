const controls = new WeakMap();

// Checkboxes start touch painting; desktop drags can start anywhere on a row.
export const vGlideSelect = {
  mounted(el, binding) {
    const state = { value: binding.value, cleanup: null };
    controls.set(el, state);
    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.setAttribute('role', 'checkbox');
    el.tabIndex = 0;
    el.setAttribute('aria-checked', String(state.value.checked));
    const row = el.closest('.picker-item') || el;
    const scope = el.closest('.class-list, .student-list') || el.ownerDocument;
    const keydown = (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        state.value.toggle();
      }
    };
    let suppressClick = false;
    const click = (event) => {
      if (event.detail > 0 && (suppressClick || el.contains?.(event.target))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
      }
    };
    const down = (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      const onCheckbox = event.currentTarget === el || el.contains?.(event.target);
      if (!onCheckbox && event.pointerType !== 'mouse') return;
      if (!onCheckbox && event.target.closest?.('.edit-class-btn-small, .eval-drag-handle, input, a')) return;
      if (onCheckbox) {
        event.preventDefault();
        event.stopPropagation();
      }
      state.cleanup?.();
      const doc = el.ownerDocument;
      const group = state.value.group;
      const selected = !state.value.checked;
      const visited = new Set();
      const original = new Map();
      let active = onCheckbox;
      let marquee;
      let resetClick;
      const startX = event.clientX, startY = event.clientY;
      const apply = (target, checked = selected) => {
        const control = controls.get(target);
        if (!control || control.value.group !== group) return;
        if (control.value.checked !== checked) control.value.toggle();
      };
      const paint = (target) => {
        if (visited.has(target)) return;
        visited.add(target);
        apply(target);
      };
      if (onCheckbox) paint(el);
      let x = startX, y = startY;
      const move = (next) => {
        if (next.pointerId !== event.pointerId) return;
        if (!active && Math.hypot(next.clientX - startX, next.clientY - startY) < 6) return;
        active = true;
        next.preventDefault();
        if (next.pointerType === 'mouse' && scope.querySelectorAll) {
          if (!marquee) {
            for (const target of scope.querySelectorAll('.row-checkbox')) {
              const control = controls.get(target);
              if (control?.value.group === group) original.set(target, target === el && onCheckbox ? !selected : control.value.checked);
            }
            marquee = doc.createElement('div');
            Object.assign(marquee.style, {
              position: 'fixed', pointerEvents: 'none', zIndex: '10000',
              border: '1px solid var(--accent, currentColor)',
              background: 'color-mix(in srgb, var(--accent, currentColor) 12%, transparent)',
              borderRadius: '4px',
            });
            doc.body.append(marquee);
          }
          const left = Math.min(startX, next.clientX), top = Math.min(startY, next.clientY);
          const right = Math.max(startX, next.clientX), bottom = Math.max(startY, next.clientY);
          Object.assign(marquee.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
          const clip = scope.getBoundingClientRect();
          for (const [target, checked] of original) {
            const bounds = (target.closest('.picker-item') || target).getBoundingClientRect();
            const hit = bounds.right >= Math.max(left, clip.left) && bounds.left <= Math.min(right, clip.right) && bounds.bottom >= Math.max(top, clip.top) && bounds.top <= Math.min(bottom, clip.bottom);
            apply(target, hit ? selected : checked);
          }
        } else {
          const steps = Math.max(1, Math.ceil(Math.hypot(next.clientX - x, next.clientY - y) / 6));
          for (let i = 1; i <= steps; i++) {
            const hit = doc.elementFromPoint(x + (next.clientX - x) * i / steps, y + (next.clientY - y) * i / steps);
            const target = hit?.closest('.row-checkbox') || hit?.closest('.picker-item')?.querySelector('.row-checkbox');
            if (target && (scope === doc || scope.contains(target))) paint(target);
          }
        }
        x = next.clientX;
        y = next.clientY;
      };
      const finish = (next) => {
        if (next && next.pointerId !== event.pointerId) return;
        suppressClick = active;
        // A cancelled gesture must not swallow a later, unrelated click.
        clearTimeout(resetClick);
        resetClick = setTimeout(() => { suppressClick = false; }, 0);
        marquee?.remove();
        doc.removeEventListener('pointermove', move, { capture: true });
        doc.removeEventListener('pointerup', finish, { capture: true });
        doc.removeEventListener('pointercancel', finish, { capture: true });
        doc.defaultView.removeEventListener('blur', cancel);
        state.cleanup = null;
      };
      const cancel = () => finish();
      doc.addEventListener('pointermove', move, { capture: true, passive: false });
      doc.addEventListener('pointerup', finish, { capture: true });
      doc.addEventListener('pointercancel', finish, { capture: true });
      doc.defaultView.addEventListener('blur', cancel);
      state.cleanup = cancel;
    };
    el.addEventListener('pointerdown', down);
    row.addEventListener('pointerdown', down);
    row.addEventListener('click', click, true);
    el.addEventListener('keydown', keydown);
    state.destroy = () => {
      state.cleanup?.();
      el.removeEventListener('pointerdown', down);
      row.removeEventListener('pointerdown', down);
      row.removeEventListener('click', click, true);
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

