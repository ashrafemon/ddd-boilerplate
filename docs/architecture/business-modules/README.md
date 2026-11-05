# Business Module Architecture Standard

> **Status:** Phase 0 complete (documentation only). Implementation has **not** started.
> **Scope:** every aggregate module under `src/business/**`.
> **Last verified:** 2026-11-05.

This folder is the documentation-first source of truth for standardizing business
modules: controllers, use cases, facades, domain boundaries, request context,
authorization, event integrations, caching/idempotency, the implementation roadmap,
persistent progress, architectural decisions, and AI handover.

No application source code is changed in Phase 0. Phases 1–10 are tracked in
[`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) and
[`PROGRESS.md`](./PROGRESS.md).

---

## 1. Purpose

The ERP boilerplate already has strong repo-wide architecture documentation
(`ARCHITECTURE.md`, `docs/BUSINESS-MODULE-GUIDE.md`,
`docs/PLATFORM-SERVICE-GUIDE.md`, `AGENTS.md`). It does **not** yet define one
unambiguous, auditable standard for business-module internals. This package fills
that gap and makes the work resumable by any model or developer.

Goals:

1. Define normative business-module rules without weakening existing hard rules.
2. Record where the current code differs from the target standard.
3. Break the migration into small, independently verifiable tasks.
4. Persist state in the repository so progress survives session resets and rate limits.
5. Give the next AI model a deterministic resume procedure.

---

## 2. Source-of-truth precedence

When documents disagree, use this order and **record the conflict in
[`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md)** instead of silently
picking one:

1. **This folder's rules** — [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) plus
   its supporting documents, for business-module behavior and boundaries.
2. **Architectural decision records (ADRs)** — they resolve ambiguity and record
   approved exceptions.
3. **`ARCHITECTURE.md`** — repo-wide layers, platform services, infrastructure,
   persistence, HTTP pipeline, outbox, tenancy. For business modules, the stricter
   rule in this folder governs; the conflict is recorded.
4. **`docs/BUSINESS-MODULE-GUIDE.md`** — the **current** implementation reference and
   templates. It is migration input, not the target standard.
5. **`prisma/schema/**/*.prisma`** — the table contract (there are no migrations).

**Always in force, in parallel with the above:** `AGENTS.md` non-negotiable repo
safety rules (ESLint boundaries, tenancy, outbox, physical SQL column names, no
migrations). They are a hard constraint, not a lower-precedence document, and are
never overridden by this package.

Hard rule: **no implementation task may weaken a rule in this folder.** If a rule
cannot be met because of an existing technical constraint, document the conflict and
its implications in an ADR and leave the task `BLOCKED` or `NEEDS_REVIEW` rather than
silently reinterpreting the rule.

---

## 3. Document index

