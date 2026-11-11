import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { StoredCapsule } from '../../lib/capsules.ts'
import { openBody } from '../../lib/crypto.ts'
import type { CapsuleHeader } from '../../lib/crypto.ts'
import { useSession } from '../auth/sessionContext.ts'
import { useInbox } from '../letter/inboxContext.ts'

type Tab = 'server' | 'device'

/** サーバーに置いてある 1 項目 */
type ServerField = {
  name: string
  value: string
  /** 運営がそのまま読める値か。false は暗号文など、読んでも意味がわからない値 */
  readable: boolean
  note: string
}

/** 手紙のサーバー上の姿を、項目ごとに並べる */
function toServerFields(capsule: StoredCapsule): ServerField[] {
  const fields: ServerField[] = [
    { name: 'to', value: capsule.to, readable: true, note: 'あて先の ID' },
    { name: 'from', value: capsule.from, readable: true, note: '差出人の ID' },
    {
      name: 'createdAt',
      value: capsule.createdAt === null ? '(記録中)' : new Date(capsule.createdAt).toISOString(),
      readable: true,
      note: '埋めた日時',
    },
    { name: 'header.iv', value: capsule.header.iv, readable: false, note: '暗号化に使った使い捨ての値' },
    { name: 'header.ct', value: capsule.header.ct, readable: false, note: '場所・ヒント・差出人の名前（暗号文）' },
    { name: 'body.iv', value: capsule.body.iv, readable: false, note: '暗号化に使った使い捨ての値' },
    { name: 'body.ct', value: capsule.body.ct, readable: false, note: '手紙の文面（暗号文）' },
  ]
  for (const [uid, key] of Object.entries(capsule.keys)) {
    const who = uid === capsule.to ? 'あて先' : '差出人'
    fields.push(
      { name: `keys.${uid}.epk`, value: key.epk, readable: false, note: `${who}ぶん：使い捨ての公開鍵` },
      { name: `keys.${uid}.salt`, value: key.salt, readable: false, note: `${who}ぶん：鍵を作るときの乱数` },
      { name: `keys.${uid}.iv`, value: key.iv, readable: false, note: `${who}ぶん：暗号化に使った使い捨ての値` },
      { name: `keys.${uid}.wrapped`, value: key.wrapped, readable: false, note: `${who}ぶん：包んだ内容鍵（暗号文）` },
    )
  }
  return fields
}

function ServerTab({ capsule }: { capsule: StoredCapsule }) {
  return (
    <>
      <p className="text-sm text-muted">
        サーバー（Firestore）に置いてある、この手紙のすべてです。運営が読めるのは
        <span className="text-gold">「読める」</span>
        の 3 つだけで、文面も場所もわかりません。
      </p>
      <dl className="flex flex-col gap-3">
        {toServerFields(capsule).map((field) => (
          <div key={field.name} className="rounded-lg border border-line bg-surface p-3">
            <dt className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono break-all">{field.name}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  field.readable ? 'bg-gold text-gold-ink' : 'border border-line text-muted'
                }`}
              >
                {field.readable ? '読める' : '読めない'}
              </span>
            </dt>
            <dd className="mt-1.5 font-mono text-xs break-all text-muted">{field.value}</dd>
            <dd className="mt-1.5 text-xs">{field.note}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function DeviceTab({ header, message }: { header: CapsuleHeader; message: string | null }) {
  const rows = [
    { label: '差出人の名前', value: header.senderName },
    { label: 'ヒント', value: header.hint || '（なし）' },
    { label: '場所', value: `${header.lat.toFixed(5)}, ${header.lng.toFixed(5)}` },
    { label: '開けられる半径', value: `${header.radius}m` },
    {
      label: '開けられる日',
      value:
        header.openAfter === undefined
          ? '（指定なし）'
          : new Date(header.openAfter).toLocaleDateString('ja-JP'),
    },
  ]
  return (
    <>
      <p className="text-sm text-muted">
        同じ手紙を、あなたの端末の鍵で開いた結果です。鍵は端末の中にしかないので、これが見えるのはあなた（と差出人）だけです。
      </p>
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-line bg-surface p-3">
            <dt className="text-xs text-muted">{row.label}</dt>
            <dd className="mt-1">{row.value}</dd>
          </div>
        ))}
        <div className="rounded-lg bg-paper p-4 text-paper-text">
          <dt className="text-xs opacity-60">手紙の文面</dt>
          <dd className="mt-1 font-mincho leading-loose whitespace-pre-wrap">
            {message ?? 'まだ封を切っていないので、文面は開けていません。'}
          </dd>
        </div>
      </dl>
    </>
  )
}

/**
 * 運営から見えるもの（しくみ）。
 * 同じ手紙について「サーバーにある生のデータ」と「端末で開いた結果」を切り替えて見比べる。
 */
export function ServerViewPage() {
  const { id } = useParams()
  const { uid, privateKey } = useSession()
  const { status, items, openedIds } = useInbox()
  const [tab, setTab] = useState<Tab>('server')
  const [message, setMessage] = useState<string | null>(null)

  const item = items.find((candidate) => candidate.capsule.id === id)
  const capsule = item?.capsule
  const opened = capsule !== undefined && openedIds.has(capsule.id)

  // すでに封を切った手紙だけ、見比べるために文面を開ける
  useEffect(() => {
    if (!capsule || !opened) return
    let cancelled = false
    openBody(capsule, uid, privateKey).then(
      (body) => {
        if (!cancelled) setMessage(body.message)
      },
      () => {
        // 開けられなければ、文面なしのまま見せる
      },
    )
    return () => {
      cancelled = true
    }
  }, [capsule, opened, uid, privateKey])

  if (status === 'loading') {
    return <p className="p-6 text-center text-muted">手紙をさがしています…</p>
  }
  if (!item || !item.header) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">手紙が見つかりません。</p>
        <Link to="/" className="rounded-full border border-line px-6 py-3">
          地図にもどる
        </Link>
      </section>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'server', label: '運営から見えるもの' },
    { key: 'device', label: 'あなたの端末で開くと' },
  ]

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <Link to={`/letter/${item.capsule.id}`} className="self-start text-sm text-muted underline">
        手紙にもどる
      </Link>
      <h1 className="font-mincho text-2xl font-bold">しくみ</h1>

      <div role="tablist" className="flex rounded-full border border-line p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full px-3 py-2 text-sm ${
              tab === key ? 'bg-gold font-bold text-gold-ink' : 'text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'server' ? (
        <ServerTab capsule={item.capsule} />
      ) : (
        <DeviceTab header={item.header} message={message} />
      )}
    </section>
  )
}
