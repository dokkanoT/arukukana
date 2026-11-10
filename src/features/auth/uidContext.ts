import { createContext, useContext } from 'react'

/** サインイン済みの自分の uid を、下の画面に配るための入れ物 */
export const UidContext = createContext<string | null>(null)

/** 自分の uid。AuthGate の内側でだけ使える */
export function useUid(): string {
  const uid = useContext(UidContext)
  if (uid === null) throw new Error('useUid は AuthGate の内側で使ってください')
  return uid
}
