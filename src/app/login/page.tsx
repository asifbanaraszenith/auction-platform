"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const auth = getFirebaseAuth();
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setError(null);
    setBusy(true);

    try {
      await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <section style={{ maxWidth: 440, margin: "0 auto", padding: 24 }}>
        <p>Auction Platform</p>
        <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p>Phase 2 authentication is powered by Firebase Authentication.</p>

        <form onSubmit={handleEmailAuth} style={{ display: "grid", gap: 12 }}>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button type="button" onClick={handleGoogleAuth} disabled={busy} style={{ marginTop: 12 }}>
          Continue with Google
        </button>

        {error && <p role="alert" style={{ marginTop: 16 }}>{error}</p>}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          style={{ marginTop: 16 }}
        >
          {mode === "signin" ? "Create a new account" : "I already have an account"}
        </button>
      </section>
    </main>
  );
}
