"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import styles from "../auctions/auctions.module.css";

type U = { uid: string; email: string; displayName: string; isAuctionAdmin: boolean; isBidder: boolean };

export default function AdminPage() {
  const { user, roles, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<U[]>([]);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [selectedBidderUids, setSelectedBidderUids] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adminPickerOpen, setAdminPickerOpen] = useState(false);
  const [bidderPickerOpen, setBidderPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const t = await user.getIdToken(true);
    const r = await fetch("/api/auction-admins", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const p = await r.json();
    if (!r.ok) throw new Error(p.error || "Unable to load users.");
    setUsers(p.users ?? []);
  }, [user]);

  useEffect(() => {
    if (!loading && user && roles.includes("superAdmin")) {
      const timer = window.setTimeout(() => void load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load users.")), 0);
      return () => window.clearTimeout(timer);
    }
  }, [loading, user, roles, load]);

  const availableUsers = useMemo(() => users.filter((u) => !u.isAuctionAdmin && !u.isBidder), [users]);
  const availableBidderUsers = useMemo(() => users.filter((u) => !u.isAuctionAdmin && !u.isBidder), [users]);


  async function setRoles(uids: string[], role: "auctionAdmin" | "bidder" | "viewer") {
    if (!user || uids.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const t = await user.getIdToken(true);
      for (const uid of uids) {
        const r = await fetch("/api/auction-admins", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ uid, role }),
        });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error || "Unable to update role.");
      }
      setSelectedUids([]);
      setSelectedBidderUids([]);
      setAdminPickerOpen(false);
      setBidderPickerOpen(false);
      await load();
      setNotice(role === "auctionAdmin" ? "Auction Admin access granted." : "Bidder access granted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update role.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className={styles.loading}>Loading…</main>;
  if (!user || !roles.includes("superAdmin")) return <main className={styles.shell}><h1>Access denied</h1></main>;

  const currentAdmins = users.filter((u) => u.isAuctionAdmin); const currentBidders = users.filter((u) => u.isBidder);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Administration</p>
        <h1>Platform administration</h1>
        <p className={styles.subtitle}>Super Admin controls global Auction Admin eligibility. Auction assignment happens inside each auction.</p>
      </div>
      <button className={styles.secondaryButton} onClick={() => router.push("/")}>Back</button>
    </header>
    {error && <div className={styles.error}>{error}</div>}
    {notice && <div className={styles.notice}>{notice}</div>}
    <section className={styles.editor}>
      <section className={styles.configSection}>
        <div className={styles.configHeader}>
          <div>
            <p className={styles.eyebrow}>Access control</p>
            <h2>Make an Auction Admin</h2>
            <p>Select a registered account from the dropdown. This only grants global eligibility; the person still must be assigned to individual auctions.</p>
          </div>
        </div>
        <div className={styles.formGrid}>
          <label>REGISTERED ACCOUNTS
            <div className={styles.adminPicker}>
              <button type="button" className={styles.adminPickerButton} onClick={() => setAdminPickerOpen((open) => !open)} aria-expanded={adminPickerOpen} disabled={busy}>
                <span>{selectedUids.length ? `${selectedUids.length} account${selectedUids.length === 1 ? "" : "s"} selected` : "Select accounts"}</span><span aria-hidden="true">⌄</span>
              </button>
              {adminPickerOpen && <div className={styles.adminPickerMenu}>{availableUsers.map((u) => <label key={u.uid} className={styles.adminPickerOption}><input type="checkbox" checked={selectedUids.includes(u.uid)} onChange={(e) => setSelectedUids((current) => e.target.checked ? [...current, u.uid] : current.filter((id) => id !== u.uid))}/><span><strong>{u.displayName || "Unnamed user"}</strong><small>{u.email}</small></span></label>)}</div>}
            </div>
          </label>
          <div className={styles.rowActions}>
            <button className={styles.primaryButton} disabled={!selectedUids.length || busy} onClick={() => void setRoles(selectedUids, "auctionAdmin")}>{busy ? "GRANTING…" : "MAKE AUCTION ADMIN"}</button>
          </div>
        </div>      </section>
      <section className={styles.configSection}>
        <div className={styles.configHeader}><div><p className={styles.eyebrow}>Bidder access</p><h2>Make a Bidder</h2><p>Grant bidder access to a registered account. The bidder can then be added to an auction and assigned to a team.</p></div></div>
        <div className={styles.formGrid}>
          <label>REGISTERED ACCOUNTS
            <div className={styles.adminPicker}>
              <button type="button" className={styles.adminPickerButton} onClick={() => setBidderPickerOpen((open) => !open)} aria-expanded={bidderPickerOpen} disabled={busy}>
                <span>{selectedBidderUids.length ? `${selectedBidderUids.length} account${selectedBidderUids.length === 1 ? "" : "s"} selected` : "Select accounts"}</span><span aria-hidden="true">⌄</span>
              </button>
              {bidderPickerOpen && <div className={styles.adminPickerMenu}>{availableBidderUsers.map((u) => <label key={u.uid} className={styles.adminPickerOption}><input type="checkbox" checked={selectedBidderUids.includes(u.uid)} onChange={(e) => setSelectedBidderUids((current) => e.target.checked ? [...current, u.uid] : current.filter((id) => id !== u.uid))}/><span><strong>{u.displayName || "Unnamed user"}</strong><small>{u.email}</small></span></label>)}</div>}
            </div>
          </label>
          <div className={styles.rowActions}><button className={styles.primaryButton} disabled={!selectedBidderUids.length || busy} onClick={() => void setRoles(selectedBidderUids, "bidder")}>{busy ? "GRANTING…" : "MAKE BIDDER"}</button></div>
        </div>      </section>
      <section className={styles.configSection}><div className={styles.configHeader}><div><p className={styles.eyebrow}>Current bidders</p><h2>Bidders</h2></div></div>{currentBidders.length===0?<div className={styles.empty}>No global bidders configured.</div>:<div className={styles.configList}>{currentBidders.map(u=><div className={styles.configRow} key={u.uid}><div><strong>{u.displayName||"Unnamed user"}</strong><small>{u.email}</small></div><button className={styles.iconDangerButton} aria-label={`Remove bidder ${u.displayName || u.email}`} title="Remove bidder" disabled={busy} onClick={()=>void setRoles([u.uid],"viewer")}>{busy?"…":"🗑"}</button></div>)}</div>}</section><section className={styles.configSection}>
        <div className={styles.configHeader}>
          <div>
            <p className={styles.eyebrow}>Current admins</p>
            <h2>Auction Admins</h2>
          </div>
        </div>
        {currentAdmins.length === 0 ? <div className={styles.empty}>No Auction Admins configured.</div> : <div className={styles.configList}>
          {currentAdmins.map((u) => <div className={styles.configRow} key={u.uid}>
            <div><strong>{u.displayName || "Unnamed user"}</strong><small>{u.email}</small></div>
            <button className={styles.iconDangerButton} aria-label={`Remove admin ${u.displayName || u.email}`} title="Remove admin" disabled={busy} onClick={() => void setRoles([u.uid], "viewer")}>{busy ? "…" : "🗑"}</button>
          </div>)}
        </div>}
      </section>
    </section>
  </main>;
}
