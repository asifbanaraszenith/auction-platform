import { Timestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { AuctionCategory, AuctionParticipant, Player } from "@/lib/auctions/types";

async function token(user?: User) {
  const current = user ?? getFirebaseAuth().currentUser;
  if (!current) throw new Error("Authentication required.");
  return current.getIdToken(true);
}

export async function listPlayers(user: User): Promise<Player[]> {
  const response = await fetch("/api/players", { headers: { Authorization: `Bearer ${await token(user)}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load players.");
  return (payload.players ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id), displayName: String(item.displayName ?? ""), createdBy: String(item.createdBy ?? ""),
    createdAt: Timestamp.fromMillis(Number(item.createdAtMillis)), updatedAt: Timestamp.fromMillis(Number(item.updatedAtMillis)),
  }));
}

export async function createPlayer(user: User, displayName: string): Promise<Player> {
  const response = await fetch("/api/players", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(user)}` }, body: JSON.stringify({ displayName }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to create player.");
  return { id: payload.id, displayName: payload.displayName, createdBy: payload.createdBy, createdAt: Timestamp.fromMillis(payload.createdAtMillis), updatedAt: Timestamp.fromMillis(payload.updatedAtMillis) };
}

export async function listAuctionCategories(user: User, auctionId: string): Promise<AuctionCategory[]> {
  const response = await fetch(`/api/auctions/${auctionId}/participants`, { headers: { Authorization: `Bearer ${await token(user)}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load auction participants.");
  return (payload.categories ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id), name: String(item.name ?? ""), defaultBasePrice: Number(item.defaultBasePrice ?? 0), sortOrder: Number(item.sortOrder ?? 0), active: item.active !== false,
    createdAt: Timestamp.fromMillis(Number(item.createdAtMillis)), updatedAt: Timestamp.fromMillis(Number(item.updatedAtMillis)),
  }));
}

export async function listAuctionParticipants(user: User, auctionId: string): Promise<AuctionParticipant[]> {
  const response = await fetch(`/api/auctions/${auctionId}/participants`, { headers: { Authorization: `Bearer ${await token(user)}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load auction participants.");
  return (payload.participants ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id), playerId: String(item.playerId), playerName: String(item.playerName ?? ""), categoryId: String(item.categoryId), categoryName: String(item.categoryName ?? ""), basePrice: Number(item.basePrice ?? 0), status: item.status,
    createdAt: Timestamp.fromMillis(Number(item.createdAtMillis)), updatedAt: Timestamp.fromMillis(Number(item.updatedAtMillis)),
  })) as AuctionParticipant[];
}

export async function createAuctionCategory(user: User, auctionId: string, input: { name: string; defaultBasePrice: number }): Promise<void> {
  const response = await fetch(`/api/auctions/${auctionId}/participants`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(user)}` }, body: JSON.stringify({ type: "category", ...input }) });
  const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Unable to create category.");
}

export async function registerAuctionParticipant(user: User, auctionId: string, input: { playerId: string; categoryId: string; basePrice?: number }): Promise<void> {
  const response = await fetch(`/api/auctions/${auctionId}/participants`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(user)}` }, body: JSON.stringify({ type: "participant", ...input }) });
  const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Unable to add participant to auction.");
}
