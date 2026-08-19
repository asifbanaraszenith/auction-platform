import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault() });
}

async function authorize(request: Request, auctionId: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp();
  const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true);
  const db = getFirestore(app);
  const auction = await db.collection("auctions").doc(auctionId).get();
  if (!auction.exists) throw new Error("AUCTION_NOT_FOUND");
  const data = auction.data()!;
  const isSuperAdmin = decoded.superAdmin === true;
  const isAuctionAdmin = Array.isArray(data.adminIds) && data.adminIds.includes(decoded.uid);
  if (!isSuperAdmin && !isAuctionAdmin) throw new Error("INSUFFICIENT_PERMISSIONS");
  return { db, auction, uid: decoded.uid };
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : message === "AUCTION_NOT_FOUND" ? 404 : 500;
  const publicMessage = message === "AUTHENTICATION_REQUIRED" ? "Authentication required." : message === "INSUFFICIENT_PERMISSIONS" ? "You are not assigned to this auction." : message === "AUCTION_NOT_FOUND" ? "Auction not found." : fallback;
  return NextResponse.json({ error: publicMessage }, { status });
}

export async function GET(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  try {
    const auctionId = (await context.params).auctionId;
    const { db } = await authorize(request, auctionId);
    const auctionRef = db.collection("auctions").doc(auctionId);
    const [bidderSnapshot, usersSnapshot] = await Promise.all([
      auctionRef.collection("bidders").orderBy("createdAt").get(),
      db.collection("users").where("role", "==", "bidder").get(),
    ]);
    const bidders = bidderSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        displayName: data.displayName,
        initialPurse: Number(data.initialPurse ?? 0),
        status: data.status ?? "active",
        createdAtMillis: data.createdAt?.toMillis?.() ?? 0,
        updatedAtMillis: data.updatedAt?.toMillis?.() ?? 0,
      };
    });
    const assignedIds = new Set(bidders.map((bidder) => bidder.userId));
    const availableUsers = usersSnapshot.docs
      .filter((doc) => !assignedIds.has(doc.id))
      .map((doc) => ({
        userId: doc.id,
        displayName: String(doc.data().displayName ?? doc.data().name ?? ""),
        email: String(doc.data().email ?? ""),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ bidders, availableUsers });
  } catch (error) {
    return errorResponse(error, "Unable to load auction bidders.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  try {
    const auctionId = (await context.params).auctionId;
    const { db, uid } = await authorize(request, auctionId);
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const initialPurse = Number(body.initialPurse);
    if (!userId) return NextResponse.json({ error: "Bidder is required." }, { status: 400 });
    if (!Number.isFinite(initialPurse) || initialPurse < 0) return NextResponse.json({ error: "Initial purse must be a non-negative number." }, { status: 400 });
    const userSnapshot = await db.collection("users").doc(userId).get();
    if (!userSnapshot.exists || userSnapshot.data()?.role !== "bidder") return NextResponse.json({ error: "Select a registered bidder account." }, { status: 400 });
    const duplicate = await db.collection("auctions").doc(auctionId).collection("bidders").where("userId", "==", userId).limit(1).get();
    if (!duplicate.empty) return NextResponse.json({ error: "This bidder is already assigned to the auction." }, { status: 409 });
    const now = Timestamp.now();
    const data = userSnapshot.data()!;
    const ref = await db.collection("auctions").doc(auctionId).collection("bidders").add({ userId, displayName: String(data.displayName ?? data.name ?? data.email ?? "Bidder"), initialPurse, status: "active", createdAt: now, updatedAt: now, createdBy: uid });
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add bidder to this auction.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  try {
    const auctionId = (await context.params).auctionId;
    const { db } = await authorize(request, auctionId);
    const body = await request.json();
    const bidderId = typeof body.bidderId === "string" ? body.bidderId.trim() : "";
    if (!bidderId) return NextResponse.json({ error: "Bidder is required." }, { status: 400 });
    const ref = db.collection("auctions").doc(auctionId).collection("bidders").doc(bidderId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Bidder assignment not found." }, { status: 404 });
    const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (body.status === "active" || body.status === "inactive") update.status = body.status;
    if (body.initialPurse !== undefined) {
      const initialPurse = Number(body.initialPurse);
      if (!Number.isFinite(initialPurse) || initialPurse < 0) return NextResponse.json({ error: "Initial purse must be a non-negative number." }, { status: 400 });
      update.initialPurse = initialPurse;
    }
    await ref.update(update);
    return NextResponse.json({ id: bidderId });
  } catch (error) {
    return errorResponse(error, "Unable to update auction bidder.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  try {
    const auctionId = (await context.params).auctionId;
    const { db } = await authorize(request, auctionId);
    const bidderId = new URL(request.url).searchParams.get("bidderId")?.trim();
    if (!bidderId) return NextResponse.json({ error: "Bidder is required." }, { status: 400 });
    const ref = db.collection("auctions").doc(auctionId).collection("bidders").doc(bidderId);
    if (!(await ref.get()).exists) return NextResponse.json({ error: "Bidder assignment not found." }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to remove bidder from this auction.");
  }
}
