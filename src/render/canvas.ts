import { createCanvas, GlobalFonts, Canvas, type SKRSContext2D } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PANEL_WIDTH, PANEL_HEIGHT, FONT_DIR } from '../config.js'

let fontsRegistered = false

export function registerFonts(): void {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(join(FONT_DIR, 'Aldrich-Regular.ttc'), 'Aldrich')
  GlobalFonts.registerFromPath(join(FONT_DIR, 'advanced_led_board-7.ttc'), 'ClockLED')
  fontsRegistered = true
}

/** Returns a white-filled 1360x480 context ready to draw black on. */
export function createFrame(): { canvas: Canvas; ctx: SKRSContext2D } {
  registerFonts()
  const canvas = createCanvas(PANEL_WIDTH, PANEL_HEIGHT)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT)
  ctx.fillStyle = '#000000'
  return { canvas, ctx }
}

/** Writes the canvas as a PNG. display.py thresholds it to 1-bit. */
export function writeFramePng(canvas: Canvas, path: string): void {
  writeFileSync(path, canvas.toBuffer('image/png'))
}
