import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);

test("migration, shared identity, limits, history, attribution, duplication, teams and RLS", async (t) => {
  const db = new PGlite();
  // The repository has no original CREATE TABLE migration. This fixture documents
  // the baseline used by the application; staging must also verify the real schema.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated;
    create table tu_classes(id uuid primary key default gen_random_uuid(), name text, user_id uuid, created_at timestamptz default now());
    create table tu_students(id uuid primary key default gen_random_uuid(), firstname text, lastname text, gender text, birth_date date, class_id uuid not null references tu_classes on delete cascade, student_number text, custom_name text, photo_url text, name_display_prefs jsonb, user_id uuid);
    create table tu_evaluations(id uuid primary key default gen_random_uuid(), title text, user_id uuid);
    create table tu_skills(id uuid primary key default gen_random_uuid(), evaluation_id uuid references tu_evaluations on delete cascade, name text, scale jsonb, icon text, user_id uuid);
    create table tu_sessions(id uuid primary key default gen_random_uuid(), class_id uuid references tu_classes on delete cascade, evaluation_id uuid references tu_evaluations on delete cascade, started_at timestamptz default now(), ended_at timestamptz, user_id uuid);
    create table tu_teams(id uuid primary key default gen_random_uuid(), name text, color text, user_id uuid, created_at timestamptz default now());
    create table tu_student_teams(student_id uuid references tu_students on delete cascade, team_id uuid references tu_teams on delete cascade, primary key(student_id, team_id));
    create table tu_session_events(id uuid primary key default gen_random_uuid(), student_id uuid references tu_students on delete cascade, skill_id uuid references tu_skills on delete cascade, class_id uuid references tu_classes on delete cascade, evaluation_id uuid references tu_evaluations on delete cascade, session_id uuid references tu_sessions, level text, user_id uuid, team_id uuid references tu_teams, created_at timestamptz default now());
    insert into tu_classes(id,name) values ('00000000-0000-4000-8000-000000000001','401'), ('00000000-0000-4000-8000-000000000002','Volley');
    insert into tu_students(id,firstname,lastname,class_id) values ('00000000-0000-4000-8000-000000000003','Jean','Tremblay','00000000-0000-4000-8000-000000000001');
    insert into tu_evaluations(id,title) values ('00000000-0000-4000-8000-000000000004','Beep');
    insert into tu_skills(id,evaluation_id,name,scale) values ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000004','Course','["1","2","3"]');
  `);
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20260926015325_issue_review_batch.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(await readFile(new URL("../supabase/migrations/20261019143218_normalize_observation_scores.sql", import.meta.url), "utf8"));
  const one = async (query, args = []) => (await db.query(query, args)).rows[0];
  const s = "00000000-0000-4000-8000-000000000003",
    c = "00000000-0000-4000-8000-000000000001",
    c2 = "00000000-0000-4000-8000-000000000002",
    sk = "00000000-0000-4000-8000-000000000005",
    ev = "00000000-0000-4000-8000-000000000004";
  await t.test(
    "existing memberships backfill and deleting a group preserves permanent identity",
    async () => {
      assert.equal(
        (await one("select count(*)::int n from tu_student_classes")).n,
        1,
      );
      await db.query(
        "insert into tu_student_classes(student_id,class_id) values ($1,$2)",
        [s, c2],
      );
      const copy = await one("select tu_duplicate_record('class',$1,true) id", [
        c,
      ]);
      assert.equal(
        (
          await one(
            "select count(*)::int n from tu_student_classes where class_id=$1",
            [copy.id],
          )
        ).n,
        1,
      );
      await db.query("delete from tu_classes where id=$1", [copy.id]);
      assert.equal((await one("select count(*)::int n from tu_students")).n, 1);
    },
  );
  await t.test(
    "invalid group, invalid grade and observation limits are rejected; undo restores eligibility",
    async () => {
      await db.query("update tu_skills set max_observations=1 where id=$1", [
        sk,
      ]);
      const insert = (level, group = c) =>
        db.query(
          "insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,$4) returning *",
          [s, sk, group, level],
        );
      await assert.rejects(insert("4"), /barème/);
      await assert.rejects(
        insert("1", "00000000-0000-4000-8000-000000000099"),
        /groupe/,
      );
      const first = (await insert("2", c2)).rows[0];
      assert.equal(first.evaluation_id, ev);
      assert.equal(first.grading_snapshot.mode, "numeric");
      assert.equal(Number(first.normalized_score), 4.5);
      await assert.rejects(insert("3"), /maximal/);
      await db.query("delete from tu_session_events where id=$1", [first.id]);
      await insert("3");
      await assert.rejects(
        db.query("update tu_skills set grading_mode='letter' where id=$1", [
          sk,
        ]),
        /historique/,
      );
    },
  );
  await t.test(
    "absences are daily, do not consume observation limits, and preserve historical days",
    async () => {
      await db.query(
        "insert into tu_session_events(student_id,skill_id,class_id,level,created_at) values ($1,$2,$3,'abs',now()-interval '2 days')",
        [s, sk, c],
      );
      await db.query(
        "insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'abs')",
        [s, sk, c],
      );
      await assert.rejects(
        db.query(
          "insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'abs')",
          [s, sk, c],
        ),
        /déjà/,
      );
    },
  );
  await t.test(
    "activity copies include skills but no observations, and archives block new grades",
    async () => {
      const copy = await one(
        "select tu_duplicate_record('evaluation',$1,false) id",
        [ev],
      );
      assert.equal(
        (
          await one(
            "select count(*)::int n from tu_skills where evaluation_id=$1",
            [copy.id],
          )
        ).n,
        1,
      );
      assert.equal(
        (
          await one(
            "select count(*)::int n from tu_session_events where evaluation_id=$1",
            [copy.id],
          )
        ).n,
        0,
      );
      await db.query(
        "update tu_evaluations set archived_at=now() where id=$1",
        [ev],
      );
      await assert.rejects(
        db.query(
          "insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'1')",
          [s, sk, c],
        ),
        /archivée/,
      );
      await db.query("update tu_evaluations set archived_at=null where id=$1", [
        ev,
      ]);
      await db.query("select tu_reorder_evaluations($1::uuid[])", [
        [copy.id, ev],
      ]);
      assert.equal(
        (await one("select sort_order from tu_evaluations where id=$1", [ev]))
          .sort_order,
        2,
      );
    },
  );
  await t.test(
    "permanent identifiers reuse identity across imports and preserve names/photos",
    async () => {
      await db.query(
        "update tu_students set record_number='00123', photo_url='private/photo.jpg' where id=$1",
        [s],
      );
      const result = await one("select * from tu_import_students($1::jsonb)", [
        JSON.stringify([
          {
            firstname: "Wrong",
            lastname: "Name",
            record_number: "00123",
            class_id: c2,
          },
        ]),
      ]);
      assert.equal(result.id, s);
      assert.equal(
        (
          await one(
            "select firstname, photo_url from tu_students where id=$1",
            [s],
          )
        ).firstname,
        "Jean",
      );
      const added = await one("select * from tu_import_students($1::jsonb)", [
        JSON.stringify([
          {
            firstname: "Marie",
            lastname: "Roy",
            record_number: "00456",
            class_id: c2,
          },
        ]),
      ]);
      assert.notEqual(added.id, s);
    },
  );
  await t.test(
    "team batches save atomically and reassignment replaces only the same set",
    async () => {
      const { id: batch } = await one("select tu_save_teams($1::jsonb) id", [
        JSON.stringify([
          { name: "A", student_ids: [s] },
          { name: "B", student_ids: [] },
        ]),
      ]);
      const teamB = await one(
        "select id from tu_teams where batch_id=$1 and name='B'",
        [batch],
      );
      await db.query("select tu_assign_team($1,$2,$3)", [s, teamB.id, batch]);
      assert.equal(
        (
          await one(
            "select count(*)::int n from tu_student_teams where student_id=$1",
            [s],
          )
        ).n,
        1,
      );
      await assert.rejects(
        db.query("select tu_save_teams($1::jsonb)", [
          JSON.stringify([{ name: "Bad", student_ids: ["not-a-uuid"] }]),
        ]),
        /uuid/,
      );
      assert.equal(
        (await one("select count(*)::int n from tu_teams where name='Bad'")).n,
        0,
      );
    },
  );
  await t.test(
    "observer identity comes from the signed-in user, not the submitted author",
    async () => {
      const author = "00000000-0000-4000-8000-000000000009";
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        author,
      ]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ user_metadata: { full_name: "Mme Roy" } }),
      ]);
      await db.query("update tu_skills set max_observations=null where id=$1", [
        sk,
      ]);
      const event = await one(
        "insert into tu_session_events(student_id,skill_id,class_id,level,user_id) values ($1,$2,$3,'1',$4) returning user_id,observer_name",
        [s, sk, c, s],
      );
      assert.equal(event.user_id, author);
      assert.equal(event.observer_name, "Mme Roy");
    },
  );
  await t.test(
    "multi-score events retain their own criterion and copies preserve the grid",
    async () => {
      const grid = await one(
        "insert into tu_skills(evaluation_id,name,grading_mode,scale,criteria) values ($1,'Comportement','rubric','[\"-3\",\"0\",\"3\"]',array['Respect','Effort']) returning id",
        [ev],
      );
      await assert.rejects(
        db.query(
          "insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'3')",
          [s, grid.id, c],
        ),
        /critère/,
      );
      const event = await one(
        "insert into tu_session_events(student_id,skill_id,class_id,level,criterion) values ($1,$2,$3,'3','Respect') returning *",
        [s, grid.id, c],
      );
      assert.equal(event.criterion, "Respect");
      assert.deepEqual(event.grading_snapshot.criteria, ["Respect", "Effort"]);
      const copy = await one(
        "select tu_duplicate_record('skill',$1,false) id",
        [grid.id],
      );
      assert.deepEqual(
        (await one("select criteria from tu_skills where id=$1", [copy.id]))
          .criteria,
        ["Respect", "Effort"],
      );
    },
  );
  await t.test(
    "removing a historical group keeps student and observation records",
    async () => {
      const group = await one(
        "insert into tu_classes(name) values ('Ancien groupe') returning id",
      );
      const student = await one(
        "insert into tu_students(firstname,lastname,class_id) values ('Ancien','Élève',$1) returning id",
        [group.id],
      );
      const event = await one(
        "insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'1') returning id",
        [student.id, sk, group.id],
      );
      await db.query("delete from tu_classes where id=$1", [group.id]);
      assert.equal(
        (
          await one("select class_id from tu_students where id=$1", [
            student.id,
          ])
        ).class_id,
        null,
      );
      assert.equal(
        (
          await one("select class_id from tu_session_events where id=$1", [
            event.id,
          ])
        ).class_id,
        null,
      );
    },
  );
  await t.test(
    "membership RLS follows parent visibility and anonymous RPC execution is denied",
    async () => {
      await db.exec(`
      grant select, insert, update, delete on tu_students, tu_classes, tu_skills, tu_evaluations, tu_session_events to authenticated;
      alter table tu_students enable row level security;
      create policy fixture_student_visibility on tu_students for select to authenticated using (record_number='00123');
      create policy fixture_student_update on tu_students for update to authenticated using (record_number='00123');
      alter table tu_classes enable row level security;
      create policy fixture_class_visibility on tu_classes for select to authenticated using (name='401');
      set role authenticated;
    `);
      assert.equal(
        (await one("select count(*)::int n from tu_student_classes")).n,
        1,
      );
      const authenticatedEvent = await one(
        "insert into tu_session_events(student_id,skill_id,class_id,level) values ($1,$2,$3,'2') returning observer_name",
        [s, sk, c],
      );
      assert.equal(authenticatedEvent.observer_name, "Mme Roy");
      await assert.rejects(
        db.query(
          "insert into tu_student_classes(student_id,class_id) values ($1,$2)",
          [s, c2],
        ),
        /row-level security/,
      );
      await db.exec("reset role; set role anon;");
      await assert.rejects(
        db.query("select tu_duplicate_record('class',$1,true)", [c]),
        /permission denied/,
      );
      await db.exec("reset role;");
    },
  );
  await db.close();
});
