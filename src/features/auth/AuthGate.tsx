import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ensureSignedIn, FirebaseConfigError, retrySignIn } from '../../lib/firebase.ts'
import { getDeviceKeys } from '../../lib/keystore.ts'
import { publishPublicKey } from '../../lib/users.ts'
import { SessionContext } from './sessionContext.ts'
import type { Session } from './sessionContext.ts'

type State =
  | { status: 'loading' }
  | { status: 'ready'; session: Session }
  | { status: 'error'; error: unknown }

let sessionPromise: Promise<Session> | undefined

/**
 * 起動時の準備を 1 回だけ走らせる。
 * 開発中の React（StrictMode）は effect を 2 回動かすので、そのままだと公開鍵の登録が 2 回同時に走り、
 * 2 回目が「createdAt の書き換え」とみなされてルールに弾かれる。
 */
function prepareSessionOnce(signIn: () => Promise<string>, force = false): Promise<Session> {
  if (force || !sessionPromise) sessionPromise = prepareSession(signIn)
  return sessionPromise
}

/** 起動時の準備：匿名サインイン → 端末の鍵を用意 → 公開鍵を登録 */
async function prepareSession(signIn: () => Promise<string>): Promise<Session> {
  // サインインと鍵の用意は互いに関係しないので、同時に進める
  const [uid, keys] = await Promise.all([signIn(), getDeviceKeys()])
  await publishPublicKey(uid, keys.publicKey)
  return { uid, ...keys }
}

/**
 * 起動時の準備を済ませ、終わってから中身（children）を出す門。
 * 中の画面は「必ず uid と鍵がある」前提で書ける。
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    prepareSessionOnce(ensureSignedIn).then(
      (session) => {
        if (!cancelled) setState({ status: 'ready', session })
      },
      (error: unknown) => {
        // 原因を調べられるように、エラーだけはコンソールに出す（手紙の中身や座標は含まれない）
        console.error('起動時の準備に失敗しました', error)
        if (!cancelled) setState({ status: 'error', error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  function retry() {
    setState({ status: 'loading' })
    prepareSessionOnce(retrySignIn, true).then(
      (session) => setState({ status: 'ready', session }),
      (error: unknown) => setState({ status: 'error', error }),
    )
  }

  if (state.status === 'ready') {
    return <SessionContext value={state.session}>{children}</SessionContext>
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-mincho text-3xl font-bold">アルクカナ</h1>
      {state.status === 'loading' ? (
        <p className="text-muted">準備しています…</p>
      ) : state.error instanceof FirebaseConfigError ? (
        <p className="text-muted">
          Firebase の設定が入っていません。
          <br />
          .env.example を .env.local にコピーして値を入れてください。
        </p>
      ) : (
        <>
          <p className="text-muted">
            つながりませんでした。
            <br />
            電波のよいところで、もう一度ためしてください。
          </p>
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink"
          >
            もう一度ためす
          </button>
        </>
      )}
    </main>
  )
}
