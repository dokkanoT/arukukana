import { useCurrentLocation } from '../location/locationContext.ts'
import { MapView } from './MapView.tsx'

const gpsMessages = {
  idle: '',
  requesting: '現在地をしらべています…',
  active: '',
  denied: '位置情報が許可されていません。デモモードで試せます。',
  unavailable: '現在地がわかりませんでした。デモモードで試せます。',
}

export function MapPage() {
  const { source, position, gpsStatus, startGps, moveTo } = useCurrentLocation()
  const isDemo = source === 'manual'
  const message = gpsMessages[gpsStatus]

  return (
    <section className="relative h-full">
      {/* デモモードのときだけ、タップした場所を現在地にする */}
      <MapView position={position} onTap={isDemo ? moveTo : undefined} />

      {/* 地図の上に重ねる操作。pointer-events-none で、何もないところのタップは地図に通す */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3">
        {isDemo ? (
          <p className="rounded-full border border-gold/60 bg-surface/90 px-4 py-1.5 text-sm text-gold">
            デモ：タップした場所に移動
          </p>
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

      {isDemo && (
        <button
          type="button"
          onClick={startGps}
          disabled={gpsStatus === 'requesting'}
          className="absolute bottom-10 right-3 rounded-full bg-gold px-4 py-2 text-sm font-bold text-gold-ink shadow-lg disabled:opacity-60"
        >
          現在地を使う
        </button>
      )}
    </section>
  )
}
