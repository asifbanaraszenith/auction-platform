"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth-provider";
import { MobileNavigation } from "@/components/mobile-navigation";
import { useRouter } from "next/navigation";

const featureCards = [
  { title: "Auctions", description: "Create, configure, schedule and manage league auctions.", icon: "gavel", href: "/auctions" },
  { title: "Participants", description: "Register and manage players, agents, and other participants.", icon: "people", href: "/participant" },
  { title: "Teams", description: "Configure teams, rosters, and auction participation.", icon: "shield" },
  { title: "Bidding", description: "Run the real-time bidding experience for live auctions.", icon: "gavel" },
  { title: "Purse validation", description: "Validate budgets, spending rules, and purse management.", icon: "document" },
];

function FeatureIcon({ name }: { name: string }) {
  if (name === "people") return (<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="16" r="6" /><path d="M13 36c0-6 4.8-10 11-10s11 4 11 10" /><path d="M10 27c-3.5.8-6 3.5-6 7m34-7c3.5.8 6 3.5 6 7" /><path d="M9 18a5 5 0 1 0 0 10m30-10a5 5 0 1 1 0 10" /></svg>);
  if (name === "shield") return (<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 6v10c0 10-6.5 17.5-15 22-8.5-4.5-15-12-15-22V11l15-6z" /><path d="M17 24l5 5 10-11" /></svg>);
  if (name === "document") return (<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 5h19l8 8v30H11z" /><path d="M30 5v9h8M17 21h15M17 27h15M17 33h8" /><circle cx="34" cy="34" r="7" /><path d="M31 34l2 2 4-5" /></svg>);
  return (<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 10l27 27M37 10L10 37" /><path d="M16 8l-4 4 24 24 4-4z" /><path d="M8 40h32M14 35h20" /></svg>);
}

function GavelIllustration() {
  return (<div className="hero-gavel" aria-hidden="true"><div className="gavel-shadow" /><div className="gavel-head"><span /></div><div className="gavel-handle" /><div className="gavel-base"><div /></div></div>);
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }

  return (
    <main className="home-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Auction Platform home"><span className="brand-mark">AP</span><span className="brand-name"><strong>AUCTION</strong><strong>PLATFORM</strong></span></Link>
        <nav className="site-nav" aria-label="Primary navigation"><Link className="active" href="/">Home</Link>{user ? <Link href="/auctions">Auctions</Link> : <span>Auctions</span>}</nav>
        <MobileNavigation authenticated={Boolean(user)} displayName={user?.displayName} email={user?.email} onSignOut={() => void handleSignOut()} />
      </header>

      <section className="hero-section">
        <div className="hero-content-stack">
          <div className="hero-copy"><p className="section-kicker">Auction Platform</p><h1>Configurable auction<br className="desktop-break" /> platform for leagues</h1><span className="gold-rule" aria-hidden="true" /><p className="hero-description">Secure auction management, participant access, responsive administration, and auction-level configuration.</p></div>

          <section className="feature-section" aria-label="Platform actions" style={{ maxWidth: "none", margin: "28px 0 0", padding: 0 }}>
            <div className="feature-grid" style={{ gridTemplateColumns: "1fr", padding: 0, border: 0, gap: 12 }}>
              {featureCards.map((feature) => {
                const action = feature.href ? <Link className="coming-soon" href={user ? feature.href : "/login"} style={{ marginTop: 0, whiteSpace: "nowrap" }}>{user ? "Open" : "Sign in"} <b>→</b></Link> : <span className="coming-soon" style={{ marginTop: 0, whiteSpace: "nowrap" }}>Coming soon <b>→</b></span>;
                return <article className={`feature-card${feature.href ? " feature-card-active" : ""}`} key={feature.title} style={{ minHeight: 118, padding: "18px 20px", display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) auto", alignItems: "center", gap: 18, textAlign: "left" }}><div className="feature-icon" style={{ width: 64, height: 64, marginBottom: 0 }}><FeatureIcon name={feature.icon} /></div><div><h2 style={{ marginBottom: 6 }}>{feature.title}</h2><p style={{ maxWidth: 620 }}>{feature.description}</p></div>{action}</article>;
              })}
            </div>
          </section>
        </div>
        <div className="hero-art"><GavelIllustration /></div>
      </section>
      <footer className="site-footer"><span>© 2026 Auction Platform. All rights reserved.</span><span>Privacy Policy&nbsp;&nbsp; | &nbsp;&nbsp;Terms of Service</span></footer>
    </main>
  );
}
