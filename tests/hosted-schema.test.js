import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Metadata only, captured from the configured hosted project on 2026-10-02.
// No hosted student records or authentication credentials are used here.
test('migration and RPCs work against captured hosted columns, constraints and policies', async () => {
  const schema = JSON.parse(await readFile(new URL('./fixtures/hosted-schema-20261002.json', import.meta.url), 'utf8'));
  const db = new PGlite();
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      grant usage on schema auth to anon, authenticated;
      insert into auth.users values ('00000000-0000-4000-8000-000000000001','synthetic@example.test','{"full_name":"Synthetic Teacher"}');
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
      select set_config('request.jwt.claims','{"user_metadata":{"app_name":"tu-valu","full_name":"Synthetic Teacher"}}',false);
    `);
    const tables = [...new Set(schema.columns.map(c => c.table_name))];
    for (const table of tables) {
      const columns = schema.columns.filter(c => c.table_name === table).map(c =>
        `${quote(c.column_name)} ${c.data_type}${c.column_default === null ? '' : ` default ${c.column_default}`}${c.is_nullable === 'NO' ? ' not null' : ''}`);
      await db.exec(`create table public.${quote(table)} (${columns.join(',')});`);
    }
    for (const foreign of [false, true]) {
      for (const c of schema.constraints.filter(c => c.definition.startsWith('FOREIGN KEY') === foreign)) {
        await db.exec(`alter table public.${quote(c.table_name)} add constraint ${quote(c.conname)} ${c.definition};`);
      }
    }
    assert.equal(schema.triggers, null, 'Snapshot requires trigger definitions if hosted triggers exist');
    for (const table of tables) {
      await db.exec(`alter table public.${quote(table)} enable row level security; grant select,insert,update,delete on public.${quote(table)} to anon,authenticated;`);
    }
    for (const p of schema.policies) {
      await db.exec(`create policy ${quote(p.policyname)} on public.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(quote).join(',')}${p.qual ? ` using (${p.qual})` : ''}${p.with_check ? ` with check (${p.with_check})` : ''};`);
    }
    const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
    const c = (await one("insert into tu_classes(name) values ('Synthetic group') returning id")).id;
    const student = (await one("insert into tu_students(firstname,lastname,class_id,student_number) values ('Synthetic','Student',$1,'7') returning id", [c])).id;
    await db.exec("insert into tu_students(firstname,lastname) values ('Unassigned','Synthetic');");
    const ev = (await one("insert into tu_evaluations(title) values ('Synthetic activity') returning id")).id;
    const skill = (await one("insert into tu_skills(name,evaluation_id) values ('Synthetic skill',$1) returning id", [ev])).id;
    const session = (await one('insert into tu_sessions(class_id,evaluation_id) values ($1,$2) returning id', [c, ev])).id;
    await db.query("insert into tu_session_events(student_id,skill_id,class_id,evaluation_id,session_id,level,user_id) values ($1,$2,$3,$4,$5,'2',auth.uid())", [student,skill,c,ev,session]);
    await db.exec(await readFile(new URL('../supabase/migrations/20260926015325_issue_review_batch.sql', import.meta.url), 'utf8'));
    assert.equal((await one('select sort_order from tu_evaluations')).sort_order, 0);
    assert.equal((await one('select count(*)::int n from tu_student_classes')).n, 1);
    assert.equal((await one('select observer_name from tu_session_events')).observer_name, 'Synthetic Teacher');
    await db.exec('set role authenticated;');
    for (const [kind, id] of [['class',c],['evaluation',ev],['skill',skill]]) {
      assert.ok((await one('select tu_duplicate_record($1,$2,true) id', [kind,id])).id);
    }
    await one('select tu_reorder_evaluations($1::uuid[])', [[ev]]);
    assert.equal((await one('select sort_order from tu_evaluations where id=$1',[ev])).sort_order, 1);
    const imported = await one('select * from tu_import_students($1::jsonb)', [JSON.stringify([{firstname:'Import',lastname:'Synthetic',gender:'F',class_id:c,record_number:'SYNTHETIC-1',student_number:'8'}])]);
    assert.ok(imported.id);
    const batch = (await one('select tu_save_teams($1::jsonb) id', [JSON.stringify([{name:'Synthetic team',color:'#123456',student_ids:[student]}])])).id;
    const team = (await one('select id from tu_teams where batch_id=$1', [batch])).id;
    await one('select tu_assign_team($1,$2,$3)', [imported.id,team,batch]);
    await db.query('update tu_skills set max_observations=2 where id=$1', [skill]);
    await db.query("insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'3')", [student,skill,c]);
    await assert.rejects(db.query("insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'4')", [student,skill,c]), /maximal/);
    await db.query('delete from tu_classes where id=$1', [c]);
    assert.equal((await one('select count(*)::int n from tu_session_events where student_id=$1',[student])).n,2);
    assert.equal((await one('select class_id from tu_students where id=$1',[student])).class_id,null);
    assert.equal((await one('select class_id from tu_sessions where id=$1',[session])).class_id,null);
  } finally {
    await db.close();
  }
});
