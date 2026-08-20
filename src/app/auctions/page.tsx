"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import AuctionManagementClient from "./AuctionManagementClient";

export const dynamic = "force-dynamic";

export default function AuctionsPage() {
  const { user, roles, loading } = useAuth();
  const router = useRouter();
  const canManageAuctions = roles.includes("superAdmin") || roles.includes("auctionAdmin");
  const isParticipant = roles.includes("participant");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canManageAuctions) router.replace(isParticipant ? "/participant" : "/");
  }, [loading, user, roles, canManageAuctions, isParticipant, router]);

  if (loading || !user || !canManageAuctions) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0d0d0c", color: "#f5f2e9" }}>Checking access…</main>;
  }

  return <AuctionManagementClient />;
}
