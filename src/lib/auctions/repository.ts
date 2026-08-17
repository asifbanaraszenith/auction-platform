import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { Auction, CreateAuctionInput } from "@/lib/auctions/types";

function auctionsCollection() {
  return collection(getFirebaseDb(), "auctions");
}

function toAuction(id: string, data: DocumentData): Auction {
  return { id, ...(data as Omit<Auction, "id">) };
}

export async function createAuction(input: CreateAuctionInput): Promise<Auction> {
  const now = Timestamp.now();
  const reference = await addDoc(auctionsCollection(), {
    ...input,
    createdAt: now,
    updatedAt: now,
  });

  return { id: reference.id, ...input, createdAt: now, updatedAt: now };
}

export async function getAuction(auctionId: string): Promise<Auction | null> {
  const snapshot = await getDoc(doc(auctionsCollection(), auctionId));
  return snapshot.exists() ? toAuction(snapshot.id, snapshot.data()) : null;
}

export async function listAuctionsForUser(user: User): Promise<Auction[]> {
  const token = await user.getIdTokenResult();
  const isSuperAdmin = token.claims.superAdmin === true;
  const auctions = auctionsCollection();

  const snapshots = isSuperAdmin
    ? await getDocs(query(auctions, orderBy("updatedAt", "desc")))
    : await getDocs(
        query(
          auctions,
          where("adminIds", "array-contains", user.uid),
          orderBy("updatedAt", "desc"),
        ),
      );

  return snapshots.docs.map((snapshot) => toAuction(snapshot.id, snapshot.data()));
}

export async function updateAuction(
  auctionId: string,
  changes: Partial<Omit<Auction, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await updateDoc(doc(auctionsCollection(), auctionId), {
    ...changes,
    updatedAt: Timestamp.now(),
  });
}
