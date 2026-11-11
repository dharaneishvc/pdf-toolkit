import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearHistory, getFavorites, getHistory, recordHistory, setFavorites } from './storage'
beforeEach(() => { vi.stubGlobal('document', { title: crypto.randomUUID() }) })
describe('private local persistence', () => {
  it('starts empty and persists favorites', async () => { expect(await getFavorites()).toEqual([]); await setFavorites(['json-format']); expect(await getFavorites()).toEqual(['json-format']) })
  it('records metadata only, not content', async () => { await recordHistory('hash', 'SHA hash'); const history = await getHistory(); expect(history).toHaveLength(1); expect(Object.keys(history[0]).sort()).toEqual(['id', 'name', 'time', 'tool']); expect(history[0].tool).toBe('hash') })
  it('caps history at 50 jobs', async () => { for (let index = 0; index < 60; index++) await recordHistory('tool', `Job ${index}`); expect(await getHistory()).toHaveLength(50) })
  it('clears all history', async () => { await recordHistory('tool', 'Test'); await clearHistory(); expect(await getHistory()).toEqual([]) })
})