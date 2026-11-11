import { createContext, useContext } from 'react'
import type { DeviceKeys } from '../../lib/keystore.ts'

/** 起動時にそろえる「自分」の情報 */
export type Session = DeviceKeys & {
  /** 匿名サインインで決まる自分の uid */
  uid: string
}

/** Session を下の画面に配るための入れ物 */
export const SessionContext = createContext<Session | null>(null)

/** 自分の uid と鍵。AuthGate の内側でだけ使える */
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (session === null) throw new Error('useSession は AuthGate の内側で使ってください')
  return session
}
