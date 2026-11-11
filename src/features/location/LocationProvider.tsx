import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LatLng } from '../../lib/geo.ts'
import { LocationContext } from './locationContext.ts'
import type { LocationContextValue, LocationState } from './locationContext.ts'

/** デモモードの初期位置：東京駅 */
const TOKYO_STATION: LatLng = { lat: 35.6812, lng: 139.7671 }

const initialState: LocationState = {
  source: 'manual',
  position: TOKYO_STATION,
  accuracy: 0,
  gpsStatus: 'idle',
}

/**
 * 現在地を配る。
 * はじめはデモモード（manual・東京駅）。GPS が使えるようになったら gps に切り替わり、
 * 拒否・失敗したときは、その時点の場所のままデモモードに戻る。
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationState>(initialState)
  /** watchPosition の番号。GPS を見張っていないときは null */
  const watchId = useRef<number | null>(null)

  const stopGps = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const startGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, gpsStatus: 'unavailable' }))
      return
    }
    if (watchId.current !== null) return // すでに見張っている

    setState((prev) => ({ ...prev, gpsStatus: 'requesting' }))
    watchId.current = navigator.geolocation.watchPosition(
      (result) => {
        setState({
          source: 'gps',
          position: { lat: result.coords.latitude, lng: result.coords.longitude },
          accuracy: result.coords.accuracy,
          gpsStatus: 'active',
        })
      },
      (error) => {
        stopGps()
        // 最後にわかっていた場所のまま、デモモードに戻す
        setState((prev) => ({
          ...prev,
          source: 'manual',
          accuracy: 0,
          gpsStatus: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        }))
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
  }, [stopGps])

  const moveTo = useCallback(
    (position: LatLng) => {
      stopGps()
      setState((prev) => ({
        source: 'manual',
        position,
        accuracy: 0,
        // 拒否されたことは覚えておく（もう一度たずねても同じ結果になるため）
        gpsStatus: prev.gpsStatus === 'denied' ? 'denied' : 'idle',
      }))
    },
    [stopGps],
  )

  // 前に位置情報を許可済みなら、たずねずに GPS を使いはじめる
  useEffect(() => {
    let cancelled = false
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((permission) => {
        if (!cancelled && permission.state === 'granted') startGps()
      })
      .catch(() => {
        // 許可の状態を調べられないブラウザでは、デモモードのまま始める
      })
    return () => {
      cancelled = true
      stopGps()
    }
  }, [startGps, stopGps])

  const value = useMemo<LocationContextValue>(
    () => ({ ...state, startGps, moveTo }),
    [state, startGps, moveTo],
  )

  return <LocationContext value={value}>{children}</LocationContext>
}
