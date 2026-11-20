import { STATES, PROFESSIONS, DEFAULT_NOTES, stateRules, isReviewedState, digitalStatementFor } from '../seals/states'
import { buildSealSvg, buildSealFile } from '../seals/generator'

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Renders the seal generator inside a <form>. On submit it rasterizes the seal
// into the form's file input so the regular upload endpoint stores it.
export default class extends HTMLElement {
  connectedCallback () {
    const settings = this.dataset.settings ? JSON.parse(this.dataset.settings) : {}

    this.values = {
      state: settings.state || this.dataset.defaultState || 'TX',
      profession: settings.profession || 'pe',
      name: settings.name || this.dataset.defaultName || '',
      license: settings.license || '',
      discipline: settings.discipline || '',
      expiration: settings.expiration || '',
      color: settings.color || '#111111'
    }

    this.render()

    this.form = this.closest('form')
    this.form.addEventListener('submit', this.onSubmit)
  }

  disconnectedCallback () {
    this.form?.removeEventListener('submit', this.onSubmit)
  }

  onSubmit = async (e) => {
    if (this.fileReady) {
      return
    }

    e.preventDefault()

    if (!this.values.name.trim() || !this.values.license.trim()) {
      this.querySelector('[data-error]').classList.remove('hidden')

      return
    }

    const file = await buildSealFile(this.values)
    const transfer = new DataTransfer()

    transfer.items.add(file)

    this.querySelector('input[type="file"]').files = transfer.files

    this.fileReady = true

    this.form.requestSubmit()
  }

  input (name, label, type = 'text', placeholder = '') {
    return `
      <div class="form-control">
        <label class="label" for="seal_${name}">${label}</label>
        <input id="seal_${name}" name="seal_settings[${name}]" type="${type}" class="base-input" dir="auto" value="${escape(this.values[name])}" placeholder="${escape(placeholder)}" data-name="${name}">
      </div>`
  }

  select (name, label, options) {
    return `
      <div class="form-control">
        <label class="label" for="seal_${name}">${label}</label>
        <select id="seal_${name}" name="seal_settings[${name}]" class="base-select" data-name="${name}">
          ${options.map(([value, text]) => `<option value="${escape(value)}" ${value === this.values[name] ? 'selected' : ''}>${escape(text)}</option>`).join('')}
        </select>
      </div>`
  }

  render () {
    this.innerHTML = `
      <div class="flex justify-center mb-3">
        <div data-preview class="w-48 h-48"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        ${this.select('state', 'State', STATES.map((s) => [s.code, s.name]))}
        ${this.select('profession', 'Profession', PROFESSIONS.map((p) => [p.key, p.title]))}
        ${this.input('name', 'Name on seal')}
        ${this.input('license', 'License number')}
        ${this.input('discipline', 'Discipline (optional)', 'text', 'e.g. Civil')}
        ${this.input('expiration', 'Expiration (optional)', 'text', 'e.g. 12/31/2027')}
        ${this.select('color', 'Ink color', [['#111111', 'Black'], ['#1e3a8a', 'Blue'], ['#991b1b', 'Red']])}
      </div>
      <p data-error class="hidden text-error text-sm mt-2">Name and license number are required.</p>
      <div data-notes class="text-sm mt-3 space-y-1"></div>
      <input name="file" type="file" class="hidden" accept="image/png">
    `

    this.querySelectorAll('[data-name]').forEach((el) => {
      el.addEventListener('input', () => {
        this.values[el.dataset.name] = el.value
        this.fileReady = false
        this.update()
      })
    })

    this.update()
  }

  update () {
    this.querySelector('[data-preview]').innerHTML = buildSealSvg(this.values).replace('<svg ', '<svg style="width:100%;height:100%" ')

    const rules = stateRules(this.values.state, this.values.profession)
    const notes = rules.notes || DEFAULT_NOTES
    const statement = digitalStatementFor({ ...this.values, date: '[date]' })

    this.querySelector('[data-notes]').innerHTML = `
      ${isReviewedState(this.values.state) ? '' : '<div class="font-medium">Generic template</div>'}
      <ul class="list-disc ps-5">${notes.map((n) => `<li>${escape(n)}</li>`).join('')}</ul>
      ${statement ? `<div class="mt-1"><span class="font-medium">Required statement:</span> ${escape(statement)}</div>` : ''}
      ${rules.source ? `<a href="${escape(rules.source)}" target="_blank" rel="noopener" class="link">Board rule</a>` : ''}
    `
  }
}
