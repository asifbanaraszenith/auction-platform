import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const USER_ROLES = ["auctionAdmin", "participant", "bidder"] as const;
type UserRole = (typeof USER_ROLES)[number];

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault() });
}

async function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  const app = getAdminApp();
  const decoded = await getAuth(app).verifyIdToken(authorization.slice("Bearer ".length), true);
  if (decoded.superAdmin !== true) throw new Error("INSUFFICIENT_PERMISSIONS");
  return { app, db: getFirestore(app) };
}

async function listAllAuthUsers(app: ReturnType<typeof getAdminApp>) {
  const auth = getAuth(app);
  const users: Awaited<ReturnType<typeof auth.listUsers>>["users"] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

export async function GET(request: Request) {
  try {
    const { app, db } = await authorize(request);
    const authUsers = await listAllAuthUsers(app);
    const profiles = await Promise.all(authUsers.map((user) => db.collection("users").doc(user.uid).get()));

    const users = authUsers.map((user, index) => {
      const data = profiles[index].exists ? profiles[index].data() : undefined;
      const role = USER_ROLES.includes(data?.role as UserRole) ? data?.role as UserRole : "participant";
      return { uid: user.uid, email: user.email ?? "", displayName: user.displayName ?? "", role };
    }).sort((a, b) => (a.email || a.displayName).localeCompare(b.email || b.displayName));

    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load users.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can access user management." }, { status: 403 });
    console.error("User management listing failed", error);
    return NextResponse.json({ error: "Unable to load users." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { app, db } = await authorize(request);
    const body = await request.json();
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    const role = body.role as UserRole;

    if (!uid) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    if (!USER_ROLES.includes(role)) return NextResponse.json({ error: "Invalid user role." }, { status: 400 });

    const user = await getAuth(app).getUser(uid);
    const now = Timestamp.now();
    const reference = db.collection("users").doc(uid);
    const snapshot = await reference.get();
    await reference.set({
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      role,
      ...(snapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });

    return NextResponse.json({ uid, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user role.";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "INSUFFICIENT_PERMISSIONS") return NextResponse.json({ error: "Only Super Admin can update user roles." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") return NextResponse.json({ error: "User account not found." }, { status: 404 });
    console.error("User role update failed", error);
    return NextResponse.json({ error: "Unable to update user role." }, { status: 500 });
  }
}
