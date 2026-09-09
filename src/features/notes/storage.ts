import type { Note } from './types'

const DB_NAME = 'knowledge-notes'
const DB_VERSION = 1
const STORE = 'notes'

/**
 * Thin promise wrapper over IndexedDB. IndexedDB rather than localStorage so
 * the base can grow past the ~5MB string cap and keep structured records.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('topicKey', 'topicKey', { unique: false })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Run one request in its own transaction and resolve only once that
 * transaction has committed. Resolving on `request.onsuccess` would be
 * earlier but a lie: the write is not yet durable, so a reload immediately
 * after an await could still read the old value.
 */
function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = work(tx.objectStore(STORE))
        let result: T
        request.onsuccess = () => {
          result = request.result
        }
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => {
          db.close()
          resolve(result)
        }
        tx.onabort = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

export const notesStore = {
  all(): Promise<Note[]> {
    return run<Note[]>('readonly', (store) => store.getAll() as IDBRequest<Note[]>)
  },
  put(note: Note): Promise<void> {
    return run('readwrite', (store) => store.put(note)).then(() => undefined)
  },
  remove(id: string): Promise<void> {
    return run('readwrite', (store) => store.delete(id)).then(() => undefined)
  },
  clear(): Promise<void> {
    return run('readwrite', (store) => store.clear()).then(() => undefined)
  },
  /** Replace the whole base in one transaction — used by import. */
  replaceAll(notes: Note[]): Promise<void> {
    return openDatabase().then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite')
          const store = tx.objectStore(STORE)
          store.clear()
          notes.forEach((note) => store.put(note))
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        }),
    )
  },
}

/** True when the browser exposes IndexedDB at all (private modes may not). */
export function storageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
