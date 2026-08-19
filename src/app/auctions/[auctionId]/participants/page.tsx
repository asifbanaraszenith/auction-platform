"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createAuctionCategory, createPlayer, listAuctionCategories, listAuctionParticipants, listPlayers, registerAuctionParticipant } from "@/lib/participants/repository";
import type { AuctionCategory, AuctionParticipant, Player } from "@/lib/auctions/types";
import styles from "../../auctions.module.css";

type Dialog = "category" | "participant" | null;

export default function AuctionParticipantsPage() {
  const { user, loading } = useAuth(); const router = useRouter(); const params = useParams<{ auctionId: string }>(); const auctionId = params.auctionId;
  const [players, setPlayers] = useState<Player[]>([]); const [categories, setCategories] = useState<AuctionCategory[]>([]); const [participants, setParticipants] = useState<AuctionParticipant[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null); const [participantMode, setParticipantMode] = useState<"existing" | "new">("existing");
  const [playerId, setPlayerId] = useState(""); const [categoryId, setCategoryId] = useState(""); const [newPlayer, setNewPlayer] = useState(""); const [expertise, setExpertise] = useState(""); const [photo, setPhoto] = useState<File | null>(null);
  const [categoryName, setCategoryName] = useState(""); const [categoryPrice, setCategoryPrice] = useState(""); const [minimumPrice, setMinimumPrice] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try { const [p, c, a] = await Promise.all([listPlayers(user), listAuctionCategories(user, auctionId), listAuctionParticipants(user, auctionId)]); setPlayers(p); setCategories(c.filter((item) => item.active)); setParticipants(a); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load auction configuration."); }
  }, [user, auctionId]);
  useEffect(() => { if (!loading && user) { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); } }, [loading, user, load]);

  function resetDialog() { setDialog(null); setParticipantMode("existing"); setPlayerId(""); setCategoryId(""); setNewPlayer(""); setExpertise(""); setPhoto(null); setCategoryName(""); setCategoryPrice(""); setMinimumPrice(""); setError(""); }
  function openCategoryDialog() { setError(""); setNotice(""); setDialog("category"); }
  function openParticipantDialog() { setError(""); setNotice(""); setDialog("participant"); setParticipantMode("existing"); }

  async function addCategory() {
    if (!user) return; const basePrice = Number(categoryPrice); const minPrice = Number(minimumPrice);
    if (!categoryName.trim() || !Number.isFinite(basePrice) || !Number.isFinite(minPrice)) { setError("Category name, base price and minimum base price are required."); return; }
    if (basePrice < 0 || minPrice < 0) { setError("Prices cannot be negative."); return; }
    if (minPrice > basePrice) { setError("Minimum base price cannot be greater than the base price."); return; }
    setBusy(true); setError("");
    try { await createAuctionCategory(user, auctionId, { name: categoryName.trim(), defaultBasePrice: basePrice, minimumBasePrice: minPrice }); await load(); resetDialog(); setNotice("Category added to this auction."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create category."); } finally { setBusy(false); }
  }

  async function createNewParticipant() {
    if (!user) return; if (!newPlayer.trim() || !expertise.trim()) { setError("Participant name and expertise are required."); return; }
    setBusy(true); setError("");
    try { const created = await createPlayer(user, { displayName: newPlayer.trim(), expertise: expertise.trim(), photo }); setPlayers((current) => [...current, created].sort((a, b) => a.displayName.localeCompare(b.displayName))); setPlayerId(created.id); setParticipantMode("existing"); setNewPlayer(""); setExpertise(""); setPhoto(null); setNotice("Participant created. Select a category and add them to this auction."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create participant."); } finally { setBusy(false); }
  }

  async function addParticipant() {
    if (!user || !playerId || !categoryId) { setError("Select a participant and a category."); return; }
    setBusy(true); setError("");
    try { await registerAuctionParticipant(user, auctionId, { playerId, categoryId }); await load(); resetDialog(); setNotice("Participant added to this auction."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to add participant to this auction."); } finally { setBusy(false); }
  }

  if (loading || !user) return <main className={styles.loading}>Loading auction configuration…</main>;
  return <main className={styles.shell}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Auction Platform / Auction Setup</p><h1>Auction Configuration</h1><p className={styles.subtitle}>Set up the auction in order: categories and their price rules first, then participants. Layout and visual settings remain secondary.</p></div><div className={styles.headerActions}><button className={styles.secondaryButton} onClick={() => router.push("/auctions")}>Back</button></div></header>
    <section className={styles.editor}>
      {error && !dialog && <div className={styles.error} role="alert">{error}</div>}{notice && <div className={styles.notice} role="status">{notice}</div>}

      <section className={styles.configSection}>
        <div className={styles.configHeader}><div><p className={styles.eyebrow}>Step 1</p><h2>Categories</h2><p>Categories belong to this auction. Define the base price and the minimum base price before adding participants.</p></div><button className={styles.iconButton} aria-label="Add category" title="Add category" onClick={openCategoryDialog}>+</button></div>
        {categories.length === 0 ? <div className={styles.empty}>No categories added. Use <strong>+</strong> to create the first category.</div> : <div className={styles.configList}>{categories.map((category) => <div key={category.id} className={styles.configRow}><div><strong>{category.name}</strong><small>Base price: {category.defaultBasePrice} points · Minimum: {category.minimumBasePrice} points</small></div></div>)}</div>}
      </section>

      <section className={styles.configSection}>
        <div className={styles.configHeader}><div><p className={styles.eyebrow}>Step 2</p><h2>Participants</h2><p>Add registered participants to this auction. You can select an existing participant or create one ad hoc.</p></div><button className={styles.iconButton} aria-label="Add participant" title="Add participant" disabled={categories.length === 0} onClick={openParticipantDialog}>+</button></div>
        {categories.length === 0 ? <div className={styles.empty}>Add at least one category before adding participants.</div> : participants.length === 0 ? <div className={styles.empty}>No participants added to this auction. Use <strong>+</strong> to add one.</div> : <div className={styles.configList}>{participants.map((participant) => <div key={participant.id} className={styles.configRow}><div className={styles.participantIdentity}>{players.find((player) => player.id === participant.playerId)?.photoUrl ? <img src={players.find((player) => player.id === participant.playerId)?.photoUrl} alt="" /> : <span className={styles.avatarPlaceholder}>{participant.playerName.slice(0, 1).toUpperCase()}</span>}<span><strong>{participant.playerName}</strong><small>{players.find((player) => player.id === participant.playerId)?.expertise || participant.categoryName}</small></span></div><div className={styles.participantMeta}><span>{participant.categoryName}</span><small>Base {participant.basePrice} · Min {participant.minimumBasePrice}</small></div></div>)}</div>}
      </section>

      {dialog && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) resetDialog(); }}><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="auction-dialog-title">
        {dialog === "category" ? <><div className={styles.dialogHeader}><div><p className={styles.eyebrow}>Add category</p><h2 id="auction-dialog-title">Category</h2></div><button className={styles.closeButton} onClick={resetDialog} disabled={busy}>×</button></div><div className={styles.formGrid}><label>CATEGORY NAME<input autoFocus value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Platinum" /></label><label>BASE PRICE<input type="number" min="0" step="1" value={categoryPrice} onChange={(e) => setCategoryPrice(e.target.value)} placeholder="10" /></label><label>MINIMUM BASE PRICE<input type="number" min="0" step="1" value={minimumPrice} onChange={(e) => setMinimumPrice(e.target.value)} placeholder="5" /></label></div>{error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.dialogActions}><button className={styles.secondaryButton} onClick={resetDialog} disabled={busy}>Cancel</button><button className={styles.primaryButton} onClick={addCategory} disabled={busy}>{busy ? "ADDING…" : "ADD CATEGORY"}</button></div></>
        : <><div className={styles.dialogHeader}><div><p className={styles.eyebrow}>Add participant</p><h2 id="auction-dialog-title">Participant</h2></div><button className={styles.closeButton} onClick={resetDialog} disabled={busy}>×</button></div><div className={styles.dialogTabs}><button className={participantMode === "existing" ? styles.tabActive : styles.tab} onClick={() => setParticipantMode("existing")}>Existing participant</button><button className={participantMode === "new" ? styles.tabActive : styles.tab} onClick={() => setParticipantMode("new")}>Create new participant</button></div>{participantMode === "existing" ? <label>PARTICIPANT<select autoFocus value={playerId} onChange={(e) => setPlayerId(e.target.value)}><option value="">Select participant</option>{players.map((player) => <option key={player.id} value={player.id}>{player.displayName}{player.expertise ? ` — ${player.expertise}` : ""}</option>)}</select></label> : <div className={styles.formGrid}><label>NAME<input autoFocus value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} placeholder="Participant name" /></label><label>EXPERTISE<input value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="Batter, Bowler, All-rounder…" /></label><label className={styles.full}>PICTURE<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label><div className={styles.full}><button className={styles.secondaryButton} disabled={busy} onClick={createNewParticipant}>{busy ? "CREATING…" : "CREATE PARTICIPANT"}</button></div></div>}{participantMode === "existing" && <label className={styles.dialogField}>CATEGORY<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name} — {category.defaultBasePrice} / min {category.minimumBasePrice}</option>)}</select></label>}{participantMode === "new" && playerId && <label className={styles.dialogField}>CATEGORY<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name} — {category.defaultBasePrice} / min {category.minimumBasePrice}</option>)}</select></label>}{error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.dialogActions}><button className={styles.secondaryButton} onClick={resetDialog} disabled={busy}>Cancel</button>{playerId && categoryId && <button className={styles.primaryButton} onClick={addParticipant} disabled={busy}>{busy ? "ADDING…" : "ADD TO AUCTION"}</button>}</div></>}
      </div></div>}
    </section>
  </main>;
}
