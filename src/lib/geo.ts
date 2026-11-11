/** 緯度・経度（度） */
export type LatLng = {
  lat: number
  lng: number
}

/** 地球の平均半径（メートル） */
const EARTH_RADIUS_M = 6_371_000

/** GPS の誤差として認める上限（メートル）。精度が悪いほど遠くから開けられてしまうのを防ぐ */
const MAX_ACCURACY_ALLOWANCE_M = 30

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * 2 地点の距離（メートル）をハーバサイン式で求める。
 * 地球を球とみなした近似で、数十メートルの判定には十分な精度。
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * 手紙の場所に「着いた」とみなせるか。
 * 条件：距離 ≤ 半径 + min(GPS精度, 30m)
 */
export function isWithinReach(
  distance: number,
  radius: number,
  accuracy: number,
): boolean {
  const allowance = Math.min(Math.max(accuracy, 0), MAX_ACCURACY_ALLOWANCE_M)
  return distance <= radius + allowance
}

/** 距離を画面用の文字にする（例：85m、1.2km） */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/** 手紙の円のふちまで、あと何メートルか。円の中にいれば 0 */
export function remainingMeters(distance: number, radius: number): number {
  return Math.max(0, distance - radius)
}

/**
 * 地図に円を描くための頂点（[経度, 緯度] の並び）を作る。
 * 地図は「メートル単位の円」を直接は描けないので、多角形で近似する。最初と最後は同じ点で閉じる。
 */
export function circlePolygon(center: LatLng, radius: number, steps = 64): [number, number][] {
  // 緯度 1 度は約 111.32km。経度 1 度は、緯度が高いほど短くなる（cos をかける）
  const latDegrees = radius / 111_320
  const lngDegrees = latDegrees / Math.cos(toRadians(center.lat))

  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    points.push([
      center.lng + lngDegrees * Math.cos(angle),
      center.lat + latDegrees * Math.sin(angle),
    ])
  }
  return points
}
