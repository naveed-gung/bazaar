<!-- AGENT NOTE: Before ending your session, update the Status table below if you
touched anything related, bump last-verified, and append to SESSIONS.md.
Rules: docs/agent/PROTOCOL.md -->
---
doc: 02-ui-ux
last-verified: 2026-08-03
verified-by: claude-code
---

# Bazaar — UI/UX & design system

## Design system (as built)

Tokens live in `frontend/src/styles.css`: oklch palette, `--signal` blue accent,
`--radius: 1rem`, flat surfaces (no gradients), light + `.dark` blocks, and a
`prefers-reduced-motion: reduce` block. `@theme inline` re-exports tokens as
Tailwind colors, so `bg-surface`, `bg-surface-2`, `text-glow`, `text-positive`,
`shadow-lift`, `shadow-glow` are all valid utilities.

Component primitives (all inside `@layer components`, so utilities still win):

| Class | Purpose |
|-------|---------|
| `.btn` + `.btn-primary` / `-quiet` / `-ghost` / `-danger` / `-lg` / `-sm` / `-icon` | Only button/CTA recipe. Base 2.75 rem tall (44 px touch target), radius .875 rem, `:active` translateY(1px) scale(.99), `:disabled` opacity .5 |
| `.panel` | Hairline card surface used for every boxed region |
| `.field` + `.field-help` | Only input/select/textarea recipe. 2.75 rem min height, signal focus ring, `:disabled` muted fill |
| `.pill` | Status/label chip (paired with the `Pill` component's tone prop) |
| `.skeleton` | Shimmer block behind `Skeleton` / `ProductCardSkeleton` / `ProductGridSkeleton` |
| `.spec-matrix` + `.spec-matrix-label` | Comparison table: hairline grid, zebra `nth-child(even)` → `var(--tint)`, sticky-**left** label column, `tr[data-diff="true"]` inset signal bar |
| `@utility tabular` / `reveal` / `reveal-in` / `grid-noise` | Numeric alignment + entrance/texture helpers |

Shared React primitives in `frontend/src/components/ui.tsx`: `Stars`, `Rating`,
`Pill`, `AvailabilityTag`, `SectionHeading`, `EmptyState`, `Skeleton`,
`ProductCardSkeleton`, `ProductGridSkeleton`. Spec rendering lives in
`frontend/src/components/spec-sheet.tsx`.

Conventions worth keeping:

- Per-file `const FIELD = "field mt-2";` is the sanctioned pattern for form inputs
  (`login`, `returns`, `profile`, `addresses`, `contact`, `admin_.catalog`, `checkout`).
- Prices, references, dates and counts always carry `tabular`.
- Every async surface renders four branches: pending (skeleton) → error (`.panel` + retry)
  → empty (`EmptyState`) → data.
- Destructive actions use `.btn-danger` and, for bulk operations, a two-step confirm
  rather than `window.confirm`.

## Status

| ID | Title | Priority | Effort | Status | Last touched |
|----|-------|----------|--------|--------|--------------|
| UIX-01 | Rebuild the product specification presentation | P0 | L | DONE | 2026-08-03 |
| UIX-02 | Rebuild the compare-page specification matrix | P0 | L | DONE | 2026-08-03 |
| UIX-03 | Extract shared button/panel/field/pill/skeleton primitives | P1 | L | DONE | 2026-08-03 |
| UIX-04 | Give every async surface skeleton / empty / error states | P1 | M | DONE | 2026-08-03 |
| UIX-05 | Render the order timeline on the order-detail route | P2 | S | DONE | 2026-08-03 |
| UIX-06 | Form accessibility + autofill pass | P1 | M | DONE | 2026-08-03 |
| UIX-07 | Promote the repeated shell width into one token | P2 | S | TODO | 2026-08-03 |
| UIX-08 | Add a skip-to-content link to the app shell | P2 | S | TODO | 2026-08-03 |
| UIX-09 | Replace the login route's bare spinner with skeletons | P3 | S | TODO | 2026-08-03 |
| UIX-10 | Measure the dark palette against WCAG AA | P2 | S | TODO | 2026-08-03 |

## Tasks

### UIX-01 Rebuild the product specification presentation
Priority: P0 · Effort: L · Depends: — · Files: frontend/src/components/spec-sheet.tsx, frontend/src/routes/product.$slug.tsx, frontend/src/styles.css

**Why**: The user's words: the layout is liked, but "when we talk about specifications it
gets damn ugly". Specs rendered as `flex justify-between` rows inside a narrow grid
column, so labels and values were orphaned at opposite edges of a dead gap, with no
icons, no zebra, no hierarchy, buried under three CTAs.
**Acceptance criteria**:
- [x] Spec values read as tiles: icon + micro-label + oversized `tabular` value
- [x] Full-width `#specifications` section instead of a squeezed sidebar column
- [x] Fixed-width label column so label/value pairs never drift apart
- [x] Layout, palette and hero treatment unchanged (the part the user likes)
**Agent instructions**: — (complete; treat `spec-sheet.tsx` as the single spec renderer
and extend it rather than inlining spec markup in a route)
**Verification**: `npm run typecheck && npm run lint && npm run build` — all green
2026-08-03; built CSS contains `.spec-matrix`, `.panel`, `.field`.
**Risks/rollback**: `git checkout -- frontend/src/routes/product.$slug.tsx frontend/src/components/spec-sheet.tsx`.

### UIX-02 Rebuild the compare-page specification matrix
Priority: P0 · Effort: L · Depends: UIX-01 · Files: frontend/src/routes/compare.tsx, frontend/src/styles.css, backend/src/routes/engagement.ts

**Why**: `border-separate border-spacing-3` plus per-cell `bg-surface` made the compare
grid read as scattered floating blocks — no row continuity, no sticky labels, no diff
affordance, no mobile fallback.
**Acceptance criteria**:
- [x] Hairline `.spec-matrix` with zebra rows and a sticky-left label column
- [x] `data-diff="true"` rows carry a signal accent bar
- [x] "Differences only" filter and a best-price marker
- [x] Stacked cards below the table breakpoint
- [x] `<caption class="sr-only">` for screen readers
**Agent instructions**: — (complete). Note the CSS trap recorded in 00-INDEX: a sticky
`<thead>` cannot work inside the horizontal scroll wrapper; do not "fix" it by trying.
**Verification**: `npm run typecheck && npm run lint && npm run build` — green 2026-08-03.
**Risks/rollback**: `git checkout -- frontend/src/routes/compare.tsx`.

### UIX-03 Extract shared button/panel/field/pill/skeleton primitives
Priority: P1 · Effort: L · Depends: — · Files: frontend/src/styles.css, frontend/src/components/ui.tsx, all of frontend/src/routes/

**Why**: Every account and admin route hand-rolled its own button, input, card, loading
string and empty state, so nothing matched anything. 7 files each declared a private
`FIELD` string of raw utilities before `.field` existed.
**Acceptance criteria**:
- [x] `.btn`, `.panel`, `.field`, `.field-help`, `.pill`, `.skeleton` defined once in `styles.css`
- [x] Every route uses them instead of ad-hoc utility stacks
- [x] Touch targets ≥ 44 px on buttons and inputs
- [x] No dead CSS left behind (`.field-label` was written then removed for this reason)
**Agent instructions**: — (complete). New surfaces must reuse these classes; adding a
second button recipe is a regression.
**Verification**: `npm run lint` clean; built CSS contains `.field`, `.btn-primary`,
`.panel`, `.spec-matrix`, `.pill`, `.skeleton`, `.field-help` (checked 2026-08-03).
**Risks/rollback**: primitives are additive; reverting `styles.css` alone would break
every migrated route, so revert route files together.

### UIX-04 Give every async surface skeleton / empty / error states
Priority: P1 · Effort: M · Depends: UIX-03 · Files: frontend/src/routes/account.tsx, addresses.tsx, admin.tsx, admin_.catalog.tsx, admin_.operations.tsx, notifications.tsx, orders.$reference.tsx, profile.tsx, sessions.tsx

**Why**: Routes showed bare "Loading…" text or nothing at all; empty lists rendered as
blank space with no next action.
**Acceptance criteria**:
- [x] Pending renders `Skeleton` blocks shaped like the real content, with `aria-busy`
- [x] Errors render inside a `.panel` with a retry affordance
- [x] Empty lists render `EmptyState` with an icon, a sentence, and an action
**Agent instructions**: — (complete)
**Verification**: `npm run typecheck` clean 2026-08-03; per-route branches read back in review.
**Risks/rollback**: per-file `git checkout --`.

### UIX-05 Render the order timeline on the order-detail route
Priority: P2 · Effort: S · Depends: UIX-03 · Files: frontend/src/routes/orders.$reference.tsx

**Why**: The route already fetched `order.timeline` and never rendered it — the state
history existed on `track-order` only.
**Acceptance criteria**:
- [x] Reversed timeline (newest first) on the same rail treatment as `track-order`
- [x] Newest event carries the signal colour; connector line hidden on the current node
- [x] Decorative icons marked `aria-hidden`
**Agent instructions**: — (complete)
**Verification**: `npm run typecheck && npm run build` green 2026-08-03.
**Risks/rollback**: `git checkout -- frontend/src/routes/orders.$reference.tsx`.

### UIX-06 Form accessibility + autofill pass
Priority: P1 · Effort: M · Depends: UIX-03 · Files: frontend/src/routes/addresses.tsx, contact.tsx, login.tsx, profile.tsx, returns.tsx, checkout.tsx, admin_.catalog.tsx

**Why**: `addresses.tsx` derived labels from camelCase field names ("fullName") via a
regex and shipped no `autocomplete` tokens, so browsers could not autofill. Helper text
was six copies of the same utility string. Required fields were unmarked.
**Acceptance criteria**:
- [x] Explicit `FIELDS` table with human labels + `autoComplete` tokens on addresses
- [x] Required markers (`*`, `aria-hidden`) on required inputs
- [x] Helper text uses `.field-help` with `aria-describedby` wiring
- [x] `addresses.add()` captures `event.currentTarget` before `await` so `form.reset()` is safe
**Agent instructions**: — (complete)
**Verification**: `npm run lint` clean 2026-08-03.
**Risks/rollback**: per-file `git checkout --`.

### UIX-07 Promote the repeated shell width into one token
Priority: P2 · Effort: S · Depends: — · Files: frontend/src/styles.css, ~25 files under frontend/src

**Why**: `max-w-[1600px]` is copy-pasted across roughly 25 call sites (`index.tsx`
×5, `product.$slug.tsx` ×5, `site-header.tsx` ×3, `checkout.tsx` ×2, plus one each in
about/cart/categories×2/compare/contact/deals/new-arrivals/page-hero/site-footer/
wishlist/account/shop/hero-slider). Admin pages diverge for no recorded reason:
`admin.tsx:27` uses `max-w-[1200px]`, `admin_.operations.tsx:93` uses `max-w-[1400px]`.
Changing the shell width today means 25 edits, and the arbitrary-value syntax also
trips the editor's `suggestCanonicalClasses` warning.
**Acceptance criteria**:
- [ ] One `@utility shell` (or a `--container-*` theme value) defines the width and the `px-6 lg:px-10` gutters
- [ ] All 1600px call sites use it; admin widths are either unified or given a comment explaining the difference
- [ ] `npm run build` output CSS shows no visual change on the home, product, compare and admin routes
**Agent instructions**:
1. Add the utility to `frontend/src/styles.css` next to the existing `@utility` block (~line 212).
2. Replace call sites file by file; keep any per-section vertical padding as-is.
3. Decide admin: unify to the shell, or keep narrower and document why in this task body.
4. Re-run the full verification set from PROTOCOL.md §7.
**Verification**: `npm run build`; `grep -rn "max-w-\[1600px\]" frontend/src` returns nothing.
**Risks/rollback**: a mistyped utility silently drops the max-width and pages go
full-bleed. Check the home and product routes at ≥1920 px before finishing. Revert with
`git checkout -- frontend/src`.

### UIX-08 Add a skip-to-content link to the app shell
Priority: P2 · Effort: S · Depends: — · Files: frontend/src/routes/__root.tsx, frontend/src/styles.css

**Why**: No skip link exists anywhere (`grep -rn "skip" frontend/src` → no matches).
The header carries a utility bar, a full nav and a search field, so keyboard users tab
through the entire chrome on every route. WCAG 2.4.1 (Bypass Blocks).
**Acceptance criteria**:
- [ ] First focusable element is a skip link, visually hidden until `:focus-visible`
- [ ] It targets a real `id` on the page's main region
- [ ] Focus lands in the main region after activation on at least home, shop, product
**Agent instructions**:
1. Add the link as the first child of the root layout in `__root.tsx`.
2. Give the main content wrapper a stable `id` (routes currently use `<section>`/`<main>`
   inconsistently — pick one and note it here).
3. Style with the existing `sr-only` pattern plus a `:focus-visible` reveal in `styles.css`.
**Verification**: load `/`, press Tab once, confirm the link appears and Enter moves focus.
**Risks/rollback**: single-file revert.

### UIX-09 Replace the login route's bare spinner with skeletons
Priority: P3 · Effort: S · Depends: UIX-03 · Files: frontend/src/routes/login.tsx

**Why**: `login.tsx:81` still renders a lone `LoaderCircle` while Firebase auth
initialises, which is the pattern every other route moved away from in UIX-04.
**Acceptance criteria**:
- [ ] Pending state renders a `.panel`-shaped `Skeleton` matching the sign-in card
- [ ] `LoaderCircle` remains only as the in-button submit spinner
**Agent instructions**:
1. Swap the `auth === undefined` branch for skeletons sized like the card below it.
2. Keep the `aria-label`/`aria-busy` semantics.
**Verification**: `npm run typecheck && npm run lint`; throttle the network and load `/login`.
**Risks/rollback**: single-file revert.

### UIX-10 Measure the dark palette against WCAG AA
Priority: P2 · Effort: S · Depends: — · Files: frontend/src/styles.css

**Why**: The `.dark` block (`styles.css:115`–153) is hand-tuned oklch. Nothing in this
repo has ever measured the pairs. The risky ones are
`--muted-foreground: oklch(0.7 0.015 255)` on `--surface: oklch(0.19 0.006 255)` —
used for every helper line and timestamp — and `--signal-foreground` on `--signal`
for `.btn-primary` labels.
**Acceptance criteria**:
- [ ] Every foreground/background pair used for text measured, recorded in a table in this task body
- [ ] Body text ≥ 4.5:1, large text ≥ 3:1; failures fixed by lightening the token, not by per-component overrides
- [ ] Light palette spot-checked for the same pairs
**Agent instructions**:
1. Compute contrast for the pairs (oklch → sRGB → relative luminance); a short local
   script is fine, keep it in the scratchpad, not in the repo.
2. Fix failures in the token block only.
3. Record the measured numbers here so the next session does not redo the maths.
**Verification**: recorded table in this task body + a visual pass on `/product/*` and
`/compare` in dark mode.
**Risks/rollback**: token edits are global — screenshot before/after; revert `styles.css`.
