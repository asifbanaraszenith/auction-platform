import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault() });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const idToken = authorization.slice("Bearer ".length);
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken, true);
    const db = getFirestore(app);

    const isSuperAdmin = decoded.superAdmin === true;
    let isAuctionAdmin = false;
    if (!isSuperAdmin) {
      const userSnapshot = await db.collection("users").doc(decoded.uid).get();
      isAuctionAdmin = userSnapshot.exists && userSnapshot.data()?.role === "auctionAdmin";
    }

    if (!isSuperAdmin && !isAuctionAdmin) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const startAtMillis = Number(body.startAtMillis);
    const endAtMillis = Number(body.endAtMillis);
    const settings = body.settings;

    if (!name) return NextResponse.json({ error: "Auction name is required before saving." }, { status: 400 });
    if (!Number.isFinite(startAtMillis) || !Number.isFinite(endAtMillis)) {
      return NextResponse.json({ error: "Start and end times are required." }, { status: 400 });
    }

    const nowMillis = Date.now();
    if (startAtMillis <= nowMillis) {
      return NextResponse.json({ error: "Start time must be in the future." }, { status: 400 });
    }
    if (endAtMillis <= startAtMillis) {
      return NextResponse.json({ error: "End time must be after the start time." }, { status: 400 });
    }
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Auction settings are required." }, { status: 400 });
    }

    const now = Timestamp.now();
    const reference = await db.collection("auctions").add({
      name,
      description,
      ownerId: decoded.uid,
      adminIds: [decoded.uid],
      status: "created",
      startAt: Timestamp.fromMillis(startAtMillis),
      endAt: Timestamp.fromMillis(endAtMillis),
      settings,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id: reference.id,
      name,
      description,
      ownerId: decoded.uid,
      adminIds: [decoded.uid],
      status: "created",
      startAtMillis,
      endAtMillis,
      settings,
      createdAtMillis: now.toMillis(),
      updatedAtMillis: now.toMillis(),
    }, { status: 201 });
  } catch (error) {
    console.error("Auction creation failed", error);
    const message = error instanceof Error ? error.message : "Unable to create auction.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
