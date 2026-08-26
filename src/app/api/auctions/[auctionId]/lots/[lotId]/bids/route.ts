import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function app() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }

async function authenticate(request: Request, auctionId: string) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const firebase = app();
  const decoded = await getAuth(firebase).verifyIdToken(header.slice(7), true);
  const db = getFirestore(firebase);
  const auction = await db.collection("auctions").doc(auctionId).get();
  if (!auction.exists) throw new Error("AUCTION_NOT_FOUND");
  return { db, auction, decoded };
}

function fail(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "AUCTION_NOT_FOUND" ? 404 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : 500;
  return NextResponse.json({ error: status === 401 ? "Authentication required." : status === 404 ? "Auction not found." : status === 403 ? "You are not eligible to bid in this auction." : fallback }, { status });
}

function validMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && Math.round(amount * 100) === amount * 100 ? amount : null;
}

export async function GET(request: Request, context: { params: Promise<{ auctionId: string; lotId: string }> }) {
  try {
    const { auctionId, lotId } = await context.params;
    const { db, auction } = await authenticate(request, auctionId);
    const lot = await auction.ref.collection("lots").doc(lotId).get();
    if (!lot.exists) return NextResponse.json({ error: "Lot not found." }, { status: 404 });
    const bids = await lot.ref.collection("bids").orderBy("sequence", "desc").limit(50).get();
    return NextResponse.json({
      lot: { id: lot.id, ...lot.data(), currentBid: Number(lot.data()?.currentBid ?? 0) },
      bids: bids.docs.map((doc) => ({ id: doc.id, ...doc.data(), amount: Number(doc.data().amount ?? 0), createdAtMillis: doc.data().createdAt?.toMillis?.() ?? 0 })),
      viewer: { uid: (await authenticate(request, auctionId)).decoded.uid },
    });
  } catch (error) { return fail(error, "Unable to load live bidding state."); }
}

export async function POST(request: Request, context: { params: Promise<{ auctionId: string; lotId: string }> }) {
  try {
    const { auctionId, lotId } = await context.params;
    const { db, auction, decoded } = await authenticate(request, auctionId);
    const body = await request.json();
    const amount = validMoney(body.amount);
    if (amount === null || amount <= 0) return NextResponse.json({ error: "Bid amount must be a positive amount with no more than two decimal places." }, { status: 400 });

    const auctionData = auction.data()!;
    if (auctionData.status !== "live") return NextResponse.json({ error: "Bidding is only available while the auction is live." }, { status: 409 });

    const bidderQuery = await auction.ref.collection("bidders").where("userId", "==", decoded.uid).limit(1).get();
    if (bidderQuery.empty) throw new Error("INSUFFICIENT_PERMISSIONS");
    const bidderRef = bidderQuery.docs[0].ref;
    const lotRef = auction.ref.collection("lots").doc(lotId);
    const bidRef = lotRef.collection("bids").doc();

    const result = await db.runTransaction(async (transaction) => {
      const [lotSnapshot, bidderSnapshot] = await Promise.all([transaction.get(lotRef), transaction.get(bidderRef)]);
      if (!lotSnapshot.exists) throw new Error("LOT_NOT_FOUND");
      if (!bidderSnapshot.exists) throw new Error("BIDDER_NOT_FOUND");
      const lot = lotSnapshot.data()!;
      const bidder = bidderSnapshot.data()!;
      if (lot.status !== "live") throw new Error("LOT_NOT_LIVE");
      if (bidder.status !== "active") throw new Error("BIDDER_INACTIVE");

      const currentBid = Number(lot.currentBid ?? 0);
      const startingBid = Number(lot.startingBid ?? 0);
      const increment = Number(lot.bidIncrement ?? 1);
      const minimum = currentBid > 0 ? currentBid + increment : startingBid;
      if (amount < minimum) throw new Error(`BID_TOO_LOW:${minimum}`);

      const initialPurse = Number(bidder.initialPurse ?? 0);
      const spentPurse = Number(bidder.spentPurse ?? 0);
      const availablePurse = initialPurse - spentPurse;
      if (amount > availablePurse) throw new Error(`PURSE_EXCEEDED:${availablePurse}`);

      const sequence = Number(lot.bidSequence ?? 0) + 1;
      const now = Timestamp.now();
      transaction.create(bidRef, { bidderId: bidderRef.id, bidderUserId: decoded.uid, bidderName: bidder.displayName ?? "", amount, sequence, createdAt: now });
      transaction.update(lotRef, { currentBid: amount, currentBidderId: bidderRef.id, currentBidderUserId: decoded.uid, bidSequence: sequence, updatedAt: now });
      return { id: bidRef.id, amount, sequence, bidderId: bidderRef.id, bidderName: bidder.displayName ?? "" };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to place bid.";
    if (message === "LOT_NOT_FOUND") return NextResponse.json({ error: "Lot not found." }, { status: 404 });
    if (message === "BIDDER_NOT_FOUND" || message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "You are not eligible to bid in this auction." }, { status: 403 });
    if (message === "LOT_NOT_LIVE") return NextResponse.json({ error: "This lot is not currently live." }, { status: 409 });
    if (message === "BIDDER_INACTIVE") return NextResponse.json({ error: "Your bidder account is inactive." }, { status: 403 });
    if (message.startsWith("BID_TOO_LOW:")) return NextResponse.json({ error: `Bid must be at least ${message.split(":")[1]}.` }, { status: 409 });
    if (message.startsWith("PURSE_EXCEEDED:")) return NextResponse.json({ error: `Bid exceeds your available purse of ${message.split(":")[1]}.` }, { status: 409 });
    return fail(error, "Unable to place bid.");
  }
}
