import { Timestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { AuctionBidder } from "@/lib/auctions/types";

export type AvailableBidder = { userId: string; displayName: string; email: string };

async function token(user?: User) {
  const current = user ?? getFirebaseAuth().currentUser;
  if (!current) throw new Error("Authentication required.");
  return current.getIdToken(true);
}

function mapBidder(item: Record<string, unknown>): AuctionBidder {
  return {
    id: String(item.id),
    userId: String(item.userId),
    displayName: String(item.displayName ?? ""),
    initialPurse: Number(item.initialPurse ?? 0),
    status: item.status === "inactive" ? "inactive" : "active",
    createdAt: Timestamp.fromMillis(Number(item.createdAtMillis ?? 0)),
    updatedAt: Timestamp.fromMillis(Number(item.updatedAtMillis ?? 0)),
  };
}

export async function listAuctionBidders(user: User, auctionId: string): Promise<{ bidders: AuctionBidder[]; availableUsers: AvailableBidder[] }> {
  const response = await fetch(`/api/auctions/${auctionId}/bidders`, { headers: { Authorization: `Bearer ${await token(user)}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load auction bidders.");
  return {
    bidders: (payload.bidders ?? []).map((item: Record<string, unknown>) => mapBidder(item)),
    availableUsers: (payload.availableUsers ?? []).map((item: Record<string, unknown>) => ({ userId: String(item.userId), displayName: String(item.displayName ?? ""), email: String(item.email ?? "") })),
  };
}

export async function addAuctionBidder(user: User, auctionId: string, input: { userId: string; initialPurse: number }): Promise<void> {
  const response = await fetch(`/api/auctions/${auctionId}/bidders`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(user)}` }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to add bidder to this auction.");
}

export async function updateAuctionBidder(user: User, auctionId: string, bidderId: string, input: { initialPurse?: number; status?: "active" | "inactive" }): Promise<void> {
  const response = await fetch(`/api/auctions/${auctionId}/bidders`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(user)}` }, body: JSON.stringify({ bidderId, ...input }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to update auction bidder.");
}

export async function removeAuctionBidder(user: User, auctionId: string, bidderId: string): Promise<void> {
  const response = await fetch(`/api/auctions/${auctionId}/bidders?bidderId=${encodeURIComponent(bidderId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${await token(user)}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to remove bidder from this auction.");
}
