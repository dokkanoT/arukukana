import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ensureSignedIn, FirebaseConfigError, retrySignIn } from '../../lib/firebase.ts'
import { UidContext } from './uidContext.ts'

type State =
  | { status: 'loading' }
  | { status: 'ready'; uid: string }
  | { status: 'error'; error: unknown }

/**
 * 起動時に匿名サインインを済ませ、終わってから中身（children）を出す門。
 * 中の画面は「必ず uid がある」前提で書ける。
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    ensureSignedIn().then(
      (uid) => {
        if (!cancelled) setState({ status: 'ready', uid })
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  function retry() {
    setState({ status: 'loading' })
    retrySignIn().then(
      (uid) => setState({ status: 'ready', uid }),
      (error: unknown) => setState({ status: 'error', error }),
    )
  }

  if (state.status === 'ready') {
    return <UidContext value={state.uid}>{children}</UidContext>
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
