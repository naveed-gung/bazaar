import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "@firebase/auth";
import type { Auth } from "@firebase/auth";
import { Check, LoaderCircle } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Skeleton } from "@/components/ui";
import { Reveal, Stagger, useScrollDrift } from "@/components/motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { browserAuth, googleProvider } from "@/lib/firebase";

type LoginSearch = { redirect?: string | undefined; mode?: "register" | undefined };

/** Same-origin relative paths only: one leading slash, no protocol, no host,
    no backslashes or whitespace. Anything else falls back to /account. */
function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//"))
    return undefined;
  return /[\\\s]/.test(value) ? undefined : value;
}

export const Route = createFileRoute("/login")({
  // SSR-24 — the sign-in/sign-up switch lives in the URL (?mode=register), so
  // the signup panel is deep-linkable and browser history behaves. Only the
  // literal "register" is accepted; anything else normalises to sign-in.
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: safeRedirect(search["redirect"]),
    mode: search["mode"] === "register" ? ("register" as const) : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — Bazaar" }] }),
  component: Login,
});

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

/** LEFT editorial rail (SSR-17): numbered statements over rules. */
const accountStatements = [
  {
    title: "01 — One state everywhere",
    body: "Your cart, wishlist and saved items follow every device.",
  },
  {
    title: "02 — Faster checkout",
    body: "Addresses and orders kept in one place.",
  },
  {
    title: "03 — Optional, always",
    body: "Guests can do everything; accounts just remember.",
  },
];

/** SSR-65 — per-row delay for the rail entrance.

    Stagger's 40 ms default is right for home's product grids, where six to
    eight cards enter at once and a longer step would drag. The rail has only
    four elements, it plays in the column OPPOSITE the button that triggers it,
    and the sign-up panel is growing taller at the same moment — so at 40 ms the
    whole cascade finished in 280 ms and read as "nothing happened" (measured,
    not assumed: rows hit opacity 1.00 by t+280ms). 110 ms spreads the same
    per-row motion over ~570 ms, which reads as a sequence instead of a blink.
    The motion itself is still home's shared <Reveal>: 240 ms, 20px rise, one
    token, one easing — only the spacing between rows differs. */
const RAIL_STAGGER_MS = 110;

/** Square Swiss checkbox pair used by section 03 — Preferences. The visible
    box is a sibling of a sr-only input so keyboard focus rings still land. */
