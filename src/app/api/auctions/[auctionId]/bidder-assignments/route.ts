import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function app() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request, auctionId: string) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const firebase = app();
  const decoded = await getAuth(firebase).verifyIdToken(header.slice(7), true);
  const db = getFirestore(firebase);
  const auction = await db.collection("auctions").doc(auctionId).get();
  if (!auction.exists) throw new Error("AUCTION_NOT_FOUND");
  const data = auction.data()!;
  if (decoded.superAdmin !== true && !(Array.isArray(data.adminIds) && data.adminIds.includes(decoded.uid))) throw new Error("INSUFFICIENT_PERMISSIONS");
  return { db, auction };
}
function fail(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : message === "AUCTION_NOT_FOUND" ? 404 : 500;
  return NextResponse.json({ error: status === 401 ? "Authentication required." : status === 403 ? "You are not assigned to this auction." : status === 404 ? "Auction not found." : fallback }, { status });
}

export async function GET(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  try {
    const auctionId = (await context.params).auctionId;
    const { db, auction } = await authorize(request, auctionId);
    const [users, assignments] = await Promise.all([db.collection("users").get(), auction.ref.collection("bidders").get()]);
    const assigned = new Map(assignments.docs.map((doc) => [doc.id, doc.data()]));
    const auth = getAuth(app());
    const candidates = (await Promise.all(users.docs.map(async (doc) => {
      const data = doc.data();
      try {
        const account = await auth.getUser(doc.id);
        if (account.customClaims?.superAdmin === true) return null;
        return { userId: doc.id, displayName: String(account.displayName ?? data.displayName ?? data.name ?? ""), email: String(account.email ?? data.email ?? ""), role: String(data.role ?? "viewer"), assigned: assigned.has(doc.id), initialPurse: Number(assigned.get(doc.id)?.initialPurse ?? 0) };
      } catch { return null; }
    }))).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    return NextResponse.json({ users: candidates });
  } catch (error) { return fail(error, "Unable to load auction bidders."); }
}

export async function PUT(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  try {
    const auctionId = (await context.params).auctionId;
    const { db, auction } = await authorize(request, auctionId);
    const body = await request.json();
    if (!Array.isArray(body.bidders)) return NextResponse.json({ error: "Bidder selection is required." }, { status: 400 });
    const selected = new Map<string, number>();
    for (const item of body.bidders) {
      const userId = typeof item?.userId === "string" ? item.userId.trim() : "";
      const initialPurse = Number(item?.initialPurse ?? 0);
      if (!userId) continue;
      if (!Number.isFinite(initialPurse) || initialPurse < 0) return NextResponse.json({ error: "Initial purse must be a non-negative number." }, { status: 400 });
      selected.set(userId, initialPurse);
    }
    const profiles = await Promise.all([...selected.keys()].map((uid) => db.collection("users").doc(uid).get()));
    if (profiles.some((profile) => !profile.exists)) return NextResponse.json({ error: "One or more selected users no longer exist." }, { status: 400 });
    const auth = getAuth(app());
    for (const uid of selected.keys()) if ((await auth.getUser(uid)).customClaims?.superAdmin === true) return NextResponse.json({ error: "Super Admin accounts are automatic and cannot be assigned as bidders." }, { status: 400 });
    const collection = auction.ref.collection("bidders");
    const current = await collection.get();
    const batch = db.batch();
    const selectedIds = new Set(selected.keys());
    current.docs.filter((doc) => !selectedIds.has(doc.id)).forEach((doc) => batch.delete(doc.ref));
    const now = Timestamp.now();
    for (const [uid, initialPurse] of selected.entries()) {
      const profile = profiles.find((item) => item.id === uid)?.data() ?? {};
      const previous = current.docs.find((doc) => doc.id === uid)?.data();
      batch.set(collection.doc(uid), { userId: uid, displayName: profile.displayName ?? profile.name ?? "", email: profile.email ?? "", initialPurse, status: "active", createdAt: previous?.createdAt ?? now, updatedAt: now }, { merge: true });
    }
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (error) { return fail(error, "Unable to save auction bidders."); }
}
