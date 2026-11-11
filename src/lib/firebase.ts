import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

/** 設定値が入っていないときのエラー。画面側で案内を出し分けるために専用の型にしている */
export class FirebaseConfigError extends Error {
  constructor(missing: string[]) {
    super(`Firebase の設定がありません: ${missing.join(', ')}`)
    this.name = 'FirebaseConfigError'
  }
}

let app: FirebaseApp | undefined

/** Firebase を初期化する。2 回目以降は同じものを返す */
function getFirebaseApp(): FirebaseApp {
  if (app) return app

  const env = {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  }
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length > 0) throw new FirebaseConfigError(missing)

  app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })
  return app
}

function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

/** Firestore。置くのは暗号文と公開鍵だけ */
export function getDb(): Firestore {
  return getFirestore(getFirebaseApp())
}

async function signIn(): Promise<string> {
  const firebaseAuth = getFirebaseAuth()
  // 前回のサインイン状態がブラウザに残っていれば、その復元を待つ
  await firebaseAuth.authStateReady()
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser.uid

  // 初めての端末だけ、ここで匿名ユーザーが新しく作られる
  const credential = await signInAnonymously(firebaseAuth)
  return credential.user.uid
}

let signInPromise: Promise<string> | undefined

/**
 * 匿名でサインインして uid を返す。登録画面なしで使えるようにするための入口。
 * 何度呼んでもサインインは 1 回だけ走る（同時に呼ばれて匿名ユーザーが 2 人できるのを防ぐ）。
 */
export function ensureSignedIn(): Promise<string> {
  signInPromise ??= signIn()
  return signInPromise
}

/** 失敗したあとにやり直す */
export function retrySignIn(): Promise<string> {
  signInPromise = undefined
  return ensureSignedIn()
}
