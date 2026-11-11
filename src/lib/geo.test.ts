import { describe, expect, it } from 'vitest'
import {
  checkOpenable,
  circlePolygon,
  distanceMeters,
  formatDistance,
  isWithinReach,
  remainingMeters,
} from './geo.ts'

const tokyoStation = { lat: 35.6812, lng: 139.7671 }

describe('distanceMeters', () => {
  it('同じ地点なら 0', () => {
    expect(distanceMeters(tokyoStation, tokyoStation)).toBe(0)
  })

  it('緯度 1 度ぶんは約 111.19km', () => {
    const north = { lat: tokyoStation.lat + 1, lng: tokyoStation.lng }
    expect(distanceMeters(tokyoStation, north)).toBeCloseTo(111_194.93, 0)
  })

  it('向きを入れ替えても同じ距離', () => {
    const shinOsaka = { lat: 34.7335, lng: 135.5002 }
    const there = distanceMeters(tokyoStation, shinOsaka)
    const back = distanceMeters(shinOsaka, tokyoStation)
    expect(there).toBeCloseTo(back, 6)
    // 東京駅〜新大阪駅は直線でおよそ 400km
    expect(there).toBeGreaterThan(390_000)
    expect(there).toBeLessThan(410_000)
  })
})

describe('isWithinReach', () => {
  it('半径の内側なら着いている', () => {
    expect(isWithinReach(25, 30, 0)).toBe(true)
  })

  it('半径ちょうどは着いている', () => {
    expect(isWithinReach(30, 30, 0)).toBe(true)
  })

  it('GPS の誤差ぶんだけ外側でも着いている', () => {
    expect(isWithinReach(45, 30, 20)).toBe(true)
    expect(isWithinReach(51, 30, 20)).toBe(false)
  })

  it('誤差として認めるのは 30m まで', () => {
    expect(isWithinReach(60, 30, 500)).toBe(true)
    expect(isWithinReach(61, 30, 500)).toBe(false)
  })
})

describe('formatDistance', () => {
  it('1km 未満はメートルで、四捨五入して出す', () => {
    expect(formatDistance(84.6)).toBe('85m')
    expect(formatDistance(0)).toBe('0m')
  })

  it('1km 以上はキロメートルで、小数 1 桁まで出す', () => {
    expect(formatDistance(1000)).toBe('1.0km')
    expect(formatDistance(1234)).toBe('1.2km')
  })
})

describe('remainingMeters', () => {
  it('円のふちまでの距離を返す', () => {
    expect(remainingMeters(100, 30)).toBe(70)
  })

  it('円の中にいれば 0', () => {
    expect(remainingMeters(10, 30)).toBe(0)
  })
})

describe('circlePolygon', () => {
  it('最初と最後が同じ点で、閉じた形になる', () => {
    const points = circlePolygon(tokyoStation, 30, 16)

    expect(points).toHaveLength(17)
    expect(points[16][0]).toBeCloseTo(points[0][0], 9)
    expect(points[16][1]).toBeCloseTo(points[0][1], 9)
  })

  it('どの頂点も、中心からほぼ半径ぶん離れている', () => {
    for (const [lng, lat] of circlePolygon(tokyoStation, 30)) {
      expect(distanceMeters(tokyoStation, { lat, lng })).toBeCloseTo(30, 0)
    }
  })
})

describe('checkOpenable', () => {
  const arrived = { distance: 10, radius: 30, accuracy: 0, now: 1_000 }

  it('着いていて、開けられる日の指定がなければ開けられる', () => {
    expect(checkOpenable(arrived)).toBe('ok')
  })

  it('着いていなければ開けられない', () => {
    expect(checkOpenable({ ...arrived, distance: 100 })).toBe('too-far')
  })

  it('開けられる日より前は開けられない', () => {
    expect(checkOpenable({ ...arrived, openAfter: 2_000 })).toBe('too-early')
  })

  it('開けられる日時ちょうどから開けられる', () => {
    expect(checkOpenable({ ...arrived, openAfter: 1_000 })).toBe('ok')
  })

  it('遠くて日も早いときは、まず遠いことを伝える', () => {
    expect(checkOpenable({ ...arrived, distance: 100, openAfter: 2_000 })).toBe('too-far')
  })
})
