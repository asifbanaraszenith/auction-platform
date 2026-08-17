import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const SUPER_ADMIN_EMAILS = new Set([
  "asifbanaras.zenith@gmail.com",
  "shaistanazir.zenith@gmail.com",
]);

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }

  const auth = getAuth();

  for (const email of SUPER_ADMIN_EMAILS) {
    const user = await auth.getUserByEmail(email);
    const existingClaims = user.customClaims ?? {};

    await auth.setCustomUserClaims(user.uid, {
      ...existingClaims,
      superAdmin: true,
    });

    console.log(`Super Admin claim assigned: ${email} (${user.uid})`);
  }

  console.log("Bootstrap complete. Each user must sign out and sign in again to refresh their ID token.");
}

main().catch((error) => {
  console.error("Super Admin bootstrap failed:", error);
  process.exit(1);
});
