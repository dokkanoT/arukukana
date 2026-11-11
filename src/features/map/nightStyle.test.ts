import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { toNightStyle } from './nightStyle.ts'

/** OpenFreeMap の dark スタイルを、テストに必要なぶんだけ小さくしたもの */
const baseStyle: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://example.com/planet' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
    {
      id: 'highway_minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      paint: { 'line-color': '#181818', 'line-width': 2 },
    },
    {
      id: 'place_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: { 'text-field': ['get', 'name:latin'], 'text-size': 14 },
      paint: { 'text-color': 'rgb(101,101,101)' },
    },
  ],
}

function findLayer(style: StyleSpecification, id: string) {
  const layer = style.layers.find((candidate) => candidate.id === id)
  if (!layer) throw new Error(`レイヤーがありません: ${id}`)
  return layer as { paint: Record<string, unknown>; layout: Record<string, unknown> }
}

describe('toNightStyle', () => {
  it('背景と道が、デザイントークンの色になる', () => {
    const night = toNightStyle(baseStyle)

    expect(findLayer(night, 'background').paint['background-color']).toBe('#121520')
    expect(findLayer(night, 'highway_minor').paint['line-color']).toBe('#1b2030')
  })

  it('色以外の設定（線の太さ・文字の大きさ）は変えない', () => {
    const night = toNightStyle(baseStyle)

    expect(findLayer(night, 'highway_minor').paint['line-width']).toBe(2)
    expect(findLayer(night, 'place_city').layout['text-size']).toBe(14)
  })

  it('地名は日本語を優先して出す', () => {
    const night = toNightStyle(baseStyle)

    expect(findLayer(night, 'place_city').layout['text-field']).toEqual([
      'coalesce',
      ['get', 'name:ja'],
      ['get', 'name'],
    ])
  })

  it('もとのスタイルは書き換えない', () => {
    const before = JSON.stringify(baseStyle)
    toNightStyle(baseStyle)

    expect(JSON.stringify(baseStyle)).toBe(before)
  })
})
