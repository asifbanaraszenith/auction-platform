"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import styles from "./auctions.module.css";

type Candidate = { userId: string; displayName: string; email: string; role: string; assigned: boolean; initialPurse: number; status: string };
type Props = { user: User; auctionId: string };

export function AuctionBiddersSection({ user, auctionId }: Props) {
  const [users, setUsers] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/auctions/${auctionId}/bidders`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to load bidders.");
      const list = (payload.users ?? []) as Candidate[];
      setUsers(list);
      setSelected(Object.fromEntries(list.filter((item) => item.assigned).map((item) => [item.userId, item.initialPurse])));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load bidders."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [auctionId, user]);

  function toggle(userId: string, checked: boolean) {
    setSelected((current) => {
      if (checked) return { ...current, [userId]: current[userId] ?? 0 };
      const next = { ...current }; delete next[userId]; return next;
    });
  }

  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/auctions/${auctionId}/bidders`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ bidders: Object.entries(selected).map(([userId, initialPurse]) => ({ userId, initialPurse })) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to save bidders.");
      setNotice("Auction bidders updated successfully.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save bidders."); }
    finally { setBusy(false); }
  }

  return <section className={styles.configSection}>
    <div className={styles.configHeader}>
      <div><p className={styles.eyebrow}>Auction setup</p><h2>Bidders</h2><p>Assign users to act as bidders for this auction. The assignment is auction-specific, so a participant can be a bidder in one league without changing their global role.</p></div>
    </div>
    {error && <div className={styles.error}>{error}</div>}
    {notice && <div className={styles.notice}>{notice}</div>}
    {loading ? <div className={styles.empty}>Loading registered users…</div> : users.length === 0 ? <div className={styles.empty}>No eligible registered users are available.</div> : <div className={styles.bidderList}>
      {users.map((item) => <label className={styles.bidderOption} key={item.userId}>
        <input type="checkbox" checked={item.userId in selected} onChange={(event) => toggle(item.userId, event.target.checked)} />
        <span className={styles.bidderIdentity}><strong>{item.displayName || "Unnamed user"}</strong><small>{item.email} · {item.role}</small></span>
        {item.userId in selected && <span className={styles.bidderPurse}><small>INITIAL PURSE</small><input type="number" min="0" value={selected[item.userId] ?? 0} onChange={(event) => setSelected((current) => ({ ...current, [item.userId]: Number(event.target.value) }))} onClick={(event) => event.stopPropagation()} /></span>}
      </label>)}
    </div>}
    <button className={styles.primaryButton} disabled={busy || loading} onClick={() => void save()}>{busy ? "SAVING…" : "SAVE BIDDERS"}</button>
  </section>;
}
