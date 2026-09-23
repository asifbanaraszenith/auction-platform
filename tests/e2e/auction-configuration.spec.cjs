/* eslint-disable @typescript-eslint/no-require-imports */
const { test, expect } = require("@playwright/test");

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !email || !password, "E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD are required.");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(auctions|participant|admin)/, { timeout: 30_000 });
});

test("auction configuration can add a participant without expertise", async ({ page }) => {
  await page.goto("/auctions");
  await page.getByRole("button", { name: "+ NEW AUCTION", exact: true }).first().click();

  const now = new Date();
  const start = new Date(now.getTime() + 10 * 60_000);
  const end = new Date(now.getTime() + 70 * 60_000);
  const localInput = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  await page.getByLabel("AUCTION NAME").fill(`E2E Auction ${Date.now()}`);
  await page.getByLabel("START AT").fill(localInput(start));
  await page.getByLabel("END AT").fill(localInput(end));
  await page.getByRole("button", { name: "CREATE AUCTION", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add category" }).click();
  await page.getByLabel("CATEGORY NAME").fill("Diamond");
  await page.getByLabel("BASE PRICE").fill("100");
  await page.getByLabel("MINIMUM BASE PRICE").fill("50");
  await page.getByRole("button", { name: "ADD CATEGORY", exact: true }).click();
  await expect(page.getByText("Category added to this auction.")).toBeVisible();

  await page.getByRole("button", { name: "Add participant" }).click();
  await page.getByRole("button", { name: "CREATE NEW PARTICIPANT", exact: true }).click();
  const unique = Date.now();
  await page.getByLabel("NAME").fill(`E2E Participant ${unique}`);
  await page.getByLabel("EMAIL").fill(`e2e-participant-${unique}@example.com`);
  await page.getByRole("button", { name: "CREATE PARTICIPANT", exact: true }).click();

  await expect(page.getByText(/Participant account created/)).toBeVisible();
  await expect(page.getByText("1 participant selected", { exact: true })).toBeVisible();

  const addButton = page.getByRole("button", { name: "ADD TO AUCTION", exact: true });
  await expect(addButton).toBeVisible();
  await expect(addButton).toBeDisabled();

  await page.getByLabel("CATEGORY").selectOption({ label: "Diamond — 100 points" });
  await expect(addButton).toBeEnabled();

  // Expertise is intentionally left blank.
  await addButton.click();
  await expect(page.getByText("1 participant added to this auction.")).toBeVisible();
  await expect(page.getByText(new RegExp(`E2E Participant ${unique}.*Diamond`))).toBeVisible();
});
