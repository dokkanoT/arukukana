import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { listenInbox } from '../../lib/capsules.ts'
import { openHeader } from '../../lib/crypto.ts'
import { loadOpenedIds, saveOpenedIds } from '../../lib/opened.ts'
import { useSession } from '../auth/sessionContext.ts'
import { InboxContext } from './inboxContext.ts'
import type { InboxItem, InboxValue } from './inboxContext.ts'

type Letters = Pick<InboxValue, 'status' | 'items'>

/**
 * 自分あての手紙を見張り、header だけ開けて配る。
 * 地図（場所の円）と「届いた」一覧の両方がここから読む。
 */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { uid, privateKey } = useSession()
  const [letters, setLetters] = useState<Letters>({ status: 'loading', items: [] })
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(new Set())

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
        if (!cancelled && turn === latest) setLetters({ status: 'ready', items })
      },
      (error) => {
        console.error('手紙を読み込めませんでした', error)
        if (!cancelled) setLetters((prev) => ({ ...prev, status: 'error' }))
      },
    )

    return () => {
      cancelled = true
      stop()
    }
  }, [uid, privateKey])

  // 開封済みの記録を、端末から読む
  useEffect(() => {
    let cancelled = false
    loadOpenedIds().then(
      (ids) => {
        // 読み込みを待つあいだに封を切った手紙があれば、それも残す
        if (!cancelled) setOpenedIds((prev) => new Set([...ids, ...prev]))
      },
      () => {
        // 読めなくても困らない（もう一度、封を切るところから見せるだけ）
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const markOpened = useCallback((capsuleId: string) => {
    setOpenedIds((prev) => {
      if (prev.has(capsuleId)) return prev
      const next = new Set(prev).add(capsuleId)
      void saveOpenedIds(next).catch(() => {
        // 保存できなくても、この画面を開いているあいだは開封済みとして扱える
      })
      return next
    })
  }, [])

  const value = useMemo<InboxValue>(
    () => ({ ...letters, openedIds, markOpened }),
    [letters, openedIds, markOpened],
  )

  return <InboxContext value={value}>{children}</InboxContext>
}
