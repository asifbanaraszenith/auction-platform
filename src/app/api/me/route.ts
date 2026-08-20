import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request) { const header = request.headers.get("authorization"); if (!header?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED"); const app = getAdminApp(); const auth = getAuth(app); const decoded = await auth.verifyIdToken(header.slice("Bearer ".length), true); return { adminAuth: auth, db: getFirestore(app), uid: decoded.uid, decoded }; }
function errorResponse(error: unknown) { const message = error instanceof Error ? error.message : "Unable to update profile."; if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 }); console.error("Profile operation failed", error); return NextResponse.json({ error: "Unable to update profile." }, { status: 500 }); }

async function scopedRoles(db: FirebaseFirestore.Firestore, uid: string) {
  const roles = new Set<string>(["viewer"]);
  const [adminAuctions, playerSnapshot] = await Promise.all([
    db.collection("auctions").where("adminIds", "array-contains", uid).limit(1).get(),
    db.collection("players").where("userId", "==", uid).limit(1).get(),
  ]);
  if (!adminAuctions.empty) roles.add("auctionAdmin");
  if (!playerSnapshot.empty) roles.add("participant");
  return [...roles];
}

export async function GET(request: Request) { try { const { adminAuth, db, uid, decoded } = await authorize(request); const [authUser, profile, roles] = await Promise.all([adminAuth.getUser(uid), db.collection("users").doc(uid).get(), scopedRoles(db, uid)]); const data = profile.data() ?? {}; const effectiveRoles = decoded.superAdmin === true ? ["viewer", "superAdmin", ...roles.filter((role) => role !== "viewer")] : roles; return NextResponse.json({ uid, name: authUser.displayName ?? data.displayName ?? "", email: authUser.email ?? data.email ?? "", photoUrl: authUser.photoURL ?? data.photoUrl ?? null, expertise: data.expertise ?? "", role: effectiveRoles.includes("superAdmin") ? "superAdmin" : "viewer", roles: effectiveRoles, emailVerified: authUser.emailVerified, provider: authUser.providerData[0]?.providerId ?? "password", mustChangePassword: data.mustChangePassword === true }); } catch (error) { return errorResponse(error); } }

export async function PATCH(request: Request) { try { const { adminAuth, db, uid } = await authorize(request); const body = await request.json(); const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined; const expertise = typeof body.expertise === "string" ? body.expertise.trim() : undefined; const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : body.photoUrl === null ? null : undefined; const passwordChanged = body.passwordChanged === true; if (displayName !== undefined && !displayName) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 }); if (expertise !== undefined && expertise.length > 200) return NextResponse.json({ error: "Expertise is too long." }, { status: 400 }); const authUpdate: { displayName?: string; photoURL?: string | null } = {}; if (displayName !== undefined) authUpdate.displayName = displayName; if (photoUrl !== undefined) authUpdate.photoURL = photoUrl; if (Object.keys(authUpdate).length) await adminAuth.updateUser(uid, authUpdate); const now = Timestamp.now(); const profileUpdate: Record<string, unknown> = { updatedAt: now }; if (displayName !== undefined) profileUpdate.displayName = displayName; if (expertise !== undefined) profileUpdate.expertise = expertise; if (photoUrl !== undefined) profileUpdate.photoUrl = photoUrl; if (passwordChanged) profileUpdate.mustChangePassword = false; await db.collection("users").doc(uid).set(profileUpdate, { merge: true }); return GET(new Request(request.url, { headers: request.headers })); } catch (error) { return errorResponse(error); } }
