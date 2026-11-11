import { describe, expect, it } from 'vitest'
import {
  exportPublicKey,
  fingerprintWords,
  fromBase64Url,
  generateDeviceKeyPair,
  openBody,
  openHeader,
  sealCapsule,
  toBase64Url,
} from './crypto.ts'
import type { CapsuleHeader, SealedCapsule } from './crypto.ts'
import { WORDS } from './words.ts'

const header: CapsuleHeader = {
  lat: 35.6812,
  lng: 139.7671,
  radius: 30,
  hint: '改札を出てすぐ',
  senderName: 'はは',
}
const message = 'おつかれさま。きょうもよくがんばったね。'

/** テスト用の登場人物（端末の鍵ペアと、公開用の文字列）を作る */
async function createPerson(uid: string) {
  const keyPair = await generateDeviceKeyPair()
  return { uid, keyPair, publicKey: await exportPublicKey(keyPair.publicKey) }
}

/** 母（差出人）から子（あて先）への手紙に封をする */
async function sealFromMotherToChild() {
  const mother = await createPerson('mother')
  const child = await createPerson('child')
  const capsule = await sealCapsule({
    capsuleId: 'capsule-1',
    to: child.uid,
    from: mother.uid,
    header,
    body: { message },
    publicKeys: { [mother.uid]: mother.publicKey, [child.uid]: child.publicKey },
  })
  return { mother, child, capsule }
}

describe('封をする → 封を切る', () => {
  it('あて先が開けると、文面と header が元どおりになる', async () => {
    const { child, capsule } = await sealFromMotherToChild()

    expect(await openBody(capsule, child.uid, child.keyPair.privateKey)).toEqual({ message })
    expect(await openHeader(capsule, child.uid, child.keyPair.privateKey)).toEqual(header)
  })

  it('差出人も自分の送った手紙を開けられる', async () => {
    const { mother, capsule } = await sealFromMotherToChild()

    expect(await openBody(capsule, mother.uid, mother.keyPair.privateKey)).toEqual({ message })
  })

  it('自分あての手紙は、鍵が 1 人ぶんだけ入る', async () => {
    const me = await createPerson('me')
    const capsule = await sealCapsule({
      capsuleId: 'capsule-self',
      to: me.uid,
      from: me.uid,
      header,
      body: { message },
      publicKeys: { [me.uid]: me.publicKey },
    })

    expect(Object.keys(capsule.keys)).toEqual([me.uid])
    expect(await openBody(capsule, me.uid, me.keyPair.privateKey)).toEqual({ message })
  })

  it('あて先の公開鍵がないと封ができない', async () => {
    const mother = await createPerson('mother')

    await expect(
      sealCapsule({
        capsuleId: 'capsule-1',
        to: 'child',
        from: mother.uid,
        header,
        body: { message },
        publicKeys: { [mother.uid]: mother.publicKey },
      }),
    ).rejects.toThrow()
  })
})

describe('第三者には開けられない', () => {
  it('他人の秘密鍵では、あて先ぶんの鍵を使っても開けない', async () => {
    const { child, capsule } = await sealFromMotherToChild()
    const stranger = await createPerson('stranger')

    await expect(openBody(capsule, child.uid, stranger.keyPair.privateKey)).rejects.toThrow()
    await expect(openHeader(capsule, child.uid, stranger.keyPair.privateKey)).rejects.toThrow()
  })

  it('鍵が入っていない uid では開けない', async () => {
    const { capsule } = await sealFromMotherToChild()
    const stranger = await createPerson('stranger')

    await expect(
      openBody(capsule, stranger.uid, stranger.keyPair.privateKey),
    ).rejects.toThrow()
  })

  it('あて先ぶんの鍵を自分の uid に付け替えても開けない', async () => {
    const { child, capsule } = await sealFromMotherToChild()
    const stranger = await createPerson('stranger')
    const forged: SealedCapsule = {
      ...capsule,
      keys: { ...capsule.keys, [stranger.uid]: capsule.keys[child.uid] },
    }

    await expect(
      openBody(forged, stranger.uid, stranger.keyPair.privateKey),
    ).rejects.toThrow()
  })
})

describe('書き換えられたら開けない', () => {
  it('to を書き換えると開けない（AAD）', async () => {
    const { child, capsule } = await sealFromMotherToChild()
    const tampered: SealedCapsule = { ...capsule, to: 'someone-else' }

    await expect(openBody(tampered, child.uid, child.keyPair.privateKey)).rejects.toThrow()
    await expect(openHeader(tampered, child.uid, child.keyPair.privateKey)).rejects.toThrow()
  })

  it('from を書き換えると開けない（AAD）', async () => {
    const { child, capsule } = await sealFromMotherToChild()
    const tampered: SealedCapsule = { ...capsule, from: 'someone-else' }

    await expect(openBody(tampered, child.uid, child.keyPair.privateKey)).rejects.toThrow()
  })

  it('手紙の ID を書き換えると開けない', async () => {
    const { child, capsule } = await sealFromMotherToChild()
    const tampered: SealedCapsule = { ...capsule, id: 'capsule-2' }

    await expect(openBody(tampered, child.uid, child.keyPair.privateKey)).rejects.toThrow()
  })

  it('header と body の暗号文を入れ替えると開けない', async () => {
    const { child, capsule } = await sealFromMotherToChild()
    const swapped: SealedCapsule = { ...capsule, header: capsule.body, body: capsule.header }

    await expect(openBody(swapped, child.uid, child.keyPair.privateKey)).rejects.toThrow()
    await expect(openHeader(swapped, child.uid, child.keyPair.privateKey)).rejects.toThrow()
  })

  it('暗号文を 1 バイト変えると開けない', async () => {
    const { child, capsule } = await sealFromMotherToChild()
    const bytes = fromBase64Url(capsule.body.ct)
    bytes[0] ^= 1
    const tampered: SealedCapsule = {
      ...capsule,
      body: { ...capsule.body, ct: toBase64Url(bytes) },
    }

    await expect(openBody(tampered, child.uid, child.keyPair.privateKey)).rejects.toThrow()
  })
})

