/**
 * IDENTITY RECONCILIATION — the single definition of "who is this person" across
 * Firebase Auth and Mongo.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Firebase owns credentials; Mongo owns roles, orders, carts and every other
 * artefact of a real account. The two are joined by ONE value: the Firebase UID,
 * stored as `users.firebaseUid` and, for owned collections, as the string
 * `user:<uid>`. That join is fragile in exactly one direction — the UID is
 * assigned by Firebase and can change (a deleted-and-recreated Auth user gets a
 * brand-new one), while Mongo keeps pointing at the old value.
 *
 * When that happens, the pre-SSR-66 code — a bare
 * `findOneAndUpdate({ firebaseUid }, …, { upsert: true })` — INSERTED A SECOND
 * DOCUMENT. The person signed in successfully and landed on an empty
 * `["customer"]` account: no roles, no order history, no addresses, no cart. The
 * old document stayed behind, orphaned and invisible. This was not theoretical:
 * the Firebase project was found holding zero Auth users against 13 Mongo user
 * documents, so EVERY account was in that state at once.
 *
 * ─── THE RULE ────────────────────────────────────────────────────────────────
 * Email is the stable human identity; the UID is only a pointer to it. So:
 *
 *   1. match on `firebaseUid`      → the normal path, nothing to do
 *   2. else match on `email`       → ADOPT: repoint the existing document and
 *                                    everything it owns at the new UID
 *   3. else                        → insert, as before
 *
 * Step 2 is what makes the two stores self-healing: drift is repaired by the
 * next sign-in, per account, with no operator involvement. `plans/identity-sync.mts`
 * runs the same rules in bulk for accounts that have not signed in yet.
 *
 * ─── THE SECURITY CATCH, AND WHY ROLES ARE HELD BACK ─────────────────────────
 * Adoption keyed on email is a privilege-escalation path if applied naively.
 * Firebase enforces one account per email, so normally nobody can register an
 * address that already exists — but adoption only triggers when the Firebase
 * side is MISSING, which is precisely when that protection is absent. Anyone who
 * knew `owner@example.com` had been deleted could register it and inherit owner.
 *
 * So identity and authority are separated:
 *   • The DOCUMENT is always adopted — cart, orders, addresses and history follow
 *     the email, because losing them is a real harm and re-creating them is not
 *     an escalation.
 *   • ROLES BEYOND `customer` are carried over only when the ID token proves
 *     control of the mailbox (`email_verified`). Otherwise they are parked in
 *     `pendingRoles` — never deleted — and restored automatically on the first
 *     verified sign-in (see `restorePendingRoles`).
 *
 * A password sign-up starts unverified, so an attacker gets the customer view and
 * nothing else; the real owner clicks the Firebase verification link and is
 * elevated on their next sign-in. Google and other federated providers set
 * `email_verified` themselves, so for them elevation is immediate.
 */
import type { DecodedIdToken } from "firebase-admin/auth";
import type { ClientSession, Db, Document, WithId } from "mongodb";

/**
 * Every collection that stores a Firebase UID, and the shape it stores it in.
 * `users` is deliberately absent: it is the document being adopted, not a
 * reference to it, and its `firebaseUid` is written explicitly under the unique
 * index.
 *
 * KEEP THIS COMPLETE. A collection missing from this list silently keeps
 * pointing at the dead UID after an adoption, which looks exactly like data loss
 * to the person it belongs to. Derived from every `ownerKey(req)` /
 * `principal.id` consumer in backend/src/routes.
 */
export const IDENTITY_REFS: readonly { collection: string; field: string; owner: boolean }[] = [
  { collection: "sessions", field: "firebaseUid", owner: false },
  { collection: "addresses", field: "userId", owner: false },
  { collection: "reviews", field: "userId", owner: false },
  { collection: "notifications", field: "userId", owner: false },
  { collection: "carts", field: "ownerKey", owner: true },
  { collection: "favorites", field: "ownerKey", owner: true },
  { collection: "comparisons", field: "ownerKey", owner: true },
  { collection: "recentlyViewed", field: "ownerKey", owner: true },
  { collection: "orders", field: "ownerKey", owner: true },
  { collection: "returns", field: "ownerKey", owner: true },
  { collection: "reservations", field: "ownerKey", owner: true },
  { collection: "stockAlerts", field: "ownerKey", owner: true },
];

/** `customer` is the floor every account already has; anything else is authority. */
export const privilegedRoles = (roles: readonly string[]): string[] =>
  roles.filter((role) => role !== "customer");

/** Normalised email, or undefined. Mongo stores emails lowercase; comparisons and
 *  lookups must agree with that or an adoption silently becomes an insert. */
export const normalizeEmail = (email: string | undefined | null): string | undefined =>
  typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : undefined;

/**
 * Repoints every reference from one UID to another. Returns per-collection
 * modified counts so callers can log what actually moved rather than assuming.
 */
export async function repointIdentity(
  db: Db,
  fromUid: string,
  toUid: string,
  session?: ClientSession,
): Promise<Record<string, number>> {
  const moved: Record<string, number> = {};
  if (fromUid === toUid) return moved;
  for (const ref of IDENTITY_REFS) {
    const from = ref.owner ? `user:${fromUid}` : fromUid;
    const to = ref.owner ? `user:${toUid}` : toUid;
    const result = await db
      .collection(ref.collection)
      .updateMany({ [ref.field]: from }, { $set: { [ref.field]: to } }, session ? { session } : {});
    if (result.modifiedCount) moved[ref.collection] = result.modifiedCount;
  }
  return moved;
}

export type IdentityAction = "matched-uid" | "adopted-by-email" | "created";

