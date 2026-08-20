import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function app() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const firebase = app(); const decoded = await getAuth(firebase).verifyIdToken(header.slice(7), true); const db = getFirestore(firebase);
  const profile = await db.collection("users").doc(decoded.uid).get();
  const isAdmin = decoded.superAdmin === true || profile.data()?.role === "auctionAdmin";
  return { db, decoded, isAdmin };
}
function fail(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "INSUFFICIENT_PERMISSIONS" ? 403 : 500; return NextResponse.json({ error: status === 401 ? "Authentication required." : status === 403 ? "Insufficient permissions." : fallback }, { status }); }

export async function GET(request: Request) {
  try {
    const { db, isAdmin } = await authorize(request); if (!isAdmin) throw new Error("INSUFFICIENT_PERMISSIONS");
    const snapshot = await db.collection("players").orderBy("displayName").get();
    return NextResponse.json({ participants: snapshot.docs.map((doc) => { const d = doc.data(); return { id: doc.id, displayName: String(d.displayName ?? ""), expertise: String(d.expertise ?? ""), photoUrl: d.photoUrl ?? null, userId: d.userId ?? null, createdAtMillis: d.createdAt?.toMillis?.() ?? 0, updatedAtMillis: d.updatedAt?.toMillis?.() ?? 0 }; }) });
  } catch (error) { return fail(error, "Unable to load participants."); }
}

export async function PATCH(request: Request) {
  try {
    const { db, isAdmin } = await authorize(request); if (!isAdmin) throw new Error("INSUFFICIENT_PERMISSIONS");
    const body = await request.json(); const id = typeof body.id === "string" ? body.id.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const expertise = typeof body.expertise === "string" ? body.expertise.trim() : undefined;
    const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : body.photoUrl === null ? null : undefined;
    if (!id) return NextResponse.json({ error: "Participant ID is required." }, { status: 400 });
    if (displayName !== undefined && !displayName) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    if (expertise !== undefined && expertise.length > 200) return NextResponse.json({ error: "Expertise is too long." }, { status: 400 });
    const ref = db.collection("players").doc(id); const snapshot = await ref.get(); if (!snapshot.exists) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    const now = Timestamp.now(); const update: Record<string, unknown> = { updatedAt: now }; if (displayName !== undefined) update.displayName = displayName; if (expertise !== undefined) update.expertise = expertise; if (photoUrl !== undefined) update.photoUrl = photoUrl;
    await ref.update(update);
    const data = { ...snapshot.data(), ...update }; return NextResponse.json({ id, displayName: data.displayName, expertise: data.expertise ?? "", photoUrl: data.photoUrl ?? null, updatedAtMillis: now.toMillis() });
  } catch (error) { return fail(error, "Unable to update participant."); }
}
