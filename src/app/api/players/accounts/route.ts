import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const TEMPORARY_PASSWORD = "123456";
function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request) {
  const header = request.headers.get("authorization"); if (!header?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp(); const auth = getAuth(app); const decoded = await auth.verifyIdToken(header.slice("Bearer ".length), true); const db = getFirestore(app);
  if (decoded.superAdmin !== true) { const profile = await db.collection("users").doc(decoded.uid).get(); const role = profile.data()?.role; if (role !== "auctionAdmin") throw new Error("INSUFFICIENT_PERMISSIONS"); }
  return { auth, db, uid: decoded.uid };
}
function fail(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : 500; return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Authentication required." : message === "INSUFFICIENT_PERMISSIONS" ? "Insufficient permissions." : fallback }, { status }); }

export async function POST(request: Request) {
  try {
    const { auth, db, uid } = await authorize(request); const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : ""; const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""; const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
    if (!name || !email || !expertise) return NextResponse.json({ error: "Name, email and expertise are required." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    let authUser;
    try { authUser = await auth.createUser({ email, password: TEMPORARY_PASSWORD, displayName: name }); }
    catch (error) { const code = error instanceof Error ? error.message : ""; if (code.includes("email-already-exists")) return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 }); throw error; }
    const now = Timestamp.now();
    await db.collection("users").doc(authUser.uid).set({ displayName: name, email, expertise, photoUrl: null, role: "participant", mustChangePassword: true, createdBy: uid, createdAt: now, updatedAt: now }, { merge: true });
    const playerRef = await db.collection("players").add({ displayName: name, expertise, photoUrl: null, userId: authUser.uid, createdBy: uid, createdAt: now, updatedAt: now });
    return NextResponse.json({ userId: authUser.uid, playerId: playerRef.id, temporaryPassword: TEMPORARY_PASSWORD }, { status: 201 });
  } catch (error) { return fail(error, "Unable to create participant account."); }
}
