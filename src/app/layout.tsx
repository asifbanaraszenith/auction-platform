import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auction Platform",
  description: "Configurable auction platform for leagues and auction-based events."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
