import { get, set } from 'idb-keyval'

/** IndexedDB に友だちの一覧を置くときの名前 */
const FRIENDS_KEY = 'arukukana:friends'

/** 手紙を送れる相手 */
export type Friend = {
  uid: string
  /** この端末で付けた呼び名。相手やサーバーには伝わらない */
  name: string
  /**
   * 追加したときの公開鍵（base64url raw）。
   * 手紙を送るたびにサーバーから読みなおさず、合言葉で確かめたこの鍵を使いつづける。
   */
  publicKey: string
  /** 追加した日時（UNIX ミリ秒） */
  addedAt: number
}

/**
 * 友だちの一覧を読む。
 * 一覧はこの端末にだけ置き、サーバーには送らない（だれとつながっているかを運営に知らせないため）。
 */
export async function loadFriends(): Promise<Friend[]> {
  return (await get<Friend[]>(FRIENDS_KEY)) ?? []
}

export async function saveFriends(friends: Friend[]): Promise<void> {
  await set(FRIENDS_KEY, friends)
}
