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
          <div className="rounded-2xl border border-border bg-surface p-8">
            <h2 className="font-bold">Browser authentication setup required</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Add the four public VITE_FIREBASE_* values from Firebase web-app settings. The Admin
              SDK credential is already handled separately and never sent to the browser.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-signal px-5 text-sm font-semibold text-signal-foreground"
            >
              Continue as guest
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8">
            <button
              type="button"
              onClick={google}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-5 text-sm font-semibold disabled:opacity-50"
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
                <span className="text-muted-foreground">Email</span>
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Password</span>
                <input
                  name="password"
                  required
                  minLength={8}
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <button
                disabled={pending}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-signal-foreground disabled:opacity-50"
              >
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
              className="mt-5 min-h-11 w-full text-sm text-muted-foreground underline"
            >
              {register ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
            <div className="mt-6 border-t border-border pt-6 text-center">
              <p className="text-sm font-semibold">An account is optional</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Shop, favorite, compare, and check out as a guest. If you sign in later, your
                current shopping state is merged without replacing account items.
              </p>
              <Link
                to="/shop"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-5 text-sm font-semibold hover:border-signal"
              >
                Continue as guest
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
