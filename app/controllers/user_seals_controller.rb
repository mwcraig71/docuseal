# frozen_string_literal: true

class UserSealsController < ApplicationController
  before_action :load_user_config
  authorize_resource :user_config

  def edit
    @seals = UserSeals.list(current_user)
    @states = SealFoundry.configured? ? safe_states : []

    render layout: 'plain'
  end

  # Saves either the state checklist (one generated seal per checked state) or
  # a single uploaded seal image.
  def update
    entries = params.key?(:seals) || params[:checklist].present? ? sync_generated_seals : add_uploaded_seal

    return redirect_to settings_profile_index_path, notice: I18n.t('unable_to_save_seal') unless entries

    UserSeals.save!(current_user, entries)

    redirect_to settings_profile_index_path, notice: I18n.t('seal_has_been_saved')
  rescue SealFoundry::ValidationError => e
    redirect_to settings_profile_index_path, alert: e.message
  rescue SealFoundry::Error, Faraday::Error
    redirect_to settings_profile_index_path, alert: I18n.t('seal_generator_is_unavailable')
  end

  def destroy
    entries = UserSeals.list(current_user)

    entries = params[:id].present? ? entries.reject { |entry| entry['id'] == params[:id] } : []

    UserSeals.save!(current_user, entries)

    redirect_to settings_profile_index_path, notice: I18n.t('seal_has_been_removed')
  end

  private

  # Checked states keep their seal when nothing changed and are re-rendered
  # through Seal Foundry otherwise. Unchecked states are removed; uploaded
  # seals are left as they are.
  def sync_generated_seals
    existing = UserSeals.list(current_user)
    uploaded = existing.reject { |entry| entry['source'] == 'generate' }
    generated = existing.select { |entry| entry['source'] == 'generate' }.index_by { |entry| entry['state'] }
    existing_uuids = ActiveStorage::Attachment.where(record: current_user, name: 'seal',
                                                     uuid: existing.pluck('attachment_uuid')).pluck(:uuid)

    color = params[:color].to_s.match?(SealFoundry::COLOR_REGEXP) ? params[:color].to_s : nil
    states_index = SealFoundry.states.index_by { |state| state['code'] }

    selected_seals_params.filter_map do |code, fields|
      state = states_index[code]

      next unless state

      current = generated[code]

      if current && current['fields'] == fields && current['color'] == color &&
         existing_uuids.include?(current['attachment_uuid'])
        next current.merge('state_name' => state['name'],
                           'diameter_in' => UserSeals.normalize_diameter(SealFoundry.diameter_in(state)))
      end

      render_generated_seal(state, fields, color, current)
    end + uploaded
  end

  def render_generated_seal(state, fields, color, current)
    diameter_in = SealFoundry.diameter_in(state)

    png = begin
      SealFoundry.render(state: state['code'], fields:, color:, format: 'png')
    rescue SealFoundry::ValidationError => e
      raise SealFoundry::ValidationError, "#{state['name']}: #{e.message}"
    end

    blob = ActiveStorage::Blob.create_and_upload!(
      io: StringIO.new(png),
      filename: "#{state['code']}-seal.png",
      content_type: 'image/png',
      metadata: UserSeals.blob_metadata(state: state['code'], diameter_in:)
    )

    attachment = ActiveStorage::Attachment.create!(blob:, name: 'seal', record: current_user)

    UserSeals.build_entry(source: 'generate', attachment:, state: state['code'], state_name: state['name'],
                          fields:, color:, diameter_in:)
             .merge(current ? { 'id' => current['id'] } : {})
  end

  # { 'TX' => { 'NAME' => ..., 'LICENSE_NO' => ... }, ... } for checked states.
  def selected_seals_params
    raw = params.fetch(:seals, {})

    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)

    raw.to_h.filter_map do |code, attrs|
      next unless attrs.is_a?(Hash) && attrs['enabled'].in?(['1', 'true', true])

      fields = attrs.fetch('fields', {}).to_h.first(10).to_h.transform_keys(&:to_s)
                    .transform_values { |v| v.to_s.strip.first(80) }

      [code.to_s.upcase.first(2), fields]
    end.uniq(&:first).first(UserSeals::MAX_SEALS)
  end

  def add_uploaded_seal
    file = params[:file]

    return if file.blank?

    extension = FilenameUtils.dangerous_extension(file.original_filename)

    raise Submitters::MaliciousFileExtension, "File type '.#{extension}' is not allowed." if extension

    state_code = params[:state].to_s.upcase.first(2).presence
    state = state_code && SealFoundry.configured? ? SealFoundry.find_state(state_code) : nil
    diameter_in = UserSeals.normalize_diameter(params[:diameter_in]) || (state && SealFoundry.diameter_in(state))

    blob = ActiveStorage::Blob.create_and_upload!(io: file.open,
                                                  filename: file.original_filename,
                                                  content_type: file.content_type,
                                                  metadata: UserSeals.blob_metadata(state: state_code, diameter_in:))

    attachment = ActiveStorage::Attachment.create!(blob:, name: 'seal', record: current_user)

    entry = UserSeals.build_entry(source: 'upload', attachment:, state: state_code,
                                  state_name: state&.dig('name'), diameter_in:)

    (UserSeals.list(current_user) + [entry]).last(UserSeals::MAX_SEALS)
  end

  def safe_states
    SealFoundry.states
  rescue SealFoundry::Error, Faraday::Error
    []
  end

  def load_user_config
    @user_config = UserConfig.find_or_initialize_by(user: current_user, key: UserConfig::SEALS_KEY)
  end
end
