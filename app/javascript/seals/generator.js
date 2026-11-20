import { findState, findProfession } from './states'

const SIZE = 400
const CENTER = SIZE / 2
const OUTER_R = 192
const INNER_R = 132
const TEXT_R = 162

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

// Rough width of an uppercase glyph in a bold sans-serif font relative to its size.
const CHAR_WIDTH = 0.66

const fitArcFontSize = (text, radius, arcFraction, max) => {
  const available = Math.PI * radius * arcFraction
  const length = Math.max(text.length, 1)

  return Math.max(Math.min(max, available / (length * CHAR_WIDTH)), 10)
}

const fitLineFontSize = (text, width, max) => {
  const length = Math.max(text.length, 1)

  return Math.max(Math.min(max, width / (length * 0.6)), 9)
}

const splitName = (name) => {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (name.length <= 18 || words.length < 2) {
    return [name.trim()]
  }

  let best = [name]
  let bestDiff = Infinity

  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(' ')
    const second = words.slice(i).join(' ')
    const diff = Math.abs(first.length - second.length)

    if (diff < bestDiff) {
      bestDiff = diff
      best = [first, second]
    }
  }

  return best
}

const starPath = (cx, cy, outer, inner = outer * 0.4) => {
  const points = []

  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5

    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }

  return `M${points.join('L')}Z`
}

export function resolveSealText (options) {
  const state = findState(options.state)
  const profession = findProfession(options.profession)
  const rules = { ...(state?.rules?.default || {}), ...(state?.rules?.[profession.key] || {}) }

  const stateLine = rules.stateText || (state ? `STATE OF ${state.name.toUpperCase()}` : '')
  const professionLine = rules.professionText || profession.title

  let top = stateLine
  let bottom = professionLine

  if (rules.layout === 'profession_top') {
    top = professionLine
    bottom = stateLine
  }

  const numberPrefix = rules.numberPrefix ?? profession.numberPrefix ?? ''
  const numberLabel = rules.numberLabel ?? 'No.'
  const license = String(options.license || '').trim()

  return {
    state,
    profession,
    rules,
    top: top.toUpperCase(),
    bottom: bottom.toUpperCase(),
    numberLine: license ? `${numberLabel} ${numberPrefix}${license}`.trim() : '',
    emblem: rules.emblem || null
  }
}

