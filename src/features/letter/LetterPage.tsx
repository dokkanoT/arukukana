import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { openBody } from '../../lib/crypto.ts'
import { checkOpenable, distanceMeters, formatDistance, remainingMeters } from '../../lib/geo.ts'
import { useSession } from '../auth/sessionContext.ts'
import type { BuryPreset } from '../bury/BuryPage.tsx'
import { useFriends } from '../friends/friendsContext.ts'
import { useCurrentLocation } from '../location/locationContext.ts'
import { Envelope } from './Envelope.tsx'
import { useInbox } from './inboxContext.ts'

/**
 * 封蝋が割れる演出（1 秒弱）が終わらなかったときに、紙面を出すまで待つ時間（ミリ秒）。
 * タブが裏に回っているなど、ブラウザが動きを止めていると、演出の「終わった」が届かないことがある。
 */
const REVEAL_FALLBACK_MS = 1500

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
 * まだ着いていない → 案内 ／ 着いた → 封筒と「封を切る」 ／ 封を切った → 封蝋が割れる → 紙面
 */
export function LetterPage() {
  const { id } = useParams()
  const { uid, privateKey } = useSession()
  const { position, accuracy } = useCurrentLocation()
  const { status, items, openedIds, markOpened } = useInbox()
  const { friends } = useFriends()

  /** 封を切って取り出した文面。まだなら null。画面を離れたら消える（端末にも保存しない） */
  const [message, setMessage] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  /** 封蝋が割れる演出が終わったか。終わってから紙面を出す */
  const [revealed, setRevealed] = useState(false)
  const reduceMotion = useReducedMotion()
  const [failed, setFailed] = useState(false)
  // 「いま」は画面を開いた時点で 1 回だけ読む
  const [now] = useState(() => Date.now())

  // 保険：文面が取れたのに演出が終わらないときも、少し待てば必ず紙面を出す
  useEffect(() => {
    if (message === null || revealed || id === undefined) return
    const timer = setTimeout(() => {
      setRevealed(true)
      markOpened(id)
    }, REVEAL_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [message, revealed, id, markOpened])

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

  // 返事を書けるのは、差出人が自分か、友だちにいるとき
  const canReply = capsule.from === uid || friends.some((friend) => friend.uid === capsule.from)

  async function breakSeal() {
    setOpening(true)
    setFailed(false)
    try {
      const body = await openBody(capsule, uid, privateKey)
      // ここではまだ「開封済み」にしない。封蝋が割れおわってから記録する（下の onBroken）
      setMessage(body.message)
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

  // 封を切ったあと：紙面。封蝋が割れおわってから、下からふわっと出す
  if (message !== null && revealed) {
    return (
      <motion.section
        className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <article className="rounded-lg bg-paper px-6 py-8 text-paper-text shadow-lg">
          <p className="font-mincho text-lg leading-loose whitespace-pre-wrap">{message}</p>
          <p className="mt-8 text-right font-mincho">{header.senderName} より</p>
        </article>
        {canReply ? (
          <Link
            to="/bury"
            // あて先と場所は URL に入れず、画面の移動と一緒に渡す
            state={{ to: capsule.from, spot: { lat: header.lat, lng: header.lng } } satisfies BuryPreset}
            className="rounded-full bg-gold px-6 py-3 text-center font-bold text-gold-ink"
          >
            ここに返事を埋める
          </Link>
        ) : (
          // 返事を送るには、差出人の公開鍵が要る。まだ友だちにいなければ、追加の画面へ案内する
          <Link
            to={`/friends?add=${encodeURIComponent(capsule.from)}`}
            className="rounded-full bg-gold px-6 py-3 text-center font-bold text-gold-ink"
          >
            差出人を友だちに追加して、返事を書く
          </Link>
        )}
        {/* ふだん使う人の導線には出さない、控えめなリンク */}
        <Link
          to={`/letter/${capsule.id}/server`}
          className="self-center text-sm text-muted underline"
        >
          しくみを見る
        </Link>
      </motion.section>
    )
  }

  // 封を切る前：封筒
  return (
    <section className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-muted">{alreadyOpened ? '前に開けた手紙です' : '着きました'}</p>

      {/* 復号に成功して文面が取れたら、封蝋を割る。失敗したときは割らない */}
      <Envelope
        senderName={header.senderName}
        broken={message !== null}
        onBroken={() => {
          setRevealed(true)
          // 演出の途中で記録すると、封筒の上の文字が「前に開けた手紙です」に変わってしまうので、ここで記録する
          markOpened(capsule.id)
        }}
      />

      {failed && (
        <p role="alert" className="text-sm text-wax">
          封を切れませんでした。もう一度ためしてください。
        </p>
      )}

      <button
        type="button"
        onClick={breakSeal}
        // 演出のあいだ（文面は取れたが、まだ紙面を出していない）も押せないようにする
        disabled={opening || message !== null}
        className="rounded-full bg-gold px-8 py-3 font-bold text-gold-ink disabled:opacity-60"
      >
        {opening || message !== null ? '封を切っています…' : '封を切る'}
      </button>
    </section>
  )
}
