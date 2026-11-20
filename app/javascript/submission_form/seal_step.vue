<template>
  <div>
    <div class="flex justify-between items-end w-full mb-3.5 md:mb-4">
      <label
        v-if="showFieldNames"
        :for="field.uuid"
        class="label text-xl sm:text-2xl py-0 field-name-label"
      >
        <MarkdownContent
          v-if="field.title"
          :string="field.title"
        />
        <template v-else>
          {{ field.name || t('seal') }}
        </template>
      </label>
      <button
        v-if="modelValue"
        type="button"
        class="btn btn-outline btn-sm reupload-button"
        @click.prevent="remove"
      >
        <IconReload
          :width="16"
          aria-hidden="true"
        />
        {{ t('change') }}
      </button>
      <div
        v-else
        class="join"
      >
        <button
          v-for="option in modes"
          :key="option.value"
          type="button"
          class="btn btn-sm join-item normal-case"
          :class="{ 'btn-active': mode === option.value, 'btn-outline': mode !== option.value }"
          @click.prevent="mode = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    <div
      v-if="field.description && !modelValue"
      dir="auto"
      class="mb-3 px-1 field-description-text"
    >
      <MarkdownContent :string="field.description" />
    </div>
    <input
      :value="modelValue"
      type="hidden"
      :name="`values[${field.uuid}]`"
    >
    <div v-if="modelValue">
      <img
        :src="attachmentsIndex[modelValue]?.url"
        :alt="field.name || t('seal')"
        class="h-52 mx-auto uploaded-image-preview"
      >
    </div>
    <div
      v-else-if="mode === 'saved'"
      class="flex justify-center"
    >
      <img
        :src="prefillData.url"
        :alt="t('seal')"
        class="h-52 mx-auto"
      >
    </div>
    <div
      v-else-if="mode === 'generate'"
      class="flex flex-col md:flex-row gap-3"
    >
      <div
        v-if="!sealStates.length"
        class="text-sm py-4"
      >
        {{ isLoadingStates ? t('loading') : (statesError || t('seal_generator_is_unavailable')) }}
      </div>
      <template v-else>
        <img
          v-if="previewUrl"
          :src="previewUrl"
          :alt="t('seal')"
          class="w-44 h-44 mx-auto flex-none object-contain seal-preview"
        >
        <div
          v-else
          class="w-44 h-44 mx-auto flex-none"
        />
        <div class="grid grid-cols-2 gap-2 flex-grow content-start">
          <select
            :value="stateCode"
            class="base-select !h-10 !min-h-10 text-base"
            :aria-label="t('state')"
            @change="selectState($event.target.value)"
          >
            <option
              v-for="state in sealStates"
              :key="state.code"
              :value="state.code"
            >
              {{ state.name }}
            </option>
          </select>
          <select
            v-model="color"
            class="base-select !h-10 !min-h-10 text-base"
            :aria-label="t('ink_color')"
            @change="schedulePreview"
          >
            <option
              v-for="[value, label] in colors"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select>
          <input
            v-for="spec in currentState.fields"
            :key="spec.key"
            v-model="sealValues[spec.key]"
            class="base-input !h-10 text-base col-span-2"
            dir="auto"
            :maxlength="spec.maxLength || 80"
            :placeholder="spec.required ? spec.label : `${spec.label} (${t('optional')})`"
            :aria-label="spec.label"
            :title="spec.help"
            @input="schedulePreview"
          >
          <select
            v-for="option in currentState.options || []"
            :key="option.key"
            v-model="sealValues[option.key]"
            class="base-select !h-10 !min-h-10 text-base col-span-2"
            :aria-label="option.label"
            :title="option.help"
            @change="schedulePreview"
          >
            <option
              v-for="choice in option.choices"
              :key="choice"
              :value="choice"
            >
              {{ option.label }}: {{ choice }}
            </option>
          </select>
          <p
            v-if="previewError"
            class="col-span-2 text-sm text-red-600"
          >
            {{ previewError }}
          </p>
          <p
            v-if="currentState.signing"
            class="col-span-2 text-xs opacity-80"
          >
            <b>{{ t('signing') }}:</b> {{ currentState.signing }}
          </p>
        </div>
      </template>
    </div>
    <FileDropzone
      v-else
      :message="`${t('upload')} ${(field.title || field.name) || t('seal')}${field.required ? '' : ` (${t('optional')})`}`"
      :submitter-slug="submitterSlug"
      :dry-run="dryRun"
      :accept="'image/*'"
      @upload="onImageUpload"
    />
  </div>
</template>

<script>
import FileDropzone from './dropzone'
import MarkdownContent from './markdown_content'
import { IconReload } from '@tabler/icons-vue'
import { fetchSealStates, fetchSealPreview, defaultSealValues, missingRequired, SEAL_COLORS, debounce } from '../seals/foundry_client'

