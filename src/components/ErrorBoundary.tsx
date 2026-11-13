import { Component } from 'react'
import type { ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

/**
 * 画面を描いている途中で想定外のエラーが起きたとき、真っ白のままにせず案内を出す。
 *
 * React では、子の描画エラーを受け止める仕組み（getDerivedStateFromError）を
 * クラスでしか書けないので、この部品だけクラスにしている。
 * 通信の失敗など、あらかじめ想定しているエラーは各画面が自分で表示するので、ここには来ない。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  /** 子のどこかで描画エラーが起きると React が呼ぶ。返した値が state になる */
  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-mincho text-3xl font-bold">アルクカナ</h1>
        <p role="alert" className="text-muted">
          うまく表示できませんでした。
          <br />
          読み込みなおすと、なおることがあります。
        </p>
        <button
          type="button"
          // 開いていた画面そのものが原因のこともあるので、地図（最初の画面）から開きなおす
          onClick={() => window.location.assign('/')}
          className="rounded-full bg-gold px-6 py-3 font-bold text-gold-ink"
        >
          読み込みなおす
        </button>
      </main>
    )
  }
}
