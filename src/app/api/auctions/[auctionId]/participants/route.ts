import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request, auctionId: string) { const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED"); const app = getAdminApp(); const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true); const db = getFirestore(app); const auction = await db.collection("auctions").doc(auctionId).get(); if (!auction.exists) throw new Error("AUCTION_NOT_FOUND"); const data = auction.data()!; const isSuperAdmin = decoded.superAdmin === true; const isAuctionAdmin = Array.isArray(data.adminIds) && data.adminIds.includes(decoded.uid); if (!isSuperAdmin && !isAuctionAdmin) throw new Error("INSUFFICIENT_PERMISSIONS"); return { db, auction, uid: decoded.uid }; }
function errorResponse(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : message === "AUCTION_NOT_FOUND" ? 404 : 500; return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Authentication required." : message === "INSUFFICIENT_PERMISSIONS" ? "You are not assigned to this auction." : message === "AUCTION_NOT_FOUND" ? "Auction not found." : fallback }, { status }); }
export async function GET(request: Request, context: { params: Promise<{ auctionId: string }> }) { try { const auctionId = (await context.params).auctionId; const { db } = await authorize(request, auctionId); const auctionRef = db.collection("auctions").doc(auctionId); const [categoriesSnapshot, participantsSnapshot] = await Promise.all([auctionRef.collection("categories").orderBy("sortOrder").get(), auctionRef.collection("participants").orderBy("createdAt").get()]); const categories = categoriesSnapshot.docs.map((doc) => { const d = doc.data(); return { id: doc.id, name: d.name, defaultBasePrice: d.defaultBasePrice, minimumBasePrice: d.minimumBasePrice ?? d.defaultBasePrice ?? 0, sortOrder: d.sortOrder ?? 0, active: d.active !== false, createdAtMillis: d.createdAt?.toMillis?.() ?? 0, updatedAtMillis: d.updatedAt?.toMillis?.() ?? 0 }; }); const participants = participantsSnapshot.docs.map((doc) => { const d = doc.data(); return { id: doc.id, playerId: d.playerId, playerName: d.playerName, expertise: d.expertise ?? "", categoryId: d.categoryId, categoryName: d.categoryName, basePrice: d.basePrice, minimumBasePrice: d.minimumBasePrice ?? d.basePrice ?? 0, status: d.status ?? "eligible", createdAtMillis: d.createdAt?.toMillis?.() ?? 0, updatedAtMillis: d.updatedAt?.toMillis?.() ?? 0 }; }); return NextResponse.json({ categories, participants }); } catch (error) { return errorResponse(error, "Unable to load auction configuration."); } }
export async function POST(request: Request, context: { params: Promise<{ auctionId: string }> }) { const auctionId = (await context.params).auctionId; try { const { db, uid } = await authorize(request, auctionId); const body = await request.json(); const auctionRef = db.collection("auctions").doc(auctionId); const now = Timestamp.now(); if (body.type === "category") { const name = typeof body.name === "string" ? body.name.trim() : ""; const defaultBasePrice = Number(body.defaultBasePrice); const minimumBasePrice = Number(body.minimumBasePrice); if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 }); if (!Number.isFinite(defaultBasePrice) || defaultBasePrice < 0) return NextResponse.json({ error: "Base price must be a non-negative number." }, { status: 400 }); if (!Number.isFinite(minimumBasePrice) || minimumBasePrice < 0) return NextResponse.json({ error: "Minimum base price must be a non-negative number." }, { status: 400 }); if (minimumBasePrice > defaultBasePrice) return NextResponse.json({ error: "Minimum base price cannot be greater than the base price." }, { status: 400 }); const duplicate = await auctionRef.collection("categories").where("name", "==", name).limit(1).get(); if (!duplicate.empty) return NextResponse.json({ error: "That category already exists in this auction." }, { status: 409 }); const count = (await auctionRef.collection("categories").get()).size; const ref = await auctionRef.collection("categories").add({ name, defaultBasePrice, minimumBasePrice, sortOrder: count, active: true, createdAt: now, updatedAt: now, createdBy: uid }); return NextResponse.json({ id: ref.id }, { status: 201 }); } if (body.type === "participant") {
      const rawPlayerIds = Array.isArray(body.playerIds) ? body.playerIds : [body.playerId];
      const playerIds = [...new Set(rawPlayerIds.filter((value: unknown): value is string => typeof value === "string" && value.trim()).map((value) => value.trim()))];
      const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
      const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
      if (!playerIds.length || !categoryId || !expertise) return NextResponse.json({ error: "At least one participant, expertise and category are required." }, { status: 400 });
      const category = await auctionRef.collection("categories").doc(categoryId).get();
      if (!category.exists || category.data()?.active === false) return NextResponse.json({ error: "Category not found or inactive." }, { status: 404 });
      const categoryName = String(category.data()?.name ?? "");
      const basePrice = Number(category.data()?.defaultBasePrice ?? 0);
      const minimumBasePrice = Number(category.data()?.minimumBasePrice ?? basePrice);
      const now = Timestamp.now();
      const existing = await auctionRef.collection("participants").where("playerId", "in", playerIds.slice(0, 10)).get();
      if (existing.docs.length) return NextResponse.json({ error: "One or more selected participants are already registered in this auction." }, { status: 409 });
      const ids: string[] = [];
      for (const playerId of playerIds) {
        const player = await db.collection("players").doc(playerId).get();
        let playerData = player.exists ? player.data()! : null;
        if (!playerData) {
          const userProfile = await db.collection("users").doc(playerId).get();
          if (!userProfile.exists) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
          const profile = userProfile.data()!;
          playerData = { displayName: profile.displayName ?? profile.email ?? "", photoUrl: profile.photoUrl ?? null, userId: playerId, createdBy: profile.createdBy ?? uid, createdAt: profile.createdAt ?? now, updatedAt: now };
          await db.collection("players").doc(playerId).set(playerData, { merge: true });
        }
        const ref = auctionRef.collection("participants").doc();
        ids.push(ref.id);
        await ref.set({ playerId, playerName: String(playerData.displayName ?? ""), expertise, categoryId, categoryName, basePrice, minimumBasePrice, status: "eligible", createdAt: now, updatedAt: now, createdBy: uid });
      }
      return NextResponse.json({ ids }, { status: 201 });
    } return NextResponse.json({ error: "Unsupported auction operation." }, { status: 400 }); } catch (error) { return errorResponse(error, "Unable to update auction configuration."); } }
