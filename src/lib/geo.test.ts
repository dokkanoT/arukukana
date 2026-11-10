import { describe, expect, it } from 'vitest'
import { distanceMeters, isWithinReach } from './geo.ts'

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
