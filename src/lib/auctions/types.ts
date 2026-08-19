import type { Timestamp } from "firebase/firestore";

export const AUCTION_STATUSES = [
  "created",
  "live",
  "paused",
  "ended",
  "archived",
] as const;

export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const AUCTION_MODES = ["live", "timed"] as const;
export type AuctionMode = (typeof AUCTION_MODES)[number];

export type ThemeMode = "dark" | "light";

export type AuctionTheme = {
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  logoUrl?: string;
  bannerUrl?: string;
  fontStyle: "luxury" | "modern";
};

export const DEFAULT_AUCTION_THEME: AuctionTheme = {
  mode: "dark",
  primaryColor: "#C7A45B",
  secondaryColor: "#E2C47D",
  backgroundColor: "#11110F",
  surfaceColor: "#191815",
  textColor: "#F5F2E9",
  mutedColor: "#A8A497",
  borderColor: "#35342E",
  fontStyle: "luxury",
};

export type AuctionSettings = {
  mode: AuctionMode;
  points: string;
  timezone: string;
  theme: AuctionTheme;
};

export type Auction = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  adminIds: string[];
  status: AuctionStatus;
  startAt: Timestamp | null;
  endAt: Timestamp | null;
  settings: AuctionSettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CreateAuctionInput = Omit<Auction, "id" | "createdAt" | "updatedAt">;

/** Global participant identity. Auction-specific classification never lives here. */
export type Player = {
  id: string;
  displayName: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Category is owned by one auction and may be different for every auction. */
export type AuctionCategory = {
  id: string;
  name: string;
  defaultBasePrice: number;
  sortOrder: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Registration/configuration of a global player inside one auction. */
export type AuctionParticipant = {
  id: string;
  playerId: string;
  playerName: string;
  categoryId: string;
  categoryName: string;
  basePrice: number;
  status: "eligible" | "withdrawn" | "sold" | "unsold" | "reserved";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
