import { describe, it, expect } from 'vitest'
import { nextRefresh } from '../src/refresh.js'

describe('nextRefresh', () => {
  it('increments the counter and stays partial below the threshold', () => {
    expect(nextRefresh(0)).toEqual({ full: false, counter: 1 })
    expect(nextRefresh(599)).toEqual({ full: false, counter: 600 })
  })

  it('does a full refresh and resets the counter at the threshold', () => {
    expect(nextRefresh(600)).toEqual({ full: true, counter: 0 })
  })
})
