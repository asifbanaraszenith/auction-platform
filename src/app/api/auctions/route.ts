import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault() });
}

async function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp();
  const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true);
  const db = getFirestore(app);
  const isSuperAdmin = decoded.superAdmin === true;
  if (!isSuperAdmin) {
    const userSnapshot = await db.collection("users").doc(decoded.uid).get();
    if (!userSnapshot.exists || userSnapshot.data()?.role !== "auctionAdmin") throw new Error("INSUFFICIENT_PERMISSIONS");
  }
  return { db, decoded, isSuperAdmin };
}

function isValidLifecycleTransition(current: string, next: string, startAtMillis: number) {
  if (current === next) return true;
  if (current === "created" && (next === "live" || next === "paused" || next === "ended")) return startAtMillis <= Date.now();
  if (current === "live" && next === "paused") return true;
  if (current === "paused" && next === "live") return true;
  if ((current === "live" || current === "paused") && next === "ended") return true;
  if (current === "ended" && next === "archived") return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const { db, decoded, isSuperAdmin } = await authorize(request);
    const snapshot = isSuperAdmin ? await db.collection("auctions").get() : await db.collection("auctions").where("adminIds", "array-contains", decoded.uid).get();
    const auctions = snapshot.docs.map((document) => {
      const data = document.data();
      return { id: document.id, name: data.name, description: data.description ?? "", ownerId: data.ownerId, adminIds: data.adminIds ?? [], status: data.status, startAtMillis: data.startAt instanceof Timestamp ? data.startAt.toMillis() : null, endAtMillis: data.endAt instanceof Timestamp ? data.endAt.toMillis() : null, settings: data.settings ?? {}, createdAtMillis: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0, updatedAtMillis: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0 };
    }).sort((a, b) => b.updatedAtMillis - a.updatedAtMillis);
    return NextResponse.json({ auctions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load auctions.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    console.error("Auction listing failed", error);
    return NextResponse.json({ error: "Unable to load auctions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { db, decoded } = await authorize(request);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const startAtMillis = Number(body.startAtMillis);
    const endAtMillis = Number(body.endAtMillis);
    const settings = body.settings;
    if (!name) return NextResponse.json({ error: "Auction name is required before saving." }, { status: 400 });
    if (!Number.isFinite(startAtMillis) || !Number.isFinite(endAtMillis)) return NextResponse.json({ error: "Start and end times are required." }, { status: 400 });
    if (startAtMillis <= Date.now()) return NextResponse.json({ error: "Start time must be in the future." }, { status: 400 });
    if (endAtMillis <= startAtMillis) return NextResponse.json({ error: "End time must be after the start time." }, { status: 400 });
    if (!settings || typeof settings !== "object") return NextResponse.json({ error: "Auction settings are required." }, { status: 400 });
    const now = Timestamp.now();
    const reference = await db.collection("auctions").add({ name, description, ownerId: decoded.uid, adminIds: [decoded.uid], status: "created", startAt: Timestamp.fromMillis(startAtMillis), endAt: Timestamp.fromMillis(endAtMillis), settings, createdAt: now, updatedAt: now });
    return NextResponse.json({ id: reference.id, name, description, ownerId: decoded.uid, adminIds: [decoded.uid], status: "created", startAtMillis, endAtMillis, settings, createdAtMillis: now.toMillis(), updatedAtMillis: now.toMillis() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create auction.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    console.error("Auction creation failed", error);
    return NextResponse.json({ error: "Unable to create auction." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { db, decoded, isSuperAdmin } = await authorize(request);
    const body = await request.json();
    const auctionId = typeof body.auctionId === "string" ? body.auctionId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const startAtMillis = Number(body.startAtMillis);
    const endAtMillis = Number(body.endAtMillis);
    const settings = body.settings;
    const nextStatus = typeof body.status === "string" ? body.status : "";
    if (!auctionId) return NextResponse.json({ error: "Auction ID is required." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Auction name is required before saving." }, { status: 400 });
    if (!Number.isFinite(startAtMillis) || !Number.isFinite(endAtMillis)) return NextResponse.json({ error: "Start and end times are required." }, { status: 400 });
    if (endAtMillis <= startAtMillis) return NextResponse.json({ error: "End time must be after the start time." }, { status: 400 });
    if (!settings || typeof settings !== "object") return NextResponse.json({ error: "Auction settings are required." }, { status: 400 });

    const reference = db.collection("auctions").doc(auctionId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Auction not found." }, { status: 404 });
    const current = snapshot.data()!;
    const currentAdminIds = Array.isArray(current.adminIds) ? current.adminIds : [];
    if (!isSuperAdmin && !currentAdminIds.includes(decoded.uid)) return NextResponse.json({ error: "You are not assigned to this auction." }, { status: 403 });
    const currentStatus = String(current.status ?? "created");
    if (!isValidLifecycleTransition(currentStatus, nextStatus, startAtMillis)) return NextResponse.json({ error: `Invalid auction lifecycle transition from ${currentStatus} to ${nextStatus}.` }, { status: 400 });

    const updatedAt = Timestamp.now();
    await reference.update({ name, description, status: nextStatus, startAt: Timestamp.fromMillis(startAtMillis), endAt: Timestamp.fromMillis(endAtMillis), settings, updatedAt });
    return NextResponse.json({ auctionId, name, description, status: nextStatus, startAtMillis, endAtMillis, settings, updatedAtMillis: updatedAt.toMillis() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update auction.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    console.error("Auction update failed", error);
    return NextResponse.json({ error: "Unable to update auction." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { db, isSuperAdmin } = await authorize(request);
    if (!isSuperAdmin) return NextResponse.json({ error: "Only Super Admin can assign auction admins." }, { status: 403 });
    const body = await request.json();
    const auctionId = typeof body.auctionId === "string" ? body.auctionId.trim() : "";
    const rawAdminIds: unknown = body.adminIds;
    if (!Array.isArray(rawAdminIds)) return NextResponse.json({ error: "Admin selection is required." }, { status: 400 });
    const adminIds: string[] = [...new Set(rawAdminIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0))];
    if (!auctionId) return NextResponse.json({ error: "Auction ID is required." }, { status: 400 });

    const auction = await db.collection("auctions").doc(auctionId).get();
    if (!auction.exists) return NextResponse.json({ error: "Auction not found." }, { status: 404 });
    if (adminIds.length) {
      const profiles = await Promise.all(adminIds.map((uid: string) => db.collection("users").doc(uid).get()));
      const invalid = profiles.some((profile) => !profile.exists || profile.data()?.role !== "auctionAdmin");
      if (invalid) return NextResponse.json({ error: "Every assigned user must have the Auction Admin role." }, { status: 400 });
    }
    await auction.ref.update({ adminIds, updatedAt: Timestamp.now() });
    return NextResponse.json({ auctionId, adminIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign auction admins.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can assign auction admins." }, { status: 403 });
    console.error("Auction admin assignment failed", error);
    return NextResponse.json({ error: "Unable to assign auction admins." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { db, isSuperAdmin } = await authorize(request);
    if (!isSuperAdmin) return NextResponse.json({ error: "Only Super Admin can delete auctions." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const auctionId = typeof body.auctionId === "string" ? body.auctionId.trim() : "";
    if (!auctionId) return NextResponse.json({ error: "Auction ID is required." }, { status: 400 });

    const reference = db.collection("auctions").doc(auctionId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Auction not found." }, { status: 404 });

    await db.recursiveDelete(reference);
    return NextResponse.json({ auctionId, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete auction.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can delete auctions." }, { status: 403 });
    console.error("Auction deletion failed", error);
    return NextResponse.json({ error: "Unable to delete auction." }, { status: 500 });
  }
}
