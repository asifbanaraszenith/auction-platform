import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth, type Auth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

const TEMPORARY_PASSWORD = "123456";

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault() });
}

async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");

  const app = getAdminApp();
  const auth = getAuth(app);
  const decoded = await auth.verifyIdToken(header.slice("Bearer ".length), true);
  const db = getFirestore(app);

  if (decoded.superAdmin !== true) {
    const profile = await db.collection("users").doc(decoded.uid).get();
    if (profile.data()?.role !== "auctionAdmin") throw new Error("INSUFFICIENT_PERMISSIONS");
  }

  return { auth, db, uid: decoded.uid };
}

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

function fail(error: unknown, fallback: string) {
  const code = firebaseErrorCode(error);
  const message = error instanceof Error ? error.message : fallback;

  if (message === "AUTHENTICATION_REQUIRED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (message === "INSUFFICIENT_PERMISSIONS") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }
  if (code === "auth/email-already-exists") {
    return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 });
  }
  if (code === "auth/invalid-email") {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (code === "auth/invalid-password") {
    return NextResponse.json({ error: "The temporary password does not meet Firebase password requirements." }, { status: 500 });
  }
  if (code === "auth/insufficient-permission") {
    return NextResponse.json({ error: "The server does not have permission to manage Firebase Authentication users." }, { status: 500 });
  }
  if (code === "auth/project-not-found") {
    return NextResponse.json({ error: "The server is connected to the wrong or unavailable Firebase project." }, { status: 500 });
  }

  console.error("Participant account creation failed", { code, error });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: Request) {
  let createdAuthUser: UserRecord | null = null;

  try {
    const { auth, db, uid }: { auth: Auth; db: Firestore; uid: string } = await authorize(request);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    try {
      await auth.getUserByEmail(email);
      return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 });
    } catch (error) {
      const code = firebaseErrorCode(error);
      if (code !== "auth/user-not-found") throw error;
    }

    createdAuthUser = await auth.createUser({
      email,
      password: TEMPORARY_PASSWORD,
      displayName: name,
      photoURL: photoUrl ?? undefined,
    });

    const now = Timestamp.now();
    try {
      await db.collection("users").doc(createdAuthUser.uid).set(
        {
          displayName: name,
          email,
          photoUrl,
          role: "participant",
          mustChangePassword: true,
          createdBy: uid,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      const playerRef = await db.collection("players").add({
        displayName: name,
        photoUrl,
        userId: createdAuthUser.uid,
        createdBy: uid,
        createdAt: now,
        updatedAt: now,
      });

      return NextResponse.json(
        {
          userId: createdAuthUser.uid,
          playerId: playerRef.id,
          temporaryPassword: TEMPORARY_PASSWORD,
        },
        { status: 201 },
      );
    } catch (error) {
      await auth.deleteUser(createdAuthUser.uid).catch((deleteError) => {
        console.error("Failed to roll back participant Auth user", deleteError);
      });
      throw error;
    }
  } catch (error) {
    return fail(error, "Unable to create participant account.");
  }
}
