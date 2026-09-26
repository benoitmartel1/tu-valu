import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:5173/tu-valu/";
const output = process.env.TEST_OUTPUT || "test-results";
await mkdir(output, { recursive: true });
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = {
  id: id(99),
  aud: "authenticated",
  role: "authenticated",
  email: "teacher@example.test",
  user_metadata: { app_name: "tu-valu", full_name: "Mme Roy" },
  app_metadata: { app_name: "tu-valu" },
};
const today = new Date(),
  birth = `2015-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const tables = {
  tu_classes: [
    { id: id(1), name: "401", school_grade: "4e", school_year: "2026–2027" },
    { id: id(2), name: "402", school_grade: "4e", school_year: "2026–2027" },
  ],
  tu_students: [
    {
      id: id(3),
      firstname: "Élodie",
      lastname: "Roy",
      custom_name: "Élo",
      class_id: id(1),
      record_number: "00123",
      student_number: "01",
      gender: "F",
      birth_date: birth,
      ability_level: 4,
      photo_url: "test-photo",
    },
    {
      id: id(4),
      firstname: "Pierre Elliot",
      lastname: "Trudeau",
      class_id: id(2),
      student_number: "01",
      gender: "M",
      ability_level: 2,
    },
    {
      id: id(5),
      firstname: "Marie",
      lastname: "Gagnon",
      class_id: id(2),
      gender: "F",
      ability_level: null,
    },
  ],
  tu_student_classes: [
    { student_id: id(3), class_id: id(1) },
    { student_id: id(4), class_id: id(2) },
    { student_id: id(5), class_id: id(2) },
  ],
  tu_evaluations: [
    {
      id: id(6),
      title: "Beep Test #1",
      sort_order: 0,
      school_term: 1,
      archived_at: null,
    },
    { id: id(7), title: "Comportement", sort_order: 1, archived_at: null },
  ],
  tu_skills: [
    {
      id: id(8),
      name: "Course",
      evaluation_id: id(6),
      scale: ["1", "2", "3", "4", "5"],
      grading_mode: "numeric",
      max_observations: null,
    },
    {
      id: id(9),
      name: "Respect",
      evaluation_id: id(7),
      scale: ["Respect", "Effort"],
      grading_mode: "category",
      max_observations: 1,
    },
  ],
  tu_teams: [
    {
      id: id(10),
      name: "Bleus",
      batch_id: id(12),
      color: "#0969da",
      created_at: "2026-09-01T12:00:00Z",
    },
    {
      id: id(11),
      name: "Verts",
      batch_id: id(12),
      color: "#238636",
      created_at: "2026-09-01T12:00:01Z",
    },
  ],
  tu_student_teams: [
    { student_id: id(3), team_id: id(10) },
    { student_id: id(4), team_id: id(11) },
  ],
  tu_session_events: Array.from({ length: 1205 }, (_, i) => ({
    id: id(1000 + i),
    student_id: id(3),
    class_id: id(1),
    skill_id: id(8),
    evaluation_id: id(6),
    level: String((i % 5) + 1),
    user_id: user.id,
    observer_name: "Mme Roy",
    created_at: new Date(Date.UTC(2026, 8, 1, 12, 0, i)).toISOString(),
  })),
};
const browser = await (
  process.env.TEST_BROWSER === "webkit" ? webkit : chromium
).launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const errors = [];
let failNextInsert = false;
let nextId = 20000;
await context.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
    return route.abort();
  if (url.pathname.endsWith("/get-image-presigned-url.php")) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="16" fill="#386641"/><circle cx="48" cy="34" r="17" fill="#f2cc60"/><path d="M18 90V76a30 30 0 0 1 60 0v14" fill="#f2cc60"/></svg>';
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        presignedUrl:
          "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"),
        expiresIn: 300,
      }),
    });
  }
  if (url.port !== "54329") return route.continue();
  const reply = (body, status = 200, headers = {}) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", ...headers },
      body: JSON.stringify(body),
    });
  if (request.method() === "OPTIONS")
    return reply({}, 200, {
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    });
  if (url.pathname.includes("/auth/v1/")) return reply(user);
  const table = url.pathname.split("/").at(-1);
  if (url.pathname.includes("/rpc/")) {
    const params = request.postDataJSON();
    if (table === "tu_reorder_evaluations") {
      params.ids.forEach((id, index) => {
        tables.tu_evaluations.find((e) => e.id === id).sort_order = index;
      });
      return reply(null);
    }
    if (table === "tu_duplicate_record") {
      const target =
        params.kind === "class"
          ? "tu_classes"
          : params.kind === "skill"
            ? "tu_skills"
            : "tu_evaluations";
      const source = tables[target].find((row) => row.id === params.source_id);
      const copy = { ...source, id: id(nextId++), archived_at: null };
      if (params.kind === "evaluation") copy.title += " (copie)";
      else copy.name += " (copie)";
      tables[target].push(copy);
      if (params.kind === "evaluation")
        tables.tu_skills.push(
          ...tables.tu_skills
            .filter((sk) => sk.evaluation_id === source.id)
            .map((sk) => ({ ...sk, id: id(nextId++), evaluation_id: copy.id })),
        );
      if (params.kind === "class" && params.include_members)
        tables.tu_student_classes.push(
          ...tables.tu_student_classes
            .filter((m) => m.class_id === source.id)
            .map((m) => ({ ...m, class_id: copy.id })),
        );
      return reply(copy.id);
    }
    return reply({ message: `Unmocked RPC: ${table}` }, 400);
  }
  if (!tables[table])
    return reply({ message: `Unmocked route: ${table}` }, 400);
  let rows = tables[table];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (value.startsWith("eq."))
      rows = rows.filter((r) => String(r[key]) === value.slice(3));
    if (value.startsWith("neq."))
      rows = rows.filter((r) => String(r[key]) !== value.slice(4));
    if (value.startsWith("gte."))
      rows = rows.filter((r) => String(r[key]) >= value.slice(4));
    if (value.startsWith("in.(")) {
      const values = value
        .slice(4, -1)
        .split(",")
        .map((v) => v.replaceAll('"', ""));
      rows = rows.filter((r) => values.includes(String(r[key])));
    }
  }
  if (request.method() === "POST") {
    if (table === "tu_session_events" && failNextInsert) {
      failNextInsert = false;
      return reply({ message: "Échec simulé de sauvegarde" }, 400);
    }
    const data = request.postDataJSON();
    rows = (Array.isArray(data) ? data : [data]).map((r) => ({
      id: id(nextId++),
      created_at: new Date().toISOString(),
      observer_name: "Mme Roy",
      ...(table === "tu_skills"
        ? {
            grading_mode: "numeric",
            criteria: ["Respect", "Esprit sportif", "Effort"],
          }
        : {}),
      ...r,
    }));
    tables[table].push(...rows);
  } else if (request.method() === "PATCH") {
    rows.forEach((row) => Object.assign(row, request.postDataJSON()));
  } else if (request.method() === "DELETE") {
    tables[table] = tables[table].filter((row) => !rows.includes(row));
    return reply(null);
  }
  const total = rows.length;
  const offset = Number(url.searchParams.get("offset") || 0),
    limit = Number(url.searchParams.get("limit") || 100000);
  rows = rows.slice(offset, offset + limit);
  const single = request.headers().accept?.includes("vnd.pgrst.object");
  return reply(single ? rows[0] || null : rows, 200, {
    "content-range": `${offset}-${offset + rows.length - 1}/${total}`,
  });
});
await context.addInitScript(
  ({ user }) => {
    const access_token = `${btoa(JSON.stringify({ alg: "HS256" }))}.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.test`;
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token,
        refresh_token: "test-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user,
      }),
    );
  },
  { user },
);
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "warning" && message.text().includes("[Vue warn]"))
    errors.push(message.text());
});
try {
  await page.goto(base);
  await page.getByTitle("Classes", { exact: true }).waitFor();
  await page.getByTitle("Classes", { exact: true }).click();
  await page
    .locator(".class-item")
    .filter({ hasText: "401" })
    .locator(".row-checkbox")
    .click();
  await page
    .locator(".class-item")
    .filter({ hasText: "402" })
    .locator(".row-checkbox")
    .click();
  await page.locator(".class-item").filter({ hasText: "401" }).click();
  await page.getByRole("button", { name: "Vue galerie" }).click();
  await page.locator(".student-gallery .student-avatar").waitFor();
  await page.screenshot({
    animations: "disabled",
    path: `${output}/groups-gallery.png`,
  });
  await page.locator(".class-modal-rail-button.close").click();
  await page.getByTitle("Évaluations", { exact: true }).click();
  await page
    .locator(".class-item")
    .filter({ hasText: "Beep Test #1" })
    .locator(".row-checkbox")
    .click();
  await page.locator(".class-modal-rail-button.close").click();
  await page.locator(".zone-segment").first().waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".student-wrapper").length === 3,
  );
  const drag = async (studentId, target) => {
    await page.waitForFunction(
      () =>
        document.querySelector(".app-root")?.getAttribute("aria-busy") ===
        "false",
    );
    const from = await page
      .locator(`.student-wrapper[data-student-id="${studentId}"]`)
      .boundingBox();
    const to = await page.locator(target).first().boundingBox();
    assert.ok(from && to, "drag endpoints visible");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector(".drag-clone"));
  };
  await drag(id(4), '[data-level="3"]');
  await page.waitForResponse((r) => false, { timeout: 100 }).catch(() => {});
  await page
    .getByTitle("Annuler la dernière action")
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector(".undo-btn").disabled,
  );
  assert.equal(
    tables.tu_session_events.at(-1).class_id,
    id(2),
    "actual student group, not first selected group",
  );
  assert.equal(tables.tu_session_events.length, 1206);
  const deletion = page.waitForResponse(
    (response) => response.request().method() === "DELETE",
  );
  await page.getByTitle("Annuler la dernière action").click();
  await deletion;
  await page
    .getByText("Enregistrement…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.querySelector(".undo-btn").disabled,
  );
  assert.equal(tables.tu_session_events.length, 1205);
  failNextInsert = true;
  await drag(id(4), '[data-level="3"]');
  await page.getByRole("alert").filter({ hasText: "Échec simulé" }).waitFor();
  assert.equal(tables.tu_session_events.length, 1205);
  assert.ok(
    await page.getByTitle("Annuler la dernière action").isDisabled(),
    "failed save must not create undo history",
  );
  await page
    .locator(".feature-error")
    .getByRole("button", { name: "Fermer" })
    .click();
  await drag(id(4), "[data-hide-zone]");
  assert.equal(
    await page.locator(`.student-wrapper[data-student-id="${id(4)}"]`).count(),
    0,
  );
  await page.getByRole("button", { name: /Rétablir/ }).click();
  await drag(id(4), "[data-priority-zone]");
  await page.waitForFunction(
    (studentId) =>
      getComputedStyle(
        document.querySelector(
          `.student-wrapper[data-student-id="${studentId}"]`,
        ),
      ).outlineWidth === "2px",
    id(4),
  );
  await page.getByTitle("Rapport", { exact: true }).click();
  await page
    .getByRole("button", { name: "Exporter le log avec horodatage en CSV" })
    .waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[aria-label="Exporter le log avec horodatage en CSV"]',
      ).disabled,
  );
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter le log avec horodatage en CSV" })
    .click();
  const download = await downloading,
    filepath = `${output}/report-log.csv`;
  await download.saveAs(filepath);
  const csv = await readFile(filepath, "utf8");
  assert.equal(csv.split("\r\n").length, 1206, "export includes every page");
  assert.ok(csv.includes("Élo") && csv.includes("Mme Roy"));
  await page.locator(".class-modal-rail-button.close").click();
  await page.getByTitle("Anniversaires", { exact: true }).click();
  await page.getByText("Élodie Roy — Aujourd’hui").waitFor();
  await page.locator(".popup-close").click();
  await page.getByTitle("Filtrer", { exact: true }).click();
  await page.getByLabel("Photos des élèves").check();
  await page.getByLabel("Respecter les choix individuels").uncheck();
  await page.getByLabel("Surnom", { exact: true }).check();
  await page.locator(".popup-close").click();
  await page.screenshot({
    animations: "disabled",
    path: `${output}/evaluation-dark.png`,
  });
  await page.getByTitle("Changer le thème", { exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: `${output}/evaluation-light.png`,
  });
  for (const viewport of [
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      bottom: document.querySelector(".students-row").getBoundingClientRect()
        .bottom,
    }));
    assert.ok(
      dimensions.width <= dimensions.viewportWidth + 1 &&
        dimensions.height <= dimensions.viewportHeight + 1,
      "no outer scroll",
    );
    assert.ok(
      dimensions.bottom <= dimensions.viewportHeight + 1,
      "student bar visible",
    );
    await page.screenshot({
      animations: "disabled",
      path: `${output}/evaluation-${viewport.width}.png`,
    });
  }
  await page.getByTitle("Classes", { exact: true }).click();
  await page.locator(".class-item").filter({ hasText: "401" }).click();
  await page.locator(".student-item").filter({ hasText: "Élodie" }).click();
  await page.getByText("Fiche permanente", { exact: true }).waitFor();
  await page.getByLabel("N° de fiche", { exact: true }).fill("00999");
  await page.getByLabel("Niveau d’habileté").selectOption("5");
  await page.getByLabel("N° de fiche", { exact: true }).focus();
  await page.waitForFunction(
    () => !document.querySelector("fieldset.feature-fields")?.disabled,
  );
  await page.screenshot({
    animations: "disabled",
    path: `${output}/student-record.png`,
  });
  assert.equal(tables.tu_students[0].record_number, "00999");
  assert.equal(tables.tu_students[0].ability_level, 5);
  await page.locator(".class-modal-rail-button.close").click();
  await page.getByTitle("Évaluations", { exact: true }).click();
  await page.locator(".class-item").filter({ hasText: "Beep Test #1" }).click();
  await page.locator(".student-item").filter({ hasText: "Course" }).click();
  await page.getByLabel("Type", { exact: false }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector("fieldset.feature-fields")?.disabled,
  );
  assert.ok(
    await page.getByLabel("Type", { exact: false }).isDisabled(),
    "existing observations protect grading mode",
  );
  await page.getByLabel("Maximum de traces par élève").fill("1");
  await page.getByLabel("Maximum de traces par élève").press("Tab");
  await page.waitForFunction(
    () => !document.querySelector("fieldset.feature-fields")?.disabled,
  );
  await page.locator(".class-modal-rail-button.close").click();
  await page
    .locator(`.student-wrapper[data-student-id="${id(3)}"]`)
    .waitFor({ state: "hidden" });
  await drag(id(4), '[data-level="3"]');
  await page
    .locator(`.student-wrapper[data-student-id="${id(4)}"]`)
    .waitFor({ state: "hidden" });
  await page.getByTitle("Annuler la dernière action").click();
  await page
    .locator(`.student-wrapper[data-student-id="${id(4)}"]`)
    .waitFor({ state: "visible" });
  await page.getByTitle("Évaluations", { exact: true }).click();
  await page.locator(".class-item").filter({ hasText: "Comportement" }).click();
  await page.locator(".student-item").filter({ hasText: "Respect" }).click();
  await page.getByLabel("Type", { exact: false }).selectOption("rubric");
  await page.waitForFunction(
    () => !document.querySelector("fieldset.feature-fields")?.disabled,
  );
  await page
    .getByLabel("Critères / catégories")
    .fill("Respect\nEsprit sportif\nEffort");
  await page.getByLabel("Critères / catégories").press("Tab");
  await page.waitForFunction(
    () => !document.querySelector("fieldset.feature-fields")?.disabled,
  );
  await page
    .locator(".class-item")
    .filter({ hasText: "Beep Test #1" })
    .locator(".row-checkbox")
    .click();
  await page
    .locator(".class-item")
    .filter({ hasText: "Comportement" })
    .locator(".row-checkbox")
    .click();
  await page.locator(".class-modal-rail-button.close").click();
  await page.locator(".rubric-column").first().waitFor();
  assert.equal(await page.locator(".rubric-column").count(), 3);
  await drag(id(4), '[data-criterion="Effort"][data-level="3"]');
  await page
    .locator(`.student-wrapper[data-student-id="${id(4)}"]`)
    .waitFor({ state: "hidden" });
  assert.equal(tables.tu_session_events.at(-1).criterion, "Effort");
  await page.screenshot({
    animations: "disabled",
    path: `${output}/multi-score.png`,
  });
  await page.getByTitle("Évaluations", { exact: true }).click();
  await page
    .locator(".class-item")
    .filter({ hasText: "Comportement" })
    .getByTitle("Modifier l'activité")
    .click();
  await page.getByRole("button", { name: "Dupliquer", exact: true }).click();
  await page
    .locator(
      'input[placeholder="Nom de l’activité"], input[placeholder="Nom de l\'activité"]',
    )
    .waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".class-item")].some((el) =>
      el.textContent.includes("Comportement (copie)"),
    ),
  );
  await page.getByRole("button", { name: "Archiver", exact: true }).click();
  await page.getByLabel("Archives", { exact: true }).check();
  await page
    .locator(".class-item")
    .filter({ hasText: "Comportement (copie)" })
    .waitFor();
  await page
    .locator(".class-item")
    .filter({ hasText: "Comportement (copie)" })
    .getByTitle("Modifier l'activité")
    .click();
  await page.getByRole("button", { name: "Restaurer", exact: true }).click();
  await page.getByLabel("Archives", { exact: true }).uncheck();
  await page
    .locator(".class-item")
    .filter({ hasText: "Comportement (copie)" })
    .waitFor();
  await page.screenshot({
    animations: "disabled",
    path: `${output}/activity-management.png`,
  });
  await page.locator(".class-modal-rail-button.close").click();
  await page.getByTitle("Classes", { exact: true }).click();
  await page.getByTitle("Importer des élèves", { exact: true }).click();
  await page.getByText("Importer des élèves (CSV)", { exact: true }).click();
  await page
    .locator(".student-import-textarea")
    .fill(
      "Groupe\tNom\tNuméro\tSexe\tDate\n401\tRoy, Élodie\t01\tF\t01/01/2015",
    );
  assert.ok(
    (await page.locator(".student-import-textarea").boundingBox()).height >=
      180,
  );
  await page.screenshot({
    animations: "disabled",
    path: `${output}/csv-import.png`,
  });
  assert.deepEqual(errors, [], "no Vue warnings or unhandled browser errors");
  console.log(
    "Browser checks passed: selections, gallery, group attribution, save failure, undo, temporary removal, priority, paginated CSV, birthdays, display preferences, themes, tablet layouts, student record, observation limits, multi-score, duplication, archive/restore, CSV paste area.",
  );
} finally {
  await browser.close();
}
