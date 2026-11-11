import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { buryCapsule } from '../../lib/capsules.ts'
import type { LatLng } from '../../lib/geo.ts'
import { useSession } from '../auth/sessionContext.ts'
import { useFriends } from '../friends/friendsContext.ts'
import { useCurrentLocation } from '../location/locationContext.ts'
import { MapView } from '../map/MapView.tsx'

const MESSAGE_MAX = 300
const HINT_MAX = 40
const NAME_MAX = 20
/** 開けられる半径（メートル） */
const RADIUS_M = 30
/** 差出人の名前を、この端末に覚えておくときの名前 */
const NAME_STORAGE_KEY = 'arukukana:sender-name'

type Status = 'editing' | 'sealing' | 'done' | 'error'

/**
 * 「ここに返事を埋める」から来たときに、画面の移動と一緒に受け取る値。
 * URL には入れない（場所が履歴に残らないようにするため）。
 */
export type BuryPreset = {
  /** あて先にしておく相手の uid */
  to: string
  /** 埋める場所にしておく地点 */
  spot: LatLng
}

/** <input type="date"> の値（例 2026-11-13）を、その日の 0 時（端末の時刻）の UNIX ミリ秒にする */
function startOfDay(dateText: string): number {
  const [year, month, day] = dateText.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

function loadSenderName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? ''
  } catch {
    return '' // プライベートブラウズなどで localStorage が使えないとき
  }
}

function saveSenderName(name: string) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name)
  } catch {
    // 覚えておけなくても、手紙を埋めるのには困らない
  }
}

export function BuryPage() {
  const session = useSession()
  const { position } = useCurrentLocation()
  const { friends } = useFriends()
  const preset = useLocation().state as BuryPreset | null

  const [message, setMessage] = useState('')
  const [hint, setHint] = useState('')
  const [senderName, setSenderName] = useState(loadSenderName)
  const [openDate, setOpenDate] = useState('')
  /** 埋める場所。地図をタップするまでは、いまいる場所 */
  const [pickedSpot, setPickedSpot] = useState<LatLng | null>(preset?.spot ?? null)
  /** あて先の uid。はじめは自分 */
  const [toUid, setToUid] = useState(preset?.to ?? session.uid)
  const [status, setStatus] = useState<Status>('editing')

  const spot = pickedSpot ?? position
  // あて先の公開鍵。自分なら手元の鍵、友だちなら追加したときに合言葉で確かめた鍵
  const friend = friends.find((candidate) => candidate.uid === toUid)
  const recipient =
    toUid === session.uid
      ? { uid: session.uid, publicKey: session.publicKey }
      : friend
        ? { uid: friend.uid, publicKey: friend.publicKey }
        : null
  const canSubmit =
    message.trim() !== '' &&
    senderName.trim() !== '' &&
    recipient !== null &&
    status !== 'sealing'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || recipient === null) return

    setStatus('sealing')
    try {
      await buryCapsule({
        from: { uid: session.uid, publicKey: session.publicKey },
        to: recipient,
        header: {
          lat: spot.lat,
          lng: spot.lng,
          radius: RADIUS_M,
          hint: hint.trim(),
          senderName: senderName.trim(),
          ...(openDate ? { openAfter: startOfDay(openDate) } : {}),
        },
        body: { message },
      })
      saveSenderName(senderName.trim())
      setStatus('done')
    } catch (error) {
      // エラーだけを出す。手紙の文面や座標はコンソールに出さない
      console.error('手紙を埋められませんでした', error)
      setStatus('error')
    }
  }

  function writeAnother() {
    setMessage('')
    setHint('')
    setOpenDate('')
    setPickedSpot(null)
    setStatus('editing')
  }

  if (status === 'done') {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-mincho text-3xl font-bold">埋めました</h1>
        <p className="text-muted">
          {friend ? `${friend.name} あてに、封をした手紙を埋めました。` : '封をした手紙を、その場所に埋めました。'}
          <br />
          {friend ? '相手の地図に出て、着いたときにだけ開けられます。' : '着いたときにだけ、開けられます。'}
        </p>
        <Link to="/" className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink">
          {friend ? '地図にもどる' : '地図で見る'}
        </Link>
        <button type="button" onClick={writeAnother} className="text-sm text-muted underline">
          もう 1 通書く
        </button>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
      <h1 className="font-mincho text-2xl font-bold">手紙を埋める</h1>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">あて先</span>
        <select
          value={toUid}
          onChange={(event) => setToUid(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2.5"
        >
          <option value={session.uid}>自分</option>
          {friends.map((candidate) => (
            <option key={candidate.uid} value={candidate.uid}>
              {candidate.name}
            </option>
          ))}
        </select>
        {friends.length === 0 && (
          <span className="text-xs text-muted">
            <Link to="/friends" className="underline">
              友だち
            </Link>
            を追加すると、その人あてにも埋められます。
          </span>
        )}
        {recipient === null && (
          <span role="alert" className="text-xs text-wax">
            このあて先の鍵がありません。あて先を選びなおしてください。
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-sm text-muted">
          <span>手紙</span>
          <span>
            {message.length} / {MESSAGE_MAX}
          </span>
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MESSAGE_MAX}
          rows={6}
          required
          placeholder="おつかれさま。"
          className="rounded-lg bg-paper px-4 py-3 font-mincho text-lg leading-relaxed text-paper-text placeholder:text-paper-text/40"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">差出人の名前</span>
        <input
          value={senderName}
          onChange={(event) => setSenderName(event.target.value)}
          maxLength={NAME_MAX}
          required
          placeholder="はは"
          className="rounded-lg border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">
          埋める場所（半径 {RADIUS_M}m）　地図をタップすると動かせます
        </span>
        <div className="h-48 overflow-hidden rounded-lg border border-line">
          <MapView position={spot} onTap={setPickedSpot} />
        </div>
        {pickedSpot && (
          <button
            type="button"
            onClick={() => setPickedSpot(null)}
            className="self-start text-sm text-muted underline"
          >
            いまいる場所に戻す
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">ヒント（開ける前に見える一言・なくてもよい）</span>
        <input
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          maxLength={HINT_MAX}
          placeholder="改札を出てすぐ"
          className="rounded-lg border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">開けられる日（なくてもよい）</span>
        <input
          type="date"
          value={openDate}
          onChange={(event) => setOpenDate(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2.5"
        />
      </label>

      {status === 'error' && (
        <p role="alert" className="text-sm text-wax">
          埋められませんでした。電波のよいところで、もう一度ためしてください。
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink disabled:opacity-50"
      >
        {status === 'sealing' ? '封をしています…' : '封をして埋める'}
      </button>
    </form>
  )
}
