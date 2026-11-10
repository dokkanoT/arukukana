import { NavLink } from 'react-router'

const tabs = [
  { to: '/', label: '地図' },
  { to: '/bury', label: '埋める' },
  { to: '/inbox', label: '届いた' },
  { to: '/friends', label: '友だち' },
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
                `block py-3 text-center text-sm ${isActive ? 'font-bold text-gold' : 'text-muted'}`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
