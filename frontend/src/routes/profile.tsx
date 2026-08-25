import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { sendEmailVerification, type Auth } from "@firebase/auth";
import { AccountLayout } from "@/routes/account";
import { Skeleton } from "@/components/ui";
import { confirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/toast";
import {
  useDeleteAvatar,
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
  type AccountProfile,
} from "@/lib/api";
import { browserAuth } from "@/lib/firebase";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Bazaar" },
      {
        name: "description",
        content: "Update the personal details attached to your Bazaar account.",
      },
    ],
  }),
  component: ProfilePage,
});

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

const AVATAR_MAX_BYTES = 250 * 1024;
const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Mirrors the backend's loose E.164-ish validation exactly. */
const PHONE_PATTERN = /^\+?[0-9][0-9 ()\-.]{5,19}$/;

function initialsOf(name: string | null, email: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "?";
  const words = source.split(/\s+/).filter(Boolean);
  const firstWord = words[0] ?? source;
  const secondWord = words.length > 1 ? (words[1] ?? "") : "";
  const letters = `${firstWord.charAt(0)}${secondWord.charAt(1) || firstWord.charAt(1) || ""}`;
  return letters.toUpperCase();
}

/* ------------------------------------------------------------------ */
/* 01 — Photo                                                          */
/* ------------------------------------------------------------------ */

