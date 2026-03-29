import Color from 'colorjs.io'
import getStroke from 'perfect-freehand'
import type { BrushSettings } from 'drawers-shared'

export function generateLightColor(): string {
  const l = 0.85 + Math.random() * 0.1
  const c = 0.05 + Math.random() * 0.1
  const h = Math.random() * 360
  const color = new Color('oklch', [l, c, h])
  const srgbColor = color.to('srgb')
  return srgbColor.toString({ format: 'hex' })
}

export function generateDarkColor(): string {
  const l = 0.3 + Math.random() * 0.15     // ~0.05–0.20
  const c = 0.05 + Math.random() * 0.15     // ~0.05–0.20
  const h = Math.random() * 360

  const color = new Color('oklch', [l, c, h])
  const srgbColor = color.to('srgb')
  return srgbColor.toString({ format: 'hex' })
}

export function throttleRaf<T extends (...args: any[]) => void>(fn: T) {
  let ticking = false
  return (...args: Parameters<T>) => {
    if (!ticking) {
      requestAnimationFrame(() => {
        fn(...args)
        ticking = false
      })
      ticking = true
    }
  }
}

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''
  const d = stroke.reduce(
    (acc: any, [x0, y0]: any, i: any, arr: any) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0] ?? [0, 0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}

export function makeStroke(pts: number[][], brush: BrushSettings): string {
  const stroke = getStroke(pts, brush.strokeOptions)
  return getSvgPathFromStroke(stroke as any)
}
