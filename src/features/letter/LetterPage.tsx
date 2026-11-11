import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { openBody } from '../../lib/crypto.ts'
import { checkOpenable, distanceMeters, formatDistance, remainingMeters } from '../../lib/geo.ts'
import { useSession } from '../auth/sessionContext.ts'
import { useCurrentLocation } from '../location/locationContext.ts'
import { useInbox } from './inboxContext.ts'

/** 「11月13日」のような日付にする */
function formatDate(time: number): string {
  return new Date(time).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
}

/** 手紙が見つからない・まだ開けられないときの、案内だけの画面 */
function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-mincho text-2xl font-bold">{title}</h1>
      <p className="text-muted">{children}</p>
      <Link to="/" className="rounded-full border border-line px-6 py-3">
        地図にもどる
      </Link>
    </section>
  )
}

/**
 * 手紙 1 通の画面。
 * まだ着いていない → 案内 ／ 着いた → 封筒と「封を切る」 ／ 封を切った → 紙面
 */
export function LetterPage() {
  const { id } = useParams()
  const { uid, privateKey } = useSession()
  const { position, accuracy } = useCurrentLocation()
  const { status, items, openedIds, markOpened } = useInbox()

  /** 封を切って取り出した文面。まだなら null。画面を離れたら消える（端末にも保存しない） */
  const [message, setMessage] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)
  // 「いま」は画面を開いた時点で 1 回だけ読む
  const [now] = useState(() => Date.now())

  const item = items.find((candidate) => candidate.capsule.id === id)

  if (status === 'loading') {
    return <p className="p-6 text-center text-muted">手紙をさがしています…</p>
  }
  if (!item) {
    return <Notice title="手紙が見つかりません">消されたか、あなたあてではない手紙です。</Notice>
  }
  if (!item.header) {
    return (
      <Notice title="この端末では開けません">
        この手紙は、別の鍵で封がされています。
        <br />
        封をしたときの端末でだけ開けられます。
      </Notice>
    )
  }

  const { capsule, header } = item
  const distance = distanceMeters(position, header)
  const alreadyOpened = openedIds.has(capsule.id)
  // 一度封を切った手紙は、どこからでも読み返せる
  const check = alreadyOpened
    ? 'ok'
    : checkOpenable({
        distance,
        radius: header.radius,
        accuracy,
        openAfter: header.openAfter,
        now,
      })

  async function breakSeal() {
    setOpening(true)
    setFailed(false)
    try {
      const body = await openBody(capsule, uid, privateKey)
      setMessage(body.message)
      markOpened(capsule.id)
    } catch (error) {
      // エラーだけを出す。手紙の文面はコンソールに出さない
      console.error('封を切れませんでした', error)
      setFailed(true)
    } finally {
      setOpening(false)
    }
  }

  if (check === 'too-far') {
    return (
      <Notice title={`${header.senderName} より`}>
        この手紙は、まだ開けられません。
        <br />
        あと {formatDistance(remainingMeters(distance, header.radius))} 歩くと開けられます。
        {header.hint && (
          <>
            <br />
            ヒント：{header.hint}
          </>
        )}
      </Notice>
    )
  }
  if (check === 'too-early' && header.openAfter !== undefined) {
    return (
      <Notice title={`${header.senderName} より`}>
        場所には着きました。
        <br />
        この手紙は、{formatDate(header.openAfter)}から開けられます。
      </Notice>
    )
  }

  // 封を切ったあと：紙面
  if (message !== null) {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        <article className="rounded-lg bg-paper px-6 py-8 text-paper-text shadow-lg">
          <p className="font-mincho text-lg leading-loose whitespace-pre-wrap">{message}</p>
          <p className="mt-8 text-right font-mincho">{header.senderName} より</p>
        </article>
        <Link
          to="/bury"
          className="rounded-full bg-gold px-6 py-3 text-center font-bold text-gold-ink"
        >
          ここに返事を埋める
        </Link>
      </section>
    )
  }

  // 封を切る前：封筒
  return (
    <section className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-muted">{alreadyOpened ? '前に開けた手紙です' : '着きました'}</p>

      <div className="relative flex h-44 w-72 items-center justify-center rounded-lg bg-paper shadow-lg">
        <p className="absolute left-5 top-4 font-mincho text-paper-text">{header.senderName} より</p>
        {/* 封蝋 */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-wax font-mincho text-2xl text-paper shadow-md">
          封
        </div>
      </div>

      {failed && (
        <p role="alert" className="text-sm text-wax">
          封を切れませんでした。もう一度ためしてください。
        </p>
      )}

      <button
        type="button"
        onClick={breakSeal}
        disabled={opening}
        className="rounded-full bg-gold px-8 py-3 font-bold text-gold-ink disabled:opacity-60"
      >
        {opening ? '封を切っています…' : '封を切る'}
      </button>
    </section>
  )
}
