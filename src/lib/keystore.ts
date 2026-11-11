import { get, set } from 'idb-keyval'
import { exportPublicKey, generateDeviceKeyPair } from './crypto.ts'

/** IndexedDB に鍵ペアを置くときの名前 */
const DEVICE_KEY_NAME = 'arukukana:device-key-pair'

/** この端末の鍵 */
export type DeviceKeys = {
  /** 封を切るのに使う秘密鍵。中身は取り出せない */
  privateKey: CryptoKey
  /** 相手に渡す公開鍵（base64url raw） */
  publicKey: string
}

async function loadOrCreate(): Promise<DeviceKeys> {
  // CryptoKey は「取り出せない」設定のまま IndexedDB に保存できる（localStorage には入れられない）
  let keyPair = await get<CryptoKeyPair>(DEVICE_KEY_NAME)
  if (!keyPair) {
    // 初めての端末だけ、ここで鍵ペアを作る
    keyPair = await generateDeviceKeyPair()
    await set(DEVICE_KEY_NAME, keyPair)
  }
  return {
    privateKey: keyPair.privateKey,
    publicKey: await exportPublicKey(keyPair.publicKey),
  }
}

let deviceKeysPromise: Promise<DeviceKeys> | undefined

/**
 * この端末の鍵を返す。無ければ作って IndexedDB に保存する。
 * 何度呼んでも作るのは 1 回だけ（同時に呼ばれて鍵が 2 組できるのを防ぐ）。
 */
export function getDeviceKeys(): Promise<DeviceKeys> {
  deviceKeysPromise ??= loadOrCreate()
  // 失敗したときは覚えておかず、次に呼ばれたらやり直す
  deviceKeysPromise.catch(() => {
    deviceKeysPromise = undefined
  })
  return deviceKeysPromise
}
