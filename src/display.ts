import { spawn } from 'node:child_process'
import { DISPLAY_SCRIPT, DISPLAY_TIMEOUT_MS } from './config.js'

/** Spawn display.py to push a PNG, killing it if it hangs past the timeout. */
export function pushFrame(pngPath: string, full: boolean, dither = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      DISPLAY_SCRIPT,
      pngPath,
      ...(full ? ['--full'] : []),
      ...(dither ? ['--dither'] : []),
    ]
    const proc = spawn('python3', args, { stdio: ['ignore', 'inherit', 'inherit'] })

    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error('display.py timed out'))
    }, DISPLAY_TIMEOUT_MS)

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    proc.on('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve() : reject(new Error(`display.py exited ${code}`))
    })
  })
}
