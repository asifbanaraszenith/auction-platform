"use client";

import { useEffect, useState } from "react";
import { deleteAuction } from "@/lib/auctions/repository";
import { useAuth } from "@/components/auth-provider";

export function AuctionDeleteGuard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [auctionName, setAuctionName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!window.location.pathname.startsWith("/auctions")) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || button.textContent?.trim().toUpperCase() !== "DELETE AUCTION") return;

      event.preventDefault();
      event.stopPropagation();
      setAuctionName(document.querySelector("main h2")?.textContent?.trim() || "this auction");
      setError("");
      setOpen(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!open) return null;

  async function confirmDelete() {
    if (!user) {
      setError("Authentication required. Please sign in again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/auctions", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to load auctions.");

      const matches = Array.isArray(payload.auctions)
        ? payload.auctions.filter((auction: { name?: unknown }) => auction.name === auctionName)
        : [];
      if (matches.length === 0) throw new Error("Auction could not be found. Please refresh and try again.");
      if (matches.length > 1) throw new Error("Multiple auctions have this name. Please refresh and select the auction again.");

      await deleteAuction(String(matches[0].id));
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete auction.");
      setBusy(false);
    }
  }

  return (
    <div className="auctionDeleteOverlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="auctionDeleteDialog" role="alertdialog" aria-modal="true" aria-labelledby="auction-delete-title">
        <p className="auctionDeleteEyebrow">DELETE AUCTION</p>
        <h2 id="auction-delete-title">Delete this auction?</h2>
        <p className="auctionDeleteMessage">
          You are about to delete <strong>“{auctionName}”</strong>.
        </p>
        <p className="auctionDeleteWarning">This action cannot be undone.</p>
        {error ? <p className="auctionDeleteError">{error}</p> : null}
        <div className="auctionDeleteActions">
          <button type="button" className="auctionDeleteCancel" disabled={busy} onClick={() => setOpen(false)}>CANCEL</button>
          <button type="button" className="auctionDeleteConfirm" disabled={busy} onClick={() => void confirmDelete()}>{busy ? "DELETING…" : "DELETE"}</button>
        </div>
      </section>
    </div>
  );
}
