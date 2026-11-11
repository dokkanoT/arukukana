import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { listenInbox } from '../../lib/capsules.ts'
import { openHeader } from '../../lib/crypto.ts'
import { useSession } from '../auth/sessionContext.ts'
import { InboxContext } from './inboxContext.ts'
import type { InboxItem, InboxValue } from './inboxContext.ts'

/**
 * 自分あての手紙を見張り、header だけ開けて配る。
 * 地図（場所の円）と「届いた」一覧の両方がここから読む。
 */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { uid, privateKey } = useSession()
  const [value, setValue] = useState<InboxValue>({ status: 'loading', items: [] })

  useEffect(() => {
    let cancelled = false
    /** 一度開けた header は覚えておき、手紙が増えるたびに全部を開けなおさない */
    const opened = new Map<string, InboxItem>()
    /** 何回目の知らせか。古い知らせの処理があとから終わっても、新しい結果を上書きしないようにする */
    let latest = 0

    const stop = listenInbox(
      uid,
      async (capsules) => {
        const turn = ++latest
        const items = await Promise.all(
          capsules.map(async (capsule): Promise<InboxItem> => {
            const known = opened.get(capsule.id)
            if (known) return { ...known, capsule }

            let item: InboxItem
            try {
              item = { capsule, header: await openHeader(capsule, uid, privateKey) }
            } catch {
              // 鍵を作り直したあとなど、この端末ではもう開けられない手紙
              item = { capsule, header: null }
            }
            opened.set(capsule.id, item)
            return item
          }),
        )
        if (!cancelled && turn === latest) setValue({ status: 'ready', items })
      },
      (error) => {
        console.error('手紙を読み込めませんでした', error)
        if (!cancelled) setValue((prev) => ({ ...prev, status: 'error' }))
      },
    )

    return () => {
      cancelled = true
      stop()
    }
  }, [uid, privateKey])

  return <InboxContext value={value}>{children}</InboxContext>
}
