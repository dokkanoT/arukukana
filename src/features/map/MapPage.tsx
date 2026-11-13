import { useMemo } from 'react'
import { Link } from 'react-router'
import { distanceMeters, remainingMeters } from '../../lib/geo.ts'
import { useInbox } from '../letter/inboxContext.ts'
import { useCurrentLocation } from '../location/locationContext.ts'
import { MapView } from './MapView.tsx'
import type { MapCircle } from './MapView.tsx'
import { NearestLetterCard } from './NearestLetterCard.tsx'

/** この距離より近い手紙は、地図で金色に光らせる（メートル） */
const NEAR_M = 150

const gpsMessages = {
  idle: '',
  requesting: '現在地をしらべています…',
  active: '',
  denied: '位置情報が許可されていません。デモモードで試せます。',
  unavailable: '現在地がわかりませんでした。デモモードで試せます。',
}

export function MapPage() {
  const { source, position, gpsStatus, startGps, moveTo } = useCurrentLocation()
  const { status, items, openedIds } = useInbox()
  const isDemo = source === 'manual'
  const message = gpsMessages[gpsStatus]

  // 開けられる手紙に、円のふちまでの残りを付けて、近い順に並べる
  const letters = useMemo(
    () =>
      items
        .flatMap((item) =>
          item.header
            ? [
                {
                  id: item.capsule.id,
                  header: item.header,
                  remaining: remainingMeters(
                    distanceMeters(position, item.header),
                    item.header.radius,
                  ),
                },
              ]
            : [],
        )
        .sort((a, b) => a.remaining - b.remaining),
    [items, position],
  )
  // カードに出すのは、まだ開けていない手紙のうち、いちばん近いもの。全部開けていれば、いちばん近い手紙
  const nearest = letters.find((letter) => !openedIds.has(letter.id)) ?? letters.at(0)

  const circles = useMemo<MapCircle[]>(
    () =>
      letters.map((letter) => ({
        id: letter.id,
        center: { lat: letter.header.lat, lng: letter.header.lng },
        radius: letter.header.radius,
        near: letter.remaining <= NEAR_M,
      })),
    [letters],
  )

  return (
    <section className="relative h-full">
      {/* デモモードのときだけ、タップした場所を現在地にする */}
      <MapView position={position} onTap={isDemo ? moveTo : undefined} circles={circles} />

      {/* 地図の上に重ねる操作。pointer-events-none で、何もないところのタップは地図に通す */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3">
        {isDemo ? (
          <>
            <p className="rounded-full border border-gold/60 bg-surface/90 px-4 py-1.5 text-sm text-gold">
              デモ：タップした場所に移動
            </p>
            <button
              type="button"
              onClick={startGps}
              disabled={gpsStatus === 'requesting'}
              className="pointer-events-auto rounded-full border border-line bg-surface/90 px-4 py-1.5 text-sm disabled:opacity-60"
            >
              現在地を使う
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => moveTo(position)}
            className="pointer-events-auto rounded-full border border-line bg-surface/90 px-4 py-1.5 text-sm text-muted"
          >
            デモ：タップした場所に移動（切り替える）
          </button>
        )}
        {message && (
          <p className="rounded-lg bg-surface/90 px-3 py-1.5 text-center text-xs text-muted">
            {message}
          </p>
        )}
        {status === 'error' && (
          <p role="alert" className="rounded-lg bg-surface/90 px-3 py-1.5 text-center text-xs text-wax">
            手紙を読み込めませんでした。電波のよいところで、開きなおしてください。
          </p>
        )}
      </div>

      {/* 下の余白は、地図の帰属表示（© OpenStreetMap など）に重ならないようにするため。
          カードが無いあいだは、この場所のタップも地図に通す */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-md px-3 pb-9">
        <div className="pointer-events-auto">
          {nearest ? (
            <NearestLetterCard
              id={nearest.id}
              header={nearest.header}
              remaining={nearest.remaining}
              onWalkThere={() => moveTo({ lat: nearest.header.lat, lng: nearest.header.lng })}
            />
          ) : (
            // 読み込みが終わって、地図に出せる手紙が 1 通もないとき。次にできることを案内する
            status === 'ready' && (
              <div className="rounded-2xl border border-line bg-surface/95 p-4 text-center shadow-lg">
                <p className="font-mincho text-lg">まだ手紙は埋まっていません</p>
                <p className="mt-1 text-sm text-muted">まずは自分あてに 1 通、埋めてみませんか。</p>
                <Link
                  to="/bury"
                  className="mt-3 block w-full rounded-full bg-gold px-4 py-2 text-center text-sm font-bold text-gold-ink"
                >
                  手紙を埋める
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}
