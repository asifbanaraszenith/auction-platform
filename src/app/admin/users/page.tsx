"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { listUserProfiles, updateUserRole, USER_ROLES, type UserProfile, type UserRole } from "@/lib/users/repository";
import styles from "./users.module.css";

export default function UserManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    void (async () => {
      try {
        const token = await user.getIdTokenResult(true);
        const allowed = token.claims.superAdmin === true;
        setIsSuperAdmin(allowed);
        if (!allowed) { router.replace("/"); return; }
        setUsers(await listUserProfiles());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load users.");
      }
    })();
  }, [loading, router, user]);

  async function changeRole(uid: string, role: UserRole) {
    if (!user || !isSuperAdmin) return;
    setBusyUid(uid); setError(""); setNotice("");
    try {
      await updateUserRole(uid, role);
      setUsers((current) => current.map((item) => item.uid === uid ? { ...item, role } : item));
      setNotice("User role updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user role.");
    } finally { setBusyUid(null); }
  }

  if (loading || !user || !isSuperAdmin) return <main className={styles.loading}>Loading user management…</main>;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Auction Platform / Administration</p>
          <h1>User & Role Management</h1>
          <p className={styles.subtitle}>Manage authenticated Firebase users and assign application roles. Super Admin remains an Auth custom claim and cannot be granted from this screen.</p>
        </div>
        <div className={styles.actions}><button onClick={() => router.push("/")}>Back</button></div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.card}>
        <div className={styles.cardHeader}><span>AUTHENTICATED USERS</span><b>{users.length}</b></div>
        <div className={styles.table}>
          {users.map((item) => (
            <div className={styles.row} key={item.uid}>
              <div className={styles.identity}><strong>{item.displayName || "Unnamed user"}</strong><span>{item.email}</span><small>{item.uid}</small></div>
              <select value={item.role} disabled={busyUid === item.uid} onChange={(event) => void changeRole(item.uid, event.target.value as UserRole)} aria-label={`Role for ${item.email}`}>
                {USER_ROLES.map((role) => <option key={role} value={role}>{role === "auctionAdmin" ? "Auction Admin" : role === "participant" ? "Participant" : "Bidder"}</option>)}
              </select>
            </div>
          ))}
          {users.length === 0 && <div className={styles.empty}>No authenticated users exist in this Firebase project.</div>}
        </div>
      </section>

      <p className={styles.securityNote}>User management is authorized server-side with the Super Admin Auth custom claim. Existing Firebase accounts are shown even if their Firestore profile document does not exist yet; those accounts default to Participant until a role is assigned.</p>
    </main>
  );
}
