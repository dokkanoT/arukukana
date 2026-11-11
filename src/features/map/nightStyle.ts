import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

/** OpenFreeMap の暗色スタイル。これを土台に、色だけアルクカナの夜トーンに上書きする */
export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** 地図の色。index.css のデザイントークンと同じ値（地図は CSS 変数を読めないので、ここにも書く） */
const colors = {
  block: '#121520', // map-block：街区
  road: '#1b2030', // map-road：道
  roadMajor: '#252b3d', // 大きな道は少しだけ明るく
  roadEdge: '#0f1118', // ink：道のふち
  water: '#0a1020',
  green: '#141a26',
  building: '#181c29',
  buildingEdge: '#1f2433',
  rail: '#2c3242', // line
  label: '#7d7869', // muted を少し沈めた色
  labelHalo: '#0f1118', // ink
}

/** 日本語の地名があればそれを、無ければ現地の名前を出す */
const japaneseName = ['coalesce', ['get', 'name:ja'], ['get', 'name']]

/** レイヤー 1 枚ぶんの色を決める。当てはまらないレイヤーはそのまま返す */
function recolor(layer: LayerSpecification): LayerSpecification {
  const paint: Record<string, unknown> = { ...layer.paint }
  const layout: Record<string, unknown> = { ...layer.layout }
  const id = layer.id

  if (layer.type === 'background') {
    paint['background-color'] = colors.block
  } else if (layer.type === 'fill') {
    if (id === 'water') paint['fill-color'] = colors.water
    else if (id === 'building') {
      paint['fill-color'] = colors.building
      paint['fill-outline-color'] = colors.buildingEdge
    } else if (id === 'landcover_wood' || id === 'landuse_park') paint['fill-color'] = colors.green
    else paint['fill-color'] = colors.block
  } else if (layer.type === 'line') {
    if (id === 'waterway') paint['line-color'] = colors.water
    else if (id.startsWith('railway')) {
      paint['line-color'] = id.endsWith('dashline') ? colors.block : colors.rail
    } else if (id.startsWith('boundary')) paint['line-color'] = colors.rail
    else if (id.endsWith('_casing')) paint['line-color'] = colors.roadEdge
    else if (id.endsWith('_inner')) paint['line-color'] = colors.roadMajor
    else paint['line-color'] = colors.road
  } else if (layer.type === 'symbol') {
    if ('text-field' in layout) {
      paint['text-color'] = colors.label
      paint['text-halo-color'] = colors.labelHalo
      // 道路番号（ref）以外は、日本語の名前に差し替える
      if (id !== 'highway_name_motorway') layout['text-field'] = japaneseName
    }
  }

  return { ...layer, paint, layout } as LayerSpecification
}

/** スタイルを夜トーンに塗り替えた新しいスタイルを返す（もとのスタイルは変えない） */
export function toNightStyle(style: StyleSpecification): StyleSpecification {
  return { ...style, layers: style.layers.map(recolor) }
}

/** OpenFreeMap からスタイルを読み込み、夜トーンにして返す */
export async function loadNightStyle(): Promise<StyleSpecification> {
  const response = await fetch(BASE_STYLE_URL)
  if (!response.ok) throw new Error(`地図のスタイルを読み込めませんでした (${response.status})`)
  return toNightStyle((await response.json()) as StyleSpecification)
}
