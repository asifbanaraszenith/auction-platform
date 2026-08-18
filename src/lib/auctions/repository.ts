import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import type { Auction, CreateAuctionInput } from "@/lib/auctions/types";

function auctionsCollection() {
  return collection(getFirebaseDb(), "auctions");
}

function toAuction(id: string, data: DocumentData): Auction {
  return { id, ...(data as Omit<Auction, "id">) };
}

export async function createAuction(input: CreateAuctionInput): Promise<Auction> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Authentication required.");

  const token = await user.getIdToken(true);
  const response = await fetch("/api/auctions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...input,
      startAtMillis: input.startAt?.toMillis() ?? null,
      endAtMillis: input.endAt?.toMillis() ?? null,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to create auction.");

  return {
    id: payload.id,
    name: payload.name,
    description: payload.description,
    ownerId: payload.ownerId,
    adminIds: payload.adminIds,
    status: payload.status,
    startAt: Timestamp.fromMillis(payload.startAtMillis),
    endAt: Timestamp.fromMillis(payload.endAtMillis),
    settings: payload.settings,
    createdAt: Timestamp.fromMillis(payload.createdAtMillis),
    updatedAt: Timestamp.fromMillis(payload.updatedAtMillis),
  };
}

export async function getAuction(auctionId: string): Promise<Auction | null> {
  const snapshot = await getDoc(doc(auctionsCollection(), auctionId));
  return snapshot.exists() ? toAuction(snapshot.id, snapshot.data()) : null;
}

export async function listAuctionsForUser(user: User): Promise<Auction[]> {
  const token = await user.getIdToken(true);
  const response = await fetch("/api/auctions", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load auctions.");

  return (payload.auctions ?? []).map((auction: Record<string, unknown>) => ({
    id: String(auction.id),
    name: String(auction.name ?? ""),
    description: String(auction.description ?? ""),
    ownerId: String(auction.ownerId ?? ""),
    adminIds: Array.isArray(auction.adminIds) ? auction.adminIds.map(String) : [],
    status: auction.status,
    startAt: typeof auction.startAtMillis === "number" ? Timestamp.fromMillis(auction.startAtMillis) : null,
    endAt: typeof auction.endAtMillis === "number" ? Timestamp.fromMillis(auction.endAtMillis) : null,
    settings: auction.settings,
    createdAt: Timestamp.fromMillis(Number(auction.createdAtMillis)),
    updatedAt: Timestamp.fromMillis(Number(auction.updatedAtMillis)),
  })) as Auction[];
}

export async function updateAuction(
  auctionId: string,
  changes: Partial<Omit<Auction, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Authentication required.");

  const token = await user.getIdToken(true);
  const response = await fetch("/api/auctions", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      auctionId,
      name: changes.name,
      description: changes.description,
      status: changes.status,
      startAtMillis: changes.startAt?.toMillis() ?? null,
      endAtMillis: changes.endAt?.toMillis() ?? null,
      settings: changes.settings,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to update auction.");
}

export async function deleteAuction(auctionId: string): Promise<void> {
  await deleteDoc(doc(auctionsCollection(), auctionId));
}
