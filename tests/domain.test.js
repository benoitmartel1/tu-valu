import test from "node:test";
import assert from "node:assert/strict";
import { allRows } from "../src/lib/paging.js";
import {
  LETTERS,
  gradeScale,
  numericGrade,
  displayGrade,
  studentName,
  belongsTo,
  observationClass,
  isStudentComplete,
  roundBrightness,
  birthdayInDays,
  csvText,
  parseDelimited,
  photoCandidates,
  distributeByAbility,
} from "../src/lib/domain.js";

test("letter averages round upward, respect saved scales and ignore absence/categories", () => {
  const skill = { grading_mode: "letter", scale: LETTERS };
  assert.equal(numericGrade({ level: "A+" }, skill), 10);
  assert.equal(numericGrade({ level: "D" }, skill), 1);
  assert.equal(displayGrade(8.01, skill), "A");
  assert.equal(displayGrade(8, skill), "A-");
  assert.equal(numericGrade({ level: "abs" }, skill), null);
  assert.equal(
    numericGrade({ level: "Effort" }, { grading_mode: "category" }),
    null,
  );
  assert.equal(
    numericGrade(
      {
        level: "C",
        grading_snapshot: {
          mode: "letter",
          labels: gradeScale("letter", false),
        },
      },
      skill,
    ),
    5,
  );
});
test("display override does not mutate student preferences or identity", () => {
  const student = {
    firstname: "Jean",
    lastname: "Tremblay",
    custom_name: "JT",
    name_display_prefs: { showFirstname: true },
  };
  assert.equal(
    studentName(student, {
      individual: false,
      showCustomName: true,
      showInitial: true,
    }),
    "T. JT",
  );
  assert.equal(studentName(student, { individual: true }), "Jean");
});
test("shared membership is distinct from legacy primary class and observation uses a selected membership", () => {
  const student = { class_id: "old", class_ids: ["401", "Volley"] };
  assert.equal(belongsTo(student, "Volley"), true);
  assert.equal(belongsTo(student, "old"), false);
  assert.equal(
    observationClass(student, new Set(["402", "Volley"]), "402"),
    "Volley",
  );
  assert.equal(
    observationClass(student, new Set(["401", "Volley"]), "Volley"),
    "Volley",
  );
});
test("completion waits for every selected skill; unlimited skills keep students available", () => {
  const skills = [
    { id: "a", max_observations: 1 },
    { id: "b", max_observations: 2 },
  ];
  assert.equal(isStudentComplete("s", skills, { s: { a: 1, b: 1 } }), false);
  assert.equal(isStudentComplete("s", skills, { s: { a: 1, b: 2 } }), true);
  assert.equal(
    isStudentComplete("s", [...skills, { id: "c" }], { s: { a: 1, b: 2 } }),
    false,
  );
  assert.equal(isStudentComplete("s", [], {}), false);
});
test("another student getting ahead never lightens an observed student; a completed round resets", () => {
  assert.equal(roundBrightness(1, [0, 1, 2]), roundBrightness(1, [0, 1, 20]));
  assert.equal(roundBrightness(2, [2, 2, 2]), 1);
  assert.ok(roundBrightness(3, [2, 3, 2]) < 1);
});
test("birthdays use calendar days across DST, year boundaries and leap years", () => {
  assert.equal(birthdayInDays("2012-12-31", new Date(2026, 11, 31)), 0);
  assert.equal(birthdayInDays("2012-01-01", new Date(2026, 11, 31)), 1);
  assert.equal(birthdayInDays("2012-02-29", new Date(2027, 1, 28)), 1);
  assert.equal(birthdayInDays("2012-03-09", new Date(2026, 2, 8)), 1);
  assert.equal(birthdayInDays(null), null);
});
test("CSV safely round trips accents, quotes, commas and multiline cells", () => {
  const rows = [
    ["Nom", "Commentaire"],
    ["Élodie, A.", '"Oui"\nDeux lignes'],
  ];
  assert.deepEqual(parseDelimited(csvText(rows).slice(1)), rows);
  assert.ok(csvText([['=HYPERLINK("bad")']]).includes("'=HYPERLINK"));
  assert.deepEqual(parseDelimited("Groupe\tNom\n401\tTremblay, Jean"), [
    ["Groupe", "Nom"],
    ["401", "Tremblay, Jean"],
  ]);
  assert.throws(() => parseDelimited('a,"b'), /Guillemet/);
});
test("photo matcher handles compound names and leaves identical candidates tied", () => {
  const students = [
    { id: 1, firstname: "Pierre Elliot", lastname: "Trudeau" },
    { id: 2, firstname: "Pierre", lastname: "Dupont" },
  ];
  assert.equal(
    photoCandidates("Trudeau_Pierre_Elliot.jpg", students)[0].student.id,
    1,
  );
  const tied = photoCandidates("Pierre Elliot Trudeau.jpg", [
    students[0],
    { ...students[0], id: 3 },
  ]);
  assert.equal(tied[0].score, tied[1].score);
  assert.equal(
    photoCandidates("999999.jpg", [
      { ...students[0], record_number: "999999" },
    ])[0].score,
    120,
  );
});
test("balanced ability teams use serpentine assignment without losing unrated students", () => {
  const students = [5, 4, 3, 2, 1, null].map((ability_level, id) => ({
    id,
    ability_level,
  }));
  const teams = distributeByAbility(students, 2);
  assert.deepEqual(
    teams.map((t) => t.map((s) => s.ability_level)),
    [
      [5, 2, 1],
      [4, 3, null],
    ],
  );
  assert.equal(new Set(teams.flat().map((s) => s.id)).size, 6);
  assert.deepEqual(
    distributeByAbility(students, 2, true).map((t) =>
      t.map((s) => s.ability_level),
    ),
    [
      [5, 4, 3],
      [2, 1, null],
    ],
  );
});
test("pagination fetches beyond server page limits and rejects partial reports on error", async () => {
  const source = Array.from({ length: 1500 }, (_, i) => i);
  const calls = [];
  const result = await allRows(() => ({
    range: async (from, to) => {
      calls.push(from);
      return { data: source.slice(from, to + 1) };
    },
  }));
  assert.deepEqual(result, source);
  assert.deepEqual(calls, [0, 500, 1000, 1500]);
  await assert.rejects(
    allRows(() => ({
      range: async (from) =>
        from
          ? { error: new Error("Disconnected") }
          : { data: source.slice(0, 500) },
    })),
    /Disconnected/,
  );
});
