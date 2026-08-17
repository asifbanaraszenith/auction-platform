# Phase 03 — Auction Management

## Purpose
Establish the secure Firestore domain model and authorization boundary for creating and managing auctions. The management UI will be built on top of this foundation in the remainder of Phase 03.

## Resolved dependencies

### Firestore authorization
`firestore.rules` is wired through `firebase.json`.

- Super Admin access uses the Firebase Auth custom claim `superAdmin: true`.
- Auction Admin access uses an auction's `adminIds` array.
- Auction Admins cannot change `ownerId` or `adminIds` themselves.
- Only Super Admins can create or delete auctions.
- Audit logs are append-only from the application.
- All unmatched documents default to deny.

### Role model

| Role | Scope | Phase 03 authority |
|---|---|---|
| Super Admin | Platform | Create, read, update, delete all auctions |
| Auction Admin | Assigned auctions | Read/update assigned auctions; cannot change ownership/admin membership |
| Participant | Registered auction | No auction-management writes |
| Bidder | Registered auction | No auction-management writes |

Super Admin provisioning must use a trusted Firebase Admin environment that can set Auth custom claims. No client-controlled Firestore field can grant Super Admin privileges.

### Auction schema

`auctions/{auctionId}` contains:

- `name`, `description`
- `ownerId`, `adminIds[]`
- `status`: `draft | scheduled | live | paused | completed | archived`
- `startAt`, `endAt`
- `settings.mode`: `live | timed`
- `settings.currency`, `settings.timezone`
- `settings.theme`
- `createdAt`, `updatedAt`

### Auction-level theme configuration

Theme is part of `auction.settings`, not a global application singleton. The default is Dark Luxury with gold/ivory accents. Each auction can independently override dark/light mode, colors, logo, banner, and typography style.

## Firestore indexes

`firestore.indexes.json` contains indexes for Auction Admin queries using `adminIds` + `updatedAt` and auction scheduling queries using `status` + `startAt`.

## Repository layer

`src/lib/auctions/repository.ts` provides typed primitives for creating, reading, listing, and updating auctions. The UI should use this repository instead of direct Firestore calls.

## Remaining Phase 03 work

- [ ] Super Admin provisioning procedure verified
- [ ] Firestore rules deployed to Firebase
- [ ] Auction management list screen
- [ ] Create auction screen
- [ ] Edit auction screen
- [ ] Auction lifecycle controls
- [ ] Auction-level theme configuration UI
- [ ] Responsive management UI
- [ ] Production CRUD smoke test
- [ ] CI typecheck/lint/build verification
- [ ] PR review and merge into `main`

## Verification gate

1. Deploy Firestore rules/indexes.
2. Provision a test Super Admin through a trusted Admin environment.
3. Sign in as Super Admin and create a draft auction.
4. Verify its assigned Auction Admin can read/update it.
5. Verify the Auction Admin cannot change `ownerId` or `adminIds`.
6. Verify an unrelated authenticated user cannot read or modify it.
7. Verify Super Admin can update/archive/delete it.
8. Verify theme changes remain scoped to that auction.
9. Run CI and production smoke tests.

## Security note

Firebase client configuration is not a service-account credential. Any Admin SDK credential used to provision Super Admin claims must remain in a trusted server/CI secret store and never be committed.
