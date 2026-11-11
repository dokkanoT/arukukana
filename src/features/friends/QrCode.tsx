import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

type Props = {
  /** QR コードに入れる文字（共有リンクの URL） */
  value: string
  /** 画像の説明（読み上げ用） */
  label: string
}

/**
 * QR コード。相手のスマホの標準カメラで読むと、リンクが開く。
 * アプリの中に読み取り機能は作らない。
 */
export function QrCode({ value, label }: Props) {
  const [image, setImage] = useState<{ value: string; src: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: 480, // 表示は 200px ほど。高精細な画面でもにじまないよう、大きめに作る
      margin: 2, // まわりの余白。少ないと読み取りにくくなる
      errorCorrectionLevel: 'M',
      // 紙と墨の色。QR は「明るい地に暗い模様」でないと読めないカメラがあるので、夜トーンにはしない
      color: { dark: '#2a2620', light: '#f2ecdf' },
    }).then(
      (src) => {
        if (!cancelled) setImage({ value, src })
      },
      (error) => console.error('QR コードを作れませんでした', error),
    )
    return () => {
      cancelled = true
    }
  }, [value])

  // 別の値の画像が残っているあいだは出さない
  if (image === null || image.value !== value) {
    return <div className="h-48 w-48 rounded-lg bg-paper/10" aria-hidden />
  }
  return <img src={image.src} alt={label} className="h-48 w-48 rounded-lg" />
}
