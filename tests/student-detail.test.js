import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ref, watch, computed, reactive, nextTick, effectScope } from 'vue';

const source = readFileSync(new URL('../src/components/detail/StudentDetail.vue', import.meta.url), 'utf8')
  .split('<script setup>')[1].split('</script>')[0].replace(/^import .*;\r?$/gm, '');
function mount(save) {
  const props = reactive({ studentId: 'one', studentData: { id: 'one', firstname: 'Old', lastname: 'Y' }, students: [], allStudents: [] });
  const events = [];
  const names = ['ref','watch','computed','defineProps','defineEmits','supabase','updateProtectedStudent','User','IdCard','Component','peekStudentPhoto'];
  const query = { select() { return this; }, eq() { return this; }, single: async () => ({ data: null }) };
  const scope = effectScope();
  const api = scope.run(() => new Function(...names, source + '\nreturn { studentDetailEditing, saveStudentDetail, saveError };')(
    ref, watch, computed, () => props, () => (...args) => events.push(args), { from: () => query }, save, {}, {}, {}, () => null));
  return { ...api, props, events, stop: () => scope.stop() };
}

test('background refresh preserves a typed first name and unchanged blur does not save', async () => {
  const calls = [];
  const form = mount(async student => { calls.push(student); return { data: [student], error: null }; });
  try {
    await form.saveStudentDetail();
    assert.equal(calls.length, 0);
    form.studentDetailEditing.value.firstname = 'New';
    form.props.studentData = { ...form.props.studentData };
    await nextTick();
    assert.equal(form.studentDetailEditing.value.firstname, 'New');
    await form.saveStudentDetail();
    assert.equal(calls[0].firstname, 'New');
    await form.saveStudentDetail();
    assert.equal(calls.length, 1);
  } finally { form.stop(); }
});

test('rapid first-name edits are persisted in order', async () => {
  const calls = [];
  let finish;
  const form = mount(async student => {
    calls.push(student.firstname);
    if (calls.length === 1) await new Promise(resolve => { finish = resolve; });
    return { data: [student], error: null };
  });
  try {
    form.studentDetailEditing.value.firstname = 'First';
    const first = form.saveStudentDetail();
    await new Promise(resolve => setImmediate(resolve));
    form.studentDetailEditing.value.firstname = 'Second';
    const second = form.saveStudentDetail();
    assert.deepEqual(calls, ['First']);
    finish();
    await Promise.all([first, second]);
    assert.deepEqual(calls, ['First', 'Second']);
  } finally { form.stop(); }
});

test('a stale first name in the server response is a failure rather than success', async () => {
  const form = mount(async student => ({ data: [{ ...student, firstname: 'Old' }], error: null }));
  try {
    form.studentDetailEditing.value.firstname = 'New';
    await form.saveStudentDetail();
    assert.match(form.saveError.value, /prénom/);
    assert.equal(form.events.length, 0);
  } finally { form.stop(); }
});
