"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import styles from "../auctions/auctions.module.css";

type U = { uid: string; email: string; displayName: string; isAuctionAdmin: boolean };

export default function AdminPage() {
  const { user, roles, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<U[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const availableUsers = useMemo(() => users.filter((u) => !u.isAuctionAdmin), [users]);
  const selectedUser = users.find((u) => u.uid === selectedUid) ?? null;

  async function setAdmin(uid: string, isAuctionAdmin: boolean) {
    if (!user || !uid) return;
    setBusy(uid);
    setError("");
    setNotice("");
    try {
      const t = await user.getIdToken(true);
      const r = await fetch("/api/auction-admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ uid, isAuctionAdmin }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || "Unable to update role.");
      setSelectedUid("");
      await load();
      setNotice(isAuctionAdmin ? "Auction Admin access granted." : "Auction Admin access removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update role.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <main className={styles.loading}>Loading…</main>;
  if (!user || !roles.includes("superAdmin")) return <main className={styles.shell}><h1>Access denied</h1></main>;

  const currentAdmins = users.filter((u) => u.isAuctionAdmin);

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
          <label>REGISTERED ACCOUNT
            <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)}>
              <option value="">Select account</option>
              {availableUsers.map((u) => <option key={u.uid} value={u.uid}>{u.displayName || "Unnamed user"} — {u.email}</option>)}
            </select>
          </label>
          <div className={styles.rowActions}>
            <button className={styles.primaryButton} disabled={!selectedUser || busy === selectedUid} onClick={() => void setAdmin(selectedUid, true)}>
              {busy === selectedUid ? "SAVING…" : "MAKE AUCTION ADMIN"}
            </button>
          </div>
        </div>
      </section>
      <section className={styles.configSection}>
        <div className={styles.configHeader}>
          <div>
            <p className={styles.eyebrow}>Current admins</p>
            <h2>Auction Admins</h2>
          </div>
        </div>
        {currentAdmins.length === 0 ? <div className={styles.empty}>No Auction Admins configured.</div> : <div className={styles.configList}>
          {currentAdmins.map((u) => <div className={styles.configRow} key={u.uid}>
            <div><strong>{u.displayName || "Unnamed user"}</strong><small>{u.email}</small></div>
            <button className={styles.dangerButton} disabled={busy === u.uid} onClick={() => void setAdmin(u.uid, false)}>{busy === u.uid ? "SAVING…" : "REMOVE ADMIN"}</button>
          </div>)}
        </div>}
      </section>
    </section>
  </main>;
}
