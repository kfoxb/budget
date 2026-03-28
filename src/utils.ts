import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";

const DATA_DIR = join(process.cwd(), "data");

export function getBudgetDir(budgetName: string): string {
  const safeName = budgetName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(DATA_DIR, safeName);
}

export async function saveJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log(`  saved ${filePath.replace(process.cwd() + "/", "")}`);
}

interface SyncState {
  lastSync: string;
  serverKnowledge: Record<string, number>;
}

function syncStatePath(budgetDir: string): string {
  return join(budgetDir, ".sync-state.json");
}

export async function loadSyncState(budgetDir: string): Promise<SyncState> {
  try {
    const raw = await readFile(syncStatePath(budgetDir), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastSync: "", serverKnowledge: {} };
  }
}

export async function saveSyncState(
  budgetDir: string,
  state: SyncState
): Promise<void> {
  state.lastSync = new Date().toISOString();
  await saveJson(syncStatePath(budgetDir), state);
}
