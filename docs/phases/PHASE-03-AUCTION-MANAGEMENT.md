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

### Final Super Admin model
The application uses Firebase Authentication custom claims as the **final authorization mechanism**. Super Admin status is never inferred from an email address in Firestore rules and can never be granted by client code.

The two initial Super Admin accounts are:

- `asifbanaras.zenith@gmail.com`
- `shaistanazir.zenith@gmail.com`

These addresses are used only by the one-time trusted bootstrap script to identify the initial accounts. The Firestore rules authorize them through the resulting `superAdmin: true` Auth custom claim, not through their email addresses.

### One-time bootstrap
`scripts/bootstrap-super-admins.ts` uses the Firebase Admin SDK and Application Default Credentials (ADC) to assign `superAdmin: true` to the two initial accounts. It contains no service-account key and must never be executed from the browser or deployed to the client.

The preferred operator environment is **Google Cloud Shell**, because it is browser-based and Google documents that Cloud Shell does not require a separate local `gcloud auth application-default login` setup for ADC. The operator must have sufficient IAM/Firebase permissions to administer Authentication.

From Cloud Shell:

```bash
git clone https://github.com/asifbanaraszenith/auction-platform.git
cd auction-platform
git checkout phase-03-auction-management
npm install
npm run bootstrap:super-admins
```

After successful execution, both users must sign out and sign back in so their Firebase ID tokens refresh and contain the new claim.

### Role model

| Role | Scope | Phase 03 authority |
|---|---|---|
| Super Admin | Platform | Create, read, update, delete all auctions |
| Auction Admin | Assigned auctions | Read/update assigned auctions; cannot change ownership/admin membership |
| Participant | Registered auction | No auction-management writes |
| Bidder | Registered auction | No auction-management writes |

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

- [ ] Run the one-time Super Admin bootstrap
- [ ] Deploy Firestore rules/indexes to Firebase
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

1. Run the one-time trusted Super Admin bootstrap.
2. Deploy Firestore rules/indexes.
3. Sign in as either Super Admin and create a draft auction.
4. Verify its assigned Auction Admin can read/update it.
5. Verify the Auction Admin cannot change `ownerId` or `adminIds`.
6. Verify an unrelated authenticated user cannot read or modify it.
7. Verify Super Admin can update/archive/delete it.
8. Verify theme changes remain scoped to that auction.
9. Run CI and production smoke tests.

## Security note

Firebase client configuration is not a service-account credential. The Admin SDK uses ADC in the trusted bootstrap environment; no service-account key is committed to the repository. Production privileged operations must remain server-side.
