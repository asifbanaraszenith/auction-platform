"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createAuction, deleteAuction, listAuctionsForUser, updateAuction } from "@/lib/auctions/repository";
import { DEFAULT_AUCTION_THEME, type Auction, type AuctionStatus, type AuctionTheme } from "@/lib/auctions/types";
import styles from "./auctions.module.css";

type AdminOption = { uid: string; email: string; displayName: string };
const EMPTY_FORM = { name: "", description: "", points: "Points", timezone: "Asia/Karachi", startAt: "", endAt: "" };
const THEME_PRESETS: Record<"dark" | "light", Partial<AuctionTheme>> = {
  dark: { mode: "dark", primaryColor: "#c7a45b", secondaryColor: "#f5f2e9", backgroundColor: "#0d0d0c", surfaceColor: "#121210", textColor: "#f5f2e9", mutedColor: "#aaa69a", borderColor: "#3b3932" },
  light: { mode: "light", primaryColor: "#8b6a2b", secondaryColor: "#1d1b17", backgroundColor: "#f6f3eb", surfaceColor: "#ffffff", textColor: "#1d1b17", mutedColor: "#69645a", borderColor: "#d6cfbf" },
};

function dateValue(value: Timestamp | null) { if (!value) return ""; const date = value.toDate(); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function timestampValue(value: string) { return value ? Timestamp.fromDate(new Date(value)) : null; }
function mergeTheme(theme?: Partial<AuctionTheme>): AuctionTheme { return { ...DEFAULT_AUCTION_THEME, ...theme }; }
function formatCardDate(value: Timestamp | null, timezone: string) { if (!value) return "—"; return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone || "Asia/Karachi" }).format(value.toDate()); }
function displayStatus(auction: Auction): string { if (auction.status === "paused" || auction.status === "ended" || auction.status === "archived") return auction.status; const now = Date.now(); if (auction.endAt && auction.endAt.toMillis() <= now) return "overdue"; if (!auction.startAt || auction.startAt.toMillis() > now) return "created"; return "live"; }
function lifecycleStatus(auction: Auction): AuctionStatus { if (auction.status === "paused" || auction.status === "ended" || auction.status === "archived") return auction.status; if (auction.endAt && auction.endAt.toMillis() <= Date.now()) return "ended"; if (!auction.startAt || auction.startAt.toMillis() > Date.now()) return "created"; return "live"; }

