"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth-provider";

const featureCards = [
  { title: "Participants", description: "Manage players, agents, and other participants.", icon: "people" },
  { title: "Teams", description: "Configure and manage teams and their rosters.", icon: "shield" },
  { title: "Bidding", description: "Real-time bidding experience for live auctions.", icon: "gavel" },
  { title: "Purse validation", description: "Validate budgets, spending rules, and purse management.", icon: "document" },
];

function FeatureIcon({ name }: { name: string }) {
  if (name === "people") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="16" r="6" /><path d="M13 36c0-6 4.8-10 11-10s11 4 11 10" /><path d="M10 27c-3.5.8-6 3.5-6 7m34-7c3.5.8 6 3.5 6 7" /><path d="M9 18a5 5 0 1 0 0 10m30-10a5 5 0 1 1 0 10" /></svg>;
  if (name === "shield") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 6v10c0 10-6.5 17.5-15 22-8.5-4.5-15-12-15-22V11l15-6z" /><path d="M17 24l5 5 10-11" /></svg>;
  if (name === "document") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 5h19l8 8v30H11z" /><path d="M30 5v9h8M17 21h15M17 27h15M17 33h8" /><circle cx="34" cy="34" r="7" /><path d="M31 34l2 2 4-5" /></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 10l27 27M37 10L10 37" /><path d="M16 8l-4 4 24 24 4-4z" /><path d="M8 40h32M14 35h20" /></svg>;
}

function GavelIllustration() {
  return <div className="hero-gavel" aria-hidden="true"><div className="gavel-shadow" /><div className="gavel-head"><span /></div><div className="gavel-handle" /><div className="gavel-base"><div /></div></div>;
}

export default function HomePage() {
  const { user, loading } = useAuth();
  async function handleSignOut() { await signOut(getFirebaseAuth()); }

  return (
    <main className="home-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Auction Platform home"><span className="brand-mark">AP</span><span className="brand-name"><strong>AUCTION</strong><strong>PLATFORM</strong></span></Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link className="active" href="/">Home</Link>
          {user && <Link href="/auctions">Auctions</Link>}
          <span>Profile</span><span>Settings</span>
        </nav>
        <div className="account-area">
          {loading ? <span className="account-loading">Checking session…</span> : user ? <><span className="account-avatar" aria-hidden="true">{(user.displayName ?? user.email ?? "A").charAt(0).toUpperCase()}</span><span className="account-copy"><strong>{user.displayName ?? "Auction Member"}</strong><small>{user.email ?? "Authenticated account"}</small></span><button className="account-menu" type="button" onClick={handleSignOut} aria-label="Sign out">↗</button></> : <Link className="header-signin" href="/login">Sign in</Link>}
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="section-kicker">Auction Platform</p>
          <h1>Configurable auction<br className="desktop-break" /> platform for leagues</h1>
          <span className="gold-rule" aria-hidden="true" />
          <p className="hero-description">Phase 3 establishes secure auction management, lifecycle controls, responsive administration, and auction-level visual configuration.</p>
          <Link className="hero-cta" href={user ? "/auctions" : "/login"><span>{user ? "Manage auctions" : "Open authentication"}</span><span aria-hidden="true">→</span></Link>
        </div>
        <div className="hero-art"><GavelIllustration />{user && !loading && <div className="welcome-card"><div className="welcome-icon">♙</div><p>Welcome back,</p><h2>{user.displayName ?? "Auction Member"}</h2><small>{user.email}</small><Link href="/auctions">Open management</Link><button type="button" onClick={handleSignOut}>Sign out</button></div>}</div>
      </section>

      <section className="feature-section" aria-label="Platform capabilities"><div className="feature-grid">{featureCards.map((feature) => <article className="feature-card" key={feature.title}><div className="feature-icon"><FeatureIcon name={feature.icon} /></div><h2>{feature.title}</h2><p>{feature.description}</p><span className="coming-soon">Coming soon <b>→</b></span></article>)}</div></section>
      <footer className="site-footer"><span>© 2026 Auction Platform. All rights reserved.</span><span>Privacy Policy&nbsp;&nbsp; | &nbsp;&nbsp;Terms of Service</span></footer>
    </main>
  );
}
