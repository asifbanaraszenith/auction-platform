"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

type AuthContextValue = {
  user: User | null;
  roles: string[];
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, roles: [], loading: true });

async function loadRoles(user: User): Promise<string[]> {
  try {
    const token = await user.getIdToken(true);
    const response = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.roles) ? payload.roles.map(String) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      getFirebaseAuth(),
      (nextUser) => {
        setUser(nextUser);
        if (!nextUser) {
          setRoles([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        void loadRoles(nextUser).then((nextRoles) => {
          setRoles(nextRoles);
          setLoading(false);
        });
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ user, roles, loading }), [user, roles, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
