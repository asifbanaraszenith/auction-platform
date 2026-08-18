import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const USER_ROLES = ["auctionAdmin", "participant", "bidder"] as const;
type UserRole = (typeof USER_ROLES)[number];

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault() });
}

async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp();
  const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true);
  const user = await getAuth(app).getUser(decoded.uid);
  return { app, user };
}

export async function POST(request: Request) {
  try {
    const { app, user } = await getAuthenticatedUser(request);
    const db = getFirestore(app);
    const reference = db.collection("users").doc(user.uid);
    const snapshot = await reference.get();
    const existing = snapshot.exists ? snapshot.data() : undefined;
    const existingRole = existing?.role as UserRole | undefined;
    const role = existingRole && USER_ROLES.includes(existingRole) ? existingRole : "participant";
    const now = Timestamp.now();

    await reference.set({
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      role,
      ...(snapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });

    return NextResponse.json({ uid: user.uid, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize user profile.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    console.error("User profile initialization failed", error);
    return NextResponse.json({ error: "Unable to initialize user profile." }, { status: 500 });
  }
}
