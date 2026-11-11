import { useEffect, useState } from 'react'
import { fingerprintWords } from '../../lib/crypto.ts'
import { useSession } from '../auth/sessionContext.ts'

/** 仮の中身。いまは自分の鍵の合言葉だけを出す（QR・共有リンク・友だち一覧はこれから） */
export function FriendsPage() {
  const { publicKey } = useSession()
  const [words, setWords] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void fingerprintWords(publicKey).then((result) => {
      if (!cancelled) setWords(result)
    })
    return () => {
      cancelled = true
    }
  }, [publicKey])

  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-mincho text-3xl font-bold">友だち</h1>
      <p className="text-muted">あなたの鍵の合言葉</p>
      <p className="font-mincho text-2xl text-gold">{words.join('・')}</p>
      <p className="text-sm text-muted">
        相手の画面に出る合言葉と読み合わせると、
        <br />
        鍵の取り違えに気づけます。
      </p>
    </section>
  )
}
