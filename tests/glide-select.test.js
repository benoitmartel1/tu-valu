import test from 'node:test';
import assert from 'node:assert/strict';
import { vGlideSelect } from '../src/lib/glideSelect.js';

function fixture(values) {
  const doc = new EventTarget();
  doc.defaultView = new EventTarget();
  const elements = values.map((checked, index) => {
    const el = new EventTarget();
    el.style = {};
    el.ownerDocument = doc;
    el.setAttribute = () => {};
    el.closest = () => el;
    el.value = { group: index === 3 ? 'other' : 'students', checked, toggle() {
      el.value.checked = !el.value.checked;
      vGlideSelect.updated(el, { value: el.value });
    } };
    vGlideSelect.mounted(el, { value: el.value });
    return el;
  });
  doc.elementFromPoint = (x) => elements[Math.floor(x / 20)] || null;
  const send = (target, type, x = 5, extra = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 5, ...extra });
    target.dispatchEvent(event);
    return event;
  };
  return { doc, elements, send, checked: () => elements.map(el => el.value.checked), destroy: () => elements.forEach(el => vGlideSelect.beforeUnmount(el)) };
}

test('glide selects skipped controls, leaves selected ones selected, and stays in its group', () => {
  const f = fixture([false, true, false, false]);
  f.send(f.elements[0], 'pointerdown');
  f.send(f.doc, 'pointermove', 65);
  assert.deepEqual(f.checked(), [true, true, true, false]);
  f.send(f.doc, 'pointermove', 5);
  assert.deepEqual(f.checked(), [true, true, true, false]);
  f.send(f.doc, 'pointerup');
  assert.equal(f.send(f.elements[0], 'click', 5, { detail: 1 }).defaultPrevented, true);
  f.destroy();
});

test('starting checked deselects; cancellation and secondary pointers stop painting', () => {
  const f = fixture([true, false, true]);
  f.send(f.elements[0], 'pointerdown');
  f.send(f.doc, 'pointermove', 45, { pointerId: 2 });
  assert.deepEqual(f.checked(), [false, false, true]);
  f.send(f.doc, 'pointercancel');
  f.send(f.doc, 'pointermove', 45);
  assert.deepEqual(f.checked(), [false, false, true]);
  f.send(f.elements[2], 'pointerdown', 45);
  f.send(f.doc, 'pointermove', 5);
  assert.deepEqual(f.checked(), [false, false, false]);
  f.destroy();
});

test('keyboard activation toggles and unmount removes gesture listeners', () => {
  const f = fixture([false, false]);
  f.send(f.elements[0], 'keydown', 5, { key: ' ' });
  assert.equal(f.checked()[0], true);
  f.send(f.elements[0], 'pointerdown');
  f.destroy();
  f.send(f.doc, 'pointermove', 25);
  assert.equal(f.checked()[1], false);
});
