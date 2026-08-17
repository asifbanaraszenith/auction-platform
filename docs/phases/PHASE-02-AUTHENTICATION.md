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
- Authenticated-session display and sign-out
- Responsive luxury dark-mode authentication UI
- Clear handling of `auth/unauthorized-domain` with the current hostname shown to the user
- Firebase client initialization for future Firestore use
- No Firebase credentials or service-account secrets committed to the repository

## Google sign-in domain requirement
The Firebase error `auth/unauthorized-domain` is a Firebase project configuration issue. Firebase requires the domain hosting the web app to be included in Authentication's Authorized domains for OAuth operations.

For the deployed application, add the exact hostname shown in the login-page error to Firebase Console → Authentication → Settings → Authorized domains. For local development, add `localhost` if needed; newer Firebase projects may not automatically authorize localhost.

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
- [x] Authenticated session and sign-out added
- [x] Responsive luxury authentication UI added
- [x] Unauthorized-domain error made actionable
- [x] CI lockfile generation handled
- [ ] Firebase Authorized Domains updated for the deployed hostname
- [ ] Production Google sign-in verified
- [ ] Production email/password sign-in verified
- [ ] Production sign-out verified
- [ ] Final Phase 02 pull request merged into `main`

## Verification plan
1. Run CI typecheck, lint, and production build.
2. Deploy through Firebase App Hosting.
3. Open `/login` on the production hostname.
4. Confirm the production hostname appears under Firebase Authentication → Settings → Authorized domains.
5. Verify account creation with email/password.
6. Verify email/password sign-in and session persistence.
7. Verify Google sign-in.
8. Verify authenticated-session display and sign-out.
9. Confirm no service-account secrets or `.env.local` files are committed.
10. Merge Phase 02 only after the production smoke test passes.

## Baseline for next phase
Phase 03 must be created from the latest stable `main` after Phase 02 is reviewed, merged, and production-authentication verified. `main` must contain only completed and validated phases.
