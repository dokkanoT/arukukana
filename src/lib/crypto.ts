/**
 * 手紙（カプセル）の暗号。Web Crypto API（crypto.subtle）の標準アルゴリズムだけで組んでいる。
 *
 * 全体の流れ：
 *   1. 手紙ごとにランダムな「内容鍵 K」（AES-GCM 256bit）を作り、header と body を K で暗号化する
 *   2. K そのものを、読める人（あて先と差出人）ごとに包んで一緒に保存する
 *      - 使い捨ての鍵ペア e を作り、ECDH(e の秘密鍵, 相手の公開鍵) で共有秘密を得る
 *      - 共有秘密を HKDF-SHA256 に通して「鍵を包む鍵 KEK」にし、K を AES-GCM で包む
 *   3. 開けるときは、自分の秘密鍵と e の公開鍵（epk）から同じ KEK を作り、K を取り出す
 *
 * サーバーに置くのは暗号文と epk などの公開値だけ。秘密鍵は端末から出ない。
 */

import { wordsFromBytes } from './words.ts'

/** 中身が ArrayBuffer だと確定しているバイト列（crypto.subtle にそのまま渡せる） */
type Bytes = Uint8Array<ArrayBuffer>

const CURVE = 'P-256'
const IV_BYTES = 12
const SALT_BYTES = 16
/** HKDF の info の先頭。方式を変えるときはここを v2 にして、古い手紙と混ざらないようにする */
const INFO_PREFIX = 'arukukana-v1'
/** 合言葉に使う指紋のバイト数（= 語数） */
const FINGERPRINT_BYTES = 4

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

/** 暗号化する前の header。一覧や地図に出す情報 */
export type CapsuleHeader = {
  lat: number
  lng: number
  /** 開けられる半径（メートル） */
  radius: number
  hint: string
  /** この時刻（UNIX ミリ秒）を過ぎるまで開けられない。省略可 */
  openAfter?: number
  senderName: string
}

/** 暗号化する前の body。手紙の文面 */
export type CapsuleBody = {
  message: string
}

/** AES-GCM の暗号文。どちらも base64url */
export type Ciphertext = {
  iv: string
  ct: string
}

/** 1 人ぶんの「包んだ内容鍵」。すべて base64url */
export type WrappedKey = {
  /** 使い捨て鍵ペアの公開鍵（raw） */
  epk: string
  /** HKDF の salt */
  salt: string
  iv: string
  /** KEK で包んだ内容鍵 K */
  wrapped: string
}

/** 封をした手紙。Firestore の capsules/{id} に置く形（createdAt を除く） */
export type SealedCapsule = {
  id: string
  /** あて先の uid（平文） */
  to: string
  /** 差出人の uid（平文） */
  from: string
  header: Ciphertext
  body: Ciphertext
  /** uid ごとの包んだ内容鍵 */
  keys: Record<string, WrappedKey>
}

export type SealInput = {
  capsuleId: string
  to: string
  from: string
  header: CapsuleHeader
  body: CapsuleBody
  /** uid → 公開鍵（base64url raw）。to と from の両方が入っていること */
  publicKeys: Record<string, string>
}

// ---------------------------------------------------------------------------
// バイト列と文字列の変換
// ---------------------------------------------------------------------------

function utf8(text: string): Bytes {
  return new TextEncoder().encode(text) as Bytes
}

function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function toBase64Url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function fromBase64Url(text: string): Bytes {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ---------------------------------------------------------------------------
// 端末の鍵
// ---------------------------------------------------------------------------

/**
 * 端末の鍵ペア（ECDH P-256）を作る。
 * extractable=false なので、秘密鍵の中身は JavaScript からも取り出せない（公開鍵は常に取り出せる）。
 */
export function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: CURVE }, false, ['deriveBits'])
}

/** 公開鍵を、保存・共有用の文字列（raw 形式の base64url）にする */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  return toBase64Url(await crypto.subtle.exportKey('raw', publicKey))
}

/** 文字列の公開鍵を CryptoKey に戻す。P-256 の点として正しくなければ例外になる */
export function importPublicKey(publicKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    fromBase64Url(publicKey),
    { name: 'ECDH', namedCurve: CURVE },
    true,
    [],
  )
}

/**
 * 鍵の合言葉（指紋）。SHA-256(公開鍵 raw) の先頭 4 バイトを、ひらがな 4 語にする。
 * 同じ公開鍵からは必ず同じ 4 語になるので、相手と声で読み合わせて鍵の取り違えを確かめられる。
 */
export async function fingerprintWords(publicKey: string): Promise<string[]> {
  const digest = await crypto.subtle.digest('SHA-256', fromBase64Url(publicKey))
  return wordsFromBytes(new Uint8Array(digest, 0, FINGERPRINT_BYTES))
}

// ---------------------------------------------------------------------------
// 内部の部品
// ---------------------------------------------------------------------------

/**
 * AAD：平文で保存するメタデータ。暗号文と結びつけ、書き換えられたら復号が失敗するようにする。
 * 末尾に header / body の区別も入れる。両方を同じ鍵 K で暗号化しているので、
 * これがないと、サーバー側で header と body の暗号文を入れ替えても復号が通ってしまう。
 */
function associatedData(
  capsuleId: string,
  to: string,
  from: string,
  part: 'header' | 'body',
): Bytes {
  return utf8(`${capsuleId}|${to}|${from}|${part}`)
}

