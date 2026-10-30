import type { Page } from '@shared/contracts'
import type { PageQuery } from '../services/apiTypes'

/** Collect small metadata lists only; never use for full answer detail. */
export async function loadPages<T>(fetchPage: (query: PageQuery) => Promise<Page<T>>): Promise<Page<T>> {
  const items: T[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  do {
    const result = await fetchPage({ limit: 100, cursor })
    items.push(...result.items)
    cursor = result.nextCursor ?? undefined
    if (cursor && seen.has(cursor)) throw new Error('分页响应重复，请重新查询')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return { items, nextCursor: null }
}
