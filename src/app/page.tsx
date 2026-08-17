import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <p style={{ marginBottom: 8 }}>Auction Platform</p>
        <h1>Configurable auction platform for leagues</h1>
        <p>
          Phase 2 establishes Firebase Authentication with email/password and Google sign-in.
        </p>
        <Link href="/login">Open authentication</Link>
      </section>
    </main>
  );
}
