import { getApps, initializeApp } from "@firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "@firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined,
};

export function browserAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  const { apiKey, authDomain, projectId, appId } = firebaseConfig;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  const app = getApps()[0] ?? initializeApp({ apiKey, authDomain, projectId, appId });
  return getAuth(app);
}

export const googleProvider = new GoogleAuthProvider();
