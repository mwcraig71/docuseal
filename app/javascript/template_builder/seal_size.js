// True printed size for professional seal fields.
//
// Field areas are stored as fractions of the page, so a seal only prints at
// the right diameter when its area is computed from the page's physical size.
// PDF documents carry their page sizes in points (metadata.pdf.page_sizes);
// image documents are placed on an A4-fitted page when the result PDF is built.

export const POINTS_PER_INCH = 72
export const DEFAULT_SEAL_DIAMETER_IN = 1.75
export const MIN_SEAL_DIAMETER_IN = 0.5
export const MAX_SEAL_DIAMETER_IN = 4

// Signature box placed alongside a seal: wide enough to sign across the seal.
export const SIGNATURE_WIDTH_RATIO = 1.4
export const SIGNATURE_HEIGHT_RATIO = 0.5

export const COMMON_SEAL_DIAMETERS_IN = [1.5, 1.625, 1.75, 2, 2.25]

const A4_SIZE = [595, 842]
const LETTER_SIZE = [612, 792]

export function sealDiameterIn (field) {
  const value = parseFloat(field?.preferences?.seal_diameter_in)

  if (Number.isFinite(value) && value >= MIN_SEAL_DIAMETER_IN && value <= MAX_SEAL_DIAMETER_IN) {
    return value
  }

  return DEFAULT_SEAL_DIAMETER_IN
}

export function isSealSizeLocked (field) {
  return field?.type === 'seal' && !field.preferences?.unlock_size
}

export function formatInches (value) {
  return `${parseFloat(Number(value).toFixed(3))} in`
}

// Page size in points: [width, height]. `estimated` is true when the
// document has no recorded size and US Letter is assumed.
export function pageSizePoints (document, page) {
  const pdfSize = document?.metadata?.pdf?.page_sizes?.[page]

  if (pdfSize?.[0] && pdfSize?.[1]) {
    return { width: pdfSize[0], height: pdfSize[1], estimated: false }
  }

  const image = document?.preview_images?.find((img) => parseInt(img.filename) === page) || document?.preview_images?.[0]
  const imageWidth = image?.metadata?.width
  const imageHeight = image?.metadata?.height

  if (!document?.metadata?.pdf && imageWidth && imageHeight) {
    const scale = Math.min(A4_SIZE[0] / imageWidth, A4_SIZE[1] / imageHeight)

    return { width: imageWidth * scale, height: imageHeight * scale, estimated: false }
  }

  const landscape = imageWidth && imageHeight && imageWidth > imageHeight

  return {
    width: landscape ? LETTER_SIZE[1] : LETTER_SIZE[0],
    height: landscape ? LETTER_SIZE[0] : LETTER_SIZE[1],
    estimated: true
  }
}

// Area fractions for a box of the given physical size on the area's page.
export function physicalAreaSize (document, page, widthIn, heightIn) {
  const size = pageSizePoints(document, page)

  return {
    w: Math.min((widthIn * POINTS_PER_INCH) / size.width, 1),
    h: Math.min((heightIn * POINTS_PER_INCH) / size.height, 1)
  }
}

// Resizes the area to the seal's true diameter, keeping it centered where it
// was and on the page. Returns true when the area changed.
export function applySealSize (area, field, document) {
  const diameter = sealDiameterIn(field)
  const { w, h } = physicalAreaSize(document, area.page, diameter, diameter)

  if (Math.abs((area.w || 0) - w) < 1e-6 && Math.abs((area.h || 0) - h) < 1e-6) {
    return false
  }

  const centerX = (area.x || 0) + (area.w || 0) / 2
  const centerY = (area.y || 0) + (area.h || 0) / 2

  area.w = w
  area.h = h
  area.x = Math.min(Math.max(centerX - w / 2, 0), 1 - w)
  area.y = Math.min(Math.max(centerY - h / 2, 0), 1 - h)

  return true
}

export function signatureAreaSizeForSeal (sealField, document, page) {
  const diameter = sealDiameterIn(sealField)

  return physicalAreaSize(document, page, diameter * SIGNATURE_WIDTH_RATIO, diameter * SIGNATURE_HEIGHT_RATIO)
}

function parseDiameter (value) {
  if (value && typeof value === 'object') {
    return parseFloat(value.default ?? value.max ?? value.min)
  }

  return parseFloat(value)
}

let statesPromise

// Seal Foundry states (with each board's seal diameter), for the size picker.
export function loadSealStates (fetchFn = (url, opts) => fetch(url, opts)) {
  statesPromise ||= fetchFn('/user_seal/foundry', { headers: { Accept: 'application/json' } })
    .then((resp) => resp.ok ? resp.json() : {})
    .then((data) => (data.states || [])
      .map((state) => ({ code: state.code, name: state.name, diameterIn: parseDiameter(state.diameterIn) }))
      .filter((state) => Number.isFinite(state.diameterIn) && state.diameterIn > 0))
    .catch(() => [])

  return statesPromise
}
