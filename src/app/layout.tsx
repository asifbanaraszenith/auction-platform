import type { Metadata } from "next";
import "./globals.css";
import "./phase4-mobile.css";
import { AuthProvider } from "@/components/auth-provider";
import { AuctionDeleteGuard } from "@/components/auction-delete-guard";

export const metadata: Metadata = {
  title: "Auction Platform",
  description: "Configurable auction platform for leagues and auction-based events."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <AuctionDeleteGuard />
        </AuthProvider>
      </body>
    </html>
  );
}
