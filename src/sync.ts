import "dotenv/config";
import { join } from "node:path";
import { createClient, fetchAll } from "./ynab-client.js";
import { getBudgetDir, saveJson, loadSyncState, saveSyncState } from "./utils.js";

async function main() {
  const token = process.env.YNAB_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing YNAB_ACCESS_TOKEN in environment");
    process.exit(1);
  }

  const budgetId = process.env.YNAB_BUDGET_ID;
  if (!budgetId) {
    console.error("Missing YNAB_BUDGET_ID in environment");
    console.error("Run with YNAB_BUDGET_ID=last to use the last used budget,");
    console.error("or set it to your budget's UUID.");
    console.error("\nTo find your budget ID, visit https://app.ynab.com and copy it from the URL.");
    process.exit(1);
  }

  const client = createClient(token);

  // Resolve "last" as a shortcut for the last-used budget
  let resolvedBudgetId = budgetId;
  if (budgetId === "last") {
    console.log("Resolving last-used budget...");
    const budgets = await client.budgets.getBudgets();
    const sorted = budgets.data.budgets.sort(
      (a, b) =>
        new Date(b.last_modified_on!).getTime() -
        new Date(a.last_modified_on!).getTime()
    );
    resolvedBudgetId = sorted[0].id;
    console.log(`Using budget: ${sorted[0].name} (${resolvedBudgetId})`);
  }

  // Load previous sync state for delta requests
  // We need the budget name first, so do a quick fetch
  console.log("\n--- Syncing budget data ---\n");
  const result = await fetchAll(client, resolvedBudgetId, {});

  const budgetDir = getBudgetDir(result.budget.name);

  // Save top-level data
  await saveJson(join(budgetDir, "budget.json"), {
    id: result.budget.id,
    name: result.budget.name,
    last_modified_on: result.budget.last_modified_on,
    first_month: result.budget.first_month,
    last_month: result.budget.last_month,
    currency_format: result.budget.currency_format,
    date_format: result.budget.date_format,
  });

  await saveJson(join(budgetDir, "settings.json"), result.settings);
  await saveJson(join(budgetDir, "accounts.json"), result.accounts);
  await saveJson(join(budgetDir, "categories.json"), result.categories);
  await saveJson(join(budgetDir, "payees.json"), result.payees);
  await saveJson(join(budgetDir, "payee-locations.json"), result.payeeLocations);
  await saveJson(join(budgetDir, "scheduled-transactions.json"), result.scheduledTransactions);

  // Save month details individually
  for (const [monthStr, detail] of result.monthDetails) {
    await saveJson(join(budgetDir, "months", `${monthStr}.json`), detail);
  }

  // Group transactions by month and save
  const txByMonth = new Map<string, typeof result.transactions>();
  for (const tx of result.transactions) {
    const month = tx.date.slice(0, 7); // "2024-01"
    if (!txByMonth.has(month)) txByMonth.set(month, []);
    txByMonth.get(month)!.push(tx);
  }
  for (const [month, txs] of txByMonth) {
    await saveJson(
      join(budgetDir, "transactions", `${month}.json`),
      txs
    );
  }

  // Save sync state for future delta syncs
  await saveSyncState(budgetDir, {
    lastSync: "",
    serverKnowledge: result.serverKnowledge,
  });

  console.log(
    `\nDone! Synced ${result.accounts.length} accounts, ` +
    `${result.transactions.length} transactions across ${txByMonth.size} months, ` +
    `${result.monthDetails.size} month budgets, ` +
    `${result.payees.length} payees, ` +
    `${result.scheduledTransactions.length} scheduled transactions.`
  );
}

main().catch((err) => {
  console.error("Sync failed:", err.message || err);
  process.exit(1);
});
