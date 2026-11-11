import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getDb } from './firebase.ts'

/**
 * 自分の公開鍵を users/{uid} に登録する。手紙を送る人は、ここから相手の公開鍵を読む。
 * すでに同じ鍵が登録されていれば、何も書かない。
 */
export async function publishPublicKey(uid: string, publicKey: string): Promise<void> {
  const ref = doc(getDb(), 'users', uid)
  const snapshot = await getDoc(ref)

  if (!snapshot.exists()) {
    await setDoc(ref, { publicKey, createdAt: serverTimestamp() })
    return
  }
  // 端末の鍵を作り直したとき（ブラウザのデータを一部だけ消した、など）は差し替える
  if (snapshot.data().publicKey !== publicKey) {
    await updateDoc(ref, { publicKey })
  }
}

/** 相手の公開鍵を読む。登録が無ければ null */
export async function fetchPublicKey(uid: string): Promise<string | null> {
  const snapshot = await getDoc(doc(getDb(), 'users', uid))
  const publicKey: unknown = snapshot.data()?.publicKey
  return typeof publicKey === 'string' ? publicKey : null
}
