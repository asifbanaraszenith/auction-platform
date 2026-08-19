import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request, auctionId: string) {
  const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp(); const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true); const db = getFirestore(app); const auction = await db.collection("auctions").doc(auctionId).get();
  if (!auction.exists) throw new Error("AUCTION_NOT_FOUND"); const data = auction.data()!; const isSuperAdmin = decoded.superAdmin === true; const isAuctionAdmin = Array.isArray(data.adminIds) && data.adminIds.includes(decoded.uid);
  if (!isSuperAdmin && !isAuctionAdmin) throw new Error("INSUFFICIENT_PERMISSIONS"); return { db, auction, uid: decoded.uid };
}

function errorResponse(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : message === "AUCTION_NOT_FOUND" ? 404 : 500; return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Authentication required." : message === "INSUFFICIENT_PERMISSIONS" ? "You are not assigned to this auction." : message === "AUCTION_NOT_FOUND" ? "Auction not found." : fallback }, { status }); }

export async function GET(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  try { const { db } = await authorize(request, (await context.params).auctionId); const auctionId = (await context.params).auctionId; const [categoriesSnapshot, participantsSnapshot] = await Promise.all([db.collection("auctions").doc(auctionId).collection("categories").orderBy("sortOrder").get(), db.collection("auctions").doc(auctionId).collection("participants").orderBy("createdAt").get()]);
    const categories = categoriesSnapshot.docs.map((doc) => { const d = doc.data(); return { id: doc.id, name: d.name, defaultBasePrice: d.defaultBasePrice, sortOrder: d.sortOrder ?? 0, active: d.active !== false, createdAtMillis: d.createdAt?.toMillis?.() ?? 0, updatedAtMillis: d.updatedAt?.toMillis?.() ?? 0 }; });
    const participants = participantsSnapshot.docs.map((doc) => { const d = doc.data(); return { id: doc.id, playerId: d.playerId, playerName: d.playerName, categoryId: d.categoryId, categoryName: d.categoryName, basePrice: d.basePrice, status: d.status ?? "eligible", createdAtMillis: d.createdAt?.toMillis?.() ?? 0, updatedAtMillis: d.updatedAt?.toMillis?.() ?? 0 }; });
    return NextResponse.json({ categories, participants });
  } catch (error) { return errorResponse(error, "Unable to load auction participants."); }
}

export async function POST(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  const auctionId = (await context.params).auctionId;
  try { const { db, uid } = await authorize(request, auctionId); const body = await request.json(); const auctionRef = db.collection("auctions").doc(auctionId); const now = Timestamp.now();
    if (body.type === "category") {
      const name = typeof body.name === "string" ? body.name.trim() : ""; const defaultBasePrice = Number(body.defaultBasePrice);
      if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 }); if (!Number.isFinite(defaultBasePrice) || defaultBasePrice < 0) return NextResponse.json({ error: "Default base price must be a non-negative number." }, { status: 400 });
      const duplicate = await auctionRef.collection("categories").where("name", "==", name).limit(1).get(); if (!duplicate.empty) return NextResponse.json({ error: "That category already exists in this auction." }, { status: 409 });
      const count = (await auctionRef.collection("categories").get()).size; const ref = await auctionRef.collection("categories").add({ name, defaultBasePrice, sortOrder: count, active: true, createdAt: now, updatedAt: now, createdBy: uid }); return NextResponse.json({ id: ref.id }, { status: 201 });
    }
    if (body.type === "participant") {
      const playerId = typeof body.playerId === "string" ? body.playerId.trim() : ""; const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : ""; if (!playerId || !categoryId) return NextResponse.json({ error: "Player and category are required." }, { status: 400 });
      const [player, category, duplicate] = await Promise.all([db.collection("players").doc(playerId).get(), auctionRef.collection("categories").doc(categoryId).get(), auctionRef.collection("participants").where("playerId", "==", playerId).limit(1).get()]);
      if (!player.exists) return NextResponse.json({ error: "Player not found." }, { status: 404 }); if (!category.exists || category.data()?.active === false) return NextResponse.json({ error: "Category not found or inactive." }, { status: 404 }); if (!duplicate.empty) return NextResponse.json({ error: "This player is already registered in this auction." }, { status: 409 });
      const playerName = String(player.data()?.displayName ?? ""); const categoryName = String(category.data()?.name ?? ""); const defaultBasePrice = Number(category.data()?.defaultBasePrice ?? 0); const suppliedPrice = body.basePrice === undefined || body.basePrice === null || body.basePrice === "" ? defaultBasePrice : Number(body.basePrice); if (!Number.isFinite(suppliedPrice) || suppliedPrice < 0) return NextResponse.json({ error: "Base price must be a non-negative number." }, { status: 400 });
      const ref = await auctionRef.collection("participants").add({ playerId, playerName, categoryId, categoryName, basePrice: suppliedPrice, status: "eligible", createdAt: now, updatedAt: now, createdBy: uid }); return NextResponse.json({ id: ref.id }, { status: 201 });
    }
    return NextResponse.json({ error: "Unsupported participant operation." }, { status: 400 });
  } catch (error) { return errorResponse(error, "Unable to update auction participants."); }
}
