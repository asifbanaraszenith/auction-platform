"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { addAuctionBidder, listAuctionBidders, removeAuctionBidder, type AvailableBidder } from "@/lib/auctions/bidders";
import type { AuctionBidder } from "@/lib/auctions/types";
import styles from "../../auctions.module.css";

export default function AuctionBiddersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ auctionId: string }>();
  const auctionId = params.auctionId;
  const [bidders, setBidders] = useState<AuctionBidder[]>([]);
  const [available, setAvailable] = useState<AvailableBidder[]>([]);
  const [userId, setUserId] = useState("");
  const [purse, setPurse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const result = await listAuctionBidders(user, auctionId);
      setBidders(result.bidders);
      setAvailable(result.availableUsers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load bidders.");
    }
  }, [user, auctionId]);

  useEffect(() => {
    if (!loading && user) void load();
  }, [loading, user, load]);

  async function add() {
    if (!user || !userId) { setError("Select a registered bidder."); return; }
    const value = Number(purse);
    if (!Number.isFinite(value) || value < 0) { setError("Initial purse must be a non-negative number."); return; }
    setBusy(true); setError("");
    try {
      await addAuctionBidder(user, auctionId, { userId, initialPurse: value });
      setUserId(""); setPurse(""); await load(); setNotice("Bidder added to this auction.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add bidder."); }
    finally { setBusy(false); }
  }

  async function remove(bidder: AuctionBidder) {
    if (!user || !window.confirm(`Remove ${bidder.displayName} from this auction?`)) return;
    setBusy(true); setError("");
    try { await removeAuctionBidder(user, auctionId, bidder.id); await load(); setNotice("Bidder removed from this auction."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to remove bidder."); }
    finally { setBusy(false); }
  }

  if (loading || !user) return <main className={styles.loading}>Loading bidders…</main>;
  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Auction Platform / Auction Setup</p><h1>Bidder Purses</h1><p className={styles.subtitle}>Assign registered bidder accounts to this auction and define their auction-specific starting purse in points.</p></div>
      <div className={styles.headerActions}><button className={styles.secondaryButton} onClick={() => router.push("/auctions")}>Back</button></div>
    </header>
    <section className={styles.editor}>
      {error && <div className={styles.error} role="alert">{error}</div>}{notice && <div className={styles.notice} role="status">{notice}</div>}
      <section className={styles.configSection}>
        <div className={styles.configHeader}><div><p className={styles.eyebrow}>Auction setup</p><h2>Bidder / Team Purses</h2><p>The purse belongs to this auction assignment. It is not stored on the global user or participant profile.</p></div></div>
        <div className={styles.formGrid} style={{ marginTop: 20 }}>
          <label>BIDDER ACCOUNT<select value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Select registered bidder</option>{available.map((item) => <option key={item.userId} value={item.userId}>{item.displayName}{item.email ? ` — ${item.email}` : ""}</option>)}</select></label>
          <label>INITIAL PURSE<input type="number" min="0" step="1" value={purse} onChange={(e) => setPurse(e.target.value)} placeholder="1000" /></label>
          <div style={{ display: "flex", alignItems: "end" }}><button className={styles.primaryButton} style={{ width: "100%" }} onClick={add} disabled={busy || !userId}>{busy ? "ADDING…" : "ADD BIDDER"}</button></div>
        </div>
      </section>
      <section className={styles.configSection}>
        <div className={styles.configHeader}><div><p className={styles.eyebrow}>Registered in this auction</p><h2>Bidders</h2></div></div>
        {bidders.length === 0 ? <div className={styles.empty}>No bidders assigned to this auction yet.</div> : <div className={styles.configList}>{bidders.map((bidder) => <div key={bidder.id} className={styles.configRow}><div><strong>{bidder.displayName}</strong><small>{bidder.status === "active" ? "Active" : "Inactive"} · Initial purse: {bidder.initialPurse} points</small></div><button className={styles.dangerButton} onClick={() => void remove(bidder)} disabled={busy}>REMOVE</button></div>)}</div>}
      </section>
    </section>
  </main>;
}