export type IdentityResolution = {
  /** The user document, after reconciliation. */
  doc: WithId<Document>;
  /** Roles that are in force for this session — never read straight off `doc`. */
  roles: string[];
  action: IdentityAction;
  /** Present on adoption: the UID the document used to point at. */
  adoptedFrom?: string;
  /** References moved during adoption, per collection. */
  moved?: Record<string, number>;
  /** Roles parked because the mailbox is unproven. Empty when nothing was held. */
  pendingRoles?: string[];
  /** Roles handed back after a now-verified sign-in. */
  restoredRoles?: string[];
};

/**
 * Hands back parked roles once the mailbox is proven. Runs on the ordinary
 * matched-uid path too, so an account elevated-then-parked recovers on the first
 * verified sign-in without anyone touching the database.
 */
async function restorePendingRoles(
  db: Db,
  doc: WithId<Document>,
  emailVerified: boolean,
): Promise<{ roles: string[]; restored: string[] }> {
  const roles = Array.isArray(doc["roles"]) ? (doc["roles"] as string[]) : ["customer"];
  const pending = Array.isArray(doc["pendingRoles"]) ? (doc["pendingRoles"] as string[]) : [];
  if (!pending.length || !emailVerified) return { roles, restored: [] };
  const merged = [...new Set([...roles, ...pending])];
  await db.collection("users").updateOne(
    { _id: doc._id },
    {
      $set: { roles: merged, rolesRestoredAt: new Date() },
      $unset: { pendingRoles: "", pendingRolesReason: "" },
    },
  );
  return { roles: merged, restored: pending };
}

/**
 * Resolves the verified ID token to exactly one Mongo user document, repairing
 * UID drift on the way. Replaces the old blind upsert in POST /auth/session.
 *
 * `bootstrapRoles` stays the caller's decision (it depends on config and on the
 * token's `role` claim) and applies ONLY to a genuine first insert.
 */
export async function resolveUserIdentity(
  db: Db,
  /* `name` is accepted structurally: some Firebase Admin versions do not
     declare it on DecodedIdToken even though verified tokens carry it. */
  decoded: Pick<DecodedIdToken, "uid" | "email" | "email_verified"> & { name?: string },
  bootstrapRoles: string[],
): Promise<IdentityResolution> {
  const uid = decoded.uid;
  const email = normalizeEmail(decoded.email);
  const displayName = typeof decoded.name === "string" ? decoded.name : undefined;
  const emailVerified = decoded.email_verified === true;
  const now = new Date();
  const users = db.collection("users");

  // 1. The normal path.
  const byUid = await users.findOne({ firebaseUid: uid });
  if (byUid) {
    const { roles, restored } = await restorePendingRoles(db, byUid, emailVerified);
    await users.updateOne(
      { _id: byUid._id },
      { $set: { ...(email ? { email } : {}), ...(displayName ? { displayName } : {}), lastSeenAt: now } },
    );
    return {
      doc: byUid,
      roles,
      action: "matched-uid",
      ...(restored.length ? { restoredRoles: restored } : {}),
    };
  }

  // 2. Drift: Firebase minted a new UID for an email Mongo already knows.
  const byEmail = email ? await users.findOne({ email }) : null;
  if (byEmail) {
    const previousUid = typeof byEmail["firebaseUid"] === "string" ? byEmail["firebaseUid"] : "";
    const storedRoles = Array.isArray(byEmail["roles"]) ? (byEmail["roles"] as string[]) : ["customer"];
    const parked = Array.isArray(byEmail["pendingRoles"]) ? (byEmail["pendingRoles"] as string[]) : [];
    const elevated = privilegedRoles(storedRoles);
    const holdBack = !emailVerified && elevated.length > 0;
    const nextRoles = holdBack ? storedRoles.filter((r) => !elevated.includes(r)) : storedRoles;
    // Nothing is discarded: held roles move to pendingRoles and come back on the
    // first verified sign-in.
    const nextPending = holdBack ? [...new Set([...parked, ...elevated])] : parked;

    await users.updateOne(
      { _id: byEmail._id },
      {
        $set: {
          firebaseUid: uid,
          email,
          ...(displayName ? { displayName } : {}),
          lastSeenAt: now,
          roles: nextRoles.length ? nextRoles : ["customer"],
          adoptedAt: now,
          ...(previousUid ? { previousFirebaseUid: previousUid } : {}),
          ...(nextPending.length
            ? { pendingRoles: nextPending, pendingRolesReason: "email_unverified_on_adoption" }
            : {}),
        },
        ...(nextPending.length ? {} : { $unset: { pendingRoles: "", pendingRolesReason: "" } }),
      },
    );
    const moved = previousUid ? await repointIdentity(db, previousUid, uid) : {};
    await db.collection("auditLogs").insertOne({
      actorId: uid,
      action: "identity.adopted",
      entityType: "user",
      entityId: String(byEmail._id),
      changes: {
        email,
        fromUid: previousUid || null,
        toUid: uid,
        emailVerified,
        rolesHeldBack: holdBack ? elevated : [],
        moved,
      },
      createdAt: now,
    });
    return {
      doc: byEmail,
      roles: nextRoles.length ? nextRoles : ["customer"],
      action: "adopted-by-email",
      ...(previousUid ? { adoptedFrom: previousUid } : {}),
      moved,
      ...(holdBack ? { pendingRoles: elevated } : {}),
    };
  }

  // 3. Genuinely new.
  const inserted = await users.findOneAndUpdate(
    { firebaseUid: uid },
    {
      $set: { ...(email ? { email } : {}), ...(displayName ? { displayName } : {}), lastSeenAt: now },
      $setOnInsert: { roles: bootstrapRoles, createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  const roles = Array.isArray(inserted?.["roles"]) ? (inserted?.["roles"] as string[]) : bootstrapRoles;
  return { doc: inserted as WithId<Document>, roles, action: "created" };
}
