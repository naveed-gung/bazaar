<!-- AGENT NOTE: Before ending your session, update the Status tables in the docs you
touched, bump last-verified, and append a line to SESSIONS.md.
Rules: docs/agent/PROTOCOL.md -->
---
doc: 00-INDEX
last-verified: 2026-08-03
verified-by: claude-code
---

# Bazaar — agent docs index

Agent-maintained knowledge base. Read this file first, every session.

## What this repo is

npm-workspaces monorepo for **Bazaar**, a full-stack commerce platform.

| Workspace | Path | Stack |
|-----------|------|-------|
| `@bazaar/frontend` | `frontend/` | TanStack Start + Router (file routes), React 19, TanStack Query v5, Tailwind CSS 4 (CSS-first `@theme inline`), lucide-react |
| `@bazaar/backend` | `backend/` | Express 5, MongoDB (transactions), Firebase Admin, opaque HttpOnly session cookies, CSRF + rate limits, Vitest |
| `@bazaar/shared` | `packages/shared/` | Shared types (`ProductSummary`, …) |
| functions | `netlify/functions/` | Netlify deploy glue |

Root scripts: `dev` · `dev:web` · `dev:api` · `build` · `typecheck` · `lint` ·
`test` (backend only — see TASK-02) · `db:bootstrap` · `db:seed`.

## Doc map

| Doc | Scope | ID prefix |
|-----|-------|-----------|
| [PROTOCOL.md](PROTOCOL.md) | The maintenance contract (read once per session) | — |
| [SESSIONS.md](SESSIONS.md) | Session journal, newest first | — |
| [01-roadmap.md](01-roadmap.md) | Backend, tooling, testing, infrastructure work | TASK |
| [02-ui-ux.md](02-ui-ux.md) | Design system, routes, accessibility | UIX |

Layout note: hybrid of the lean and full layouts — UI/UX is split out because it is
where the bulk of the work sits; everything else stays in one roadmap until a theme
earns its own doc.

## Status legend

`TODO` not started · `IN-PROGRESS` someone worked on it, unfinished · `BLOCKED`
needs HUMAN-GATE or dependency · `DONE` verified complete · `DROPPED` won't do.

## Current top priorities (max 5 — keep current)

1. [TASK-02](01-roadmap.md) — frontend has no test runner; `npm test` only exercises the backend.
2. [UIX-10](02-ui-ux.md) — dark-palette contrast pairs have never been measured against WCAG AA.
3. [UIX-08](02-ui-ux.md) — no skip-to-content link anywhere in the app shell.
4. [UIX-07](02-ui-ux.md) — `max-w-[1600px]` shell width is copy-pasted across ~25 call sites.
5. [TASK-03](01-roadmap.md) — backend route files hold multi-statement single lines; hard to review.

## Verified facts worth not re-deriving

- **Secrets are correctly ignored** (verified 2026-08-03): `git ls-files` tracks no
  `.env`/adminsdk/credential file; `.gitignore` lines 4–5 cover
  `atlas-credentials.env` and `*-adminsdk-*.json`. Both exist untracked in the repo root.
- Tailwind v4 `@layer components` loses to utilities here, so `className="btn btn-primary w-full"`
  and `className="field mt-2"` compose correctly — no `!important` needed.
- An `overflow-x: auto` wrapper computes `overflow-y: auto` and becomes a scroll
  container, so a vertically sticky `<thead>` can never pin inside one. `.spec-matrix`
  therefore uses sticky-**left** labels only.
- `frontend` is Prettier-enforced through ESLint (`eslint-plugin-prettier/recommended`,
  printWidth 100, double quotes). `backend` is **not** — it runs `eslint src --max-warnings=0`.

## Cross-doc dependencies

| Task | Depends on |
|------|------------|
| UIX-07 | — (independent; touches route files only) |
| TASK-02 | — (adding Vitest to `frontend/` unlocks regression tests for UIX-01…UIX-06) |
