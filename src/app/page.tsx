"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth-provider";

export default function HomePage() {
  const { user, loading } = useAuth();

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
  }

  return (
    <main>
      <section style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <p style={{ marginBottom: 8 }}>Auction Platform</p>
        <h1>Configurable auction platform for leagues</h1>
        <p>
          Phase 2 establishes Firebase Authentication with email/password and Google sign-in.
        </p>

        {loading ? (
          <p>Checking authentication…</p>
        ) : user ? (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <p>Signed in as {user.email ?? user.uid}</p>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login">Open authentication</Link>
        )}
      </section>
    </main>
  );
}
