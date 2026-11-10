type Props = {
  title: string
  note: string
}

/** 中身を作る前の仮ページ。各画面を実装したら使わなくなる */
export function PagePlaceholder({ title, note }: Props) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-mincho text-3xl font-bold">{title}</h1>
      <p className="text-muted">{note}</p>
    </section>
  )
}