/**
 * 鍵を包む鍵 KEK を作る。
 * ECDH で得た共有秘密はそのまま鍵にせず、HKDF-SHA256 に通す。
 * info に手紙の ID と uid を入れるので、別の手紙・別の人あての KEK とは必ず別物になる。
 */
async function deriveKek(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt: Bytes,
  capsuleId: string,
  uid: string,
  usage: 'wrapKey' | 'unwrapKey',
): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  )
  const hkdfInput = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: utf8(`${INFO_PREFIX}|${capsuleId}|${uid}`),
    },
    hkdfInput,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

async function encryptJson(key: CryptoKey, aad: Bytes, value: unknown): Promise<Ciphertext> {
  const iv = randomBytes(IV_BYTES)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    key,
    utf8(JSON.stringify(value)),
  )
  return { iv: toBase64Url(iv), ct: toBase64Url(ct) }
}

async function decryptJson(key: CryptoKey, aad: Bytes, data: Ciphertext): Promise<unknown> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(data.iv), additionalData: aad },
    key,
    fromBase64Url(data.ct),
  )
  return JSON.parse(new TextDecoder().decode(plain))
}

/** 内容鍵 K を、uid の人だけが取り出せるように包む */
async function wrapContentKey(
  contentKey: CryptoKey,
  capsuleId: string,
  uid: string,
  recipientPublicKey: string,
): Promise<WrappedKey> {
  // 手紙ごと・相手ごとに使い捨ての鍵ペアを作る。秘密鍵はこの関数を抜けたら捨てられる
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    false,
    ['deriveBits'],
  )
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const kek = await deriveKek(
    ephemeral.privateKey,
    await importPublicKey(recipientPublicKey),
    salt,
    capsuleId,
    uid,
    'wrapKey',
  )
  const wrapped = await crypto.subtle.wrapKey('raw', contentKey, kek, { name: 'AES-GCM', iv })
  return {
    epk: await exportPublicKey(ephemeral.publicKey),
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    wrapped: toBase64Url(wrapped),
  }
}

/** 自分の秘密鍵で、自分あてに包まれた内容鍵 K を取り出す。鍵が違えば例外になる */
async function unwrapContentKey(
  capsule: SealedCapsule,
  uid: string,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
  const entry = capsule.keys[uid]
  if (!entry) throw new Error('この手紙には、あなたあての鍵が入っていません')

  const kek = await deriveKek(
    privateKey,
    await importPublicKey(entry.epk),
    fromBase64Url(entry.salt),
    capsule.id,
    uid,
    'unwrapKey',
  )
  return crypto.subtle.unwrapKey(
    'raw',
    fromBase64Url(entry.wrapped),
    kek,
    { name: 'AES-GCM', iv: fromBase64Url(entry.iv) },
    { name: 'AES-GCM' },
    false, // 取り出した K も、中身は JavaScript から読めないままにする
    ['decrypt'],
  )
}

// ---------------------------------------------------------------------------
// 封をする・封を切る
// ---------------------------------------------------------------------------

/** 手紙に封をする（暗号化）。返り値をそのまま Firestore に保存できる */
export async function sealCapsule(input: SealInput): Promise<SealedCapsule> {
  const { capsuleId, to, from } = input

  // 包む相手は、あて先と差出人。自分あての手紙なら 1 人ぶんになる
  const readers = [...new Set([to, from])]
  for (const uid of readers) {
    if (!input.publicKeys[uid]) throw new Error(`公開鍵が見つかりません: ${uid}`)
  }

  // 内容鍵 K。包む（wrapKey）ために、この場でだけ extractable=true にしている
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ])

  // encryptJson が毎回ランダムな IV を作るので、header と body は別の IV になる
  const header = await encryptJson(
    contentKey,
    associatedData(capsuleId, to, from, 'header'),
    input.header,
  )
  const body = await encryptJson(
    contentKey,
    associatedData(capsuleId, to, from, 'body'),
    input.body,
  )

  const keys: Record<string, WrappedKey> = {}
  for (const uid of readers) {
    keys[uid] = await wrapContentKey(contentKey, capsuleId, uid, input.publicKeys[uid])
  }

  return { id: capsuleId, to, from, header, body, keys }
}

/**
 * header（場所・ヒントなど）を開ける。一覧や地図に出すため、いつ開けてもよい。
 */
export async function openHeader(
  capsule: SealedCapsule,
  uid: string,
  privateKey: CryptoKey,
): Promise<CapsuleHeader> {
  const contentKey = await unwrapContentKey(capsule, uid, privateKey)
  const aad = associatedData(capsule.id, capsule.to, capsule.from, 'header')
  return (await decryptJson(contentKey, aad, capsule.header)) as CapsuleHeader
}

/**
 * body（文面）を開ける ＝ 封を切る。
 * 「その場所に着いたか」「開けられる日を過ぎたか」は呼び出す側が先に確かめること。
 * この関数自体は、鍵さえあれば場所に関係なく復号できる（場所・日時の制限は端末側の判定）。
 */
export async function openBody(
  capsule: SealedCapsule,
  uid: string,
  privateKey: CryptoKey,
): Promise<CapsuleBody> {
  const contentKey = await unwrapContentKey(capsule, uid, privateKey)
  const aad = associatedData(capsule.id, capsule.to, capsule.from, 'body')
  return (await decryptJson(contentKey, aad, capsule.body)) as CapsuleBody
}
