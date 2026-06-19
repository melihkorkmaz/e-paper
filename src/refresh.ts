export const FULL_REFRESH_EVERY = 600

export interface RefreshDecision {
  full: boolean
  counter: number
}

/** Port of main.py refresh_counter logic: full refresh every 600 frames. */
export function nextRefresh(counter: number): RefreshDecision {
  if (counter >= FULL_REFRESH_EVERY) {
    return { full: true, counter: 0 }
  }
  return { full: false, counter: counter + 1 }
}
