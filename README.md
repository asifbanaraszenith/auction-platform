# Auction Platform

A generic, configurable auction platform for local leagues and other auction-based events.

## Project Status

| Phase | Status |
|---|---|
| Phase 1 — Foundation | Completed |
| Phase 2 — Authentication | Completed |
| Phase 3 — Auction Management | In progress |
| Phase 4 — Participants | Pending |
| Phase 5 — Teams & Bidders | Pending |
| Phase 6 — Auction Engine | Pending |
| Phase 7 — Live Bidding | Pending |
| Phase 8 — Purse & Squad Validation | Pending |
| Phase 9 — Administration | Pending |
| Phase 10 — Testing & Security | Pending |
| Phase 11 — Deployment | Pending |

## Product Direction

The platform is designed to be reusable for different leagues and auction formats. An authorized Super Admin can manage the platform, while an Auction Admin has full privileges within a specific auction. Participants and bidders only see auctions in which they are registered.

## Current Architecture

- **Frontend:** Next.js + TypeScript
- **Authentication:** Firebase Authentication
- **Database:** Cloud Firestore
- **Hosting target:** Firebase App Hosting
- **Configuration:** Firebase App Hosting automatic Web SDK configuration in production; local environment variables for development
- **Security:** Firestore rules use Firebase Auth custom claims for Super Admin access and auction-level admin membership for Auction Admin access

Firebase App Hosting can automatically supply the Firebase Web SDK configuration to the JavaScript SDK. Privileged server credentials, including anything used to provision Super Admin custom claims, must remain server-side and must never be committed.

## Phase 03 Domain Model

Auctions are stored under `auctions/{auctionId}` with ownership, admin membership, lifecycle status, scheduling, and settings. Theme configuration is intentionally stored inside each auction so light/dark mode, colors, branding, and typography can vary independently by auction.

The default visual language remains the Dark Luxury theme: deep charcoal, gold/ivory accents, and serif display typography.

## Development Workflow

Each phase is implemented on its own branch, reviewed, documented, and merged into `main` when complete. The next phase is always created from the latest stable `main`.

**Rule:** `main` always represents the latest completed and stable phase.

## Documentation

Detailed phase documentation is maintained under `docs/phases/`.

- [Phase 1 — Foundation](docs/phases/PHASE-01-FOUNDATION.md)
- [Phase 2 — Authentication](docs/phases/PHASE-02-AUTHENTICATION.md)
- [Phase 3 — Auction Management](docs/phases/PHASE-03-AUCTION-MANAGEMENT.md)

## Repository Branching Strategy

`main` is the stable baseline. Phase branches use the naming format `phase-XX-short-name`.

Example:

```text
main
  └── phase-01-foundation
        ↓ merge
      main
        └── phase-02-authentication
              ↓ merge
            main
              └── phase-03-auction-management
                    ↓ merge
                  main
                    └── phase-04-participants
```
