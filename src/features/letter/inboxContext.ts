import { createContext, useContext } from 'react'
import type { StoredCapsule } from '../../lib/capsules.ts'
import type { CapsuleHeader } from '../../lib/crypto.ts'

/** 届いた手紙 1 通。header（場所・ヒント）は開けてあり、body（文面）はまだ封をしたまま */
export type InboxItem = {
  capsule: StoredCapsule
  /** 開けた header。この端末の鍵で開けられなかったときは null */
  header: CapsuleHeader | null
}

export type InboxValue = {
  status: 'loading' | 'ready' | 'error'
  items: InboxItem[]
}

export const InboxContext = createContext<InboxValue | null>(null)

/** 届いた手紙の一覧。InboxProvider の内側でだけ使える */
export function useInbox(): InboxValue {
  const value = useContext(InboxContext)
  if (value === null) throw new Error('useInbox は InboxProvider の内側で使ってください')
  return value
}
