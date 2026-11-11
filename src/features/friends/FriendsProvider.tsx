import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loadFriends, saveFriends } from '../../lib/friends.ts'
import type { Friend } from '../../lib/friends.ts'
import { FriendsContext } from './friendsContext.ts'
import type { FriendsValue } from './friendsContext.ts'

/** 友だちの一覧を端末から読み、全画面に配る。変えたら端末に保存する */
export function FriendsProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<Friend[]>([])

  useEffect(() => {
    let cancelled = false
    loadFriends().then(
      (loaded) => {
        if (cancelled) return
        // 読み込みを待つあいだに追加された友だちがいれば、そちらを優先して残す
        setFriends((current) => [
          ...current,
          ...loaded.filter((friend) => !current.some((added) => added.uid === friend.uid)),
        ])
      },
      (error) => console.error('友だちの一覧を読み込めませんでした', error),
    )
    return () => {
      cancelled = true
    }
  }, [])

  /** 一覧を作りなおして、端末にも保存する */
  const update = useCallback((change: (current: Friend[]) => Friend[]) => {
    setFriends((current) => {
      const next = change(current)
      void saveFriends(next).catch((error) =>
        console.error('友だちの一覧を保存できませんでした', error),
      )
      return next
    })
  }, [])

  const addFriend = useCallback(
    (friend: Friend) =>
      update((current) => [...current.filter((other) => other.uid !== friend.uid), friend]),
    [update],
  )

  const removeFriend = useCallback(
    (uid: string) => update((current) => current.filter((friend) => friend.uid !== uid)),
    [update],
  )

  const value = useMemo<FriendsValue>(
    () => ({ friends, addFriend, removeFriend }),
    [friends, addFriend, removeFriend],
  )

  return <FriendsContext value={value}>{children}</FriendsContext>
}
