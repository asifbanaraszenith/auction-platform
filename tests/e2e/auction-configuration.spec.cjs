/* eslint-disable @typescript-eslint/no-require-imports */
const { test, expect } = require("@playwright/test");

const superAdminEmail = process.env.E2E_EMAIL;
const superAdminPassword = process.env.E2E_PASSWORD;

function localInput(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function signIn(page, email, password) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
}

async function createAccount(page, name, email, password) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Create a new account", exact: true }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\//, { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !superAdminEmail || !superAdminPassword, "E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD are required.");
  await signIn(page, superAdminEmail, superAdminPassword);
});

test("full auction flow provisions roles, configures an auction, bids and settles a lot", async ({ page, browser }) => {
  const unique = Date.now();
  const adminName = `E2E Auction Admin ${unique}`;
  const bidderName = `E2E Bidder ${unique}`;
  const adminEmail = `e2e-admin-${unique}@example.com`;
  const bidderEmail = `e2e-bidder-${unique}@example.com`;
  const accountPassword = `E2e!${unique}Aa9`;
  const auctionName = `E2E Live Auction ${unique}`;
  const participantName = `E2E Participant ${unique}`;
  const participantEmail = `e2e-participant-${unique}@example.com`;

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await createAccount(adminPage, adminName, adminEmail, accountPassword);

  const bidderContext = await browser.newContext();
  const bidderPage = await bidderContext.newPage();
  await createAccount(bidderPage, bidderName, bidderEmail, accountPassword);

  const superAdminContext = await browser.newContext();
  const superAdminPage = await superAdminContext.newPage();
  await signIn(superAdminPage, superAdminEmail, superAdminPassword);

  await superAdminPage.goto("/admin");
  const adminHeading = superAdminPage.getByRole("heading", { name: "Make an Auction Admin", exact: true });
  try {
    await expect(adminHeading).toBeVisible({ timeout: 10_000 });
  } catch (error) {
    const diagnostics = await superAdminPage.evaluate(async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      const text = await response.text();
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.slice(0, 5000),
        meStatus: response.status,
        meBody: text.slice(0, 5000),
      };
    });
    console.error("SUPER_ADMIN_ADMIN_PAGE_DIAGNOSTICS", JSON.stringify(diagnostics, null, 2));
    throw error;
  }

  const adminSection = adminHeading.locator("xpath=ancestor::section[1]");
  await adminSection.getByLabel("REGISTERED ACCOUNT").selectOption({ label: `${adminName} — ${adminEmail}` });
  await adminSection.getByRole("button", { name: "MAKE AUCTION ADMIN", exact: true }).click();
  await expect(superAdminPage.getByText("Auction Admin access granted.", { exact: true })).toBeVisible();

  const bidderHeading = superAdminPage.getByRole("heading", { name: "Make a Bidder", exact: true });
  const bidderSection = bidderHeading.locator("xpath=ancestor::section[1]");
  await bidderSection.getByLabel("REGISTERED ACCOUNT").selectOption({ label: `${bidderName} — ${bidderEmail}` });
  await bidderSection.getByRole("button", { name: "MAKE BIDDER", exact: true }).click();
  await expect(superAdminPage.getByText("Bidder access granted.", { exact: true })).toBeVisible();

  await superAdminPage.goto("/auctions");
  await superAdminPage.getByRole("button", { name: "+ NEW AUCTION", exact: true }).first().click();

  const now = new Date();
  const start = new Date(now.getTime() + 15_000);
  const end = new Date(now.getTime() + 10 * 60_000);

  await superAdminPage.getByLabel("AUCTION NAME").fill(auctionName);
  await superAdminPage.getByLabel("START AT").fill(localInput(start));
  await superAdminPage.getByLabel("END AT").fill(localInput(end));
  await superAdminPage.getByRole("button", { name: "CREATE AUCTION", exact: true }).click();
  await superAdminPage.getByRole("button", { name: new RegExp(auctionName) }).first().click();
  await expect(superAdminPage.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();

  await superAdminPage.getByRole("button", { name: "Add category" }).click();
  await superAdminPage.getByLabel("CATEGORY NAME").fill("Diamond");
  await superAdminPage.getByRole("spinbutton", { name: "BASE PRICE", exact: true }).fill("100");
  await superAdminPage.getByRole("spinbutton", { name: "MINIMUM BASE PRICE", exact: true }).fill("50");
  await superAdminPage.getByRole("button", { name: "ADD CATEGORY", exact: true }).click();
  await expect(superAdminPage.getByText("Category added to this auction.", { exact: true })).toBeVisible();

  await superAdminPage.getByRole("button", { name: "Add participant" }).click();
  await superAdminPage.getByRole("button", { name: "CREATE NEW PARTICIPANT", exact: true }).click();
  await superAdminPage.getByLabel("NAME").fill(participantName);
  await superAdminPage.getByLabel("EMAIL").fill(participantEmail);
  await superAdminPage.getByRole("button", { name: "CREATE PARTICIPANT", exact: true }).click();
  await expect(superAdminPage.getByText(/Participant account created/)).toBeVisible();

  const addParticipantButton = superAdminPage.getByRole("button", { name: "ADD TO AUCTION", exact: true });
  await expect(addParticipantButton).toBeVisible();
  await expect(addParticipantButton).toBeDisabled();
  await superAdminPage.getByLabel("CATEGORY").selectOption({ label: "Diamond — 100 points" });
  await expect(addParticipantButton).toBeEnabled();
  await addParticipantButton.click();
  await expect(superAdminPage.getByText("1 participant added to this auction.", { exact: true })).toBeVisible();

  const adminAccessSection = superAdminPage.getByRole("heading", { name: "Assign auction admins", exact: true }).locator("..").locator("..");
  await adminAccessSection.getByRole("button", { name: "Select auction admins", exact: true }).click();
  await adminAccessSection.getByText(adminEmail, { exact: true }).click();
  await adminAccessSection.getByRole("button", { name: "SAVE ADMIN ASSIGNMENTS", exact: true }).click();
  await expect(superAdminPage.getByText("Auction admins updated successfully.", { exact: true })).toBeVisible();

  await adminPage.goto("/auctions");
  await expect(adminPage.getByText("AUCTION ADMIN", { exact: true })).toBeVisible();

  const auctionItem = adminPage.getByRole("button", { name: new RegExp(auctionName) }).first();
  await auctionItem.click();
  await expect(adminPage.getByRole("heading", { name: "Teams & squads", exact: true })).toBeVisible();

  await adminPage.getByLabel("BIDDER ACCOUNT").selectOption({ label: `${bidderName} — ${bidderEmail}` });
  await adminPage.getByLabel("INITIAL PURSE").fill("1000");
  await adminPage.getByRole("button", { name: "ADD BIDDER", exact: true }).click();
  await expect(adminPage.getByText("Bidder added to this auction.", { exact: true })).toBeVisible();

  const teamsSection = adminPage.getByRole("heading", { name: "Teams & squads", exact: true }).locator("..").locator("..");
  await teamsSection.getByLabel("TEAM NAME").fill(`E2E Team ${unique}`);
  await teamsSection.getByLabel("INITIAL PURSE").fill("1000");
  await teamsSection.getByLabel("MIN SQUAD").fill("0");
  await teamsSection.getByLabel("MAX SQUAD").fill("20");
  await teamsSection.getByRole("button", { name: "CREATE TEAM", exact: true }).click();
  await expect(adminPage.getByText("Team created.", { exact: true })).toBeVisible();

  const teamRow = teamsSection.locator("div").filter({ hasText: `E2E Team ${unique}` }).last();
  await teamRow.locator("select").selectOption({ label: bidderName });

  await adminPage.getByLabel("ELIGIBLE PARTICIPANT").selectOption({ label: new RegExp(participantName) });
  await adminPage.getByLabel("STARTING BID").fill("100");
  await adminPage.getByLabel("BID INCREMENT").fill("10");
  await adminPage.getByRole("button", { name: "ADD TO QUEUE", exact: true }).click();
  await expect(adminPage.getByText("Lot added to queue.", { exact: true })).toBeVisible();

  await expect(adminPage.getByText("Status: live", { exact: true })).toBeVisible({ timeout: 30_000 });
  await adminPage.getByRole("button", { name: "PAUSE AUCTION", exact: true }).click();
  await expect(adminPage.getByRole("button", { name: "RESUME AUCTION", exact: true })).toBeVisible();
  await adminPage.getByRole("button", { name: "RESUME AUCTION", exact: true }).click();
  await expect(adminPage.getByText("Status: live", { exact: true })).toBeVisible();

  await adminPage.getByRole("button", { name: "LIVE ROOM", exact: true }).click();
  await expect(adminPage.getByRole("heading", { name: auctionName, exact: true })).toBeVisible();
  await adminPage.getByRole("button", { name: "START NEXT LOT", exact: true }).click();
  await expect(adminPage.getByText(participantName, { exact: true })).toBeVisible();

  await bidderPage.goto(new URL(adminPage.url()).toString());
  await expect(bidderPage.getByRole("heading", { name: auctionName, exact: true })).toBeVisible();
  await expect(bidderPage.getByText("Available purse: 1000", { exact: true })).toBeVisible();
  const bidInput = bidderPage.locator('input[type="number"]').first();
  await bidInput.fill("100");
  await bidderPage.getByRole("button", { name: "PLACE BID", exact: true }).click();
  await expect(bidderPage.getByText("Action completed.", { exact: true })).toBeVisible();
  await expect(bidderPage.getByText("100", { exact: true }).first()).toBeVisible();

  await expect(adminPage.getByText(bidderName, { exact: true })).toBeVisible({ timeout: 15_000 });
  await adminPage.getByRole("button", { name: "SELL LOT", exact: true }).click();
  await expect(adminPage.getByText("Action completed.", { exact: true })).toBeVisible();
  await expect(adminPage.getByText("No active lot", { exact: true })).toBeVisible();

  await adminPage.getByRole("button", { name: "FINALIZE AUCTION", exact: true }).click();
  await expect(adminPage.getByText("Action completed.", { exact: true })).toBeVisible();
  await expect(adminPage.getByText("ended", { exact: true })).toBeVisible();

  await superAdminPage.goto("/auctions");
  const superAdminAuction = superAdminPage.getByRole("button", { name: new RegExp(auctionName) }).first();
  await superAdminAuction.click();
  superAdminPage.once("dialog", (dialog) => dialog.accept());
  await superAdminPage.getByRole("button", { name: "DELETE AUCTION", exact: true }).click();
  await expect(superAdminPage.getByText("Auction deleted.", { exact: true })).toBeVisible();

  await adminContext.close();
  await bidderContext.close();
  await superAdminContext.close();
});
