import { createContext, useContext } from 'react'
import type { LatLng } from '../../lib/geo.ts'

/** GPS の状態 */
export type GpsStatus =
  /** まだ使っていない */
  | 'idle'
  /** 許可や最初の測位を待っている */
  | 'requesting'
  /** 測位できている */
  | 'active'
  /** 利用者が許可しなかった */
  | 'denied'
  /** 端末が対応していない、または測位に失敗した */
  | 'unavailable'

export type LocationState = {
  /** 現在地の取得元。manual はデモモード（地図をタップした場所が現在地になる） */
  source: 'gps' | 'manual'
  position: LatLng
  /** GPS の誤差（メートル）。manual のときは 0 */
  accuracy: number
  gpsStatus: GpsStatus
}

export type LocationContextValue = LocationState & {
  /** GPS を使いはじめる。初回はブラウザの許可ダイアログが出る */
  startGps: () => void
  /** デモモードにして、指定した場所を現在地にする */
  moveTo: (position: LatLng) => void
}

export const LocationContext = createContext<LocationContextValue | null>(null)

/** 現在地。LocationProvider の内側でだけ使える */
export function useCurrentLocation(): LocationContextValue {
  const value = useContext(LocationContext)
  if (value === null) throw new Error('useCurrentLocation は LocationProvider の内側で使ってください')
  return value
}
