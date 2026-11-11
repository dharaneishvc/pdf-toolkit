import { openDB } from 'idb'

export type HistoryEntry = { id: string; tool: string; name: string; time: number }
const database = () => openDB('local-tools-' + document.title, 1, { upgrade(db) { db.createObjectStore('preferences'); db.createObjectStore('history', { keyPath: 'id' }) } })
export async function getFavorites(): Promise<string[]> { return (await (await database()).get('preferences', 'favorites')) ?? [] }
export async function setFavorites(ids: string[]) { await (await database()).put('preferences', ids, 'favorites') }
export async function getHistory(): Promise<HistoryEntry[]> { return ((await (await database()).getAll('history')) as HistoryEntry[]).sort((first, second) => second.time - first.time) }
export async function recordHistory(tool: string, name: string) {
  const db = await database()
  const transaction = db.transaction('history', 'readwrite')
  const entries = ((await transaction.store.getAll()) as HistoryEntry[]).sort((first, second) => second.time - first.time)
  for (const entry of entries.slice(49)) await transaction.store.delete(entry.id)
  await transaction.store.put({ id: crypto.randomUUID(), tool, name, time: Date.now() })
  await transaction.done
}
export async function clearHistory() { await (await database()).clear('history') }