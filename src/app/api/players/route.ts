import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp(); const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true); const db = getFirestore(app);
  if (decoded.superAdmin !== true) { const profile = await db.collection("users").doc(decoded.uid).get(); if (!profile.exists || profile.data()?.role !== "auctionAdmin") throw new Error("INSUFFICIENT_PERMISSIONS"); }
  return { db, uid: decoded.uid };
}

export async function GET(request: Request) {
  try { const { db } = await authorize(request); const snapshot = await db.collection("players").orderBy("displayName").get(); return NextResponse.json({ players: snapshot.docs.map((doc) => { const data = doc.data(); return { id: doc.id, displayName: data.displayName, createdBy: data.createdBy, createdAtMillis: data.createdAt?.toMillis?.() ?? 0, updatedAtMillis: data.updatedAt?.toMillis?.() ?? 0 }; }) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to load players."; if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }); console.error("Player listing failed", error); return NextResponse.json({ error: "Unable to load players." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try { const { db, uid } = await authorize(request); const body = await request.json(); const displayName = typeof body.displayName === "string" ? body.displayName.trim() : ""; if (!displayName) return NextResponse.json({ error: "Player name is required." }, { status: 400 }); const duplicate = await db.collection("players").where("displayName", "==", displayName).limit(1).get(); if (!duplicate.empty) return NextResponse.json({ error: "A player with this name already exists." }, { status: 409 }); const now = Timestamp.now(); const ref = await db.collection("players").add({ displayName, createdBy: uid, createdAt: now, updatedAt: now }); return NextResponse.json({ id: ref.id, displayName, createdBy: uid, createdAtMillis: now.toMillis(), updatedAtMillis: now.toMillis() }, { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to create player."; if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }); console.error("Player creation failed", error); return NextResponse.json({ error: "Unable to create player." }, { status: 500 }); }
}
