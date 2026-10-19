import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");

test("normalized decimal scores preserve entries and their historical scales", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema tu_private;
      create table tu_session_events(id serial primary key, level text, grading_snapshot jsonb);
      insert into tu_session_events(level, grading_snapshot)
        values ('3', '{"mode":"numeric","labels":["1","2","3","4","5","6"]}');`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261019143218_normalize_observation_scores.sql", import.meta.url), "utf8"));
    const score = async (level, mode, labels) => {
      const snapshot = { mode, labels };
      const { rows: [row] } = await db.query(
        "insert into tu_session_events(level,grading_snapshot) values ($1,$2) returning *",
        [level, JSON.stringify(snapshot)],
      );
      assert.equal(row.level, level);
      assert.deepEqual(row.grading_snapshot, snapshot);
      return row.normalized_score === null ? null : Number(row.normalized_score);
    };
    const six = ["1", "2", "3", "4", "5", "6"];
    const { rows: [historical] } = await db.query("select * from tu_session_events where id=1");
    assert.equal(historical.level, "3");
    assert.deepEqual(historical.grading_snapshot.labels, six);
    assert.equal(Number(historical.normalized_score), 3.6);
    assert.equal(await score("1", "numeric", six), 0);
    assert.equal(await score("6", "numeric", six), 9);
    assert.equal(await score("3.5", "numeric", six), 4.5);
    assert.equal(await score("2", "numeric", ["1", "2", "6"]), 1.8);
    assert.equal(await score("0", "rubric", ["-3", "0", "3"]), 4.5);
    const letters = ["D", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
    assert.equal(await score("D", "letter", letters), 0);
    assert.equal(await score("B", "letter", letters), 5);
    assert.equal(await score("A+", "letter", letters), 9);
    assert.equal(await score("C", "letter", ["D", "C", "B", "A"]), 3);
    for (const [level, mode, labels] of [
      ["abs", "numeric", six], ["Effort", "category", ["Effort", "Respect"]],
      ["7", "numeric", six], ["", "numeric", six], ["3", "numeric", []],
      ["3", "numeric", ["3", "3"]], ["3", "numeric", ["bad", "6"]],
      ["NaN", "numeric", six], ["Z", "letter", letters],
    ]) assert.equal(await score(level, mode, labels), null);
    await db.exec("insert into tu_session_events(level) values ('4')");
    assert.equal((await db.query("select normalized_score from tu_session_events where grading_snapshot is null")).rows[0].normalized_score, null);
    await assert.rejects(db.exec("insert into tu_session_events(level, normalized_score) values ('3', 12)"), { code: "428C9" });
    // Metadata changes do not replace the saved scale or original entry.
    await db.exec("alter table tu_session_events add column comment text; update tu_session_events set comment='Reviewed' where id=1");
    assert.equal(Number((await db.query("select normalized_score from tu_session_events where id=1")).rows[0].normalized_score), 3.6);
  } finally { await db.close(); }
});