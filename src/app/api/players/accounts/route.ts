import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp(); const auth = getAuth(app); const decoded = await auth.verifyIdToken(header.slice("Bearer ".length), true); const db = getFirestore(app);
  if (decoded.superAdmin !== true) { const snapshot = await db.collection("auctions").where("adminIds", "array-contains", decoded.uid).limit(1).get(); if (snapshot.empty) throw new Error("INSUFFICIENT_PERMISSIONS"); }
  return { auth, db, uid: decoded.uid };
}
function fail(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : 500; return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Authentication required." : message === "INSUFFICIENT_PERMISSIONS" ? "Insufficient permissions." : fallback }, { status }); }

export async function POST(request: Request) {
  try {
    const { auth, db, uid } = await authorize(request);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
    const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null;
    if (!name || !email || !password) return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    let authUser;
    try { authUser = await auth.createUser({ email, password, displayName: name, photoURL: photoUrl }); }
    catch (error) { const code = error instanceof Error ? error.message : ""; if (code.includes("email-already-exists")) return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 }); throw error; }
    const now = Timestamp.now();
    try {
      await db.collection("users").doc(authUser.uid).set({ displayName: name, email, expertise, photoUrl, role: "viewer", mustChangePassword: false, createdBy: uid, createdAt: now, updatedAt: now }, { merge: true });
      const playerRef = await db.collection("players").add({ displayName: name, expertise, photoUrl, userId: authUser.uid, createdBy: uid, createdAt: now, updatedAt: now });
      return NextResponse.json({ userId: authUser.uid, playerId: playerRef.id }, { status: 201 });
    } catch (error) { await auth.deleteUser(authUser.uid).catch(() => undefined); throw error; }
  } catch (error) { return fail(error, "Unable to create participant account."); }
}
