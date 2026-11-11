import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// 末尾の ?url は Vite の機能。ファイルの中身ではなく、配信されるときの URL を受け取る
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { circlePolygon } from '../../lib/geo.ts'
import type { LatLng } from '../../lib/geo.ts'
import { loadNightStyle } from './nightStyle.ts'

/** 地図に描く手紙の円 */
export type MapCircle = {
  id: string
  center: LatLng
  /** 半径（メートル） */
  radius: number
  /** 近くにあるか。近いものは金色に光らせ、遠いものは点線にする */
  near: boolean
}

type Props = {
  /** 現在地。金色の点で出す */
  position: LatLng
  /** 地図をタップしたとき */
  onTap?: (position: LatLng) => void
  /** 手紙の円 */
  circles?: MapCircle[]
}

// MapLibre は地図タイルの処理を別スレッド（Web Worker）で行う。
// ビルドするとファイルの置き場所が変わり、ワーカーを自動では見つけられないので、場所を教える
setWorkerUrl(workerUrl)

/** gold（index.css のトークンと同じ値。地図は CSS 変数を読めないので、ここにも書く） */
const GOLD = '#e9b44c'
/** 円のデータを入れておく場所の名前 */
const CIRCLES_SOURCE = 'capsule-circles'
const NO_CIRCLES: MapCircle[] = []

/** 現在地の点（金色の丸と、うすい輪） */
function createPositionDot(): HTMLElement {
  const dot = document.createElement('div')
  dot.className = 'h-4 w-4 rounded-full border-2 border-ink bg-gold ring-4 ring-gold/30'
  return dot
}

/** 円の一覧を、地図が読める形（GeoJSON）にする。円そのものと、中心の点の 2 つずつ */
function toGeoJson(circles: MapCircle[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: circles.flatMap((circle): Feature[] => [
      {
        type: 'Feature',
        properties: { near: circle.near },
        geometry: { type: 'Polygon', coordinates: [circlePolygon(circle.center, circle.radius)] },
      },
      {
        type: 'Feature',
        properties: { near: circle.near },
        geometry: { type: 'Point', coordinates: [circle.center.lng, circle.center.lat] },
      },
    ]),
  }
}

/** 円を描くレイヤーを地図に足す */
function addCircleLayers(map: MapLibreMap) {
  map.addSource(CIRCLES_SOURCE, { type: 'geojson', data: toGeoJson([]) })

  // 円のふちと塗り。近いものだけ、ぼんやり光って見えるように濃くする
  map.addLayer({
    id: 'capsule-fill',
    type: 'fill',
    source: CIRCLES_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': GOLD,
      'fill-opacity': ['case', ['get', 'near'], 0.22, 0.05],
    },
  })
  // 近い手紙：実線のふち
  map.addLayer({
    id: 'capsule-outline-near',
    type: 'line',
    source: CIRCLES_SOURCE,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['get', 'near']],
    paint: { 'line-color': GOLD, 'line-width': 2 },
  })
  // 遠い手紙：点線のふち
  map.addLayer({
    id: 'capsule-outline-far',
    type: 'line',
    source: CIRCLES_SOURCE,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!', ['get', 'near']]],
    paint: {
      'line-color': GOLD,
      'line-width': 1.5,
      'line-opacity': 0.6,
      'line-dasharray': [2, 2],
    },
  })
  // 中心の灯り。半径 30m の円は地図を引くと見えなくなるので、点は画面上の大きさを一定にする
  map.addLayer({
    id: 'capsule-light',
    type: 'circle',
    source: CIRCLES_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': GOLD,
      'circle-radius': ['case', ['get', 'near'], 5, 4],
      'circle-opacity': ['case', ['get', 'near'], 1, 0.5],
      'circle-blur': 0.4,
    },
  })
}

/**
 * 夜トーンの地図。
 * MapLibre は React の外で自分で画面を描くので、useEffect の中で作り、ref に持っておく。
 */
export function MapView({ position, onTap, circles = NO_CIRCLES }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const marker = useRef<Marker | null>(null)
  /** 地図の読み込みが終わり、円を描けるようになったか */
  const [ready, setReady] = useState(false)
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
        // スタイルの準備ができたら円のレイヤーを足す。
        // 'load' は地図タイルが全部そろうまで来ないので、電波が悪いと円がいつまでも出ない
        created.once('style.load', () => {
          if (cancelled) return
          addCircleLayers(created)
          setReady(true)
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
      setReady(false)
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

  // 手紙の円を描きなおす
  useEffect(() => {
    if (!ready || !map.current) return
    map.current.getSource<GeoJSONSource>(CIRCLES_SOURCE)?.setData(toGeoJson(circles))
  }, [ready, circles])

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
