import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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
    const snapshot = await db.collection("users").where("role", "==", "auctionAdmin").get();
    const users = (await Promise.all(snapshot.docs.map(async (item) => {
      const data = item.data();
      try { const account = await auth.getUser(item.id); if (account.customClaims?.superAdmin === true) return null; } catch { /* orphaned profile; keep it available for assignment */ }
      return { uid: item.id, email: String(data.email ?? ""), displayName: String(data.displayName ?? "") };
    }))).filter((item): item is { uid: string; email: string; displayName: string } => item !== null).sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load auction admins.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can assign auction admins." }, { status: 403 });
    console.error("Auction admin listing failed", error); return NextResponse.json({ error: "Unable to load auction admins." }, { status: 500 });
  }
}
