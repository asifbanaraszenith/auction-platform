import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";

export const USER_ROLES = ["auctionAdmin", "participant", "bidder"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
};

const usersCollection = () => collection(getFirebaseDb(), "users");

export async function ensureUserProfile(user: User): Promise<void> {
  const reference = doc(usersCollection(), user.uid);
  const snapshot = await getDoc(reference);
  if (snapshot.exists()) {
    await updateDoc(reference, {
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await setDoc(reference, {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    role: "participant",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function getAdminToken() {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Authentication required.");
  return user.getIdToken(true);
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const token = await getAdminToken();
  const response = await fetch("/api/admin/users", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load users.");
  return (payload.users ?? []) as UserProfile[];
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const token = await getAdminToken();
  const response = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uid, role }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to update user role.");
}
