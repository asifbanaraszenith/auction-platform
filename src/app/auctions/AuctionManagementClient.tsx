"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createAuction, deleteAuction, listAuctionsForUser, updateAuction } from "@/lib/auctions/repository";
import { AUCTION_MODES, AUCTION_STATUSES, DEFAULT_AUCTION_THEME, type Auction, type AuctionStatus, type AuctionTheme } from "@/lib/auctions/types";
import styles from "./auctions.module.css";

const EMPTY_FORM = { name: "", description: "", status: "draft" as AuctionStatus, mode: "live" as "live" | "timed", currency: "PKR", timezone: "Asia/Karachi", startAt: "", endAt: "" };
const THEME_PRESETS: Record<"dark" | "light", Partial<AuctionTheme>> = {
  dark: { mode: "dark", primaryColor: "#c7a45b", secondaryColor: "#f5f2e9", backgroundColor: "#0d0d0c", surfaceColor: "#121210", textColor: "#f5f2e9", mutedColor: "#aaa69a", borderColor: "#3b3932" },
  light: { mode: "light", primaryColor: "#8b6a2b", secondaryColor: "#1d1b17", backgroundColor: "#f6f3eb", surfaceColor: "#ffffff", textColor: "#1d1b17", mutedColor: "#69645a", borderColor: "#d6cfbf" },
};

