import { Outlet } from 'react-router'
import { TabBar } from './TabBar.tsx'

/** 全画面共通の枠。上に各ページ（Outlet）、下にタブバーを置く */
export function AppLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
