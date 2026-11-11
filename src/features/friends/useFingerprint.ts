import { useEffect, useState } from 'react'
import { fingerprintWords } from '../../lib/crypto.ts'

/**
 * 公開鍵の合言葉（ひらがな 4 語を「・」でつないだもの）。計算が終わるまでは空文字。
 * 公開鍵が無い（null）ときも空文字を返す。
 */
export function useFingerprint(publicKey: string | null): string {
  const [result, setResult] = useState<{ publicKey: string; words: string } | null>(null)

  useEffect(() => {
    if (publicKey === null) return
    let cancelled = false
    fingerprintWords(publicKey).then(
      (words) => {
        if (!cancelled) setResult({ publicKey, words: words.join('・') })
      },
      () => {
        // 公開鍵の形がおかしいときは、合言葉を出さない
      },
    )
    return () => {
      cancelled = true
    }
  }, [publicKey])

  // 別の鍵の結果が残っているあいだは出さない
  return result !== null && result.publicKey === publicKey ? result.words : ''
}