describe('サーバーに置く形', () => {
  it('平文の文面・ヒント・差出人名が含まれない', async () => {
    const { capsule } = await sealFromMotherToChild()
    const stored = JSON.stringify(capsule)

    expect(stored).not.toContain(message)
    expect(stored).not.toContain(header.hint)
    expect(stored).not.toContain(header.senderName)
    expect(stored).not.toContain(String(header.lat))
  })

  it('header と body は別の IV で暗号化される', async () => {
    const { capsule } = await sealFromMotherToChild()

    expect(capsule.header.iv).not.toBe(capsule.body.iv)
    expect(fromBase64Url(capsule.header.iv)).toHaveLength(12)
    expect(fromBase64Url(capsule.body.iv)).toHaveLength(12)
  })

  it('保存する値の長さが firestore.rules の数字と合っている', async () => {
    // ここの数字を変えるときは firestore.rules も一緒に直すこと
    const { mother, child, capsule } = await sealFromMotherToChild()

    expect(mother.publicKey).toHaveLength(87) // 公開鍵 65 バイト
    expect(capsule.header.iv).toHaveLength(16) // IV 12 バイト
    expect(capsule.body.iv).toHaveLength(16)
    for (const uid of [mother.uid, child.uid]) {
      const key = capsule.keys[uid]
      expect(key.epk).toHaveLength(87)
      expect(key.salt).toHaveLength(22) // salt 16 バイト
      expect(key.iv).toHaveLength(16)
      expect(key.wrapped).toHaveLength(64) // 鍵 32 バイト + 認証タグ 16 バイト
    }
  })

  it('300 字の手紙でも、暗号文の合計は 16KB に収まる', async () => {
    const me = await createPerson('me')
    const capsule = await sealCapsule({
      capsuleId: 'capsule-long',
      to: me.uid,
      from: me.uid,
      header: { ...header, hint: 'あ'.repeat(100), openAfter: Date.now() },
      body: { message: 'あ'.repeat(300) },
      publicKeys: { [me.uid]: me.publicKey },
    })

    expect(capsule.header.ct.length + capsule.body.ct.length).toBeLessThanOrEqual(16 * 1024)
  })

  it('同じ手紙でも、封をするたびに違う暗号文になる', async () => {
    const me = await createPerson('me')
    const input = {
      capsuleId: 'capsule-self',
      to: me.uid,
      from: me.uid,
      header,
      body: { message },
      publicKeys: { [me.uid]: me.publicKey },
    }
    const first = await sealCapsule(input)
    const second = await sealCapsule(input)

    expect(first.body.ct).not.toBe(second.body.ct)
    expect(first.keys[me.uid].epk).not.toBe(second.keys[me.uid].epk)
  })
})

describe('端末の鍵', () => {
  it('秘密鍵は取り出せない（extractable=false）', async () => {
    const { privateKey } = await generateDeviceKeyPair()

    expect(privateKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('pkcs8', privateKey)).rejects.toThrow()
  })

  it('公開鍵は P-256 の raw 形式（65 バイト）', async () => {
    const person = await createPerson('me')

    expect(fromBase64Url(person.publicKey)).toHaveLength(65)
  })
})

describe('鍵の合言葉（指紋）', () => {
  it('同じ公開鍵からは常に同じ 4 語になる', async () => {
    const person = await createPerson('me')
    const first = await fingerprintWords(person.publicKey)
    const second = await fingerprintWords(person.publicKey)

    expect(first).toHaveLength(4)
    expect(second).toEqual(first)
    for (const word of first) expect(WORDS).toContain(word)
  })

  it('決まった入力に対して、決まった 4 語になる', async () => {
    // 65 バイトすべて 0 の入力。SHA-256 の先頭 4 バイトを別途計算して突き合わせる
    const input = new Uint8Array(65)
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input))
    const expected = [...digest.slice(0, 4)].map((byte) => WORDS[byte])

    expect(await fingerprintWords(toBase64Url(input))).toEqual(expected)
  })
})

describe('base64url', () => {
  it('往復で元のバイト列に戻り、URL に使えない文字を含まない', () => {
    const bytes = new Uint8Array(256).map((_, i) => i)
    const text = toBase64Url(bytes)

    expect(text).not.toMatch(/[+/=]/)
    expect(fromBase64Url(text)).toEqual(bytes)
  })
})
