# ERP Boilerplate — AI Models and Agents

This document provides a complete understanding of how AI models and agents are used within
this project, including their architecture, capabilities, responsibilities, integration,
workflows, and implementation guidelines.

## Overview

This project is an ERP boilerplate designed for both human developers and AI coding agents.
AI agents (such as Kilo) assist with software engineering tasks including implementing new
features, fixing bugs, refactoring code, running verification, and generating documentation.

## AI agent architecture

### Agent roles

| Role | Responsibility | Tools available |
|------|---------------|-----------------|
| **Coding agent** | Implement features, fix bugs, refactor code | Read, Edit, Write, Glob, Grep, Bash, Task, Board |
| **Explore agent** | Research codebase, find files/patterns | Read, Glob, Grep, Bash (read-only) |
| **General agent** | Execute multi-step research and implementation tasks | All tools |

### Agent workflow

1. **Understand** — Read documentation (`AGENTS.md`, `docs/architecture.md`, etc.) and inspect
   the codebase to understand the current implementation.
2. **Plan** — Break the task into phases; verify the plan against architecture rules.
3. **Implement** — Write code following the conventions in `rules/coding-standards.md`.
4. **Verify** — Run the verification battery (`tsc`, `lint:check`, `format:check`, `docs:di`,
   `build`, DI smoke test).
5. **Commit** — Commit changes with a descriptive message (only when explicitly requested).

### Context boundaries

AI agents must respect the architectural boundaries enforced by ESLint:

- **`src/platform/**` may not import `@business/**`
- **Business modules** import only `@platform` exported tokens, another module's `public/`,
  `application/outbound-ports/**`, and `shared-business` primitives
- **Domain folders** import no `@nestjs/*`
- **Raw clients** → `infrastructure/config/bootstrap/platform` only

## AI model integration

### Model selection

Agents may use different models and reasoning variants. Model selection is handled by the
agent framework (e.g., Kilo Agent Manager) and can be specified per task:

- **Model**: The LLM used for reasoning and code generation (e.g., Claude Opus 4.1)
- **Provider**: The model provider (e.g., anthropic)
- **Variant**: The reasoning effort override (e.g., low, medium, high)

Model selection should only be overridden when explicitly requested by the user.

### Capabilities

| Capability | Description |
|------------|-------------|
| Code generation | Write new TypeScript files following project conventions |
| Code refactoring | Modify existing files while preserving behavior |
| Code review | Identify issues, suggest improvements, verify architecture rules |
| Documentation | Generate and update Markdown documentation |
| Verification | Run type checks, lint, format, build, and DI smoke tests |
| Research | Search codebase for patterns, files, and implementation details |
| Task orchestration | Delegate subtasks to subagents, coordinate via shared board |

### Limitations

- AI agents cannot access external URLs unless they are programming-related help URLs
- AI agents cannot commit unless explicitly requested by the user
- AI agents cannot start new Agent Manager sessions unless explicitly requested
- AI agents must not guess model URLs; only use URLs provided by the user or local files

## Integration points

### Agent Manager

The Agent Manager orchestrates agent sessions, worktrees, and task assignments:

- **`agent_manager list`** — Inspect sessions, sections, and worktrees
- **`agent_manager prompt`** — Send instructions to an existing session
- **`agent_manager stop`** — Stop and remove a session
- **`agent_manager move`** — Move a session's worktree into a section
- **`agent_manager answer`** — Resolve pending questions

### Board

The shared board is used for peer coordination between agents:

- **`board_post`** — Post INFO, ASK, RESULT, HOLD, or VETO messages
- **`board_read`** — Read board history for context

### Wakeups and cron

- **`schedule_wakeup`** — Schedule a one-time future resume
- **`cron_create`** — Schedule recurring tasks
- **`cron_delete`** — Delete scheduled tasks
- **`cron_list`** — List scheduled tasks

## Implementation guidelines for AI agents

### Before writing code

1. Read `AGENTS.md` for hard rules and verification battery.
2. Read `docs/architecture.md` for system design.
3. Read `docs/business-modules.md` for module conventions.
4. Inspect the actual module before changing it.
5. For DB changes: read `prisma/schema/<context>/*.prisma` header comments.

### During implementation

- Follow `rules/coding-stardards.md` for TypeScript/NestJS conventions.
- One use case per file (`<verb>-<noun>.usecase.ts`).
- One request DTO per file (`http/requests/*.request.dto.ts`, Zod via `createZodDto`).
- Ports are abstract classes used as DI tokens.
- Providers use `useExisting`.
- Module files contain bindings/exports only.
- `@Global()` is never used.
- No comments in code unless asked.

### After implementation

Run the full verification battery:

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
# DI smoke test
```

### Commit guidelines

- Do not commit unless explicitly requested.
- Do not commit secrets or `.env`.
- Write concise commit messages matching repo style.
- Never edit `src/generated/**`.

## AI-specific documentation locations

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Hard rules, verification battery, open work |
| `docs/architecture.md` | System architecture, layers, dependency rules |
| `docs/business-modules.md` | Business module anatomy and patterns |
| `docs/platform-services.md` | Platform layer services and ports |
| `docs/authentication-authorization.md` | Auth, RBAC, ABAC, tenancy |
| `docs/outbox-events-messaging.md` | Transactional outbox, events, messaging |
| `docs/data-model.md` | Prisma schema, tables, tenancy |
| `docs/api-endpoints.md` | HTTP API, controllers, DTOs |
| `docs/service-module-development.md` | Service module development guidelines |
| `rules/architecture-rules.md` | ESLint-enforced architecture boundaries |
| `rules/coding-standards.md` | TypeScript/NestJS naming conventions |

## Adding AI-assisted features

When adding a new feature with AI assistance:

1. **Create a plan** — Document what will be built, which files will change, and which
   architecture rules apply.
2. **Verify the plan** — Check against `AGENTS.md` hard rules.
3. **Implement incrementally** — One phase at a time, running verification after each.
4. **Document changes** — Update relevant docs if the architecture or APIs change.
5. **Request commit** — Ask the user before committing changes.
