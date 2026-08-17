# Phase 02 — Authentication

## Purpose
Establish a reusable authentication foundation using Firebase Authentication for the Auction Platform.

## Dependencies
- Firebase project: Auction Platform
- Firebase Web App: Auction Platform Web
- Firebase Authentication enabled
- Email/password provider enabled
- Google provider enabled
- Cloud Firestore Standard edition created in `asia-south1`
- Production-mode Firestore rules

## Included
- Firebase JavaScript SDK integration
- Firebase App Hosting automatic Web SDK configuration for production
- Local-development Firebase configuration fallback through environment variables
- Shared Firebase Auth state provider
- Email/password sign-in
- Email/password account creation
- Google sign-in
- Authentication entry page at `/login`
- Firebase client initialization for future Firestore use
- No Firebase credentials or service-account secrets committed to the repository

## Security boundary
Firebase App Hosting automatically supplies the Firebase Web App configuration to the JavaScript SDK, so production does not require duplicated `NEXT_PUBLIC_FIREBASE_*` values in source control. The local-development fallback uses `.env.local`, which is ignored by Git. Firebase Web configuration values are client configuration, not service-account secrets; privileged server credentials must remain server-side and must never be committed.

## Phase completion checklist
- [x] Firebase project created
- [x] Firebase Web App registered
- [x] Firebase Authentication providers configured
- [x] Firestore database created
- [x] Firebase SDK dependency added
- [x] Firebase App Hosting automatic Web SDK initialization supported
- [x] Auth state provider added
- [x] Email/password authentication UI added
- [x] Google authentication UI added
- [x] Authentication entry point added
- [x] CI lockfile generation handled
- [ ] CI typecheck/lint/build verification on the final phase commit
- [ ] End-to-end authentication verification against the Firebase project
- [ ] Pull request review
- [ ] Merge into `main`

## Verification plan
1. Install dependencies and run typecheck, lint, and production build.
2. Verify the Firebase Web SDK initializes automatically on Firebase App Hosting.
3. Open `/login` on the production deployment.
4. Verify account creation with email/password.
5. Verify sign-in and sign-out/session persistence.
6. Verify Google sign-in from the authorized production domain.
7. Confirm no service-account secrets or `.env.local` files are committed.
8. Run CI on the final phase commit and PR.
9. Merge only after the manual authentication checks pass.

## Baseline for next phase
Phase 03 must be created from the latest stable `main` after Phase 02 is reviewed and merged. `main` must contain only completed and validated phases.
