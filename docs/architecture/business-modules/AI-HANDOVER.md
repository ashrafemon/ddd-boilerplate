# AI Handover

> Deterministic continuation instructions for any AI model or developer.
> Do not rely on prior conversation history. The repository is the source of truth.
> Last updated: 2026-11-05.

---

## 1. Read order (mandatory)

1. [`README.md`](./README.md) — purpose, precedence, document index, status model.
2. [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) — normative rules R-01…R-43 and
   inherited hard rules INH-01…08.
3. [`LAYER-RESPONSIBILITIES.md`](./LAYER-RESPONSIBILITIES.md) and
   [`DEPENDENCY-BOUNDARIES.md`](./DEPENDENCY-BOUNDARIES.md).
4. [`REQUEST-LIFECYCLE.md`](./REQUEST-LIFECYCLE.md) and [`AUTHORIZATION.md`](./AUTHORIZATION.md).
5. [`EVENT-INTEGRATION.md`](./EVENT-INTEGRATION.md) and
   [`CROSS-CUTTING-CONCERNS.md`](./CROSS-CUTTING-CONCERNS.md).
6. [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md).
7. [`PROGRESS.md`](./PROGRESS.md) — live status and exact next task.
8. [`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md) — decisions and open
   questions.
9. `AGENTS.md`, `ARCHITECTURE.md`, `docs/BUSINESS-MODULE-GUIDE.md`,
   `docs/PLATFORM-SERVICE-GUIDE.md` as needed.
10. This file.

Then inspect the actual repository (`git status`, relevant `src/` files) before
changing anything.

---

## 2. Current execution state

| Field | Value |
| --- | --- |
| Current phase | **Phase 0 — COMPLETED** |
| Last completed task | **P0-15** (documentation consistency review) |
| Current/interrupted task | None |
| Exact next task | **P1-01 — Identify all business modules** (Phase 1), **only after Phase 0 is confirmed** |
| Overall completion | 15 / 131 tasks (11.5%) |
| Blockers | None confirmed. Potential IAM dependency for Phase 5 (ADR-010). |
| Working branch | `dev-v1` |
| Source of truth | `docs/architecture/business-modules/` |

**Do not start Phase 1 automatically.** The mandate requires Phase 0 to be reported
and confirmed first. If acting autonomously under explicit instruction to continue,
record the confirmation in `PROGRESS.md` before starting P1-01.

---

## 3. Completed work (Phase 0)

Created the business-module architecture package:

```text
docs/architecture/business-modules/
├── README.md
├── ARCHITECTURE-RULES.md
├── LAYER-RESPONSIBILITIES.md
├── DEPENDENCY-BOUNDARIES.md
├── REQUEST-LIFECYCLE.md
├── AUTHORIZATION.md
├── EVENT-INTEGRATION.md
├── CROSS-CUTTING-CONCERNS.md
├── IMPLEMENTATION-ROADMAP.md
├── PROGRESS.md
├── ARCHITECTURAL-DECISIONS.md
└── AI-HANDOVER.md
```

Cross-links added to existing docs (documentation only):

- `README.md` — documentation index entry.
- `ARCHITECTURE.md` — §15 pointer to this package.
- `AGENTS.md` — pointer in the "Before writing any code" section.
- `docs/BUSINESS-MODULE-GUIDE.md` — banner distinguishing current patterns from the
  target standard.

No application source code (`src/**`, `test/**`, `prisma/**`) was modified.

---

## 4. Files modified / uncommitted changes

At Phase 0 close, the working tree should contain **documentation changes only**.

Verify before resuming:

```bash
git status --short
git diff --stat
```

Expected: only `docs/architecture/business-modules/**` (new) and the four cross-link
edits above. If any `src/**` file is modified, stop and investigate: Phase 0 forbids
source changes.

> The next model must confirm this itself. Do not trust this statement blindly.

---

## 5. Validation performed

- Existing docs inventoried and cataloged.
- Rules consolidated with stable IDs (R-01…R-43, INH-01…08).
- Every required document created.
- Roadmap contains Phases 0–10 and 131 tasks.
- Progress tracker contains every task and the completed-work record.
- Cross-links added to existing docs.
- Consistency checks performed against the mandate's Section 2 and required document
  contents.
- Verified 131 roadmap/progress task IDs match; R-01…R-43 present; 17 ADRs; relative
  links resolve; `git diff --check` clean.
- `git status`/`diff` used to confirm no source changes (verify on resume).

## 6. Validation still required

- **Human/owner confirmation of Phase 0** (explicit gate).
- Resolve ambiguous decisions before the affected phases:
  - ADR-005: domain `types/`/`events/` access.
  - ADR-010: minimal RBAC/ABAC vs. full IAM.
  - ADR-009: decorator placement/transaction interaction.
- Phase 1 audit (P1-01 onward) has not started.

---

## 7. Known blockers and risks

- **No confirmed blocker.**
- **Phase 5 risk:** RBAC/ABAC depends on the deferred IAM design. Resolve ADR-010 at
  P5-07/P5-09. If unresolved, mark those tasks `BLOCKED` with the exact resolution
  needed.
- **Phase 2/3 risk:** ADR-005 (domain type/event access) may require an owner decision
  before refactoring use cases.
- **Documentation drift:** existing docs still reference `listeners`,
  `adapters/module`, `public/index.ts`, and flat platform paths. Do not "fix" these
  silently; reconcile in P10-12 (or earlier if a task requires it) and update ADR-002.

---

## 8. Key decisions and outstanding questions

Decisions: see [`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md). The most
important for resuming:

- ADR-001 — documentation-first; no source changes in Phase 0.
- ADR-002 — precedence order.
- ADR-005 — strict domain access; domain types/events ambiguity (open).
- ADR-010 — middleware/guard/use-case split; IAM dependency (open).
- ADR-015 — current implementation is migration input, not the target.
- ADR-016 — facades may invoke services, but repository/factory/outbound-port
  orchestration stays in a use case.
- ADR-017 — infrastructure adapters may depend on domain ports/types to implement
  persistence (dependency inversion).

Outstanding questions:

1. Are domain `types/` and `events/` permitted as application contracts, or must
   application-owned contracts replace them? (ADR-005)
2. Minimal RBAC/ABAC facade vs. wait for IAM? (ADR-010)
3. Where exactly do cache/idempotency decorators sit for non-HTTP use-case invocation?
   (ADR-009)
4. Where does transport-status mapping live (controller vs. use case vs. filter)?
   (ADR-003)

---

## 9. Resume procedure

1. Read in the order in §1.
2. Run `git status --short` and `git diff --stat`.
3. Confirm no unexpected source changes; if found, stop and document.
4. Open `PROGRESS.md`; find the last `COMPLETED` task and the exact next task.
5. Open the roadmap entry for that task; read scope, requirements, acceptance,
   validation, dependencies.
6. Check `ARCHITECTURAL-DECISIONS.md` for open questions affecting the task.
7. Inspect the actual code files named by the task (never assume structure).
8. Implement only that task.
9. Run validation + the relevant repo battery.
10. Update `PROGRESS.md` immediately (status, files, commands, results, date).
11. Add/update ADRs and this handover if the state changed.
12. Proceed only to the next eligible task.

At Phase 0 close, after confirmation the first eligible task is **P1-01**.

---

## 10. Rate-limit / interruption protocol

If you must stop before finishing:

1. Update `PROGRESS.md`:
   - current task → `IN_PROGRESS` or `BLOCKED` (never `COMPLETED` without validation);
   - record files changed, commands run, results, exact stopping point;
   - set the next action.
2. Update this file (`AI-HANDOVER.md`):
   - current phase/task, last completed task, exact next task;
   - uncommitted changes and unfinished edits;
   - validation performed vs. still required;
   - blockers and decisions made during the interrupted task.
3. Leave the repository buildable if possible. If not, clearly state the broken state
   and the command that fails.
4. Never claim work was persisted unless the corresponding files were actually written
   and saved.

---

## 11. Handover update template

Copy this block into §2 when handing over:

```text
Current phase:
Last completed task:
Current/interrupted task:
Exact next task:
Completed work summary:
Modified files:
Uncommitted changes:
Validation performed:
Validation still required:
Known blockers:
Architectural decisions made:
Outstanding questions:
Recommended next action:
```

---

## 12. Guardrails for the next model

- Do not modify `src/` during Phase 0; Phase 0 is done, so only start Phase 1 after
  confirmation.
- Do not weaken rules in `ARCHITECTURE-RULES.md`.
- Do not silently reinterpret an ambiguity; record it in an ADR.
- Do not combine unrelated tasks.
- Do not mark a task `COMPLETED` without passing acceptance/validation.
- Do not assume all business modules share the same structure; inspect every module.
- Preserve functional behavior unless the task explicitly changes it.
- Keep `PROGRESS.md` and `AI-HANDOVER.md` synchronized with reality.
