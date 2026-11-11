import { useState } from 'react'
import { Link } from 'react-router'
import { distanceMeters, formatDistance, remainingMeters } from '../../lib/geo.ts'
import { useCurrentLocation } from '../location/locationContext.ts'
import { useInbox } from './inboxContext.ts'

/** 「11月13日」のような日付にする */
function formatDate(time: number): string {
  return new Date(time).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
}

export function InboxPage() {
  const { status, items } = useInbox()
  const { position } = useCurrentLocation()
  // 「いま」は画面を開いた時点で 1 回だけ読む（描画のたびに変わる値を、描画の中で直接読まないため）
  const [now] = useState(() => Date.now())

  // 開けられる手紙に距離を付けて、近い順に並べる
  const letters = items
    .flatMap((item) =>
      item.header
        ? [
            {
              id: item.capsule.id,
              header: item.header,
              // 円のふちまでの残り。地図のカードと同じ数え方にそろえる
              remaining: remainingMeters(distanceMeters(position, item.header), item.header.radius),
            },
          ]
        : [],
    )
    .sort((a, b) => a.remaining - b.remaining)
  const unreadableCount = items.length - letters.length

  if (status === 'loading') {
    return <p className="p-6 text-center text-muted">手紙をさがしています…</p>
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="font-mincho text-2xl font-bold">届いた手紙</h1>

      {status === 'error' && (
        <p role="alert" className="text-sm text-wax">
          手紙を読み込めませんでした。電波のよいところで、開きなおしてください。
        </p>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-muted">
            まだ手紙は届いていません。
            <br />
            まずは自分あてに 1 通、埋めてみませんか。
          </p>
          <Link to="/bury" className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink">
            手紙を埋める
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {letters.map(({ id, header, remaining }) => (
          <li key={id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mincho text-lg">{header.senderName} より</p>
              <p className="shrink-0 text-sm text-gold">
                {remaining === 0 ? '着きました' : `あと ${formatDistance(remaining)}`}
              </p>
            </div>
            {header.hint && <p className="mt-1 text-sm text-muted">{header.hint}</p>}
            {header.openAfter !== undefined && header.openAfter > now && (
              <p className="mt-2 text-xs text-muted">
                {formatDate(header.openAfter)}から開けられます
              </p>
            )}
          </li>
        ))}
      </ul>

      {unreadableCount > 0 && (
        <p className="text-xs text-muted">
          この端末では開けられない手紙が {unreadableCount} 通あります。
        </p>
      )}
    </section>
  )
}
