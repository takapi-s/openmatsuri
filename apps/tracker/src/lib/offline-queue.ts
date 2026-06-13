const DB_NAME = "festival-tracker-queue";
const STORE_NAME = "locations";

type QueuedLocation = {
  id?: number;
  token: string;
  lat: number;
  lng: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueLocation(item: Omit<QueuedLocation, "id">) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushQueue(
  send: (item: QueuedLocation) => Promise<boolean>,
): Promise<number> {
  const db = await openDb();
  const items = await new Promise<QueuedLocation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueuedLocation[]);
    req.onerror = () => reject(req.error);
  });

  let sent = 0;
  for (const item of items) {
    const ok = await send(item);
    if (!ok) break;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(item.id!);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    sent++;
  }
  return sent;
}

export async function getQueueSize(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
