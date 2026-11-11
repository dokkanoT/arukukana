import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// 末尾の ?url は Vite の機能。ファイルの中身ではなく、配信されるときの URL を受け取る
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import type { LatLng } from '../../lib/geo.ts'
import { loadNightStyle } from './nightStyle.ts'

type Props = {
  /** 現在地。金色の点で出す */
  position: LatLng
  /** 地図をタップしたとき */
  onTap?: (position: LatLng) => void
}

// MapLibre は地図タイルの処理を別スレッド（Web Worker）で行う。
// ビルドするとファイルの置き場所が変わり、ワーカーを自動では見つけられないので、場所を教える
setWorkerUrl(workerUrl)

/** 現在地の点（金色の丸と、うすい輪） */
function createPositionDot(): HTMLElement {
  const dot = document.createElement('div')
  dot.className = 'h-4 w-4 rounded-full border-2 border-ink bg-gold ring-4 ring-gold/30'
  return dot
}

/**
 * 夜トーンの地図。
 * MapLibre は React の外で自分で画面を描くので、useEffect の中で作り、ref に持っておく。
 */
export function MapView({ position, onTap }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const [failed, setFailed] = useState(false)

  // 地図を作る effect は最初の 1 回しか動かないので、最新の値は ref 経由で読む
  const latestPosition = useRef(position)
  const latestOnTap = useRef(onTap)
  useEffect(() => {
    latestPosition.current = position
    latestOnTap.current = onTap
  })

  // 地図を作る（最初の 1 回だけ）
  useEffect(() => {
    let cancelled = false

    loadNightStyle().then(
      (style) => {
        if (cancelled || !container.current) return
        const start = latestPosition.current

        const created = new MapLibreMap({
          container: container.current,
          style,
          center: [start.lng, start.lat],
          zoom: 16,
          attributionControl: { compact: true },
        })
        // 北を上に固定する（回転すると方角がわかりにくくなるため）
        created.dragRotate.disable()
        created.touchZoomRotate.disableRotation()
        created.keyboard.disableRotation()

        created.on('click', (event) => {
          latestOnTap.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng })
        })

        marker.current = new Marker({ element: createPositionDot() })
          .setLngLat([start.lng, start.lat])
          .addTo(created)
        map.current = created
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )

    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  // 現在地が変わったら点を動かす。画面の外に出たときだけ、地図も追いかける
  useEffect(() => {
    if (!map.current || !marker.current) return
    const lngLat: [number, number] = [position.lng, position.lat]
    marker.current.setLngLat(lngLat)
    if (!map.current.getBounds().contains(lngLat)) {
      map.current.easeTo({ center: lngLat })
    }
  }, [position])

  return (
    <div className="relative h-full w-full bg-map-block">
      <div ref={container} className="h-full w-full" />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-muted">
          地図を読み込めませんでした。
          <br />
          電波のよいところで、開きなおしてください。
        </p>
      )}
    </div>
  )
}
