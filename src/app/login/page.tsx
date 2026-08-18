"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/users/repository";

function getAuthErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return "auth/unknown";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!error) return;
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-app-alert='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [error]);

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const auth = getFirebaseAuth();
      const credential = mode === "signin"
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);
      await ensureUserProfile(credential.user);
      router.replace("/");
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
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(getFirebaseAuth(), provider);
      await ensureUserProfile(credential.user);
      router.replace("/");
    } catch (err) {
      const code = getAuthErrorCode(err);

      if (code === "auth/unauthorized-domain") {
        const domain = typeof window !== "undefined" ? window.location.hostname : "this domain";
        setError(
          `Google sign-in is blocked because ${domain} is not an authorized Firebase Authentication domain. Add this hostname in Firebase Console → Authentication → Settings → Authorized domains, then try again.`,
        );
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.");
      } else if (code === "auth/popup-closed-by-user") {
        setError("The Google sign-in window was closed before authentication completed.");
      } else {
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  const isSignIn = mode === "signin";

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="Auction Platform introduction">
        <div className="auth-mark">Auction Platform</div>

        <div className="auth-brand-copy">
          <h2>The art of the auction.</h2>
          <p>
            A refined digital room for competitive auctions, curated leagues,
            and the moments that define a season.
          </p>
        </div>

        <div className="auth-footer">Private access · Auction management</div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="auth-eyebrow">Private Access</p>
          <h1>{isSignIn ? "Sign in" : "Create account"}</h1>
          <p className="auth-subtitle">
            {isSignIn
              ? "Enter your credentials to continue to the auction room."
              : "Create your account to enter the auction room."}
          </p>

          <form onSubmit={handleEmailAuth} className="auth-form">
            <label className="auth-field">
              <span>Email address</span>
              <input className="auth-input" required autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input className="auth-input" required minLength={6} autoComplete={isSignIn ? "current-password" : "new-password"} type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}</button>
          </form>

          <div className="auth-divider" aria-hidden="true">or</div>
          <button className="auth-google" type="button" onClick={handleGoogleAuth} disabled={busy}>Continue with Google</button>

          {error && <div className="auth-error" data-app-alert="true" role="alert"><strong>Authentication notice</strong><div>{error}</div></div>}

          <button className="auth-switch" type="button" onClick={() => { setError(null); setMode(isSignIn ? "signup" : "signin"); }}>
            {isSignIn ? "Create a new account" : "I already have an account"}
          </button>
        </div>
      </section>
    </main>
  );
}
