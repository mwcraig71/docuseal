import { fetchSealStates, fetchSealPreview, defaultSealValues, missingRequired, SEAL_COLORS, debounce } from '../seals/foundry_client'

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Seal Foundry generator for the profile page. Inputs are posted with the form
// as seal_settings[...]; the server renders the final PNG through Seal Foundry.
export default class extends HTMLElement {
  async connectedCallback () {
    this.saved = this.dataset.settings ? JSON.parse(this.dataset.settings) : {}
    this.form = this.closest('form')
    this.form.addEventListener('submit', this.onSubmit)

    this.innerHTML = '<p class="text-sm opacity-70">Loading state seals…</p>'

    const { states, error } = await fetchSealStates(this.dataset.statesUrl)

    this.states = states

    if (!states.length) {
      this.innerHTML = `<p class="text-sm">${escape(error || 'Seal generator is not set up.')} Use Upload to add a scan of your stamp.</p>`
      this.form.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled')

      return
    }

    const defaultState = states.find((s) => s.code === this.saved.state) || states.find((s) => s.code === this.dataset.defaultState) || states[0]

    this.stateCode = defaultState.code
    this.color = this.saved.color || '#000000'
    this.values = defaultSealValues(defaultState, {
      NAME: this.dataset.defaultName,
      ...(this.saved.state === defaultState.code ? this.saved.fields : {})
    })

    this.render()
  }

  disconnectedCallback () {
    this.form?.removeEventListener('submit', this.onSubmit)
  }

  get state () {
    return this.states.find((s) => s.code === this.stateCode)
  }

  onSubmit = (e) => {
    if (!this.state) {
      return
    }

    const missing = missingRequired(this.state, this.values)

    if (missing.length) {
      e.preventDefault()
      e.stopImmediatePropagation()

      this.querySelector('[data-error]').textContent = `${missing.map((f) => f.label).join(', ')} required.`
    }
  }

  render () {
    const state = this.state

    const fields = state.fields.map((f) => `
      <div class="form-control col-span-2">
        <label class="label" for="seal_field_${f.key}">${escape(f.label)}${f.required ? '' : ' (optional)'}</label>
        <input id="seal_field_${f.key}" name="seal_settings[fields][${escape(f.key)}]" class="base-input" dir="auto" maxlength="${f.maxLength || 80}" value="${escape(this.values[f.key])}" data-key="${escape(f.key)}">
        ${f.help ? `<span class="text-xs opacity-70 mt-1">${escape(f.help)}</span>` : ''}
      </div>`).join('')

    const options = (state.options || []).map((o) => `
      <div class="form-control col-span-2">
        <label class="label" for="seal_option_${o.key}">${escape(o.label)}</label>
        <select id="seal_option_${o.key}" name="seal_settings[fields][${escape(o.key)}]" class="base-select" data-key="${escape(o.key)}">
          ${o.choices.map((c) => `<option value="${escape(c)}" ${c === this.values[o.key] ? 'selected' : ''}>${escape(c)}</option>`).join('')}
        </select>
        ${o.help ? `<span class="text-xs opacity-70 mt-1">${escape(o.help)}</span>` : ''}
      </div>`).join('')

    this.innerHTML = `
      <div class="flex justify-center mb-3">
        <img data-preview class="w-48 h-48 object-contain" alt="Seal preview">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="form-control">
          <label class="label" for="seal_state">State</label>
          <select id="seal_state" name="seal_settings[state]" class="base-select" data-state>
            ${this.states.map((s) => `<option value="${escape(s.code)}" ${s.code === this.stateCode ? 'selected' : ''}>${escape(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-control">
          <label class="label" for="seal_color">Ink color</label>
          <select id="seal_color" name="seal_settings[color]" class="base-select" data-color>
            ${SEAL_COLORS.map(([v, l]) => `<option value="${v}" ${v === this.color ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        ${fields}
        ${options}
      </div>
      <p data-error class="text-error text-sm mt-2"></p>
      <div class="text-sm mt-3 space-y-1">
        ${state.signing ? `<p><span class="font-medium">Signing:</span> ${escape(state.signing)}</p>` : ''}
        ${(state.sources || []).slice(0, 2).map((s) => `<a href="${escape(s.url)}" target="_blank" rel="noopener" class="link block">${escape(s.cite)}</a>`).join('')}
      </div>
    `

    this.querySelector('[data-state]').addEventListener('change', (e) => {
      const name = this.values.NAME

      this.stateCode = e.target.value
      this.values = defaultSealValues(this.state, { NAME: name, LICENSE_NO: this.values.LICENSE_NO })
      this.render()
    })

    this.querySelector('[data-color]').addEventListener('change', (e) => {
      this.color = e.target.value
      this.preview()
    })

    this.querySelectorAll('[data-key]').forEach((el) => {
      el.addEventListener('input', () => {
        this.values[el.dataset.key] = el.value
        this.preview()
      })
    })

    this.refresh()
  }

  preview = debounce(() => this.refresh())

  async refresh () {
    const fields = { ...this.values }

    if (!fields.NAME) fields.NAME = 'YOUR NAME'
    if (!fields.LICENSE_NO) fields.LICENSE_NO = '000000'

    const { url, error } = await fetchSealPreview(this.dataset.previewUrl, { state: this.stateCode, fields, color: this.color }, {
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
    })

    this.querySelector('[data-error]').textContent = error || ''

    if (url) {
      const img = this.querySelector('[data-preview]')

      if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src)

      img.src = url
    }
  }
}