function CheckSquare({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center border transition-colors",
        checked
          ? "border-signal bg-signal text-signal-foreground"
          : "border-border bg-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring",
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

function Login() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [termsError, setTermsError] = useState("");
  // SSR-28 — route-scoped navigate: resolution of to/search can never be
  // ambiguous regardless of where this component mounts in the tree.
  const navigate = Route.useNavigate();
  // SSR-68 — establish() invalidates the auth-status cache through this client
  // so the account guard never reads its stale pre-signup guest snapshot.
  const queryClient = useQueryClient();
  const { redirect, mode } = Route.useSearch();
  // SSR-39 — the rail container drifts subtly with scroll (useScrollDrift:
  // rAF-throttled, ±24px clamp, transform-only, reduced-motion off-switch,
  // hydration-safe because the transform lands after mount). SSR-62 — the
  // entrance is now home's shared <Reveal>/<Stagger> primitives (see the rail
  // comment below); the drift still translates the whole CONTAINER while
  // Reveal transforms the ROWS, so neither touches the other's transform.
  const rail = useScrollDrift();
  // SSR-24 — derived from the URL, not local state: every heading,
  // autoComplete token, submit branch and panel below reads this one boolean.
  const register = mode === "register";
  /* SSR-62 (owner request): the rail entrance must fire ONLY when the visitor
     switches login → sign-up, because the sign-up form is the long one and the
     rail is what balances it. It must NOT fire on arrival.

     `modeAtEntry` is captured once per mount, so `railAnimates` is a PURE render
     value — no effect, no extra render, and therefore no frame where static rows
     paint before the animation takes over. Arriving on sign-in and switching to
     sign-up animates; switching back to sign-in renders instantly; switching to
     sign-up again animates once more (the key below remounts the subtree). A
     direct ?mode=register deep link counts as "arrival", so it stays static. */
  const modeAtEntry = useRef(register);
  const railAnimates = register !== modeAtEntry.current;
  const [auth, setAuth] = useState<Auth | null>();
  useEffect(() => setAuth(browserAuth()), []);
  async function establish(
    user: { getIdToken: (forceRefresh?: boolean) => Promise<string> },
    marketingConsent?: boolean,
  ) {
    const idToken = await user.getIdToken(true);
    await api("/auth/session", { method: "POST", body: JSON.stringify({ idToken }) });
    /* SSR-68 — refresh the auth-status cache BEFORE navigating on. Without
       this, the account guard reads its stale pre-signup guest snapshot and
       bounces the freshly authenticated user back to /login with a redirect
       chain that grows on every cycle. */
    await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    if (marketingConsent !== undefined) {
      // Owner directive: signup consent persists server-side on the account profile.
      // Non-fatal by design — a failed write must never block sign-in.
      try {
        await api("/me/profile", { method: "PUT", body: JSON.stringify({ marketingConsent }) });
      } catch {
        /* consent persistence is best-effort */
      }
    }
    await navigate({ href: redirect ?? "/account" });
  }
  async function emailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setError("");
    setConfirmError("");
    setTermsError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    if (register) {
      // Client-side gates run BEFORE any Firebase call.
      if (String(data.get("confirmPassword") ?? "") !== password) {
        setConfirmError("Passwords do not match.");
        return;
      }
      if (!agreeTerms) {
        setTermsError("Please accept the terms to create an account.");
        return;
      }
    }
    setPending(true);
    try {
      const credential = register
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      if (register) {
        // Non-fatal: a failed display-name write must never block the session.
        try {
          await updateProfile(credential.user, {
            displayName: String(data.get("displayName") ?? "").trim(),
          });
        } catch {
          /* cosmetic only — continue to establish() */
        }
      }
      await establish(credential.user, register ? marketingOptIn : undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message.replace("Firebase: ", "") : "Sign-in failed.",
      );
    } finally {
      setPending(false);
    }
  }
  async function google() {
    if (!auth) return;
    setPending(true);
    setError("");
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await establish(credential.user, register ? marketingOptIn : undefined);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.replace("Firebase: ", "")
          : "Google sign-in failed.",
      );
    } finally {
      setPending(false);
    }
  }
  function toggleMode() {
    setError("");
    setConfirmError("");
    setTermsError("");
    // SSR-24/28 — swap modes through the URL with a replace navigation, so no
    // page refresh happens and Back leaves /login instead of ping-ponging
    // between panels. Spreading prev preserves an existing ?redirect=
    // parameter; resetScroll:false keeps the viewport anchored while panels
    // swap. SSR-28 audit: register state is URL-derived (no leftover setState),
    // both toggles are type="button" OUTSIDE every <form> (no implicit
    // submission), and no <a href> exists on the switch paths — the only
    // real-world reload sources were splash-overlay click swallowing (fixed by
    // the SSR-27 imperative overlay's instant dismissal) and extension-induced
    // hydration noise (suppressed on <body>).
    void navigate({
      to: "/login",
      search: (prev) => ({ ...prev, mode: register ? undefined : "register" }),
      replace: true,
      resetScroll: false,
    });
  }
  return (
    <>
      {/* 01 — Account header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Sign in" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 max-w-3xl">
          <span className="eyebrow">01 — Account</span>
          <h1 className="headline mt-4 text-[clamp(2rem,5vw,3.5rem)]">
            {register ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="measure mt-4 text-sm leading-relaxed text-muted-foreground">
            Sign in once and your profile syncs across every device.
          </p>
        </div>
      </section>

      {/* 02 — Two-column split: editorial brand rail (lg+) beside the auth panel */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* LEFT — numbered statements over rules. SSR-62 (owner request): the
              entrance is now the SAME primitives home's "03 — Featured" and
              "04 — Deals" rails use — <Reveal> for the header block, <Stagger>
              over the rows at the system's default 40 ms step. This replaces
              SSR-37's component-scoped CSS keyframes (RAIL_CSS), which are
              deleted along with the <style> tag that injected them.

              Why the swap is safe now, given SSR-37 removed an observer on
              purpose: that decision was forced by the welcome splash, an opaque
              full-viewport cover that ate the entrance window for above-the-fold
              content. The splash has not rendered since the SSR-47 client-only
              rewrite (SSR-59 — its mount effect bails on a null ref), so nothing
              covers the rail any more. Reveal also handles the above-the-fold
              case correctly on its own: IntersectionObserver fires its first
              callback for an element already in view, so an animated rail plays
              immediately rather than waiting for a scroll.

              WHEN it plays is gated by `railAnimates` (see above): only a
              login → sign-up switch animates. On arrival — and on the way back
              to sign-in — the same rows render WITHOUT the Reveal/Stagger
              wrappers, so they never carry `.reveal` and never start at
              opacity 0. That is why the gate is a render-time value and not an
              effect: an effect would paint one static frame first and flash.
              Replay across repeated switches still comes from the mode-keyed
              container below, which remounts and resets each Reveal's `shown`
              state (SSR-28 behaviour, now without any component-local CSS).

              Reduced motion is now handled by the GLOBAL prefers-reduced-motion
              block in styles.css (`.reveal { opacity: 1; transform: none }`)
              instead of a per-component media query.

              Rows stay plain DIVs (deliberately NO <ul>). */}
          <aside
            ref={rail.ref}
            style={rail.style}
            aria-label="Why an account"
            className="order-2 lg:order-1 lg:col-span-5"
          >
            <div key={register ? "register" : "signin"}>
              {/* Header block. The 72×2px red rule is a STATIC element: SSR-37's
                  scaleX sweep lived in RAIL_CSS, and home's rails carry a plain
                  rule. When the rail animates, Reveal fades the whole block —
                  eyebrow and rule together. */}
              {(() => {
                const header = (
                  <>
                    <span className="eyebrow">The Case</span>
                    <span aria-hidden="true" className="mt-3.5 block h-[2px] w-[72px] bg-accent" />
                  </>
                );
                const rows = accountStatements.map((statement, index) => (
                  <div
                    key={statement.title}
                    className={cn(
                      "border-t border-border py-6",
                      index === accountStatements.length - 1 && "border-b",
                    )}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.14em]">
                      {statement.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {statement.body}
                    </p>
                  </div>
                ));
                return railAnimates ? (
                  <>
                    <Reveal>{header}</Reveal>
                    <Stagger className="mt-8" step={RAIL_STAGGER_MS}>
                      {rows}
                    </Stagger>
                  </>
                ) : (
                  <>
                    <div>{header}</div>
                    <div className="mt-8">{rows}</div>
                  </>
                );
              })()}
            </div>
            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
              Preferences below are saved to your account and follow you across every device.
            </p>
          </aside>

          {/* RIGHT — auth panel */}
          <div className="order-1 lg:order-2 lg:col-span-7">
            <div className="mx-auto w-full max-w-xl">
              {auth === undefined ? (
                /* Card-shaped skeleton replaces the bare spinner while Firebase boots. */
                <div className="panel p-8" aria-busy="true" aria-live="polite">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="mt-6 h-3 w-24" />
                  <Skeleton className="mt-4 h-11 w-full" />
                  <Skeleton className="mt-5 h-3 w-20" />
                  <Skeleton className="mt-4 h-11 w-full" />
                  <Skeleton className="mt-7 h-12 w-full" />
                  <Skeleton className="mt-8 h-px w-full" />
                  <Skeleton className="mt-6 h-3 w-40" />
                  <Skeleton className="mt-2 h-3 w-56 max-w-full" />
                  <Skeleton className="mt-5 h-12 w-44" />
                </div>
              ) : !auth ? (
                <div className="panel p-8">
                  <h2 className="font-display text-lg font-bold tracking-tight">
                    Browser authentication setup required
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Add the four public VITE_FIREBASE_* values from Firebase web-app settings. The
                    Admin SDK credential is already handled separately and never sent to the
                    browser.
                  </p>
                  <Link to="/shop" className="btn btn-primary mt-6">
                    Continue as guest
                  </Link>
                </div>
              ) : register ? (
                /* REGISTER — numbered sections separated by hairlines */
                <div className="panel p-8">
                  <button
                    type="button"
                    onClick={google}
                    disabled={pending}
                    className="btn btn-quiet w-full"
                  >
                    Continue with Google
                  </button>
                  <div className="my-6 flex items-center gap-3 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    <span className="h-px flex-1 bg-border" />
                    or email
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={emailSubmit}>
                    <div className="divide-y divide-border">
                      {/* 01 — Identity */}
                      <section aria-labelledby="login-identity-heading">
                        <h2 id="login-identity-heading" className="eyebrow">
                          01 — Identity
                        </h2>
                        <label className="block text-sm">
                          <span className="font-medium">Display name</span>
                          <input
                            name="displayName"
                            required
                            type="text"
                            autoComplete="name"
                            className={FIELD}
                          />
                          <span className="field-help">
                            Shown on your account pages; you can change it later.
                          </span>
                        </label>
                      </section>

                      {/* 02 — Credentials */}
                      <section aria-labelledby="login-credentials-heading" className="pt-7">
                        <h2 id="login-credentials-heading" className="eyebrow">
                          02 — Credentials
                        </h2>
                        <label className="mt-5 block text-sm">
                          <span className="font-medium">Email</span>
                          <input
                            name="email"
                            required
                            type="email"
                            autoComplete="email"
                            className={FIELD}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">Password</span>
                          <input
                            name="password"
                            required
                            minLength={8}
                            type="password"
                            autoComplete="new-password"
                            aria-describedby="password-help"
                            className={FIELD}
                          />
                          <span id="password-help" className="field-help">
                            At least 8 characters.
                          </span>
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">Confirm password</span>
                          <input
                            name="confirmPassword"
                            required
                            minLength={8}
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={confirmError ? "true" : undefined}
                            aria-describedby={confirmError ? "confirm-error" : "confirm-help"}
                            className={FIELD}
                          />
                          {confirmError ? (
                            <span id="confirm-error" className="field-error">
                              {confirmError}
                            </span>
                          ) : (
                            <span id="confirm-help" className="field-help">
                              Type the same password again.
                            </span>
                          )}
                        </label>
                      </section>

                      {/* 03 — Preferences (saved to your account) */}
                      <section aria-labelledby="login-preferences-heading" className="pt-7">
                        <h2 id="login-preferences-heading" className="eyebrow">
                          03 — Preferences
                        </h2>
                        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={agreeTerms}
                            onChange={(event) => {
                              setAgreeTerms(event.target.checked);
                              if (event.target.checked) setTermsError("");
                            }}
                            className="peer sr-only"
                            aria-invalid={termsError ? "true" : undefined}
                            aria-describedby={termsError ? "terms-error" : undefined}
                          />
                          <CheckSquare checked={agreeTerms} />
                          <span>
                            <span className="font-medium">
                              I agree to the Terms and plain-language privacy notes
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                              A required acknowledgement, saved to your account.
                            </span>
                          </span>
                        </label>
                        {termsError && (
                          <p id="terms-error" className="field-error mt-2">
                            {termsError}
                          </p>
                        )}
                        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={marketingOptIn}
                            onChange={(event) => setMarketingOptIn(event.target.checked)}
                            className="peer sr-only"
                          />
                          <CheckSquare checked={marketingOptIn} />
                          <span>
                            <span className="font-medium">
                              Send me the occasional drop note. No spam.
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                              Optional consent saved to your account.
                            </span>
                          </span>
                        </label>
                      </section>
                    </div>

                    {error && (
                      <p
                        role="alert"
                        className="mt-7 border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
                      >
                        {error}
                      </p>
                    )}
                    <button disabled={pending} className="btn btn-primary mt-7 w-full">
                      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                      Create account
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={toggleMode}
                    className="btn btn-ghost btn-sm mt-5 w-full text-muted-foreground"
                  >
                    Already have an account? Sign in
                  </button>
                  <div className="mt-6 border-t border-border pt-6">
                    <p className="text-sm font-semibold">An account is optional</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Shop, favorite, compare, and check out as a guest. If you sign in later, your
                      current shopping state is merged without replacing account items.
                    </p>
                    <Link to="/shop" className="btn btn-quiet mt-5">
                      Continue as guest
                    </Link>
                  </div>
                </div>
              ) : (
                /* SIGN-IN — compact single panel */
                <div className="panel p-8">
                  <button
                    type="button"
                    onClick={google}
                    disabled={pending}
                    className="btn btn-quiet w-full"
                  >
                    Continue with Google
                  </button>
                  <div className="my-6 flex items-center gap-3 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    <span className="h-px flex-1 bg-border" />
                    or email
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <span className="eyebrow">01 — Credentials</span>
                  <form onSubmit={emailSubmit} className="mt-5 space-y-5">
                    <label className="block text-sm">
                      <span className="font-medium">Email</span>
                      <input
                        name="email"
                        required
                        type="email"
                        autoComplete="email"
                        className={FIELD}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium">Password</span>
                      <input
                        name="password"
                        required
                        minLength={8}
                        type="password"
                        autoComplete="current-password"
                        className={FIELD}
                      />
                    </label>
                    {error && (
                      <p
                        role="alert"
                        className="border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
                      >
                        {error}
                      </p>
                    )}
                    <button disabled={pending} className="btn btn-primary w-full">
                      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                      Sign in
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="btn btn-ghost btn-sm mt-5 w-full text-muted-foreground"
                  >
                    New here? Create an account
                  </button>
                  <div className="mt-6 border-t border-border pt-6">
                    <p className="text-sm font-semibold">An account is optional</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Shop, favorite, compare, and check out as a guest. If you sign in later, your
                      current shopping state is merged without replacing account items.
                    </p>
                    <Link to="/shop" className="btn btn-quiet mt-5">
                      Continue as guest
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