| Document | Purpose |
| --- | --- |
| [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) | Normative rules R-01…R-43, reproduced from the standardization mandate; inherited hard rules. |
| [`LAYER-RESPONSIBILITIES.md`](./LAYER-RESPONSIBILITIES.md) | Responsibility, allowed dependencies, and prohibitions for every component. |
| [`DEPENDENCY-BOUNDARIES.md`](./DEPENDENCY-BOUNDARIES.md) | Allowed/prohibited dependency directions, domain-file access, exceptions, examples, enforcement gaps. |
| [`REQUEST-LIFECYCLE.md`](./REQUEST-LIFECYCLE.md) | Middleware → context → tenancy/auth → company config → guard → controller → use case → ABAC → orchestration. |
| [`AUTHORIZATION.md`](./AUTHORIZATION.md) | RBAC, ABAC, middleware/guard boundaries, context requirements, current gaps. |
| [`EVENT-INTEGRATION.md`](./EVENT-INTEGRATION.md) | Incoming contracts/listeners + inbox-first sequence; outgoing contracts/publishers; naming; tests. |
| [`CROSS-CUTTING-CONCERNS.md`](./CROSS-CUTTING-CONCERNS.md) | Cache and idempotency decorators; prohibition on direct port calls from use cases. |
| [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) | Phases 0–10 with every task's scope, requirements, acceptance criteria, validation, dependencies, status. |
| [`PROGRESS.md`](./PROGRESS.md) | Persistent task tracker, completed work, blockers, verification, current phase, exact next action. |
| [`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md) | ADR log: decisions, rationale, consequences, unresolved questions, conflicts. |
| [`AI-HANDOVER.md`](./AI-HANDOVER.md) | Deterministic read order and resume/handover protocol for another model. |

Related existing documents (not duplicated here):

- `ARCHITECTURE.md` — repo-wide design and platform/infrastructure rules.
- `docs/BUSINESS-MODULE-GUIDE.md` — current module build templates.
- `docs/PLATFORM-SERVICE-GUIDE.md` — platform-service build templates.
- `docs/FLOWCHARTS.md` — runtime flow diagrams.
- `docs/DI-WIRING.md` — generated dependency-injection graph.
- `docs/IAM-BUILD-PLAN.md` — deferred IAM design (RBAC/ABAC dependency).
- `AGENTS.md` — hard repo rules and verification battery.

---

## 4. How to use this package

### 4.1 Developer workflow

1. Read `ARCHITECTURE-RULES.md` and the document for the layer you will touch.
2. Read the relevant ADRs and the current `PROGRESS.md`.
3. Inspect the actual code before deciding a change; do not assume modules are uniform.
4. Pick the **next eligible task** from `IMPLEMENTATION-ROADMAP.md`.
5. Implement only that task's scope.
6. Run the task's validation plus the repo verification battery.
7. Update `PROGRESS.md` immediately (status, files, commands, results, date).
8. Add an ADR if the task creates or resolves an architectural decision.
9. Update `AI-HANDOVER.md` whenever the execution state changes materially.

### 4.2 AI-model workflow

Never rely on conversation history. Follow [`AI-HANDOVER.md`](./AI-HANDOVER.md):
read the README → rules → roadmap → progress → ADRs → handover, then inspect the
repo and `git status`, find the last verified task, and continue from the exact next
task. Do not repeat verified work.

### 4.3 Documentation update discipline

- Update the **existing** document when the topic already exists; do not create a
  parallel doc.
- Keep rule IDs stable. If a rule changes, amend it and add an ADR; never renumber
  silently.
- Every task that changes architecture must update the relevant doc and
  `PROGRESS.md` in the same change.
- Link, don't copy. Prefer references to `ARCHITECTURE.md` / schema files over
  duplicated text that can drift.

---

## 5. Status model

Use these values consistently in the roadmap and progress tracker:

| Status | Meaning |
| --- | --- |
| `PENDING` | Not started. |
| `IN_PROGRESS` | Currently being implemented; record the owner/date. |
| `BLOCKED` | Cannot proceed: dependency, missing information, or external constraint. Record resolution needed. |
| `COMPLETED` | Implemented and verified against acceptance criteria; validation results recorded. |
| `NEEDS_REVIEW` | Implemented but not yet verified, or awaiting architectural review. |

**Completion requires verification.** Code changes alone do not make a task
`COMPLETED`; the acceptance criteria and validation must pass and be recorded.

---

## 6. Roadmap and progress process

- [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) contains Phase 0 through
  Phase 10 and every task with its full definition.
- [`PROGRESS.md`](./PROGRESS.md) is the live tracker. Update it **after every task**,
  not at the end of a phase.
- Task IDs are stable (`P<phase>-<nn>`). New work discovered during a task gets a new
  ID appended to the current phase (for example `P3-13`) and is added to both files.
- Do not combine unrelated tasks into one change.
- Do not proceed past a phase gate until its acceptance criteria are verified.
- Phase 0 ends with a report and **waits for confirmation** before Phase 1.

---

## 7. Execution constraints

- Work exclusively inside business modules unless a shared infrastructure change is
  explicitly necessary; if so, document why in an ADR and keep the change minimal.
- Follow existing repository structure and naming unless this standard says otherwise.
- No unnecessary abstractions; a new layer/file must have a clear architectural or
  functional benefit.
- Preserve existing functional behavior unless a task explicitly changes it.
- No unrelated refactoring; no speculative violations.
- Do not modify `src/` during Phase 0.
- The repo's hard safety rules (tenancy, outbox, lint boundaries, schema conventions)
  always apply.

---

## 8. Phase 0 verification checklist

- [x] Existing documentation structure inspected.
- [x] Existing architecture/guideline documents cataloged.
- [x] Missing/outdated/conflicting documentation identified.
- [x] All business-module rules consolidated in `ARCHITECTURE-RULES.md`.
- [x] Layer responsibilities documented.
- [x] Dependency boundaries and permitted exceptions documented.
- [x] Request lifecycle and context requirements documented.
- [x] RBAC/ABAC responsibilities documented.
- [x] Incoming/outgoing event integration conventions documented.
- [x] Cache/idempotency decorator conventions documented.
- [x] Phased roadmap with small tasks created.
- [x] Persistent progress tracker created.
- [x] Architectural decision log created.
- [x] AI handover instructions created.
- [x] Documentation cross-checked for internal consistency; no source code modified.

---

## 9. Requirement coverage map (Phase 0 cross-check)

| Mandate section | Requirement | Covered by |
| --- | --- | --- |
| §2.1 | Thin controllers; no logic; delegate orchestration | R-01…R-03; `LAYER-RESPONSIBILITIES.md`; `DEPENDENCY-BOUNDARIES.md` |
| §2.2 | Use cases orchestrate only; no business/domain work; no facades; variables; context sequence | R-04…R-11; `REQUEST-LIFECYCLE.md` |
| §2.3 | Facades invoke use cases/services; no facade-to-facade; no business logic | R-12…R-15; `LAYER-RESPONSIBILITIES.md`; ADR-016 |
| §2.4 | Domain-only access; permitted services/repos/factories; invariants/policies/errors | R-16…R-23; `DEPENDENCY-BOUNDARIES.md`; ADR-005/ADR-006 |
| §2.5 | No required application DTOs/mappers; no unnecessary abstractions | R-24…R-25; `LAYER-RESPONSIBILITIES.md`; ADR-007 |
| §2.6 | Separate incoming/outgoing events; contracts/listeners; inbox-first; publishers | R-26…R-31; `EVENT-INTEGRATION.md`; ADR-008 |
| §2.7 | Cache/idempotency via decorators; no direct ports; audit | R-32…R-35; `CROSS-CUTTING-CONCERNS.md`; ADR-009 |
| §2.8 | Middleware context/tenancy/auth/config; guard RBAC; use-case context+ABAC | R-36…R-43; `REQUEST-LIFECYCLE.md`; `AUTHORIZATION.md`; ADR-010/ADR-013 |
| §3 | Documentation-first; no source changes in Phase 0 | This README; Phase 0 in `IMPLEMENTATION-ROADMAP.md`; `PROGRESS.md` |
| §4 | Required document structure/content | §3 document index of this README; all package files |
| §5 | Phased roadmap with small, independently executable tasks | `IMPLEMENTATION-ROADMAP.md` (131 tasks) |
| §6 | Task execution sequence and status values | `IMPLEMENTATION-ROADMAP.md` §1; `PROGRESS.md` |
| §7 | Persistent progress tracking | `PROGRESS.md` |
| §8 | AI handover/model continuity | `AI-HANDOVER.md` |
| §9 | Execution constraints | This README §7; `IMPLEMENTATION-ROADMAP.md` §1 |
| §10 | Phase 0 only; report; wait for confirmation | Phase 0 completed; `PROGRESS.md` §8 |
| §11 | Definition of success | Phase 10 tasks; `PROGRESS.md` phase gates |

