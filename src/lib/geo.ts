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
