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
    <>
      <style>{`
        .auctionDeleteOverlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.68);backdrop-filter:blur(4px)}
        .auctionDeleteDialog{width:min(520px,100%);border:1px solid #4a463c;background:#121210;color:#f5f2e9;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:32px}
        .auctionDeleteEyebrow{margin:0 0 10px;color:#c7a45b;font-size:12px;letter-spacing:.22em;font-weight:600}
        .auctionDeleteDialog h2{margin:0 0 18px;font-family:Georgia,serif;font-size:34px;font-weight:400;line-height:1.1}
        .auctionDeleteMessage{margin:0;color:#d5d0c4;font-size:17px;line-height:1.55}
        .auctionDeleteWarning{margin:8px 0 0;color:#aaa69a;font-size:14px}
        .auctionDeleteError{margin:20px 0 0;padding:12px 14px;border:1px solid #713d42;background:#351a1d;color:#f0b7bc;font-size:14px}
        .auctionDeleteActions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:28px}
        .auctionDeleteActions button{min-height:52px;border:1px solid #514d43;font:inherit;font-size:14px;letter-spacing:.12em;cursor:pointer}
        .auctionDeleteCancel{background:transparent;color:#f5f2e9}
        .auctionDeleteConfirm{background:#8e1f25;color:#fff;border-color:#a94a50!important}
        .auctionDeleteActions button:disabled{opacity:.55;cursor:wait}
        @media(max-width:520px){.auctionDeleteDialog{padding:24px}.auctionDeleteDialog h2{font-size:29px}}
      `}</style>
      <div className="auctionDeleteOverlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
        <section className="auctionDeleteDialog" role="alertdialog" aria-modal="true" aria-labelledby="auction-delete-title">
          <p className="auctionDeleteEyebrow">DELETE AUCTION</p>
          <h2 id="auction-delete-title">Delete this auction?</h2>
          <p className="auctionDeleteMessage">You are about to delete <strong>“{auctionName}”</strong>.</p>
          <p className="auctionDeleteWarning">This action cannot be undone.</p>
          {error ? <p className="auctionDeleteError">{error}</p> : null}
          <div className="auctionDeleteActions">
            <button type="button" className="auctionDeleteCancel" disabled={busy} onClick={() => setOpen(false)}>CANCEL</button>
            <button type="button" className="auctionDeleteConfirm" disabled={busy} onClick={() => void confirmDelete()}>{busy ? "DELETING…" : "DELETE"}</button>
          </div>
        </section>
      </div>
    </>
  );
}
