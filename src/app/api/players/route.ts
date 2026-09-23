import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request) {
  const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp(); const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true); const db = getFirestore(app);
  if (decoded.superAdmin !== true) { const profile = await db.collection("users").doc(decoded.uid).get(); if (!profile.exists || profile.data()?.role !== "auctionAdmin") throw new Error("INSUFFICIENT_PERMISSIONS"); }
  return { db, uid: decoded.uid };
}
function responseError(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }); console.error("Player operation failed", error); return NextResponse.json({ error: fallback }, { status: 500 }); }
export async function GET(request: Request) {
  try {
    const { db } = await authorize(request);
    const [playersSnapshot, participantUsersSnapshot, auctionAdminUsersSnapshot] = await Promise.all([
      db.collection("players").orderBy("displayName").get(),
      db.collection("users").where("role", "==", "participant").get(),
      db.collection("users").where("role", "==", "auctionAdmin").get(),
    ]);
    const players = new Map<string, Record<string, unknown>>();
    for (const doc of playersSnapshot.docs) {
      const data = doc.data();
      players.set(doc.id, { id: doc.id, displayName: data.displayName, photoUrl: data.photoUrl ?? null, userId: data.userId ?? null, createdBy: data.createdBy, createdAtMillis: data.createdAt?.toMillis?.() ?? 0, updatedAtMillis: data.updatedAt?.toMillis?.() ?? 0 });
    }
    for (const doc of [...participantUsersSnapshot.docs, ...auctionAdminUsersSnapshot.docs]) {
      const data = doc.data();
      const existing = [...players.values()].find((player) => player.userId === doc.id);
      if (existing) continue;
      const createdAt = data.createdAt?.toMillis?.() ?? 0;
      const updatedAt = data.updatedAt?.toMillis?.() ?? createdAt;
      players.set(doc.id, { id: doc.id, displayName: data.displayName ?? data.email ?? "", photoUrl: data.photoUrl ?? null, userId: doc.id, createdBy: data.createdBy ?? "", createdAtMillis: createdAt, updatedAtMillis: updatedAt });
    }
    const playerList = [...players.values()];
    const auctionSnapshot = await db.collection("auctions").get();
    const auctionNames = new Map<string, string>();
    for (const auction of auctionSnapshot.docs) {
      auctionNames.set(auction.id, String(auction.data().name ?? auction.id));
    }
    const registrations = new Map<string, { auctionId: string; auctionName: string }[]>();
    for (const auction of auctionSnapshot.docs) {
      const registrationsSnapshot = await auction.ref.collection("participants").get();
      for (const registration of registrationsSnapshot.docs) {
        const playerId = String(registration.data().playerId ?? "");
        if (!playerId) continue;
        const current = registrations.get(playerId) ?? [];
        current.push({ auctionId: auction.id, auctionName: auctionNames.get(auction.id) ?? auction.id });
        registrations.set(playerId, current);
      }
    }
    const enriched = playerList.map((player) => ({
      ...player,
      email: (() => {
        const userId = typeof player.userId === "string" ? player.userId : "";
        const matching = participantUsersSnapshot.docs.find((doc) => doc.id === userId) ?? auctionAdminUsersSnapshot.docs.find((doc) => doc.id === userId);
        return matching ? String(matching.data().email ?? "") : "";
      })(),
      auctions: registrations.get(String(player.id)) ?? [],
    }));
    return NextResponse.json({ players: enriched.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName))) });
  } catch (error) { return responseError(error, "Unable to load participants."); }
}
export async function POST(request: Request) { try { const { db, uid } = await authorize(request); const body = await request.json(); const displayName = typeof body.displayName === "string" ? body.displayName.trim() : ""; const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null; if (!displayName) return NextResponse.json({ error: "Participant name is required." }, { status: 400 }); const duplicate = await db.collection("players").where("displayName", "==", displayName).limit(1).get(); if (!duplicate.empty) return NextResponse.json({ error: "A participant with this name already exists." }, { status: 409 }); const now = Timestamp.now(); const ref = await db.collection("players").add({ displayName, photoUrl, createdBy: uid, createdAt: now, updatedAt: now }); return NextResponse.json({ id: ref.id, displayName, photoUrl, createdBy: uid, createdAtMillis: now.toMillis(), updatedAtMillis: now.toMillis() }, { status: 201 }); } catch (error) { return responseError(error, "Unable to create participant."); } }

export async function PATCH(request: Request) {
  try {
    const { db } = await authorize(request);
    const body = await request.json();
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null;
    if (!playerId || !displayName || !email) return NextResponse.json({ error: "Participant ID, name and email are required." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const playerRef = db.collection("players").doc(playerId);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    const data = playerSnap.data()!;
    const userId = typeof data.userId === "string" ? data.userId : playerId;
    const auth = getAuth(getAdminApp());
    const account = await auth.getUser(userId).catch(() => null);
    if (!account) return NextResponse.json({ error: "Participant account not found." }, { status: 404 });
    const duplicate = await db.collection("players").where("displayName", "==", displayName).get();
    if (duplicate.docs.some((doc) => doc.id !== playerId)) return NextResponse.json({ error: "A participant with this name already exists." }, { status: 409 });
    try {
      await auth.updateUser(userId, { displayName, email, photoURL: photoUrl ?? undefined });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
      if (code === "auth/email-already-exists") return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 });
      throw error;
    }
    await db.collection("users").doc(userId).set({ displayName, email, photoUrl, updatedAt: Timestamp.now() }, { merge: true });
    await playerRef.update({ displayName, photoUrl, updatedAt: Timestamp.now() });
    return NextResponse.json({ ok: true });
  } catch (error) { return responseError(error, "Unable to update participant."); }
}
