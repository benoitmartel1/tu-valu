# Tu-valu — review branch

Branch: `feat/issue-review-batch`, based on `8116e7d`.

This branch implements the 24 open requests reviewed on September 25, 2026. It is ready for product review, not deployed. The hosted database has not been changed and the GitHub issues remain open.

## Changes by issue

| Issue                                                     | Implemented behavior                                                                                                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#3](https://github.com/benoitmartel1/tu-valu/issues/3)   | Team assignment on the student record, multiple-team filtering, and explicit saved team sets.                                                                                                                                                 |
| [#20](https://github.com/benoitmartel1/tu-valu/issues/20) | Global first name, surname, initial, nickname and photo preferences; individual preferences remain intact.                                                                                                                                    |
| [#21](https://github.com/benoitmartel1/tu-valu/issues/21) | Separate recorded absence and temporary removal zones. Temporary removal has a restore button. Recorded absences are daily and undoable.                                                                                                      |
| [#25](https://github.com/benoitmartel1/tu-valu/issues/25) | Archive/restore, archive browsing, term, duplication, drag ordering and move buttons. Nonnumeric observations accept comments. Multi-score grids keep separate criteria with scores from +3 to −3, following the attached example.            |
| [#29](https://github.com/benoitmartel1/tu-valu/issues/29) | Persistent light/dark toggle with shared neutral colors across evaluation and management screens.                                                                                                                                             |
| [#32](https://github.com/benoitmartel1/tu-valu/issues/32) | Responsive import mapping fields with consistent label/control alignment.                                                                                                                                                                     |
| [#34](https://github.com/benoitmartel1/tu-valu/issues/34) | Draggable photos, optional labels, initials fallback, and photo drag previews.                                                                                                                                                                |
| [#36](https://github.com/benoitmartel1/tu-valu/issues/36) | Group search, school-grade filter, selected-group summary, and Deselect all. Browsing remains separate from selection.                                                                                                                        |
| [#38](https://github.com/benoitmartel1/tu-valu/issues/38) | Larger paste area with saved resize height, bounded by the screen. Quoted CSV fields and multiline cells are supported.                                                                                                                       |
| [#39](https://github.com/benoitmartel1/tu-valu/issues/39) | Compound-name matching and explicit candidate selection. Classroom-number matching checks the group too. Permanent record numbers take precedence when present in filenames.                                                                  |
| [#40](https://github.com/benoitmartel1/tu-valu/issues/40) | Persistent list/gallery switch with shared selections, photo cards and readable labels.                                                                                                                                                       |
| [#41](https://github.com/benoitmartel1/tu-valu/issues/41) | Three priority levels, visible outline and star, per-student decrease, and reset in settings. Priority creates no grade.                                                                                                                      |
| [#42](https://github.com/benoitmartel1/tu-valu/issues/42) | Birthdays tab: today or next 30 days, selected students or all groups.                                                                                                                                                                        |
| [#43](https://github.com/benoitmartel1/tu-valu/issues/43) | Paginated report loading, surfaced errors, request ordering, export loading guards, and correct group attribution for new observations. Historical observations remain available when a group is removed.                                     |
| [#45](https://github.com/benoitmartel1/tu-valu/issues/45) | Nicknames alongside full names in report lists and details.                                                                                                                                                                                   |
| [#46](https://github.com/benoitmartel1/tu-valu/issues/46) | Expanded summary and log CSVs: identifiers, names, nicknames, birth dates, gender, ability, groups, years, classroom numbers, active team, photo reference, and observation authors/comments.                                                 |
| [#47](https://github.com/benoitmartel1/tu-valu/issues/47) | Atomic copies of groups, activities and skills, opening the copied record for editing. Group copies can reuse student memberships. Observations are never copied.                                                                             |
| [#48](https://github.com/benoitmartel1/tu-valu/issues/48) | Permanent student identifiers, shared group memberships, school years, a student bank, and import reuse by identifier. Classroom numbers live on memberships. Removing a group preserves students and historical observations.                |
| [#49](https://github.com/benoitmartel1/tu-valu/issues/49) | Optional per-skill observation cap, server-side enforcement, completed-student hiding, and restoration through undo.                                                                                                                          |
| [#50](https://github.com/benoitmartel1/tu-valu/issues/50) | Numeric, letter, category and multi-score modes; optional letter modifiers; saved grading snapshots; letter averages rounded upward.                                                                                                          |
| [#51](https://github.com/benoitmartel1/tu-valu/issues/51) | Optional ability level 1–5, student sorting, balanced teams and similar-ability teams. Unrated students remain distinct from level 1.                                                                                                         |
| [#52](https://github.com/benoitmartel1/tu-valu/issues/52) | Stable observation-round darkening; another student's higher count no longer lightens an already observed student. Labels remain readable.                                                                                                    |
| [#53](https://github.com/benoitmartel1/tu-valu/issues/53) | Viewport-sized evaluation layout, persistent top tabs and student strip, internal scrolling for evaluations and large rosters.                                                                                                                |
| [#54](https://github.com/benoitmartel1/tu-valu/issues/54) | Signed-in observer attribution enforced on insert, displayed in the log, filterable in statistics, and included in CSV. Existing known authors receive their account's current display name during migration; unknown authors remain unknown. |

## Choices to review

- A limit covers the entire history of a skill, not a browser visit. A student disappears only when every selected skill is complete. A multi-score grid's limit currently covers the whole skill, across its criteria.
- Darkening follows complete observation rounds across the selected roster; gender/team display filters do not change that baseline. Marked-absent students are excluded from the current round.
- With modifiers, D=1 through A+=10. Without modifiers, D=2.5, C=5, B=7.5, A=10. Changing a grading type after observations requires duplicating the skill so historical averages are not mixed across incompatible scales.
- February 29 birthdays appear on March 1 in non-leap years. Birthdays use the device's calendar date; database absence deduplication uses America/Toronto.
- Preferences are saved on this browser/device. Temporary removal and priority are current-session aids.
- Permanent record numbers are unique within the current shared application database. Existing records are not automatically merged by name. An existing identifier reused during import adds a membership without overwriting that student's name or photo.
- Old team sets cannot be reliably inferred from timestamps. They remain under “Anciennes équipes”; newly saved teams use explicit sets.

## Verification

- Production build passes.
- 21 automated assertions/subtests pass, including local PostgreSQL migration execution, RLS behavior, observation limits, daily absences, grading history, shared identity, group deletion, duplication, team assignment and attribution.
- Browser checks use synthetic records and a mocked API, including an export of 1,205 observations. They cover scoring, failed saves, undo, limits, gallery, photo rendering, temporary removal, priority, birthdays, theme/display settings, student record edits, multi-score, activity duplication, archive/restore and CSV paste layout.
- Chromium and WebKit are used at desktop and tablet dimensions. This is not a physical iPad test.

## Database and rollout

The new migration is `supabase/migrations/20260926015325_issue_review_batch.sql`. It must be applied to a staging copy of the real database before this frontend is used there. It adds membership data and fields, preserves group history, and installs invoker functions and observation validation triggers.

The repository does not include the original complete table-creation migration. Local database tests therefore reconstruct the baseline expected by the existing application. The public application key did not permit reading hosted schema metadata. Compatibility with the full hosted schema and existing constraints still needs staging verification; no production migration, repair, deployment, push or issue closure was performed.

Existing observations that may have been assigned to the wrong group are not automatically rewritten: the correct historical group cannot safely be inferred from current membership alone. New observations use the student's actual selected membership.

New membership policies follow visibility of the existing student and group tables. This change does not replace the application's existing access model.

## Running the checks

After `npm ci`, run `npm test` and `npm run build`.

For browser checks, start Vite with `VITE_SUPABASE_URL=http://127.0.0.1:54329` and `VITE_SUPABASE_ANON_KEY=test-anon-key`, then run `npm run test:browser`. The test intercepts every API request and does not use the hosted database. Install test browsers with `npx playwright install chromium webkit`. Set `TEST_BROWSER=webkit` for WebKit. `TEST_OUTPUT` can override the screenshot directory.

Use real environment values only against a staging database after its migration has passed. The original checkout remains on `main`; this branch is in the isolated checkout listed by `git worktree list`.
