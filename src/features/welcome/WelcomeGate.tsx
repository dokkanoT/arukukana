import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { buryCapsule } from '../../lib/capsules.ts'
import type { LatLng } from '../../lib/geo.ts'
import { useSession } from '../auth/sessionContext.ts'
import { useCurrentLocation } from '../location/locationContext.ts'

/** 「はじめて」を済ませたことを、この端末に覚えておくときの名前 */
const WELCOMED_KEY = 'arukukana:welcomed'

const WELCOME_MESSAGE = `ようこそ、アルクカナへ。

この手紙は、あなたの端末の中で封をしてから、ここに埋めました。運営のサーバーにあるのは暗号文だけで、文面も場所も読めません。

次は、だれかの帰り道に 1 通、埋めてみてください。いつもの道が、1ミリ良くなりますように。`

function hasWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) === '1'
  } catch {
    return false
  }
}

function rememberWelcomed() {
  try {
    localStorage.setItem(WELCOMED_KEY, '1')
  } catch {
    // 覚えておけないと次もこの画面が出るが、使うのには困らない
  }
}

/** 現在地を 1 回だけ調べる。許可されなかった・わからなかったときは null */
function locateOnce(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (result) => resolve({ lat: result.coords.latitude, lng: result.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  })
}

type Step =
  /** どちらで始めるかを選んでもらう */
  | 'choose'
  /** 位置情報の許可と、最初の測位を待っている */
  | 'locating'
  /** ようこその手紙に封をして埋めている */
  | 'burying'
  | 'error'
  | 'done'

/**
 * はじめて開いたときだけ出る画面。
 * 自分あての「ようこそ」の手紙を、いまいる場所に 1 通、本物の暗号化で埋めてから中身（children）を出す。
 * これで、開いてすぐに「掘る → 封を切る」を一通り体験できる。
 */
export function WelcomeGate({ children }: { children: ReactNode }) {
  const session = useSession()
  const { position, startGps } = useCurrentLocation()
  const [step, setStep] = useState<Step>(() => (hasWelcomed() ? 'done' : 'choose'))
  /** 手紙を 2 通埋めてしまわないための目印 */
  const buried = useRef(false)

  async function buryWelcomeLetter(spot: LatLng) {
    if (buried.current) return
    buried.current = true
    setStep('burying')
    try {
      await buryCapsule({
        from: { uid: session.uid, publicKey: session.publicKey },
        to: session.uid,
        header: {
          lat: spot.lat,
          lng: spot.lng,
          radius: 30,
          hint: 'あなたの足元',
          senderName: 'アルクカナ',
        },
        body: { message: WELCOME_MESSAGE },
      })
      rememberWelcomed()
      setStep('done')
    } catch (error) {
      console.error('ようこその手紙を埋められませんでした', error)
      buried.current = false
      setStep('error')
    }
  }

  /** 位置を許可して掘る：測位できたらその場所に、だめなら東京駅（デモの初期位置）に埋める */
  async function startWithGps() {
    setStep('locating')
    startGps() // 地図のために、現在地の見張りも始めておく
    const spot = await locateOnce()
    await buryWelcomeLetter(spot ?? position)
  }

  if (step === 'done') return children

  function skip() {
    rememberWelcomed()
    setStep('done')
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm text-muted">アルクカナ</p>
      <h1 className="font-mincho text-3xl leading-relaxed font-bold">
        あなたの足元に、
        <br />
        手紙が 1 通
        <br />
        埋まっています。
      </h1>

      {step === 'choose' && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={() => void startWithGps()}
            className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink"
          >
            位置を許可して掘る
          </button>
          <button
            type="button"
            onClick={() => void buryWelcomeLetter(position)}
            className="rounded-full border border-line px-6 py-3"
          >
            位置なしで試す
          </button>
          <p className="text-xs text-muted">
            「位置なしで試す」では、東京駅にいることにして始めます。
            <br />
            どちらでも、すべての機能を試せます。
          </p>
        </div>
      )}

      {step === 'locating' && <p className="text-muted">現在地をしらべています…</p>}
      {step === 'burying' && <p className="text-muted">手紙に封をしています…</p>}

      {step === 'error' && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p role="alert" className="text-sm text-wax">
            手紙を用意できませんでした。電波のよいところで、もう一度ためしてください。
          </p>
          <button
            type="button"
            onClick={() => void buryWelcomeLetter(position)}
            className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink"
          >
            もう一度ためす
          </button>
          <button type="button" onClick={skip} className="text-sm text-muted underline">
            手紙なしで始める
          </button>
        </div>
      )}
    </main>
  )
}
