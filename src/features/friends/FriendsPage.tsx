import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Friend } from '../../lib/friends.ts'
import { useSession } from '../auth/sessionContext.ts'
import { AddFriendPanel } from './AddFriendPanel.tsx'
import { useFriends } from './friendsContext.ts'
import { useFingerprint } from './useFingerprint.ts'

/** 共有リンクに入れる、相手の uid のパラメータ名（例：/friends?add=xxxx） */
const ADD_PARAM = 'add'

function FriendRow({ friend, onRemove }: { friend: Friend; onRemove: () => void }) {
  const words = useFingerprint(friend.publicKey)
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="min-w-0">
        <p className="font-mincho text-lg">{friend.name}</p>
        <p className="text-xs text-muted">{words}</p>
      </div>
      <button type="button" onClick={onRemove} className="shrink-0 text-sm text-muted underline">
        消す
      </button>
    </li>
  )
}

export function FriendsPage() {
  const { uid, publicKey } = useSession()
  const { friends, removeFriend } = useFriends()
  const [searchParams, setSearchParams] = useSearchParams()
  const [shareNote, setShareNote] = useState('')
  const myWords = useFingerprint(publicKey)

  const addUid = searchParams.get(ADD_PARAM)
  // リンクに入れるのは uid だけ。公開鍵は、開いた側がサーバーから読む
  const shareUrl = `${window.location.origin}/friends?${ADD_PARAM}=${encodeURIComponent(uid)}`

  async function share() {
    setShareNote('')
    try {
      if (navigator.share) {
        // スマホでは、LINE やメールなどを選ぶ画面が出る
        await navigator.share({
          title: 'アルクカナ',
          text: 'アルクカナで、わたしあての手紙を埋められます。',
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setShareNote('リンクをコピーしました。相手に送ってください。')
      }
    } catch (error) {
      // 共有の画面を閉じただけのときは、何も言わない
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareNote('共有できませんでした。下のリンクをコピーして送ってください。')
    }
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="font-mincho text-2xl font-bold">友だち</h1>

      {addUid !== null &&
        (addUid === uid ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <p className="text-muted">
              これは、あなた自身のリンクです。手紙を送ってほしい相手に送ってください。
            </p>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="self-start text-sm underline"
            >
              閉じる
            </button>
          </div>
        ) : (
          // key を付けて、別の人のリンクを開いたら入力を作りなおす
          <AddFriendPanel key={addUid} uid={addUid} onClose={() => setSearchParams({})} />
        ))}

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <p className="text-sm text-muted">あなたの鍵の合言葉</p>
          <p className="mt-1 font-mincho text-2xl text-gold">{myWords}</p>
        </div>
        <p className="text-sm text-muted">
          下のリンクを送ると、相手があなたあてに手紙を埋められるようになります。相手の画面に出る合言葉がこれと同じなら、あなたの鍵です。
        </p>
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink"
        >
          リンクで送る
        </button>
        {shareNote && <p className="text-sm text-muted">{shareNote}</p>}
        <p className="font-mono text-xs break-all text-muted">{shareUrl}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mincho text-lg font-bold">手紙を送れる相手</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">
            まだいません。相手からリンクを送ってもらって開くと、ここに追加できます。
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {friends.map((friend) => (
              <FriendRow
                key={friend.uid}
                friend={friend}
                onRemove={() => removeFriend(friend.uid)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
