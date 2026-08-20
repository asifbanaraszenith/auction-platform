import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp(); const auth = getAuth(app); const decoded = await auth.verifyIdToken(authorization.slice("Bearer ".length), true);
  if (decoded.superAdmin !== true) throw new Error("INSUFFICIENT_PERMISSIONS");
  return { db: getFirestore(app), auth };
}

export async function GET(request: Request) {
  try {
    const { db, auth } = await authorize(request);
    const snapshot = await db.collection("users").get();
    const users = (await Promise.all(snapshot.docs.map(async (item) => {
      const data = item.data();
      try {
        const account = await auth.getUser(item.id);
        if (account.customClaims?.superAdmin === true) return null;
        return {
          uid: item.id,
          email: String(account.email ?? data.email ?? ""),
          displayName: String(account.displayName ?? data.displayName ?? data.name ?? ""),
          isAuctionAdmin: data.role === "auctionAdmin",
        };
      } catch { return null; }
    }))).filter((item): item is { uid: string; email: string; displayName: string; isAuctionAdmin: boolean } => item !== null)
      .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load registered users.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can manage auction admin roles." }, { status: 403 });
    console.error("Auction admin candidate listing failed", error); return NextResponse.json({ error: "Unable to load registered users." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { db, auth } = await authorize(request);
    const body = await request.json();
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    const isAuctionAdmin = body.isAuctionAdmin === true;
    if (!uid) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    const account = await auth.getUser(uid);
    if (account.customClaims?.superAdmin === true) return NextResponse.json({ error: "Super Admin accounts cannot be changed here." }, { status: 400 });
    const reference = db.collection("users").doc(uid);
    const snapshot = await reference.get();
    if (!snapshot.exists) return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    const now = Timestamp.now();
    await reference.set({ role: isAuctionAdmin ? "auctionAdmin" : "viewer", updatedAt: now }, { merge: true });
    return NextResponse.json({ uid, isAuctionAdmin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update auction admin role.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can manage auction admin roles." }, { status: 403 });
    console.error("Auction admin role update failed", error); return NextResponse.json({ error: "Unable to update auction admin role." }, { status: 500 });
  }
}
