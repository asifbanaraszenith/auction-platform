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
  const idToken = authorization.slice("Bearer ".length);
  const decoded = await getAuth(app).verifyIdToken(idToken, true);
  const db = getFirestore(app);
  const isSuperAdmin = decoded.superAdmin === true;

  if (!isSuperAdmin) {
    const userSnapshot = await db.collection("users").doc(decoded.uid).get();
    if (!userSnapshot.exists || userSnapshot.data()?.role !== "auctionAdmin") {
      throw new Error("INSUFFICIENT_PERMISSIONS");
    }
  }

  return { db, decoded, isSuperAdmin };
}

export async function GET(request: Request) {
  try {
    const { db, decoded, isSuperAdmin } = await authorize(request);
    const query = isSuperAdmin
      ? db.collection("auctions").orderBy("updatedAt", "desc")
      : db.collection("auctions").where("adminIds", "array-contains", decoded.uid).orderBy("updatedAt", "desc");
    const snapshot = await query.get();

    const auctions = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        name: data.name,
        description: data.description ?? "",
        ownerId: data.ownerId,
        adminIds: data.adminIds ?? [],
        status: data.status,
        startAtMillis: data.startAt instanceof Timestamp ? data.startAt.toMillis() : null,
        endAtMillis: data.endAt instanceof Timestamp ? data.endAt.toMillis() : null,
        settings: data.settings ?? {},
        createdAtMillis: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        updatedAtMillis: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now(),
      };
    });

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
    const message = error instanceof Error ? error.message : "Unable to create auction.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    console.error("Auction creation failed", error);
    return NextResponse.json({ error: "Unable to create auction." }, { status: 500 });
  }
}
