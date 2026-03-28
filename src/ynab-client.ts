import * as ynab from "ynab";

export function createClient(accessToken: string): ynab.api {
  return new ynab.API(accessToken);
}

export interface SyncResult {
  budget: ynab.BudgetDetail;
  settings: ynab.BudgetSettings;
  accounts: ynab.Account[];
  categories: ynab.CategoryGroupWithCategories[];
  payees: ynab.Payee[];
  payeeLocations: ynab.PayeeLocation[];
  months: ynab.MonthSummary[];
  monthDetails: Map<string, ynab.MonthDetail>;
  transactions: ynab.TransactionDetail[];
  scheduledTransactions: ynab.ScheduledTransactionDetail[];
  serverKnowledge: Record<string, number>;
}

export async function fetchAll(
  client: ynab.api,
  budgetId: string,
  prevKnowledge: Record<string, number>
): Promise<SyncResult> {
  const sk: Record<string, number> = {};

  // Budget detail (includes accounts, categories, etc. but we also fetch individually for delta support)
  console.log("Fetching budget...");
  const budgetRes = await client.budgets.getBudgetById(budgetId);
  const budget = budgetRes.data.budget;

  console.log("Fetching settings...");
  const settingsRes = await client.budgets.getBudgetSettingsById(budgetId);
  const settings = settingsRes.data.settings;

  console.log("Fetching accounts...");
  const accountsRes = await client.accounts.getAccounts(budgetId);
  const accounts = accountsRes.data.accounts;

  console.log("Fetching categories...");
  const categoriesRes = await client.categories.getCategories(
    budgetId,
    prevKnowledge["categories"]
  );
  const categories = categoriesRes.data.category_groups;
  sk["categories"] = categoriesRes.data.server_knowledge;

  console.log("Fetching payees...");
  const payeesRes = await client.payees.getPayees(
    budgetId,
    prevKnowledge["payees"]
  );
  const payees = payeesRes.data.payees;
  sk["payees"] = payeesRes.data.server_knowledge;

  console.log("Fetching payee locations...");
  const payeeLocationsRes = await client.payeeLocations.getPayeeLocations(budgetId);
  const payeeLocations = payeeLocationsRes.data.payee_locations;

  console.log("Fetching months...");
  const monthsRes = await client.months.getBudgetMonths(
    budgetId,
    prevKnowledge["months"]
  );
  const months = monthsRes.data.months;
  sk["months"] = monthsRes.data.server_knowledge;

  // Fetch detail for each month (includes per-category budget data)
  console.log(`Fetching details for ${months.length} months...`);
  const monthDetails = new Map<string, ynab.MonthDetail>();
  for (const month of months) {
    const monthStr = month.month;
    const detail = await client.months.getBudgetMonth(budgetId, monthStr);
    monthDetails.set(monthStr, detail.data.month);
  }

  console.log("Fetching transactions...");
  const transactionsRes = await client.transactions.getTransactions(
    budgetId,
    undefined,
    undefined,
    prevKnowledge["transactions"]
  );
  const transactions = transactionsRes.data.transactions;
  sk["transactions"] = transactionsRes.data.server_knowledge;

  console.log("Fetching scheduled transactions...");
  const scheduledRes = await client.scheduledTransactions.getScheduledTransactions(
    budgetId,
    prevKnowledge["scheduledTransactions"]
  );
  const scheduledTransactions = scheduledRes.data.scheduled_transactions;
  sk["scheduledTransactions"] = scheduledRes.data.server_knowledge;

  return {
    budget,
    settings,
    accounts,
    categories,
    payees,
    payeeLocations,
    months,
    monthDetails,
    transactions,
    scheduledTransactions,
    serverKnowledge: sk,
  };
}
