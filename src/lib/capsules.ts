import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import { sealCapsule } from './crypto.ts'
import type { CapsuleBody, CapsuleHeader, SealedCapsule } from './crypto.ts'
import { getDb } from './firebase.ts'

export type BuryInput = {
  /** 差出人（自分）の uid と公開鍵 */
  from: { uid: string; publicKey: string }
  /** あて先の uid と公開鍵。自分あてなら from と同じ */
  to: { uid: string; publicKey: string }
  header: CapsuleHeader
  body: CapsuleBody
}

/**
 * 手紙に封をして、Firestore に埋める。返り値は手紙の ID。
 * サーバーに送るのは暗号文と、あて先・差出人の uid だけ。
 */
export async function buryCapsule(input: BuryInput): Promise<string> {
  const { from, to } = input

  // 先に ID だけ決める。ID は暗号の材料（AAD と HKDF の info）に入れるので、封をする前に必要
  const ref = doc(collection(getDb(), 'capsules'))

  const sealed = await sealCapsule({
    capsuleId: ref.id,
    to: to.uid,
    from: from.uid,
    header: input.header,
    body: input.body,
    // あて先の鍵は、呼び出し側が渡す。友だちなら、追加したときに合言葉で確かめた鍵
    publicKeys: { [from.uid]: from.publicKey, [to.uid]: to.publicKey },
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

/** Firestore から読んだ手紙。封をした手紙に、埋めた時刻が付く */
export type StoredCapsule = SealedCapsule & {
  /** 埋めた時刻（UNIX ミリ秒）。サーバーの時刻がまだ届いていない一瞬だけ null */
  createdAt: number | null
}

/**
 * 自分あての手紙を見張る。手紙が増えたり消えたりするたびに onChange が呼ばれる。
 * 返り値の関数を呼ぶと、見張りをやめる。
 */
export function listenInbox(
  uid: string,
  onChange: (capsules: StoredCapsule[]) => void,
  onError: (error: unknown) => void,
): () => void {
  // ルールで読めるのは「to か from が自分」の手紙だけなので、問い合わせも to == 自分 に絞る
  const inbox = query(collection(getDb(), 'capsules'), where('to', '==', uid))

  return onSnapshot(
    inbox,
    (snapshot) => {
      onChange(
        snapshot.docs.map((document) => {
          const data = document.data()
          return {
            id: document.id,
            to: data.to,
            from: data.from,
            header: data.header,
            body: data.body,
            keys: data.keys,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : null,
          }
        }),
      )
    },
    onError,
  )
}
