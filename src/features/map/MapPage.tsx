import { useMemo } from 'react'
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
  const { items, openedIds } = useInbox()
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
      </div>

      {nearest && (
        // 下の余白は、地図の帰属表示（© OpenStreetMap など）に重ならないようにするため
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md px-3 pb-9">
          <NearestLetterCard
            id={nearest.id}
            header={nearest.header}
            remaining={nearest.remaining}
            onWalkThere={() => moveTo({ lat: nearest.header.lat, lng: nearest.header.lng })}
          />
        </div>
      )}
    </section>
  )
}
