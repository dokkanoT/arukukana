import { motion, useReducedMotion } from 'motion/react'

/** 封蝋が割れて落ちるまでの秒数 */
const BREAK_SECONDS = 0.6
/** 封筒が薄くなって消えるまでの秒数（封蝋が割れはじめてから少し待って始める） */
const FADE_SECONDS = 0.4
const FADE_DELAY_SECONDS = 0.45

type Side = 'left' | 'right'

/**
 * 封蝋の半分。
 * 丸い封蝋を左右 2 枚に分けておき、割れるときはそれぞれ外側へ回りながら落ちる。
 */
function WaxHalf({ side, broken, seconds }: { side: Side; broken: boolean; seconds: number }) {
  // 左は左下へ、右は右下へ
  const direction = side === 'left' ? -1 : 1
  return (
    <motion.div
      className="relative h-16 w-8 overflow-hidden"
      initial={false}
      animate={
        broken
          ? { x: direction * 26, y: 64, rotate: direction * 40, opacity: 0 }
          : { x: 0, y: 0, rotate: 0, opacity: 1 }
      }
      transition={{ duration: seconds, ease: 'easeIn' }}
    >
      {/* 幅 16 の丸を、半分の幅の窓からのぞかせる。右半分は丸を左へずらして右側を見せる */}
      <div
        className={`absolute top-0 flex h-16 w-16 items-center justify-center rounded-full bg-wax font-mincho text-2xl text-paper ${
          side === 'left' ? 'left-0' : '-left-8'
        }`}
      >
        封
      </div>
    </motion.div>
  )
}

type Props = {
  senderName: string
  /** true になったら封蝋を割る。復号に成功したあとで true にする */
  broken: boolean
  /** 割れる演出が終わったときに呼ばれる。ここで紙面に切り替える */
  onBroken: () => void
}

/**
 * 封蝋つきの封筒。
 * broken が true になると、封蝋が左右に割れて落ち、封筒が薄くなって消える。
 */
export function Envelope({ senderName, broken, onBroken }: Props) {
  // OS で「視差効果を減らす」にしている人には、動きを付けずにすぐ紙面へ進む
  const reduceMotion = useReducedMotion()
  const breakSeconds = reduceMotion ? 0 : BREAK_SECONDS
  const fadeSeconds = reduceMotion ? 0 : FADE_SECONDS
  const fadeDelay = reduceMotion ? 0 : FADE_DELAY_SECONDS

  return (
    <motion.div
      className="relative flex h-44 w-72 items-center justify-center rounded-lg bg-paper shadow-lg"
      initial={false}
      animate={broken ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
      transition={{ duration: fadeSeconds, delay: fadeDelay }}
      // いちばん最後に終わるのが封筒の消える動きなので、ここで終わりを知らせる
      onAnimationComplete={() => {
        if (broken) onBroken()
      }}
    >
      <p className="absolute left-5 top-4 font-mincho text-paper-text">{senderName} より</p>
      <div className="flex drop-shadow-md" aria-hidden="true">
        <WaxHalf side="left" broken={broken} seconds={breakSeconds} />
        <WaxHalf side="right" broken={broken} seconds={breakSeconds} />
      </div>
    </motion.div>
  )
}
