import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const exists = (path: string) => existsSync(join(root, path));
const route = (path: string) => assert.equal(exists(path), true, "Expected route to exist: " + path);

test("release surface contains all core workflows", () => {
  [
    "src/app/login/page.tsx",
    "src/app/participant/page.tsx",
    "src/app/admin/page.tsx",
    "src/app/auctions/page.tsx",
    "src/app/auctions/AuctionManagementClient.tsx",
    "src/app/live/[auctionId]/page.tsx",
    "src/app/bidder/page.tsx",
  ].forEach(route);
});

test("auction API surface exists", () => {
  [
    "src/app/api/auctions/route.ts",
    "src/app/api/auctions/[auctionId]/participants/route.ts",
    "src/app/api/auctions/[auctionId]/teams/route.ts",
    "src/app/api/auctions/[auctionId]/bidders/route.ts",
    "src/app/api/auctions/[auctionId]/lots/route.ts",
    "src/app/api/auctions/[auctionId]/live/route.ts",
    "src/app/api/auctions/[auctionId]/audit/route.ts",
    "src/app/api/auctions/[auctionId]/finalize/route.ts",
  ].forEach(route);
});

test("participant directory is separated from admin access control", () => {
  const page = read("src/app/participant/page.tsx");
  assert.doesNotMatch(page, /Auction Admin Access/);
  assert.doesNotMatch(page, /toggleAuctionAdmin/);
  assert.match(page, /Participant Management/);
  assert.match(page, /p\.email/);
  assert.match(page, /p\.auctions/);
});

test("Super Admin can edit participant identity", () => {
  const page = read("src/app/participant/page.tsx");
  const repo = read("src/lib/participants/repository.ts");
  const api = read("src/app/api/players/route.ts");
  assert.match(page, /Edit participant/);
  assert.match(page, /editName/);
  assert.match(page, /editEmail/);
  assert.match(page, /editPhoto/);
  assert.match(repo, /updateParticipant/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /auth\.updateUser/);
});

test("participant assignment supports bulk selection", () => {
  const page = read("src/app/auctions/AuctionManagementClient.tsx");
  const repo = read("src/lib/participants/repository.ts");
  const api = read("src/app/api/auctions/[auctionId]/participants/route.ts");
  assert.match(page, /selectedPlayerIds/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /Select participants/);
  assert.match(repo, /playerIds\?: string\[\]/);
  assert.match(api, /Array\.isArray\(body\.playerIds\)/);
  assert.match(page, /disabled=\{busy \|\| selectedPlayerIds\.length === 0 \|\| !categoryId\}/);
  assert.doesNotMatch(page, /!expertise\.trim\(\)/);
  assert.doesNotMatch(api, /!expertise/);
});

test("auction admin assignment is constrained to globally eligible admins", () => {
  const page = read("src/app/auctions/AuctionManagementClient.tsx");
  const api = read("src/app/api/auctions/route.ts");
  assert.match(page, /Assign auction admins/);
  assert.match(page, /adminPicker/);
  assert.match(page, /assignedAdminIds/);
  assert.match(api, /role !== "auctionAdmin"/);
});

test("bidder management and bidder-to-team assignment exist", () => {
  const admin = read("src/app/admin/page.tsx");
  const auction = read("src/app/auctions/AuctionManagementClient.tsx");
  const bidderApi = read("src/app/api/auctions/[auctionId]/bidders/route.ts");
  const teamApi = read("src/app/api/auctions/[auctionId]/teams/route.ts");
  assert.match(admin, /Make a Bidder/);
  assert.match(admin, /MAKE BIDDER/);
  assert.match(auction, /Bidders/);
  assert.match(auction, /bidderUserId/);
  assert.match(auction, /No bidder/);
  assert.match(auction, /bidders\.map/);
  assert.match(bidderApi, /availableUsers/);
  assert.match(teamApi, /bidderId/);
});

test("lots are in auction configuration while Live Room remains separate", () => {
  const auction = read("src/app/auctions/AuctionManagementClient.tsx");
  assert.match(auction, /<h2>Lots<\/h2>/);
  assert.match(auction, /ADD TO QUEUE/);
  assert.match(auction, /LIVE ROOM/);
});

test("bid API enforces bidding rules server-side", () => {
  const api = read("src/app/api/auctions/[auctionId]/lots/[lotId]/bids/route.ts");
  assert.match(api, /runTransaction/);
  assert.match(api, /startingBid/);
  assert.match(api, /bidIncrement/);
  assert.match(api, /initialPurse/);
  assert.match(api, /runTransaction/);
});

test("settlement and finalization enforce squad constraints", () => {
  const settle = read("src/app/api/auctions/[auctionId]/lots/[lotId]/settle/route.ts");
  const finalize = read("src/app/api/auctions/[auctionId]/finalize/route.ts");
  assert.match(settle, /maxSquadSize/);
  assert.match(settle, /winningTeamId/);
  assert.match(settle, /runTransaction/);
  assert.match(finalize, /minSquadSize/);
  assert.match(finalize, /maxSquadSize/);
});

test("audit trail exists", () => {
  const api = read("src/app/api/auctions/[auctionId]/audit/route.ts");
  const settlement = read("src/app/api/auctions/[auctionId]/lots/[lotId]/settle/route.ts");
  assert.match(api, /auditLogs/);
  assert.match(settlement, /actorId:decoded.uid/);
});

test("Firestore rules protect role and auction boundaries", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /function superAdmin/);
  assert.match(rules, /function auctionAdmin/);
  assert.match(rules, /function canManageAuction/);
  assert.match(rules, /match \/auctions/);
  assert.match(rules, /allow update: if canManageAuction/);
  assert.match(rules, /allow update, delete: if false/);
});

test("CI release gates include typecheck, lint and build", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /npm run typecheck/);
  assert.match(ci, /npm run lint/);
  assert.match(ci, /npm run build/);
});

test("Live Room navigation is explicitly exposed", () => {
  const page = read("src/app/auctions/AuctionManagementClient.tsx");
  assert.match(page, /LIVE ROOM/);
  assert.match(page, /\/live\/\$\{selected\.id\}/);
});
