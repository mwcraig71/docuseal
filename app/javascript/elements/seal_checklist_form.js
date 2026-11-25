import { fetchSealStates, fetchSealPreview, defaultSealValues, missingRequired, sealDiameterLabel, SEAL_COLORS, debounce } from '../seals/foundry_client'

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Profile seal checklist: the user ticks every state they're licensed in,
// enters the license number for each, and can change the name per seal when a
// board's record spells it differently. Checked states are posted as
// seals[CODE][enabled] / seals[CODE][fields][KEY]; the server renders each
// seal through Seal Foundry at that board's diameter.
export default class extends HTMLElement {
  async connectedCallback () {
    const saved = this.dataset.seals ? JSON.parse(this.dataset.seals) : []

    this.form = this.closest('form')
    this.form.addEventListener('submit', this.onSubmit)

    this.defaultName = this.dataset.defaultName || ''
    this.color = saved.find((s) => s.color)?.color || '#000000'
    this.checked = new Set(saved.map((s) => s.state))
    this.savedFields = Object.fromEntries(saved.map((s) => [s.state, s.fields || {}]))
    this.values = {}
    this.nameEdited = new Set(saved.filter((s) => s.fields?.NAME && s.fields.NAME !== this.defaultName).map((s) => s.state))
    this.previews = {}

    this.innerHTML = '<p class="text-sm opacity-70">Loading state seals…</p>'

    const { states, error } = await fetchSealStates(this.dataset.statesUrl)

    this.states = states

    if (!states.length) {
      this.innerHTML = `<p class="text-sm">${escape(error || 'Seal generator is not set up.')} Use Upload to add a scan of your stamp.</p>`
      this.form.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled')

      return
    }

    this.render()
  }

  disconnectedCallback () {
    this.form?.removeEventListener('submit', this.onSubmit)
  }

  stateByCode (code) {
    return this.states.find((s) => s.code === code)
  }

  valuesFor (state) {
    this.values[state.code] ||= defaultSealValues(state, { NAME: this.defaultName, ...(this.savedFields[state.code] || {}) })

    return this.values[state.code]
  }

  onSubmit = (e) => {
    const problems = [...this.checked].map((code) => this.stateByCode(code)).filter(Boolean).map((state) => {
      const missing = missingRequired(state, this.valuesFor(state))

      return missing.length ? `${state.name}: ${missing.map((f) => f.label).join(', ')}` : null
    }).filter(Boolean)

    if (problems.length) {
      e.preventDefault()
      e.stopImmediatePropagation()

      this.querySelector('[data-error]').textContent = `Required: ${problems.join('; ')}`
    }
  }

