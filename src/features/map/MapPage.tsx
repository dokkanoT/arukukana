import { useCurrentLocation } from '../location/locationContext.ts'

const gpsMessages = {
  idle: '',
  requesting: '現在地をしらべています…',
  active: '',
  denied: '位置情報が許可されていません。デモモードで試せます。',
  unavailable: '現在地がわかりませんでした。デモモードで試せます。',
}

/** 仮の中身。いまは現在地の取得元と座標だけを出す（地図はこれから） */
export function MapPage() {
  const { source, position, accuracy, gpsStatus, startGps, moveTo } = useCurrentLocation()

  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-mincho text-3xl font-bold">地図</h1>

      <p className="rounded-full border border-line bg-surface px-4 py-1 text-sm">
        {source === 'gps' ? '現在地を使っています' : 'デモ：好きな場所に移動できます'}
      </p>

      <p className="text-muted">
        {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        {source === 'gps' && `（誤差 約${Math.round(accuracy)}m）`}
      </p>

      {gpsMessages[gpsStatus] && <p className="text-sm text-muted">{gpsMessages[gpsStatus]}</p>}

      {source === 'manual' ? (
        <button
          type="button"
          onClick={startGps}
          disabled={gpsStatus === 'requesting'}
          className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink disabled:opacity-60"
        >
          現在地を使う
        </button>
      ) : (
        <button
          type="button"
          onClick={() => moveTo(position)}
          className="rounded-full border border-line px-6 py-3"
        >
          デモモードにする
        </button>
      )}
    </section>
  )
}
