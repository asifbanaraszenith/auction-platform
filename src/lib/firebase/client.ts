import { getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const requiredEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebaseAuth: Auth | null = null;

function getFirebaseConfig() {
  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Firebase environment variables: ${missing.join(", ")}`);
  }

  return requiredEnv as {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}

export function getFirebaseApp() {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  // Firebase App Hosting supports automatic Web SDK configuration.
  try {
    return initializeApp();
  } catch {
    // Local development can provide the standard NEXT_PUBLIC_* values.
    return initializeApp(getFirebaseConfig());
  }
}

export function getFirebaseAuth() {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = getFirebaseApp();

  try {
    // Use explicit browser localStorage persistence instead of the default
    // IndexedDB-backed persistence. This avoids browser database lifecycle
    // failures that can break OAuth completion on mobile browsers while
    // retaining persistent sessions across browser restarts.
    firebaseAuth = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Hot reloads or another module may already have initialized Auth.
    firebaseAuth = getAuth(app);
  }

  return firebaseAuth;
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}
