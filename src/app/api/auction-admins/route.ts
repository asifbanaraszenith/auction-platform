import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault() });
}

async function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp();
  const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true);
  const db = getFirestore(app);
  if (decoded.superAdmin !== true) throw new Error("INSUFFICIENT_PERMISSIONS");
  return db;
}

export async function GET(request: Request) {
  try {
    const db = await authorize(request);
    const snapshot = await db.collection("users").where("role", "==", "auctionAdmin").get();
    const users = snapshot.docs.map((item) => {
      const data = item.data();
      return { uid: item.id, email: String(data.email ?? ""), displayName: String(data.displayName ?? "") };
    }).sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load auction admins.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can assign auction admins." }, { status: 403 });
    console.error("Auction admin listing failed", error);
    return NextResponse.json({ error: "Unable to load auction admins." }, { status: 500 });
  }
}