  render () {
    this.innerHTML = `
      <div class="grid grid-cols-2 gap-3">
        <div class="form-control">
          <label class="label" for="seal_default_name">Name on seals</label>
          <input id="seal_default_name" class="base-input" dir="auto" maxlength="80" value="${escape(this.defaultName)}" data-default-name>
        </div>
        <div class="form-control">
          <label class="label" for="seal_color">Ink color</label>
          <select id="seal_color" name="color" class="base-select" data-color>
            ${SEAL_COLORS.map(([v, l]) => `<option value="${v}" ${v === this.color ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex items-center justify-between mt-4 mb-2 gap-2">
        <span class="font-medium">States you're licensed in <span class="text-sm opacity-70" data-count></span></span>
        <input type="search" class="base-input !h-9 !min-h-9 w-36 text-sm" placeholder="Filter" aria-label="Filter states" data-filter>
      </div>
      <div class="border border-base-300 rounded-xl divide-y divide-base-300 max-h-[55vh] overflow-y-auto" data-list>
        ${this.states.map((state) => `
          <div data-row="${escape(state.code)}" class="px-3 py-2">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" class="base-checkbox" name="seals[${escape(state.code)}][enabled]" value="1" ${this.checked.has(state.code) ? 'checked' : ''} data-check="${escape(state.code)}">
              <span class="flex-grow">${escape(state.name)}</span>
              <span class="text-xs opacity-70">${escape(sealDiameterLabel(state.diameterIn))}</span>
            </label>
            <div data-details="${escape(state.code)}"></div>
          </div>`).join('')}
      </div>
      <p data-error class="text-error text-sm mt-2"></p>
    `

    this.querySelector('[data-color]').addEventListener('change', (e) => {
      this.color = e.target.value
      this.checked.forEach((code) => this.schedulePreview(code))
    })

    this.querySelector('[data-default-name]').addEventListener('input', (e) => {
      this.defaultName = e.target.value

      this.checked.forEach((code) => {
        if (this.nameEdited.has(code)) return

        const state = this.stateByCode(code)

        if (!state) return

        this.valuesFor(state).NAME = this.defaultName

        const input = this.querySelector(`[data-details="${code}"] [data-key="NAME"]`)

        if (input) input.value = this.defaultName

        this.schedulePreview(code)
      })
    })

    this.querySelector('[data-filter]').addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase()

      this.querySelectorAll('[data-row]').forEach((row) => {
        const state = this.stateByCode(row.dataset.row)
        const match = !query || state.name.toLowerCase().includes(query) || state.code.toLowerCase() === query

        row.classList.toggle('hidden', !match && !this.checked.has(state.code))
      })
    })

    this.querySelectorAll('[data-check]').forEach((el) => {
      el.addEventListener('change', () => {
        const code = el.dataset.check

        if (el.checked) {
          this.checked.add(code)
        } else {
          this.checked.delete(code)
        }

        this.renderDetails(code)
        this.updateCount()
      })
    })

    this.checked.forEach((code) => this.renderDetails(code))
    this.updateCount()
  }

  updateCount () {
    const count = [...this.checked].filter((code) => this.stateByCode(code)).length

    this.querySelector('[data-count]').textContent = count ? `(${count} selected)` : ''
  }

  renderDetails (code) {
    const container = this.querySelector(`[data-details="${code}"]`)
    const state = this.stateByCode(code)

    if (!container || !state) return

    if (!this.checked.has(code)) {
      container.innerHTML = ''

      return
    }

    const values = this.valuesFor(state)
    const prefix = `seals[${escape(code)}][fields]`

    const fields = state.fields.map((f) => `
      <div class="form-control">
        <label class="label text-sm py-1" for="seal_${escape(code)}_${escape(f.key)}">${escape(f.key === 'NAME' ? `${f.label} (on this seal)` : f.label)}${f.required ? '' : ' (optional)'}</label>
        <input id="seal_${escape(code)}_${escape(f.key)}" name="${prefix}[${escape(f.key)}]" class="base-input !h-10" dir="auto" maxlength="${f.maxLength || 80}" value="${escape(values[f.key])}" data-key="${escape(f.key)}" ${f.required ? 'required' : ''}>
        ${f.help ? `<span class="text-xs opacity-70 mt-1">${escape(f.help)}</span>` : ''}
      </div>`).join('')

    const options = (state.options || []).map((o) => `
      <div class="form-control">
        <label class="label text-sm py-1" for="seal_${escape(code)}_${escape(o.key)}">${escape(o.label)}</label>
        <select id="seal_${escape(code)}_${escape(o.key)}" name="${prefix}[${escape(o.key)}]" class="base-select !h-10 !min-h-10" data-key="${escape(o.key)}">
          ${o.choices.map((c) => `<option value="${escape(c)}" ${c === values[o.key] ? 'selected' : ''}>${escape(c)}</option>`).join('')}
        </select>
      </div>`).join('')

    container.innerHTML = `
      <div class="flex gap-3 mt-2 mb-1">
        <img data-preview class="w-28 h-28 object-contain flex-none" alt="${escape(state.name)} seal preview">
        <div class="flex-grow space-y-1">
          ${fields}
          ${options}
          <p data-row-error class="text-error text-xs"></p>
        </div>
      </div>
    `

    container.querySelectorAll('[data-key]').forEach((el) => {
      el.addEventListener('input', () => {
        values[el.dataset.key] = el.value

        if (el.dataset.key === 'NAME') this.nameEdited.add(code)

        this.schedulePreview(code)
      })
    })

    this.refreshPreview(code)
  }

  schedulePreview (code) {
    this.previews[code] ||= debounce(() => this.refreshPreview(code))
    this.previews[code]()
  }

  async refreshPreview (code) {
    const state = this.stateByCode(code)
    const container = this.querySelector(`[data-details="${code}"]`)

    if (!state || !container?.querySelector('[data-preview]')) return

    const fields = { ...this.valuesFor(state) }

    if (!fields.NAME) fields.NAME = 'YOUR NAME'
    if (!fields.LICENSE_NO) fields.LICENSE_NO = '000000'

    const { url, error } = await fetchSealPreview(this.dataset.previewUrl, { state: code, fields, color: this.color }, {
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
    })

    const img = container.querySelector('[data-preview]')
    const errorEl = container.querySelector('[data-row-error]')

    if (errorEl) errorEl.textContent = error || ''

    if (url && img) {
      if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src)

      img.src = url
    }
  }
}
