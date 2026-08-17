# Super Admin Provisioning

Phase 03 intentionally does **not** allow a client to promote itself to Super Admin.

The Firestore rules recognize only the Firebase Authentication custom claim:

```json
{ "superAdmin": true }
```

## Provisioning procedure

1. Use a trusted Firebase Admin SDK environment (local secure workstation, Cloud Function, or CI secret store).
2. Authenticate the Admin SDK with a service account or Application Default Credentials.
3. Set the custom claim on the intended Firebase Auth user:

```ts
await getAuth().setCustomUserClaims(uid, { superAdmin: true });
```

4. Force the user to refresh their ID token by signing out/in or calling `getIdToken(true)` after provisioning.
5. Verify the user's token contains `superAdmin: true`.
6. Test creation of a `draft` auction.

## Important security boundary

Never put a service-account JSON key, Admin SDK private key, or other privileged credential in this repository, a browser bundle, or a `NEXT_PUBLIC_*` environment variable.

The repository's Firestore rules do not trust a `role: superAdmin` Firestore field. This prevents a user from writing their own privileged role document.

## Phase 03 operational dependency

The code-side authorization dependency is resolved. Before production CRUD testing, the production Firebase project still needs one trusted Super Admin claim provisioned and the repository's `firestore.rules` deployed through the Firebase toolchain.