function PhotoSection({
  photoDataUrl,
  displayName,
  email,
}: {
  photoDataUrl: string | null;
  displayName: string | null;
  email: string | null;
}) {
  const upload = useUploadAvatar();
  const remove = useDeleteAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const initials = initialsOf(displayName, email);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = ""; // lets the same file be re-picked to modify
    setError("");
    if (!file) return;
    if (!AVATAR_TYPES.has(file.type)) {
      setError("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Images must be 250 KB or smaller.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("The image could not be read."));
        reader.readAsDataURL(file);
      });
      upload.mutate(dataUrl, {
        onSuccess: () =>
          showToast("success", "Photo updated", "Your picture is saved to your account."),
        onError: (caught) =>
          showToast(
            "error",
            "Upload failed",
            caught instanceof Error ? caught.message : "Try again in a moment.",
          ),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The image could not be read.");
    }
  }

  async function removePhoto() {
    const confirmed = await confirmDialog({
      title: "Remove profile photo",
      body: "Your account will show your initials again.",
      confirmLabel: "Remove photo",
      destructive: true,
    });
    if (!confirmed) return;
    remove.mutate(undefined, {
      onSuccess: () => showToast("info", "Photo removed"),
      onError: (caught) =>
        showToast(
          "error",
          "Removal failed",
          caught instanceof Error ? caught.message : "Try again in a moment.",
        ),
    });
  }

  return (
    <section aria-labelledby="profile-photo-heading" className="panel p-7 lg:p-9">
      <h2 id="profile-photo-heading" className="eyebrow">
        01 — Photo
      </h2>
      <div className="rule mt-5" />
      <div className="mt-6 flex flex-wrap items-center gap-6">
        {/* Square preview: current avatar, else the initials block. */}
        <span
          aria-hidden="true"
          className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden border border-border bg-surface-2"
        >
          {photoDataUrl ? (
            <img src={photoDataUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-2xl font-bold uppercase text-muted-foreground">
              {initials}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Profile picture</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            PNG, JPEG or WebP, up to 250 KB.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
              className="btn btn-quiet btn-sm min-h-11"
            >
              {photoDataUrl ? "Modify photo" : "Upload photo"}
            </button>
            {photoDataUrl && (
              <button
                type="button"
                onClick={() => void removePhoto()}
                disabled={remove.isPending}
                className="btn btn-danger btn-sm min-h-11"
              >
                Remove
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="field-error mt-2">
              {error}
            </p>
          )}
          {(upload.isPending || remove.isPending) && (
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              Working…
            </p>
          )}
        </div>
      </div>
      {/* Hidden picker — the visible button drives it. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => void onFile(event)}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Contact                                                        */
/* ------------------------------------------------------------------ */

function ContactSection({ profile }: { profile: AccountProfile }) {
  const update = useUpdateProfile();
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [phoneError, setPhoneError] = useState("");
  const [resending, setResending] = useState(false);
  const [auth, setAuth] = useState<Auth | null>();
  useEffect(() => setAuth(browserAuth()), []);

  function savePhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = phone.trim();
    if (value && !PHONE_PATTERN.test(value)) {
      setPhoneError("Enter a valid phone number, e.g. +1 555 010 1234.");
      return;
    }
    setPhoneError("");
    update.mutate(
      { phone: value },
      {
        onSuccess: () => showToast("success", "Contact details saved"),
        onError: (caught) =>
          showToast(
            "error",
            "Save failed",
            caught instanceof Error ? caught.message : "Try again in a moment.",
          ),
      },
    );
  }

  async function resendVerification() {
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      showToast("error", "Verification unavailable", "Sign in again to resend the email.");
      return;
    }
    setResending(true);
    try {
      await sendEmailVerification(currentUser);
      showToast("success", "Verification email sent", "Check your inbox for the link.");
    } catch (caught) {
      showToast(
        "error",
        "Could not send",
        caught instanceof Error
          ? caught.message.replace("Firebase: ", "")
          : "Try again in a moment.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <section aria-labelledby="profile-contact-heading" className="panel p-7 lg:p-9">
      <h2 id="profile-contact-heading" className="eyebrow">
        02 — Contact
      </h2>
      <div className="rule mt-5" />

      <form onSubmit={savePhone} className="mt-6">
        <label className="block text-sm">
          <span className="font-medium">Phone</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (phoneError) setPhoneError("");
            }}
            placeholder="+1 555 010 1234"
            aria-invalid={phoneError ? "true" : undefined}
            aria-describedby={phoneError ? "phone-error" : "phone-help"}
            className={FIELD}
          />
          {phoneError ? (
            <span id="phone-error" className="field-error">
              {phoneError}
            </span>
          ) : (
            <span id="phone-help" className="field-help">
              Optional. Saved to your account and used for delivery updates.
            </span>
          )}
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button disabled={update.isPending} className="btn btn-primary btn-sm min-h-11">
            {update.isPending ? "Saving…" : "Save phone"}
          </button>
        </div>
      </form>

      <div className="mt-8 border-t border-border pt-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Email</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="text-sm font-medium break-all">{profile.email}</span>
          {profile.emailVerified === true ? (
            <span className="border border-border bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-positive">
              Verified
            </span>
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Not verified
              </span>
              <button
                type="button"
                onClick={() => void resendVerification()}
                disabled={resending}
                className="btn btn-quiet btn-sm min-h-11"
              >
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Preferences                                                    */
/* ------------------------------------------------------------------ */

function PreferencesSection({ marketingConsent }: { marketingConsent: boolean }) {
  const update = useUpdateProfile();
  const [consent, setConsent] = useState(marketingConsent);
  const [confirmation, setConfirmation] = useState("");

  function toggle(next: boolean) {
    setConsent(next);
    setConfirmation("");
    update.mutate(
      { marketingConsent: next },
      {
        onSuccess: () =>
          setConfirmation(
            next
              ? "Saved — you will receive occasional drop notes."
              : "Saved — drop notes are off.",
          ),
        onError: (caught) => {
          setConsent(!next); // roll the control back to the stored truth
          setConfirmation(
            caught instanceof Error ? caught.message : "The preference was not saved.",
          );
        },
      },
    );
  }

  return (
    <section aria-labelledby="profile-preferences-heading" className="panel p-7 lg:p-9">
      <h2 id="profile-preferences-heading" className="eyebrow">
        03 — Preferences
      </h2>
      <div className="rule mt-5" />
      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => toggle(event.target.checked)}
          disabled={update.isPending}
          className="accent-foreground mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
        />
        <span>
          <span className="font-medium">Send me the occasional drop note. No spam.</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            Saved to your account and honoured across every device.
          </span>
        </span>
      </label>
      <p aria-live="polite" className="mt-4 min-h-5 text-sm font-semibold text-positive">
        {confirmation}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ProfilePage() {
  const profile = useProfile();

  return (
    <AccountLayout
      active="/profile"
      title="Profile"
      copy="Your photo, contact details and preferences — saved to your account."
    >
      <div className="max-w-xl space-y-10">
        {profile.isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : profile.error ? (
          <p
            role="alert"
            className="border-l-2 border-destructive bg-surface-2 p-4 text-sm text-destructive"
          >
            {profile.error.message}
          </p>
        ) : profile.data ? (
          <>
            <PhotoSection
              photoDataUrl={profile.data.photoDataUrl}
              displayName={profile.data.displayName}
              email={profile.data.email}
            />
            <ContactSection profile={profile.data} />
            <PreferencesSection marketingConsent={profile.data.marketingConsent} />
          </>
        ) : null}
      </div>
    </AccountLayout>
  );
}
