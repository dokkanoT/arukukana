import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchPublicKey } from '../../lib/users.ts'
import { useFriends } from './friendsContext.ts'
import { useFingerprint } from './useFingerprint.ts'

const NAME_MAX = 20

type Lookup =
  | { status: 'loading' }
  | { status: 'found'; publicKey: string }
  | { status: 'missing' }
  | { status: 'error' }

type Props = {
  /** 共有リンクに入っていた、相手の uid */
  uid: string
  /** 追加した・やめた、のどちらでも呼ばれる */
  onClose: () => void
}

/** 共有リンクを開いたときに出る、「この人を友だちに追加しますか」の枠 */
export function AddFriendPanel({ uid, onClose }: Props) {
  const { friends, addFriend } = useFriends()
  const existing = friends.find((friend) => friend.uid === uid)
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })
  const [name, setName] = useState(existing?.name ?? '')

  // 相手の公開鍵をサーバーから読む
  useEffect(() => {
    let cancelled = false
    fetchPublicKey(uid).then(
      (publicKey) => {
        if (cancelled) return
        setLookup(publicKey ? { status: 'found', publicKey } : { status: 'missing' })
      },
      () => {
        if (!cancelled) setLookup({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [uid])

  const words = useFingerprint(lookup.status === 'found' ? lookup.publicKey : null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (lookup.status !== 'found' || name.trim() === '') return
    addFriend({ uid, name: name.trim(), publicKey: lookup.publicKey, addedAt: Date.now() })
    onClose()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-gold/60 bg-surface p-4"
    >
      <h2 className="font-mincho text-xl font-bold">友だちに追加しますか</h2>

      {lookup.status === 'loading' && <p className="text-muted">相手の鍵をしらべています…</p>}
      {lookup.status === 'missing' && (
        <p className="text-muted">相手が見つかりませんでした。リンクをもう一度送ってもらってください。</p>
      )}
      {lookup.status === 'error' && (
        <p role="alert" className="text-sm text-wax">
          つながりませんでした。電波のよいところで、開きなおしてください。
        </p>
      )}

      {lookup.status === 'found' && (
        <>
          <div>
            <p className="text-sm text-muted">相手の鍵の合言葉</p>
            <p className="mt-1 font-mincho text-xl text-gold">{words}</p>
            <p className="mt-1 text-xs text-muted">
              相手の「友だち」画面に出ている合言葉と同じなら、本人の鍵です。
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">呼び名（あなたの端末にだけ保存します）</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NAME_MAX}
              required
              placeholder="おかあさん"
              className="rounded-lg border border-line bg-ink px-3 py-2.5"
            />
          </label>
        </>
      )}

      <div className="flex gap-3">
        {lookup.status === 'found' && (
          <button
            type="submit"
            disabled={name.trim() === ''}
            className="flex-1 rounded-full bg-gold px-4 py-2.5 font-bold text-gold-ink disabled:opacity-50"
          >
            {existing ? '上書きする' : '友だちに追加'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full border border-line px-4 py-2.5"
        >
          やめる
        </button>
      </div>
    </form>
  )
}
