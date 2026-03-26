import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "chore-app-drafts";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

export interface DraftItem {
  itemId: number;
  isChecked: boolean;
}

export interface Draft {
  routineId: number;
  items: DraftItem[];
  startedAt: string;
  idempotencyKey: string;
  hasSubmissionFailed?: boolean;
  localDate?: string;
  randomizedOrder?: number[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "routineId" });
      },
    });
  }
  return dbPromise;
}

/** Exported for tests to reset the cached connection between runs. */
export function resetDbCache(): void {
  dbPromise = null;
}

export async function getDraft(routineId: number): Promise<Draft | undefined> {
  try {
    const db = await getDb();
    return (await db.get(STORE_NAME, routineId)) as Draft | undefined;
  } catch (error) {
    console.warn("Failed to read draft from IndexedDB", error);
    return undefined;
  }
}

export async function saveDraft(draft: Draft): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, draft);
  } catch (error) {
    console.warn("Failed to save draft to IndexedDB", error);
    throw error;
  }
}

export async function deleteDraft(routineId: number): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, routineId);
  } catch (error) {
    console.warn("Failed to delete draft from IndexedDB", error);
  }
}

export async function hasAnyActiveDraft(): Promise<boolean> {
  try {
    const db = await getDb();
    const allDrafts = (await db.getAll(STORE_NAME)) as Draft[];
    return allDrafts.some((draft) => draft.items.some((item) => item.isChecked));
  } catch {
    return false;
  }
}

export async function getDraftsWithFailedSubmission(): Promise<Draft[]> {
  try {
    const db = await getDb();
    const allDrafts = (await db.getAll(STORE_NAME)) as Draft[];
    return allDrafts.filter((draft) => draft.hasSubmissionFailed === true);
  } catch (error) {
    console.warn("Failed to read drafts from IndexedDB", error);
    return [];
  }
}
