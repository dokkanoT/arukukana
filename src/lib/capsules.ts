import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { sealCapsule } from './crypto.ts'
import type { CapsuleBody, CapsuleHeader } from './crypto.ts'
import { getDb } from './firebase.ts'
import { fetchPublicKey } from './users.ts'

export type BuryInput = {
  /** 差出人（自分）の uid と公開鍵 */
  from: { uid: string; publicKey: string }
  /** あて先の uid。自分あてなら from.uid と同じ */
  to: string
  header: CapsuleHeader
  body: CapsuleBody
}

/**
 * 手紙に封をして、Firestore に埋める。返り値は手紙の ID。
 * サーバーに送るのは暗号文と、あて先・差出人の uid だけ。
 */
export async function buryCapsule(input: BuryInput): Promise<string> {
  const { from, to } = input

  // 自分あてなら手元の公開鍵を使い、ほかの人あてなら Firestore から相手の公開鍵を読む
  const recipientKey = to === from.uid ? from.publicKey : await fetchPublicKey(to)
  if (!recipientKey) throw new Error('あて先の鍵が見つかりません')

  // 先に ID だけ決める。ID は暗号の材料（AAD と HKDF の info）に入れるので、封をする前に必要
  const ref = doc(collection(getDb(), 'capsules'))

  const sealed = await sealCapsule({
    capsuleId: ref.id,
    to,
    from: from.uid,
    header: input.header,
    body: input.body,
    publicKeys: { [from.uid]: from.publicKey, [to]: recipientKey },
  })

  await setDoc(ref, {
    to: sealed.to,
    from: sealed.from,
    createdAt: serverTimestamp(),
    header: sealed.header,
    body: sealed.body,
    keys: sealed.keys,
  })
  return ref.id
}