export default function AuctionManagementClient() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]); const [selected, setSelected] = useState<Auction | null>(null); const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM); const [theme, setTheme] = useState<AuctionTheme>(DEFAULT_AUCTION_THEME); const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<AdminOption[]>([]); const [assignedAdminIds, setAssignedAdminIds] = useState<string[]>([]); const [adminsLoading, setAdminsLoading] = useState(false);
  const [busy, setBusy] = useState(false); const [adminBusy, setAdminBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [clock, setClock] = useState(() => Date.now());
  const sortedAuctions = useMemo(() => [...auctions].sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()), [auctions]);

  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (loading) return; if (!user) { router.replace("/login"); return; }
    void (async () => { try {
      const token = await user.getIdTokenResult(true); const superAdmin = token.claims.superAdmin === true; setIsSuperAdmin(superAdmin); setAuctions(await listAuctionsForUser(user));
      if (superAdmin) { setAdminsLoading(true); const response = await fetch("/api/auction-admins", { headers: { Authorization: `Bearer ${await user.getIdToken(true)}` }, cache: "no-store" }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Unable to load registered auction admins."); setAdmins(payload.users ?? []); setAdminsLoading(false); }
    } catch (err) { console.error("Unable to preload auction management", err); setAuctions([]); setAdminsLoading(false); setError(err instanceof Error ? err.message : "Unable to load auctions. Please refresh and try again."); } })();
  }, [loading, router, user]);

  useEffect(() => {
    if (!error && !notice) return;
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-auction-alert='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [error, notice]);

  function startCreate() { setSelected(null); setIsCreating(true); setForm(EMPTY_FORM); setTheme(DEFAULT_AUCTION_THEME); setAssignedAdminIds([]); setError(""); setNotice(""); }
  function closeEditor() { setSelected(null); setIsCreating(false); setError(""); setNotice(""); }
  function selectAuction(auction: Auction) { setSelected(auction); setIsCreating(false); setForm({ name: auction.name, description: auction.description, points: auction.settings.points || "Points", timezone: auction.settings.timezone, startAt: dateValue(auction.startAt), endAt: dateValue(auction.endAt) }); setTheme(mergeTheme(auction.settings.theme)); setAssignedAdminIds(auction.adminIds ?? []); setError(""); setNotice(""); }
  function changeThemeMode(mode: "dark" | "light") { setTheme((current) => ({ ...current, ...THEME_PRESETS[mode] })); }

  async function saveAdminAssignments() {
    if (!selected || !user || !isSuperAdmin) return; setAdminBusy(true); setError(""); setNotice("");
    try { const token = await user.getIdToken(true); const response = await fetch("/api/auctions", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ auctionId: selected.id, adminIds: assignedAdminIds }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Unable to assign auction admins."); const updated = { ...selected, adminIds: payload.adminIds }; setSelected(updated); setAuctions((current) => current.map((item) => item.id === updated.id ? updated : item)); setNotice("Auction admins updated successfully."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to assign auction admins."); } finally { setAdminBusy(false); }
  }

  async function changeLifecycle(status: "live" | "paused" | "ended") {
    if (!selected || !user) return; setBusy(true); setError(""); setNotice("");
    try { await user.getIdToken(true); await updateAuction(selected.id, { status }); const updated = { ...selected, status } as Auction; setSelected(updated); setAuctions((current) => current.map((item) => item.id === selected.id ? updated : item)); setNotice(status === "live" ? "Auction resumed and is now live." : status === "paused" ? "Auction paused." : "Auction ended."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to change auction lifecycle."); } finally { setBusy(false); }
  }

  async function save() {
    if (!user) return; if (!form.name.trim()) { setError("Auction name is required before saving."); return; }
    const startAt = timestampValue(form.startAt); const endAt = timestampValue(form.endAt);
    if (!startAt) { setError("Start time is required."); return; } if (!endAt) { setError("End time is required."); return; } if (!selected && startAt.toMillis() <= Date.now()) { setError("Start time must be in the future."); return; } if (endAt.toMillis() <= startAt.toMillis()) { setError("End time must be after the start time."); return; }
    const status: AuctionStatus = selected ? selected.status : "created";
    setBusy(true); setError(""); setNotice("");
    try { await user.getIdToken(true); const settings = { mode: "timed" as const, points: "Points", timezone: form.timezone, theme };
      if (selected) { await updateAuction(selected.id, { name: form.name.trim(), description: form.description.trim(), status, startAt, endAt, settings }); const updated = { ...selected, name: form.name.trim(), description: form.description.trim(), status, startAt, endAt, settings } as Auction; setSelected(updated); setAuctions((current) => current.map((item) => item.id === updated.id ? updated : item)); setNotice("Auction updated successfully."); }
      else { await createAuction({ name: form.name.trim(), description: form.description.trim(), ownerId: user.uid, adminIds: [user.uid], status: "created", startAt, endAt, settings }); setAuctions(await listAuctionsForUser(user)); setSelected(null); setIsCreating(false); setForm(EMPTY_FORM); setTheme(DEFAULT_AUCTION_THEME); setNotice("Auction created successfully."); }
      if (selected) { try { setAuctions(await listAuctionsForUser(user)); } catch (refreshError) { console.error("Unable to refresh auction list", refreshError); } }
    } catch (err) { const message = err instanceof Error ? err.message : "Unable to save auction."; setError(message.includes("Missing or insufficient permissions") ? "You do not have permission to perform this auction action. Please refresh your session if your role was just granted." : message); } finally { setBusy(false); }
  }

  async function remove() { if (!selected || !isSuperAdmin || !user) return; if (!window.confirm(`Delete “${selected.name}”? This cannot be undone.`)) return; setBusy(true); setError(""); setNotice(""); try { await user.getIdToken(true); await deleteAuction(selected.id); setAuctions((current) => current.filter((item) => item.id !== selected.id)); closeEditor(); setNotice("Auction deleted."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete auction."); } finally { setBusy(false); } }

  if (loading || !user) return <main className={styles.loading}>Loading auction management…</main>;
  const currentStatus = selected ? lifecycleStatus(selected) : null; const minimumStart = selected ? undefined : new Date(clock + 60000).toISOString().slice(0, 16); const editorOpen = isCreating || Boolean(selected);
  return <main className={styles.shell} data-theme={theme.mode} style={{ "--auction-primary": theme.primaryColor, "--auction-secondary": theme.secondaryColor, "--auction-background": theme.backgroundColor, "--auction-surface": theme.surfaceColor, "--auction-text": theme.textColor, "--auction-muted": theme.mutedColor, "--auction-border": theme.borderColor } as React.CSSProperties}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Auction Platform / Management</p><h1>Auction Management</h1><p className={styles.subtitle}>Create, configure, schedule and govern every league auction.</p></div><div className={styles.headerActions}><span className={styles.role}>{isSuperAdmin ? "SUPER ADMIN" : "AUCTION ADMIN"}</span><button className={styles.secondaryButton} onClick={() => router.push("/")}>Back</button><button className={styles.primaryButton} onClick={startCreate}>+ NEW AUCTION</button></div></header>
    <div className={styles.layout}><aside className={styles.listPanel}><div className={styles.listHeader}><span>Auctions</span><b>{sortedAuctions.length}</b></div>{sortedAuctions.length === 0 ? <div className={styles.empty}>No auctions yet.<br />Use <strong>+ NEW AUCTION</strong> above to create your first league auction.</div> : sortedAuctions.map((auction) => <button key={auction.id} className={`${styles.auctionItem} ${selected?.id === auction.id ? styles.selected : ""}`} onClick={() => selectAuction(auction)}><span className={styles.itemTop}><strong>{auction.name}</strong><em className={displayStatus(auction) === "overdue" ? styles.overdue : ""}>{displayStatus(auction)}</em></span><span className={styles.itemBottom}>Start: {formatCardDate(auction.startAt, auction.settings.timezone)}</span><span className={styles.itemBottom}>End: {formatCardDate(auction.endAt, auction.settings.timezone)}</span><span className={styles.itemBottom}>Timed · Points · {auction.settings.timezone}</span></button>)}</aside>
    <section className={styles.editor}>{!editorOpen ? <div className={styles.editorEmpty}><p className={styles.eyebrow}>{sortedAuctions.length ? "Auction list" : "Ready when you are"}</p><h2>{sortedAuctions.length ? "Select an auction" : "Create your first auction"}</h2><p>{sortedAuctions.length ? "Choose an auction from the list to edit its configuration, or use + NEW AUCTION to create another one." : "The configuration form stays closed until you choose + NEW AUCTION."}</p><button className={styles.primaryButton} onClick={startCreate}>+ NEW AUCTION</button></div> : <>
      <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>{selected ? "Edit auction" : "New auction"}</p><h2>{selected?.name || "Auction configuration"}</h2>{selected && <p className={styles.statusLine}>Status: <strong className={displayStatus(selected) === "overdue" ? styles.overdue : ""}>{displayStatus(selected)}</strong></p>}</div>{selected && <span className={styles.id}>ID {selected.id}</span>}</div>
      {error && <div className={styles.error} data-auction-alert="true" role="alert">{error}</div>}{notice && <div className={styles.notice} data-auction-alert="true" role="status">{notice}</div>}
      <div className={styles.formGrid}><label>AUCTION NAME<input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); }} placeholder="Premier League 2026" /></label><label className={styles.full}>DESCRIPTION<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Auction purpose, league and operating notes" rows={4} /></label><label>POINT SYSTEM<input value="Points" readOnly aria-readonly="true" /></label><label>TIMEZONE<select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}><option>Asia/Karachi</option><option>UTC</option><option>Asia/Dubai</option><option>Asia/Kolkata</option></select></label><label className={styles.full}>START AT<input type="datetime-local" value={form.startAt} min={minimumStart} onChange={(e) => setForm({ ...form, startAt: e.target.value, endAt: form.endAt && new Date(e.target.value) >= new Date(form.endAt) ? "" : form.endAt })} /></label><label className={styles.full}>END AT<input type="datetime-local" value={form.endAt} min={form.startAt || undefined} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label></div>
      {selected && isSuperAdmin && <div className={styles.adminPanel}><div><p className={styles.eyebrow}>Auction access</p><h3>Assign auction admins</h3><p>Select one or more registered users who have the <strong>Auction Admin</strong> role.</p></div><div className={styles.adminList}>{adminsLoading ? <p>Loading registered admins…</p> : admins.length === 0 ? <p>No users currently have the Auction Admin role. Assign that role first in User & Role Management.</p> : admins.map((admin) => <label key={admin.uid} className={styles.adminOption}><input type="checkbox" checked={assignedAdminIds.includes(admin.uid)} onChange={(e) => setAssignedAdminIds((current) => e.target.checked ? [...current, admin.uid] : current.filter((id) => id !== admin.uid))} /><span><strong>{admin.displayName || "Unnamed user"}</strong><small>{admin.email}</small></span></label>)}</div><button className={styles.secondaryButton} disabled={adminBusy || adminsLoading} onClick={() => void saveAdminAssignments()}>{adminBusy ? "SAVING…" : "SAVE ADMIN ASSIGNMENTS"}</button></div>}
      <div className={styles.themePanel}><div><p className={styles.eyebrow}>Auction-level visual identity</p><h3>Theme & branding</h3><p>Each auction owns its presentation. Select a base theme, then refine the colors below.</p></div><div className={styles.themeGrid}><label>MODE<select value={theme.mode} onChange={(e) => changeThemeMode(e.target.value as "dark" | "light")}><option value="dark">Dark luxury</option><option value="light">Light gallery</option></select></label><label>FONT STYLE<select value={theme.fontStyle} onChange={(e) => setTheme({ ...theme, fontStyle: e.target.value as "luxury" | "modern" })}><option value="luxury">Luxury serif</option><option value="modern">Modern sans</option></select></label><label>PRIMARY<input type="color" value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} /></label><label>SECONDARY<input type="color" value={theme.secondaryColor} onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })} /></label><label>BACKGROUND<input type="color" value={theme.backgroundColor} onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })} /></label><label>SURFACE<input type="color" value={theme.surfaceColor} onChange={(e) => setTheme({ ...theme, surfaceColor: e.target.value })} /></label></div><div className={styles.preview} style={{ background: theme.backgroundColor, color: theme.textColor, borderColor: theme.borderColor }}><span style={{ color: theme.primaryColor }}>THE AUCTION</span><strong style={{ fontFamily: theme.fontStyle === "luxury" ? "Georgia, serif" : "Arial, sans-serif" }}>{form.name || "League Auction"}</strong><small style={{ color: theme.mutedColor }}>{form.description || "A private, curated bidding experience."}</small></div></div>
      {selected && currentStatus === "live" && <div className={styles.lifecycle}><button className={styles.statusButton} disabled={busy} onClick={() => void changeLifecycle("paused")}>PAUSE AUCTION</button><button className={styles.statusButton} disabled={busy} onClick={() => void changeLifecycle("ended")}>END AUCTION</button></div>}{selected && currentStatus === "paused" && <div className={styles.lifecycle}><button className={styles.statusButton} disabled={busy} onClick={() => void changeLifecycle("live")}>RESUME AUCTION</button><button className={styles.statusButton} disabled={busy} onClick={() => void changeLifecycle("ended")}>END AUCTION</button></div>}
      <div className={styles.footerActions}><button className={styles.primaryButton} disabled={busy} onClick={() => void save()}>{busy ? "SAVING…" : selected ? "SAVE CHANGES" : "CREATE AUCTION"}</button><button className={styles.secondaryButton} disabled={busy} onClick={closeEditor}>CANCEL</button>{selected && isSuperAdmin && <button className={styles.dangerButton} disabled={busy} onClick={() => void remove()}>DELETE AUCTION</button>}</div>
    </>}</section></div>
  </main>;
}
