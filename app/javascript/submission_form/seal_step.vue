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
      <!-- eslint-disable vue/no-v-html -- generated SVG; all user text is XML-escaped in buildSealSvg -->
      <div
        class="w-44 h-44 mx-auto flex-none seal-preview"
        v-html="previewSvg"
      />
      <!-- eslint-enable vue/no-v-html -->
      <div class="grid grid-cols-2 gap-2 flex-grow">
        <select
          v-model="seal.state"
          class="base-select !h-10 !min-h-10 text-base"
          :aria-label="t('state')"
        >
          <option
            v-for="state in states"
            :key="state.code"
            :value="state.code"
          >
            {{ state.name }}
          </option>
        </select>
        <select
          v-model="seal.profession"
          class="base-select !h-10 !min-h-10 text-base"
          :aria-label="t('profession')"
        >
          <option
            v-for="profession in professions"
            :key="profession.key"
            :value="profession.key"
          >
            {{ profession.title }}
          </option>
        </select>
        <input
          v-model="seal.name"
          class="base-input !h-10 text-base"
          dir="auto"
          :placeholder="t('name')"
          :aria-label="t('name')"
        >
        <input
          v-model="seal.license"
          class="base-input !h-10 text-base"
          :placeholder="t('license_number')"
          :aria-label="t('license_number')"
        >
        <input
          v-model="seal.discipline"
          class="base-input !h-10 text-base"
          :placeholder="t('discipline_optional')"
          :aria-label="t('discipline_optional')"
        >
        <input
          v-model="seal.expiration"
          class="base-input !h-10 text-base"
          :placeholder="t('expiration_optional')"
          :aria-label="t('expiration_optional')"
        >
        <p
          v-if="rules.notes?.length || digitalStatement"
          class="col-span-2 text-xs opacity-80"
        >
          <span
            v-for="(note, index) in rules.notes"
            :key="index"
            class="block"
          >• {{ note }}</span>
          <span
            v-if="digitalStatement"
            class="block mt-1"
          ><b>{{ t('required_statement') }}:</b> {{ digitalStatement }}</span>
        </p>
      </div>
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
import { STATES, PROFESSIONS, stateRules, digitalStatementFor } from '../seals/states'
import { buildSealSvg, buildSealFile } from '../seals/generator'

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
    const settings = this.sealSettings || {}

    return {
      mode: this.prefillData ? 'saved' : 'generate',
      seal: {
        state: settings.state || this.field.preferences?.seal_state || 'TX',
        profession: settings.profession || 'pe',
        name: settings.name || this.submitter?.name || '',
        license: settings.license || '',
        discipline: settings.discipline || '',
        expiration: settings.expiration || '',
        color: settings.color || '#111111'
      }
    }
  },
  computed: {
    states () {
      return STATES
    },
    professions () {
      return PROFESSIONS
    },
    modes () {
      return [
        this.prefillData && { value: 'saved', label: this.t('my_seal') },
        { value: 'generate', label: this.t('generate') },
        { value: 'upload', label: this.t('upload') }
      ].filter(Boolean)
    },
    rules () {
      return stateRules(this.seal.state, this.seal.profession)
    },
    digitalStatement () {
      return digitalStatementFor({ ...this.seal, date: new Date().toLocaleDateString() })
    },
    previewSvg () {
      return buildSealSvg(this.seal).replace('<svg ', '<svg style="width:100%;height:100%" ')
    }
  },
  methods: {
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
      const file = await buildSealFile(this.seal)

      if (this.dryRun) {
        return new Promise((resolve) => {
          const reader = new FileReader()

          reader.onloadend = () => resolve(this.emitAttachment({ uuid: Math.random().toString(), url: reader.result }))

          reader.readAsDataURL(file)
        })
      }

      const formData = new FormData()

      formData.append('file', file)
      formData.append('submitter_slug', this.submitterSlug)
      formData.append('name', 'attachments')
      formData.append('type', 'seal')

      const resp = await fetch(this.baseUrl + `/s/${this.submitterSlug}/upload`, {
        method: 'POST',
        headers: { ...this.fetchOptions.headers },
        body: formData
      })

      const data = await resp.json()

      if (!resp.ok) {
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

      if (this.mode === 'generate') {
        const isFilled = this.seal.name.trim() && this.seal.license.trim()

        if (isFilled) {
          return this.submitGenerated()
        } else if (this.field.required === true) {
          alert(this.t('seal_name_and_license_required'))

          return Promise.reject(new Error('Seal name and license number are required'))
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
