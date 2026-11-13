import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

/**
 * タブのアイコン。24×24 の枠に線で描く。
 * 色は currentColor（まわりの文字色）を使うので、開いているタブは文字と一緒に金色になる。
 * アイコン用のライブラリは入れず、4 つだけなので SVG を直接書いている。
 */
function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mx-auto h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      // 下にラベルの文字があるので、読み上げでは飛ばす
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const tabs = [
  {
    to: '/',
    label: '地図',
    // 地図のピン
    icon: (
      <>
        <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
        <circle cx="12" cy="11" r="2" />
      </>
    ),
  },
  {
    to: '/bury',
    label: '埋める',
    // ペン（手紙を書く）
    icon: (
      <>
        <path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z" />
        <path d="M14 7l3 3" />
      </>
    ),
  },
  {
    to: '/inbox',
    label: '届いた',
    // 封筒
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 8l9 6 9-6" />
      </>
    ),
  },
  {
    to: '/friends',
    label: '友だち',
    // 2 人
    icon: (
      <>
        <circle cx="9" cy="9" r="3" />
        <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M16 14.2c2.8.2 5 2 5 4.8" />
      </>
    ),
  },
]

/** 画面下部に固定するタブ。いま開いているタブだけ金色にする */
export function TabBar() {
  return (
    <nav
      aria-label="メインメニュー"
      className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `block py-2 text-center text-xs ${isActive ? 'font-bold text-gold' : 'text-muted'}`
              }
            >
              <TabIcon>{tab.icon}</TabIcon>
              <span className="mt-1 block">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