export function buildSealSvg (options = {}) {
  // Only hex colors are allowed: the color is written into SVG attributes unescaped.
  const color = /^#[0-9a-f]{3,8}$/i.test(options.color || '') ? options.color : '#111111'
  const name = String(options.name || '').trim().toUpperCase() || 'YOUR NAME'
  const text = resolveSealText(options)

  const discipline = options.discipline
    ? String(options.discipline).trim().toUpperCase()
    : ''

  const expiration = options.expiration
    ? `Exp. ${String(options.expiration).trim()}`
    : ''

  const topSize = fitArcFontSize(text.top, TEXT_R, 0.76, 30)
  const bottomSize = fitArcFontSize(text.bottom, TEXT_R, 0.76, 30)

  // Top text runs clockwise across the top. Bottom text runs counter-clockwise
  // across the bottom so that it reads left-to-right; its radius is pushed out
  // by the cap height so both rows sit centered in the ring.
  const topR = TEXT_R - topSize * 0.36
  const bottomR = TEXT_R + bottomSize * 0.36

  const topPath = `M ${CENTER - topR},${CENTER} A ${topR},${topR} 0 0 1 ${CENTER + topR},${CENTER}`
  const bottomPath = `M ${CENTER - bottomR},${CENTER} A ${bottomR},${bottomR} 0 0 0 ${CENTER + bottomR},${CENTER}`

  const nameLines = splitName(name)
  const innerWidth = INNER_R * 1.7
  const nameSize = Math.min(...nameLines.map((line) => fitLineFontSize(line, innerWidth, 34)))

  const centerLines = []

  if (text.emblem === 'star') {
    centerLines.push({ kind: 'star', height: 44 })
  }

  if (discipline && text.rules.disciplinePosition === 'top') {
    centerLines.push({ kind: 'text', text: discipline, size: fitLineFontSize(discipline, innerWidth * 0.8, 20), weight: 700 })
  }

  nameLines.forEach((line) => {
    centerLines.push({ kind: 'text', text: line, size: nameSize, weight: 700 })
  })

  if (text.numberLine) {
    centerLines.push({ kind: 'rule', height: 10 })
    centerLines.push({ kind: 'text', text: text.numberLine, size: fitLineFontSize(text.numberLine, innerWidth * 0.85, 26), weight: 700 })
  }

  if (discipline && text.rules.disciplinePosition !== 'top') {
    centerLines.push({ kind: 'text', text: discipline, size: fitLineFontSize(discipline, innerWidth * 0.8, 20), weight: 700 })
  }

  if (expiration) {
    centerLines.push({ kind: 'text', text: expiration, size: fitLineFontSize(expiration, innerWidth * 0.8, 18), weight: 400 })
  }

  const lineHeight = (line) => line.kind === 'text' ? line.size * 1.18 : line.height
  const totalHeight = centerLines.reduce((sum, line) => sum + lineHeight(line), 0)

  let y = CENTER - totalHeight / 2

  const centerSvg = centerLines.map((line) => {
    const h = lineHeight(line)
    let out = ''

    if (line.kind === 'star') {
      out = `<path d="${starPath(CENTER, y + h / 2, h / 2 - 2)}" fill="${color}"/>`
    } else if (line.kind === 'rule') {
      out = `<line x1="${CENTER - INNER_R * 0.7}" y1="${y + h / 2}" x2="${CENTER + INNER_R * 0.7}" y2="${y + h / 2}" stroke="${color}" stroke-width="2"/>`
    } else {
      out = `<text x="${CENTER}" y="${(y + h / 2 + line.size * 0.35).toFixed(2)}" font-size="${line.size.toFixed(2)}" font-weight="${line.weight}" text-anchor="middle">${escapeXml(line.text)}</text>`
    }

    y += h

    return out
  }).join('')

  const separator = (x) => `<path d="${starPath(x, CENTER, 7)}" fill="${color}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` +
    '<defs>' +
    `<path id="seal-top" d="${topPath}" fill="none"/>` +
    `<path id="seal-bottom" d="${bottomPath}" fill="none"/>` +
    '</defs>' +
    `<g fill="${color}" font-family="Arial, Helvetica, 'Liberation Sans', sans-serif">` +
    `<circle cx="${CENTER}" cy="${CENTER}" r="${OUTER_R}" fill="none" stroke="${color}" stroke-width="6"/>` +
    `<circle cx="${CENTER}" cy="${CENTER}" r="${OUTER_R - 9}" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    `<circle cx="${CENTER}" cy="${CENTER}" r="${INNER_R}" fill="none" stroke="${color}" stroke-width="3"/>` +
    `<text font-size="${topSize.toFixed(2)}" font-weight="700" letter-spacing="1"><textPath href="#seal-top" startOffset="50%" text-anchor="middle">${escapeXml(text.top)}</textPath></text>` +
    `<text font-size="${bottomSize.toFixed(2)}" font-weight="700" letter-spacing="1"><textPath href="#seal-bottom" startOffset="50%" text-anchor="middle">${escapeXml(text.bottom)}</textPath></text>` +
    separator(CENTER - TEXT_R) +
    separator(CENTER + TEXT_R) +
    centerSvg +
    '</g></svg>'
}

export function sealSvgToPngBlob (svg, size = 800) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))

    image.onload = () => {
      const canvas = document.createElement('canvas')

      canvas.width = size
      canvas.height = size

      canvas.getContext('2d').drawImage(image, 0, 0, size, size)

      URL.revokeObjectURL(url)

      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to render seal')), 'image/png')
    }

    image.onerror = (e) => {
      URL.revokeObjectURL(url)

      reject(e)
    }

    image.src = url
  })
}

export async function buildSealFile (options, filename = 'seal.png') {
  const blob = await sealSvgToPngBlob(buildSealSvg(options))

  return new File([blob], filename, { type: 'image/png' })
}
