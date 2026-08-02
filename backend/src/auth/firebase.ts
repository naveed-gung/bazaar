import fs from "node:fs";
import path from "node:path";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "../config.js";

let app: App | null | undefined;

function firebaseApp(): App | null {
  if (app !== undefined) return app;
  if (getApps()[0]) { app = getApps()[0]!; return app; }
  try {
    const explicit = config.firebaseAdminCredentials || process.env["GOOGLE_APPLICATION_CREDENTIALS"] || "";
    const privateKey = config.firebasePrivateKeyBase64
      ? Buffer.from(config.firebasePrivateKeyBase64, "base64").toString("utf8")
      : config.firebasePrivateKey.replace(/\\n/g, "\n");
    if (config.firebaseProjectId && config.firebaseClientEmail && privateKey) {
      app = initializeApp({
        credential: cert({
          projectId: config.firebaseProjectId,
          clientEmail: config.firebaseClientEmail,
          privateKey,
        }),
        projectId: config.firebaseProjectId,
      });
      return app;
    }
    if (explicit.trimStart().startsWith("{")) {
      const serviceAccount = JSON.parse(explicit) as { project_id: string; client_email: string; private_key: string };
      app = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
        projectId: config.firebaseProjectId || serviceAccount.project_id,
      });
      return app;
    }
    if (explicit && fs.existsSync(explicit)) {
      const serviceAccount = JSON.parse(fs.readFileSync(explicit, "utf8")) as { project_id: string; client_email: string; private_key: string };
      app = initializeApp({ credential: cert({ projectId: serviceAccount.project_id, clientEmail: serviceAccount.client_email, privateKey: serviceAccount.private_key }), projectId: config.firebaseProjectId || serviceAccount.project_id });
      return app;
    }
    const localCredential = [path.resolve(process.cwd()), path.resolve(process.cwd(), "..")]
      .flatMap((directory) => fs.existsSync(directory) ? fs.readdirSync(directory).map((name) => path.join(directory, name)) : [])
      .find((candidate) => candidate.includes("firebase-adminsdk") && candidate.endsWith(".json"));
    if (localCredential) {
      const serviceAccount = JSON.parse(fs.readFileSync(localCredential, "utf8")) as { project_id: string; client_email: string; private_key: string };
      app = initializeApp({ credential: cert({ projectId: serviceAccount.project_id, clientEmail: serviceAccount.client_email, privateKey: serviceAccount.private_key }), projectId: config.firebaseProjectId || serviceAccount.project_id });
      return app;
    }
    if (config.firebaseProjectId) {
      app = initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
      return app;
    }
  } catch {
    app = null;
    return app;
  }
  app = null;
  return app;
}

export function firebaseAuth() {
  const initialized = firebaseApp();
  return initialized ? getAuth(initialized) : null;
}
