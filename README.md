# Auction Platform

A generic, configurable auction platform for local leagues and other auction-based events.

## Project Status

| Phase | Status |
|---|---|
| Phase 1 — Foundation | Completed |
| Phase 2 — Authentication | In progress |
| Phase 3 — Auction Management | Pending |
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

## Development Workflow

Each phase is implemented on its own branch, reviewed, documented, and merged into `main` when complete. The next phase is always created from the latest stable `main`.

**Rule:** `main` always represents the latest completed and stable phase.

## Documentation

Detailed phase documentation is maintained under `docs/phases/`.

- [Phase 1 — Foundation](docs/phases/PHASE-01-FOUNDATION.md)

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
```
