import { get, set } from 'idb-keyval'

/** IndexedDB に開封済みの手紙 ID を置くときの名前 */
const OPENED_KEY = 'arukukana:opened-capsules'

/**
 * 開封済みの手紙の ID を読む。
 * 「開けたかどうか」はこの端末にだけ覚えておき、サーバーには送らない（行動の履歴を残さないため）。
 * 覚えるのは ID だけで、手紙の文面は保存しない。
 */
export async function loadOpenedIds(): Promise<Set<string>> {
  return new Set((await get<string[]>(OPENED_KEY)) ?? [])
}

/** 開封済みの手紙の ID を保存する */
export async function saveOpenedIds(ids: Set<string>): Promise<void> {
  await set(OPENED_KEY, [...ids])
}
