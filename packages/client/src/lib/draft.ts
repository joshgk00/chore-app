import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "chore-app-drafts";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

export interface DraftItem {
  itemId: number;
  checked: boolean;
}

export interface Draft {
  routineId: number;
  items: DraftItem[];
  startedAt: string;
  idempotencyKey: string;
  submissionFailed?: boolean;
}

async function openDraftDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: "routineId" });
    },
  });
}

export async function getDraft(routineId: number): Promise<Draft | undefined> {
  const db = await openDraftDb();
  return db.get(STORE_NAME, routineId) as Promise<Draft | undefined>;
}

export async function saveDraft(draft: Draft): Promise<void> {
  const db = await openDraftDb();
  await db.put(STORE_NAME, draft);
}

export async function deleteDraft(routineId: number): Promise<void> {
  const db = await openDraftDb();
  await db.delete(STORE_NAME, routineId);
}

export async function getDraftsWithFailedSubmission(): Promise<Draft[]> {
  const db = await openDraftDb();
  const all = (await db.getAll(STORE_NAME)) as Draft[];
  return all.filter((d) => d.submissionFailed === true);
}
