# Final Platform Release

## Scope

This release completes the remaining product workflow as a deployable MVP across Phases 6–11.

### Phase 6 — Auction Engine
- Auction lots and queue management.
- Starting bid and bid increment rules.
- Live/paused/sold/unsold lot lifecycle.
- Server-side lot settlement.

### Phase 7 — Live Bidding
- Dedicated live auction room.
- Bidder portal.
- Two-second state refresh for the live room.
- Transaction-safe bid acceptance.
- Minimum-bid enforcement.
- Bidder/team eligibility checks.

### Phase 8 — Purse & Squad Validation
- Team-level purse.
- Spent/available purse tracking.
- Maximum squad-size validation at settlement.
- Minimum squad-size validation at auction finalization.
- Sold participant assignment to winning team.
- Bid settlement and immutable bid history.

### Phase 9 — Administration
- Super Admin Auction Admin promotion.
- Auction-level admin assignment.
- Team/bidder administration.
- Auction audit log API.
- Auction finalization controls.

### Phase 10 — Testing & Security
- Server-side authorization on management and bidding APIs.
- Viewer/member management routes remain inaccessible.
- Bidding is validated inside Firestore transactions.
- No client-side purse or role value is trusted for privileged operations.
- CI must pass typecheck, lint and production build before release.

### Phase 11 — Deployment
- Firebase App Hosting remains the production hosting target.
- GitHub main is the stable release branch.
- Production deployment should be triggered by the repository's configured Firebase App Hosting integration.
- Final production smoke test is required after deployment.

## Operational flow

1. Super Admin promotes a user to Auction Admin.
2. Auction Admin creates/configures an auction.
3. Auction Admin creates teams and assigns bidder accounts.
4. Admin registers participants and creates the lot queue.
5. Admin opens the live auction room.
6. Bidders enter their assigned live auction and place bids.
7. Admin sells/marks lots unsold.
8. Settlement updates participant status and team/bidder spend.
9. Admin finalizes the auction after squad validation passes.
10. Audit history remains available through the auction audit API.

## Release limitation

This repository release is deployment-ready, but the model does not have direct access to the user's Firebase App Hosting control plane. Deployment must therefore be performed by the configured Firebase App Hosting/GitHub integration or by an authorized Firebase deployment command in the user's environment.


Validation: CI must pass before release merge.