function dateValue(value: Timestamp | null) {
  if (!value) return "";
  const date = value.toDate();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function timestampValue(value: string) { return value ? Timestamp.fromDate(new Date(value)) : null; }
function mergeTheme(theme?: Partial<AuctionTheme>): AuctionTheme { return { ...DEFAULT_AUCTION_THEME, ...theme }; }

export default function AuctionManagementClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [selected, setSelected] = useState<Auction | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [theme, setTheme] = useState<AuctionTheme>(DEFAULT_AUCTION_THEME);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sortedAuctions = useMemo(() => [...auctions].sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()), [auctions]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    void (async () => {
      try {
        const token = await user.getIdTokenResult(true);
        setIsSuperAdmin(token.claims.superAdmin === true);
        setAuctions(await listAuctionsForUser(user));
      } catch (err) {
        console.error("Unable to preload auctions", err);
        setAuctions([]);
      }
    })();
  }, [loading, router, user]);

  function startCreate() { setSelected(null); setForm(EMPTY_FORM); setTheme(DEFAULT_AUCTION_THEME); setError(""); setNotice(""); }
  function selectAuction(auction: Auction) { setSelected(auction); setForm({ name: auction.name, description: auction.description, status: auction.status, mode: auction.settings.mode, currency: auction.settings.currency, timezone: auction.settings.timezone, startAt: dateValue(auction.startAt), endAt: dateValue(auction.endAt) }); setTheme(mergeTheme(auction.settings.theme)); setError(""); setNotice(""); }
  function changeThemeMode(mode: "dark" | "light") { setTheme((current) => ({ ...current, ...THEME_PRESETS[mode] })); }

  async function save() {
    if (!user) return;
    if (!form.name.trim()) { setError("Auction name is required before saving."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await user.getIdToken(true);
      if (selected) {
        await updateAuction(selected.id, { name: form.name.trim(), description: form.description.trim(), status: form.status, startAt: timestampValue(form.startAt), endAt: timestampValue(form.endAt), settings: { mode: form.mode, currency: form.currency.trim() || "PKR", timezone: form.timezone, theme } });
        setNotice("Auction updated successfully.");
      } else {
        const created = await createAuction({ name: form.name.trim(), description: form.description.trim(), ownerId: user.uid, adminIds: [user.uid], status: form.status, startAt: timestampValue(form.startAt), endAt: timestampValue(form.endAt), settings: { mode: form.mode, currency: form.currency.trim() || "PKR", timezone: form.timezone, theme } });
        setSelected(created); setNotice("Auction created successfully.");
      }
      try { setAuctions(await listAuctionsForUser(user)); } catch (refreshError) { console.error("Unable to refresh auction list", refreshError); }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save auction.";
      setError(message.includes("Missing or insufficient permissions") ? "You do not have permission to perform this auction action. Please refresh your session if Super Admin access was just granted." : message);
    } finally { setBusy(false); }
  }

  async function changeStatus(status: AuctionStatus) {
    if (!selected || !user) return;
    setBusy(true); setError("");
    try { await user.getIdToken(true); await updateAuction(selected.id, { status }); const refreshed = { ...selected, status }; setSelected(refreshed); setForm((current) => ({ ...current, status })); setAuctions((current) => current.map((item) => item.id === selected.id ? refreshed : item)); setNotice(`Auction moved to ${status}.`); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to change status."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!selected || !isSuperAdmin || !user) return;
    if (!window.confirm(`Delete “${selected.name}”? This cannot be undone.`)) return;
    setBusy(true); setError("");
    try { await user.getIdToken(true); await deleteAuction(selected.id); setAuctions((current) => current.filter((item) => item.id !== selected.id)); startCreate(); setNotice("Auction deleted."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to delete auction."); }
    finally { setBusy(false); }
  }

  if (loading || !user) return <main className={styles.loading}>Loading auction management…</main>;

  return (
    <main className={styles.shell} data-theme={theme.mode} style={{ "--auction-primary": theme.primaryColor, "--auction-secondary": theme.secondaryColor, "--auction-background": theme.backgroundColor, "--auction-surface": theme.surfaceColor, "--auction-text": theme.textColor, "--auction-muted": theme.mutedColor, "--auction-border": theme.borderColor } as React.CSSProperties}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Auction Platform / Management</p><h1>Auction Management</h1><p className={styles.subtitle}>Create, configure, schedule and govern every league auction.</p></div>
        <div className={styles.headerActions}><span className={styles.role}>{isSuperAdmin ? "SUPER ADMIN" : "AUCTION ADMIN"}</span><button className={styles.secondaryButton} onClick={() => router.push("/")}>Back</button><button className={styles.primaryButton} onClick={startCreate}>+ New auction</button></div>
      </header>
      <div className={styles.layout}>
        <aside className={styles.listPanel}>
          <div className={styles.listHeader}><span>Auctions</span><b>{sortedAuctions.length}</b></div>
          {sortedAuctions.length === 0 ? <div className={styles.empty}>No auctions yet.<br />Create your first league auction.</div> : sortedAuctions.map((auction) => <button key={auction.id} className={`${styles.auctionItem} ${selected?.id === auction.id ? styles.selected : ""}`} onClick={() => selectAuction(auction)}><span className={styles.itemTop}><strong>{auction.name}</strong><em>{auction.status}</em></span><span className={styles.itemBottom}>{auction.settings.mode} · {auction.settings.currency} · {auction.settings.timezone}</span></button>)}
        </aside>
        <section className={styles.editor}>
          <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>{selected ? "Edit auction" : "New auction"}</p><h2>{selected?.name || "Auction configuration"}</h2></div>{selected && <span className={styles.id}>ID {selected.id}</span>}</div>
          {error && <div className={styles.error}>{error}</div>}{notice && <div className={styles.notice}>{notice}</div>}
          <div className={styles.formGrid}>
            <label>AUCTION NAME<input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); }} placeholder="Premier League 2026" /></label>
            <label>STATUS<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AuctionStatus })}>{AUCTION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className={styles.full}>DESCRIPTION<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Auction purpose, league and operating notes" rows={4} /></label>
            <label>MODE<select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "live" | "timed" })}>{AUCTION_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
            <label>CURRENCY<input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label>
            <label>TIMEZONE<select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}><option>Asia/Karachi</option><option>UTC</option><option>Asia/Dubai</option><option>Asia/Kolkata</option></select></label>
            <label>START AT<input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label>
            <label>END AT<input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label>
          </div>
          <div className={styles.themePanel}>
            <div><p className={styles.eyebrow}>Auction-level visual identity</p><h3>Theme & branding</h3><p>Each auction owns its presentation. Select a base theme, then refine the colors below.</p></div>
            <div className={styles.themeGrid}>
              <label>MODE<select value={theme.mode} onChange={(e) => changeThemeMode(e.target.value as "dark" | "light")}><option value="dark">Dark luxury</option><option value="light">Light gallery</option></select></label>
              <label>FONT STYLE<select value={theme.fontStyle} onChange={(e) => setTheme({ ...theme, fontStyle: e.target.value as "luxury" | "modern" })}><option value="luxury">Luxury serif</option><option value="modern">Modern sans</option></select></label>
              <label>PRIMARY<input type="color" value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} /></label>
              <label>SECONDARY<input type="color" value={theme.secondaryColor} onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })} /></label>
              <label>BACKGROUND<input type="color" value={theme.backgroundColor} onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })} /></label>
              <label>SURFACE<input type="color" value={theme.surfaceColor} onChange={(e) => setTheme({ ...theme, surfaceColor: e.target.value })} /></label>
            </div>
            <div className={styles.preview} style={{ background: theme.backgroundColor, color: theme.textColor, borderColor: theme.borderColor }}><span style={{ color: theme.primaryColor }}>THE AUCTION</span><strong style={{ fontFamily: theme.fontStyle === "luxury" ? "Georgia, serif" : "Arial, sans-serif" }}>{form.name || "League Auction"}</strong><small style={{ color: theme.mutedColor }}>{form.description || "A private, curated bidding experience."}</small></div>
          </div>
          <div className={styles.footerActions}>
            <button className={styles.primaryButton} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : selected ? "Save changes" : "Create auction"}</button>
            {selected && <div className={styles.lifecycle}>{AUCTION_STATUSES.map((status) => <button key={status} className={form.status === status ? styles.statusActive : styles.statusButton} disabled={busy} onClick={() => void changeStatus(status)}>{status}</button>)}</div>}
            {selected && isSuperAdmin && <button className={styles.dangerButton} disabled={busy} onClick={() => void remove()}>Delete</button>}
          </div>
        </section>
      </div>
    </main>
  );
}
