import { describe, expect, it } from 'vitest'
import { WORDS, wordsFromBytes } from './words.ts'

describe('WORDS', () => {
  it('ちょうど 256 語ある（1 バイトに 1 語）', () => {
    expect(WORDS).toHaveLength(256)
  })

  it('同じ語が 2 回出てこない', () => {
    expect(new Set(WORDS).size).toBe(256)
  })

  it('すべて 2〜5 文字のひらがな', () => {
    for (const word of WORDS) {
      expect(word).toMatch(/^[ぁ-ん]{2,5}$/)
    }
  })

  it('濁点・半濁点だけが違う組がない', () => {
    // 「が」を「か + 濁点」に分解してから濁点を取り除き、それでも全部ちがう語であることを確かめる
    const plain = WORDS.map((word) => word.normalize('NFD').replace(/[゙゚]/g, ''))
    expect(new Set(plain).size).toBe(256)
  })
})

describe('wordsFromBytes', () => {
  it('1 バイトが 1 語になる', () => {
    expect(wordsFromBytes(new Uint8Array([0, 1, 255]))).toEqual([
      WORDS[0],
      WORDS[1],
      WORDS[255],
    ])
  })

  it('同じバイト列からは常に同じ語が出る', () => {
    const bytes = new Uint8Array([12, 34, 56, 78])
    expect(wordsFromBytes(bytes)).toEqual(wordsFromBytes(bytes))
  })
})
