import { describe, it, expect } from 'vitest'
import { formatTime, getProgress, getNextMode } from './time'

describe('formatTime', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('formats 5 seconds as 00:05', () => {
    expect(formatTime(5)).toBe('00:05')
  })

  it('formats 65 seconds as 01:05', () => {
    expect(formatTime(65)).toBe('01:05')
  })

  it('formats 25 minutes as 25:00', () => {
    expect(formatTime(25 * 60)).toBe('25:00')
  })

  it('formats 59 minutes 59 seconds as 59:59', () => {
    expect(formatTime(59 * 60 + 59)).toBe('59:59')
  })
})

describe('getProgress', () => {
  it('returns 1 when remaining is 0', () => {
    expect(getProgress(0, 100)).toBe(1)
  })

  it('returns 0.5 when half done', () => {
    expect(getProgress(50, 100)).toBe(0.5)
  })

  it('returns 0 when nothing elapsed', () => {
    expect(getProgress(100, 100)).toBe(0)
  })

  it('returns 0 when total is 0 (edge case)', () => {
    expect(getProgress(0, 0)).toBe(0)
  })
})

describe('getNextMode', () => {
  it('returns short_break after work when completedCount not multiple of interval', () => {
    expect(getNextMode('work', 1, 4)).toBe('short_break')
    expect(getNextMode('work', 3, 4)).toBe('short_break')
  })

  it('returns long_break after work when completedCount is multiple of interval', () => {
    expect(getNextMode('work', 4, 4)).toBe('long_break')
    expect(getNextMode('work', 8, 4)).toBe('long_break')
  })

  it('returns work after short_break', () => {
    expect(getNextMode('short_break', 2, 4)).toBe('work')
  })

  it('returns work after long_break', () => {
    expect(getNextMode('long_break', 4, 4)).toBe('work')
  })
})
