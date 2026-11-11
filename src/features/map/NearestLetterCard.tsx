import type { CapsuleHeader } from '../../lib/crypto.ts'
import { formatDistance } from '../../lib/geo.ts'

/** この距離より手前から、進捗バーが伸びはじめる（メートル） */
const PROGRESS_START_M = 500

type Props = {
  header: CapsuleHeader
  /** 円のふちまでの残り（メートル）。0 なら着いている */
  remaining: number
  /** 「デモ：ここまで歩いたことにする」を押したとき */
  onWalkThere: () => void
}

/** いちばん近い手紙のカード。差出人・ヒント・残りの距離・進捗バーを出す */
export function NearestLetterCard({ header, remaining, onWalkThere }: Props) {
  const arrived = remaining === 0
  // 500m 手前で 0%、着いたら 100%
  const progress = Math.min(1, Math.max(0, 1 - remaining / PROGRESS_START_M))

  return (
    <div className="rounded-2xl border border-line bg-surface/95 p-4 shadow-lg">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mincho text-lg">{header.senderName} より</p>
        <p className="shrink-0 text-sm text-gold">
          {arrived ? '着きました' : `あと ${formatDistance(remaining)}`}
        </p>
      </div>
      {header.hint && <p className="mt-1 text-sm text-muted">{header.hint}</p>}

      <div
        role="progressbar"
        aria-label="手紙までの近さ"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-gold" style={{ width: `${progress * 100}%` }} />
      </div>

      {!arrived && (
        <button
          type="button"
          onClick={onWalkThere}
          className="mt-3 w-full rounded-full border border-gold/60 px-4 py-2 text-sm text-gold"
        >
          デモ：ここまで歩いたことにする
        </button>
      )}
    </div>
  )
}
