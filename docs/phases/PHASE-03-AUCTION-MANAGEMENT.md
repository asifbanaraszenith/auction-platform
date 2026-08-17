# Phase 03 — Auction Management

## Purpose
Establish the secure Firestore domain model, authorization boundary, and responsive management experience for creating and operating league auctions.

## Security and operational dependencies

- Firestore authorization is wired through `firebase.json`.
- Super Admin access uses the Firebase Auth custom claim `superAdmin: true`.
- Auction Admin access uses an auction's `adminIds` array.
- Auction Admins cannot change `ownerId` or `adminIds` themselves.
- Only Super Admins can create or delete auctions.
- Audit logs are append-only from the application.
- All unmatched documents default to deny.
- Initial Super Admins: `asifbanaras.zenith@gmail.com` and `shaistanazir.zenith@gmail.com`.
- The one-time trusted bootstrap has been executed using Firebase Admin SDK + Application Default Credentials; no service-account key is stored in the repository.

## Role model

| Role | Scope | Phase 03 authority |
|---|---|---|
| Super Admin | Platform | Create, read, update, delete all auctions |
| Auction Admin | Assigned auctions | Read/update assigned auctions; cannot change ownership/admin membership |
| Participant | Registered auction | No auction-management writes |
| Bidder | Registered auction | No auction-management writes |

## Auction schema

`auctions/{auctionId}` contains:

- `name`, `description`
- `ownerId`, `adminIds[]`
- `status`: `draft | scheduled | live | paused | completed | archived`
- `startAt`, `endAt`
- `settings.mode`: `live | timed`
- `settings.currency`, `settings.timezone`
- `settings.theme`
- `createdAt`, `updatedAt`

## Implemented Phase 03 features

- Secure typed auction repository with create/read/list/update/delete operations.
- Super Admin and Auction Admin scoped auction listing.
- Responsive auction management workspace at `/auctions`.
- Create auction flow.
- Edit auction flow.
- Auction lifecycle controls for draft, scheduled, live, paused, completed and archived states.
- Super Admin-only delete control.
- Auction-level theme configuration persisted inside `settings.theme`.
- Dark Luxury and Light Gallery modes.
- Configurable primary, secondary, background and surface colors.
- Configurable luxury-serif or modern typography preference.
- Responsive mobile/tablet/desktop layout.
- Home-page navigation into auction management for authenticated users.
- Firestore indexes and authorization rules remain part of the deployment baseline.

## Auction-level theme configuration

Theme is part of `auction.settings`, not a global application singleton. Each auction can independently override dark/light mode, colors, logo, banner, and typography style. The default remains Dark Luxury with gold/ivory accents.

## Verification gate

The remaining gate is deployment validation:

1. CI typecheck/lint/build must pass on the Phase 03 PR.
2. Firestore rules/indexes must be deployed with the production baseline.
3. Production Super Admin creates a draft auction.
4. Assigned Auction Admin can read/update the auction.
5. Auction Admin cannot change `ownerId` or `adminIds`.
6. Unrelated authenticated user cannot read or modify it.
7. Super Admin can update/archive/delete it.
8. Theme changes remain scoped to that auction.
9. Production CRUD smoke test passes after App Hosting rollout.

After this verification gate passes, Phase 03 can be formally marked complete and the next phase should branch from the resulting stable `main` commit.
