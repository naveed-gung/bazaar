import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "@firebase/auth";
import type { Auth } from "@firebase/auth";
import { LoaderCircle } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
import { browserAuth, googleProvider } from "@/lib/firebase";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Bazaar" }] }),
  component: Login,
});

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

function Login() {
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [auth, setAuth] = useState<Auth | null>();
  useEffect(() => setAuth(browserAuth()), []);
  async function establish(user: { getIdToken: (forceRefresh?: boolean) => Promise<string> }) {
    const idToken = await user.getIdToken(true);
    await api("/auth/session", { method: "POST", body: JSON.stringify({ idToken }) });
    await navigate({ to: "/account" });
  }
  async function emailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const email = String(data.get("email"));
      const password = String(data.get("password"));
      const credential = register
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      await establish(credential.user);
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
      await establish(credential.user);
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
  return (
    <>
      <PageHero
        eyebrow="Account"
        title={register ? "Create account" : "Welcome back"}
        copy="Firebase verifies your identity; Bazaar stores only a secure HttpOnly session cookie."
      />
      <section className="mx-auto max-w-lg px-6 py-16 lg:py-24">
        {auth === undefined ? (
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin" aria-label="Loading sign in" />
        ) : !auth ? (
          <div className="panel p-8">
            <h2 className="font-bold">Browser authentication setup required</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Add the four public VITE_FIREBASE_* values from Firebase web-app settings. The Admin
              SDK credential is already handled separately and never sent to the browser.
            </p>
            <Link to="/shop" className="btn btn-primary mt-6">
              Continue as guest
            </Link>
          </div>
        ) : (
          <div className="panel p-8">
            <button
              type="button"
              onClick={google}
              disabled={pending}
              className="btn btn-quiet w-full"
            >
              Continue with Google
            </button>
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or email
              <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={emailSubmit} className="space-y-5">
              <label className="block text-sm">
                <span className="font-medium">Email</span>
                <input name="email" required type="email" autoComplete="email" className={FIELD} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Password</span>
                <input
                  name="password"
                  required
                  minLength={8}
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  aria-describedby={register ? "password-help" : undefined}
                  className={FIELD}
                />
                {register && (
                  <span id="password-help" className="field-help">
                    At least 8 characters.
                  </span>
                )}
              </label>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <button disabled={pending} className="btn btn-primary w-full">
                {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {register ? "Create account" : "Sign in"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setRegister((value) => !value);
                setError("");
              }}
              className="btn btn-ghost btn-sm mt-5 w-full text-muted-foreground"
            >
              {register ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
            <div className="mt-6 border-t border-border pt-6 text-center">
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
      </section>
    </>
  );
}
