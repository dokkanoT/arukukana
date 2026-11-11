import { createContext, useContext } from 'react'
import type { Friend } from '../../lib/friends.ts'

export type FriendsValue = {
  friends: Friend[]
  /** 友だちを追加する。同じ uid がすでにいれば、名前と鍵を上書きする */
  addFriend: (friend: Friend) => void
  removeFriend: (uid: string) => void
}

export const FriendsContext = createContext<FriendsValue | null>(null)

/** 友だちの一覧。FriendsProvider の内側でだけ使える */
export function useFriends(): FriendsValue {
  const value = useContext(FriendsContext)
  if (value === null) throw new Error('useFriends は FriendsProvider の内側で使ってください')
  return value
}
