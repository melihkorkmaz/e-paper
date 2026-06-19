import type { SKRSContext2D } from '@napi-rs/canvas'
import { PANEL_WIDTH } from '../config.js'

/** Phase-1 proof frame: a title and a large clock, to verify fonts + layout. */
export function renderScreen(ctx: SKRSContext2D, now: Date): void {
  ctx.fillStyle = '#000000'
  ctx.font = '32px Aldrich'
  ctx.fillText('e-Paper Dashboard (TypeScript)', 20, 50)

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  ctx.font = '180px ClockLED'
  const clock = `${hh}:${mm}`
  const w = ctx.measureText(clock).width
  ctx.fillText(clock, (PANEL_WIDTH - w) / 2, 320)
}
