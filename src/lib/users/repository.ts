import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseDb } from "@/lib/firebase/client";

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

export async function listUserProfiles(): Promise<UserProfile[]> {
  const snapshot = await getDocs(usersCollection());
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      uid: item.id,
      email: String(data.email ?? ""),
      displayName: String(data.displayName ?? ""),
      role: USER_ROLES.includes(data.role as UserRole) ? data.role as UserRole : "participant",
    };
  }).sort((a, b) => a.email.localeCompare(b.email));
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(usersCollection(), uid), { role, updatedAt: serverTimestamp() });
}
