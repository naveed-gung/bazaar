<!-- AGENT NOTE: Before ending your session, update the Status table below if you
touched anything related, bump last-verified, and append to SESSIONS.md.
Rules: docs/agent/PROTOCOL.md -->
---
doc: 01-roadmap
last-verified: 2026-08-03
verified-by: codex
---

# Bazaar — roadmap & open work

Backend, tooling, testing and repo-hygiene work. UI/UX lives in [02-ui-ux.md](02-ui-ux.md).

## Status

| ID | Title | Priority | Effort | Status | Last touched |
|----|-------|----------|--------|--------|--------------|
| TASK-01 | Hoist `inventoryByProduct` and enrich the `/comparison` payload | P1 | S | DONE | 2026-08-03 |
| TASK-02 | Add a test runner to the frontend workspace | P1 | M | TODO | 2026-08-03 |
| TASK-03 | Make backend source reviewable (line length / Prettier parity) | P2 | M | TODO | 2026-08-03 |
| TASK-04 | Commit the UI overhaul working tree | P2 | S | DONE | 2026-08-03 |

## Tasks

### TASK-01 Hoist `inventoryByProduct` and enrich the `/comparison` payload
Priority: P1 · Effort: S · Depends: — · Files: backend/src/domain/catalog.ts, backend/src/routes/catalog.ts, backend/src/routes/engagement.ts

**Why**: `GET /comparison` hand-built a trimmed product shape (id, slug, name, category,
imageUrl, price, specs), so the compare page had no rating, availability or badge data to
render — UIX-02 needed the full `ProductSummary`. The inventory rollup it required was a
private helper at the bottom of `routes/catalog.ts`.
**Acceptance criteria**:
- [x] `inventoryByProduct(db, ids)` exported from `domain/catalog.ts`, typed against `Db`
- [x] `routes/catalog.ts` imports it instead of declaring its own copy
- [x] `/comparison` returns `serializeProduct(item, availability)` — same shape as the shop grid
**Agent instructions**: — (complete). Any new route needing sellable quantity should
import `inventoryByProduct` rather than re-querying `variants` + `inventory`.
**Verification**: `npm run typecheck` clean and `npm test` → 3 files / 15 tests passed
(2026-08-03).
**Risks/rollback**: `git checkout -- backend/src`.

### TASK-02 Add a test runner to the frontend workspace
Priority: P1 · Effort: M · Depends: — · Files: frontend/package.json, root package.json

**Why**: `frontend/package.json` has no `test` script and no test dependency; root
`test` is literally `npm run test --workspace @bazaar/backend`. The 2026-08-03 session
rewrote ~35 route/component files with zero automated coverage — every check was
typecheck + lint + build + reading the diff. There is nothing to catch a regression in
`spec-sheet.tsx`, the compare-matrix diff logic, or the four-branch async states.
**Acceptance criteria**:
- [ ] Vitest + jsdom (or the Testing Library stack) wired into `frontend/` with a `test` script
- [ ] Root `npm test` runs both workspaces
- [ ] At least three real tests: spec-sheet renders labels+values, compare "Differences only"
      filters to changed rows, and one route's pending → empty → data branches
- [ ] CI-friendly: no watch mode by default
**Agent instructions**:
1. HUMAN-GATE: adding runtime/dev dependencies needs user approval — propose the exact
   package list and versions first (prefer LTS-stable, pinned to the existing Vitest 3.x
   line the backend already uses).
2. Add `frontend/vitest.config.ts` reusing the Vite aliases so `@/` resolves.
3. Change root `test` to `npm run test --workspaces --if-present`.
4. Write the three tests above; keep them behaviour-level, not snapshot dumps.
**Verification**: `npm test` from the root runs backend + frontend suites, all green.
**Risks/rollback**: new dev deps only; revert `package.json` + delete the config/test files.

### TASK-03 Make backend source reviewable (line length / Prettier parity)
Priority: P2 · Effort: M · Depends: — · Files: backend/.prettierrc or backend/eslint.config.js, backend/src/**

**Why**: 171 lines in tracked `backend/src/**/*.ts` exceed 160 characters
(`backend/src/routes/admin.ts:56` is 288, `:16` is 282, `account.ts:30` is 259), because
several routes pack multiple statements onto one line
(`const db = await getDb(); const comparison = await db.collection…`). The frontend is
Prettier-enforced through ESLint; the backend runs only `eslint src --max-warnings=0`, so
nothing pushes back. Reviewing or diffing these files is painful and it hides logic —
TASK-01's diff touched exactly such a line.
**Acceptance criteria**:
- [ ] Backend inherits the same Prettier config as the frontend (printWidth 100, double quotes, semicolons, trailing commas all)
- [ ] `eslint-plugin-prettier/recommended` added to `backend/eslint.config.js`
- [ ] `npm run format --workspace @bazaar/backend` exists and the tree is formatted once
- [ ] `npm test` still passes after the reformat (proves it was formatting-only)
**Agent instructions**:
1. Mirror the frontend Prettier setup; do not invent a second style.
2. Reformat in ONE commit that touches nothing else, so the noise is isolated from logic changes.
3. Re-run the backend suite immediately after.
**Verification**: `npm run lint` clean; `npm test` → 15 tests pass;
`awk 'length>160' $(git ls-files 'backend/src/**/*.ts')` returns nothing.
**Risks/rollback**: a formatter run across every route file is a large diff; land it
alone so `git revert` is clean. No behaviour change expected — the test suite is the proof.

### TASK-04 Commit the UI overhaul working tree
Priority: P2 · Effort: S · Depends: — · Files: whole repo

**Why**: As of 2026-08-03 the tree holds 40 modified files plus untracked
`frontend/src/components/ui.tsx` and `frontend/src/components/spec-sheet.tsx`
(the UIX-01…UIX-06 work) on top of `32ee5a6`. Nothing is committed. The next session
inherits a large uncommitted diff and no history for it.
**Acceptance criteria**:
- [x] User approves a commit
- [x] `git status` checked for `.env*`, `atlas-credentials.env`, `*-adminsdk-*.json` before staging
- [x] `docs/agent/` staged in the same commit as the code
- [x] Work lands on a branch (the current branch is `main`)
**Agent instructions**:
1. HUMAN-GATE: ask before committing; never `git push --force`; never deploy.
2. Verify secret ignores still hold: `git ls-files | grep -iE "\.env|adminsdk|credential"`
   must return nothing (verified empty 2026-08-03).
3. Run PROTOCOL.md §7 verification before the commit, not after.
**Verification**: `git log --stat -1` shows code + `docs/agent/` together; `git status` clean.
**Risks/rollback**: staging a secret would be unrecoverable once pushed — hence step 2
runs before every `git add`.
