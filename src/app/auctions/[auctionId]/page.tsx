"use client";

import { useParams } from "next/navigation";
import AuctionManagementClient from "../AuctionManagementClient";

export default function AuctionDetailPage() {
  const params = useParams<{ auctionId: string }>();
  return <AuctionManagementClient mode="detail" auctionId={params.auctionId} />;
}
