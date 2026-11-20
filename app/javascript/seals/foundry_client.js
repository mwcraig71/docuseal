// Thin client for DocuSeal's Seal Foundry proxy endpoints. Seal Foundry owns the
// state seal specs and renderer; DocuSeal only sends the licensee's inputs.

export async function fetchSealStates (url, headers = {}) {
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json', ...headers } })
    const data = await resp.json().catch(() => ({}))

    return { states: data.states || [], error: data.error || (resp.ok ? '' : 'Seal generator is unavailable.') }
  } catch (e) {
    return { states: [], error: 'Seal generator is unavailable.' }
  }
}

export async function fetchSealPreview (url, payload, headers = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload)
  })

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))

    return { error: data.error || 'Unable to preview the seal.' }
  }

  const blob = await resp.blob()

  return { url: URL.createObjectURL(new Blob([blob], { type: 'image/svg+xml' })) }
}

// Fields the user types, plus each option at its default, for a state spec.
export function defaultSealValues (state, saved = {}) {
  const values = {}

  ;(state?.fields || []).forEach((f) => { values[f.key] = saved[f.key] || '' })
  ;(state?.options || []).forEach((o) => { values[o.key] = o.choices.includes(saved[o.key]) ? saved[o.key] : o.default })

  return values
}

export function missingRequired (state, values) {
  return (state?.fields || []).filter((f) => f.required && !String(values[f.key] || '').trim())
}

export const SEAL_COLORS = [['#000000', 'Black'], ['#1e3a8a', 'Blue'], ['#991b1b', 'Red']]

export function debounce (fn, wait = 350) {
  let timer

  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}