export default {
  name: 'SealStep',
  components: {
    FileDropzone,
    MarkdownContent,
    IconReload
  },
  inject: ['baseUrl', 'fetchOptions', 't'],
  props: {
    field: {
      type: Object,
      required: true
    },
    submitter: {
      type: Object,
      required: false,
      default: () => ({})
    },
    showFieldNames: {
      type: Boolean,
      required: false,
      default: true
    },
    dryRun: {
      type: Boolean,
      required: false,
      default: false
    },
    submitterSlug: {
      type: String,
      required: true
    },
    attachmentsIndex: {
      type: Object,
      required: false,
      default: () => ({})
    },
    prefillData: {
      type: Object,
      required: false,
      default: null
    },
    sealSettings: {
      type: Object,
      required: false,
      default: null
    },
    modelValue: {
      type: String,
      required: false,
      default: ''
    }
  },
  emits: ['attached', 'update:model-value'],
  data () {
    return {
      mode: this.prefillData ? 'saved' : 'generate',
      sealStates: [],
      statesError: '',
      isLoadingStates: true,
      stateCode: '',
      sealValues: {},
      color: this.sealSettings?.color || '#000000',
      previewUrl: '',
      previewError: ''
    }
  },
  computed: {
    colors () {
      return SEAL_COLORS
    },
    currentState () {
      return this.sealStates.find((s) => s.code === this.stateCode) || { fields: [], options: [] }
    },
    sealsUrl () {
      return this.baseUrl + `/s/${this.submitterSlug}/seals`
    },
    modes () {
      return [
        this.prefillData && { value: 'saved', label: this.t('my_seal') },
        { value: 'generate', label: this.t('generate') },
        { value: 'upload', label: this.t('upload') }
      ].filter(Boolean)
    }
  },
  created () {
    this.schedulePreview = debounce(() => this.refreshPreview())
  },
  async mounted () {
    const { states, error } = await fetchSealStates(this.sealsUrl, this.fetchOptions.headers)

    this.sealStates = states
    this.statesError = error
    this.isLoadingStates = false

    if (!states.length) {
      if (this.mode === 'generate') this.mode = 'upload'

      return
    }

    const saved = this.sealSettings || {}
    const state = states.find((s) => s.code === saved.state) || states.find((s) => s.code === this.field.preferences?.seal_state) || states[0]

    this.stateCode = state.code
    this.sealValues = defaultSealValues(state, { NAME: this.submitter?.name, ...(saved.state === state.code ? saved.fields : {}) })

    this.refreshPreview()
  },
  beforeUnmount () {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)
  },
  methods: {
    selectState (code) {
      const { NAME, LICENSE_NO } = this.sealValues

      this.stateCode = code
      this.sealValues = defaultSealValues(this.currentState, { NAME, LICENSE_NO })

      this.refreshPreview()
    },
    sealPayload (placeholders = false) {
      const fields = { ...this.sealValues }

      if (placeholders) {
        if (!fields.NAME) fields.NAME = 'YOUR NAME'
        if (!fields.LICENSE_NO) fields.LICENSE_NO = '000000'
      }

      return { state: this.stateCode, fields, color: this.color }
    },
    async refreshPreview () {
      const { url, error } = await fetchSealPreview(`${this.sealsUrl}/preview`, this.sealPayload(true), this.fetchOptions.headers)

      this.previewError = error || ''

      if (url) {
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)

        this.previewUrl = url
      }
    },
    remove () {
      this.$emit('update:model-value', '')
    },
    onImageUpload (attachments) {
      this.$emit('attached', attachments[0])
      this.$emit('update:model-value', attachments[0].uuid)
    },
    emitAttachment (attachment) {
      this.$emit('attached', attachment)
      this.$emit('update:model-value', attachment.uuid)

      return attachment
    },
    submitPrefill () {
      if (this.dryRun) {
        return Promise.resolve(this.emitAttachment({ uuid: Math.random().toString(), url: this.prefillData.url }))
      }

      const formData = new FormData()

      formData.append('prefill_token', this.prefillData.token)

      return fetch(this.baseUrl + `/s/${this.submitterSlug}/prefill_attachments`, {
        method: 'POST',
        headers: { ...this.fetchOptions.headers },
        body: formData
      }).then(async (resp) => {
        const data = await resp.json()

        if (!resp.ok) {
          return Promise.reject(new Error(data.error))
        }

        return this.emitAttachment(data)
      })
    },
    async submitGenerated () {
      if (this.dryRun) {
        return this.emitAttachment({ uuid: Math.random().toString(), url: this.previewUrl })
      }

      const resp = await fetch(this.sealsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.fetchOptions.headers },
        body: JSON.stringify(this.sealPayload())
      })

      const data = await resp.json()

      if (!resp.ok) {
        alert(data.error)

        return Promise.reject(new Error(data.error))
      }

      return this.emitAttachment(data)
    },
    submit () {
      if (this.modelValue) {
        return Promise.resolve({})
      }

      if (this.mode === 'saved' && this.prefillData) {
        return this.submitPrefill()
      }

      if (this.mode === 'generate' && this.sealStates.length) {
        const missing = missingRequired(this.currentState, this.sealValues)

        if (!missing.length) {
          return this.submitGenerated()
        } else if (this.field.required === true || missing.length < this.currentState.fields.filter((f) => f.required).length) {
          alert(`${this.t('seal_name_and_license_required')} (${missing.map((f) => f.label).join(', ')})`)

          return Promise.reject(new Error('Seal fields are required'))
        }
      }

      if (this.field.required === true) {
        alert(this.t('please_upload_seal'))

        return Promise.reject(new Error('Seal is required'))
      }

      return Promise.resolve({})
    }
  }
}
</script>
