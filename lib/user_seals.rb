# frozen_string_literal: true

# A user's professional seals. Engineers are often licensed in several states,
# so each user keeps a list of seals: one generated seal per state (with its
# own license number and the name exactly as it appears on that board's
# record) plus any uploaded scans of physical stamps.
#
# Stored as a JSON array in the user's `seals` config. Each entry:
#   id              - stable id used to remove a seal
#   source          - 'generate' (Seal Foundry) or 'upload'
#   state           - two-letter state code (optional for uploads)
#   state_name      - display name of the state
#   fields          - Seal Foundry inputs (NAME, LICENSE_NO, options...)
#   color           - ink color for generated seals
#   diameter_in     - true printed diameter of the seal, in inches
#   attachment_uuid - the user's `seal` attachment holding the image
module UserSeals
  MAX_SEALS = 60
  MIN_DIAMETER_IN = 0.5
  MAX_DIAMETER_IN = 4.0

  module_function

  def list(user)
    return [] if user.blank?

    value = user.user_configs.find_by(key: UserConfig::SEALS_KEY)&.value

    return Array.wrap(value).grep(Hash) if value.present?

    legacy_entries(user)
  end

  def save!(user, entries)
    UserConfig.find_or_initialize_by(user:, key: UserConfig::SEALS_KEY)
              .update!(value: entries.first(MAX_SEALS))

    # The single-seal configs are migrated into the list on first save.
    user.user_configs.where(key: [UserConfig::SEAL_KEY, UserConfig::SEAL_SETTINGS_KEY]).destroy_all

    entries
  end

  # [[entry, attachment], ...] for seals whose image still exists.
  def with_attachments(user)
    entries = list(user)

    return [] if entries.blank?

    attachments = ActiveStorage::Attachment.where(record: user, name: 'seal',
                                                  uuid: entries.pluck('attachment_uuid').compact)
                                           .preload(:blob)
                                           .index_by(&:uuid)

    entries.filter_map do |entry|
      attachment = attachments[entry['attachment_uuid']]

      [entry, attachment] if attachment
    end
  end

  def label(entry)
    [entry['state_name'].presence || entry['state'].presence,
     entry.dig('fields', 'LICENSE_NO').presence&.then { |no| "##{no}" }].compact.join(' ').presence ||
      I18n.t('professional_seal')
  end

  def build_entry(source:, attachment:, state: nil, state_name: nil, fields: {}, color: nil, diameter_in: nil)
    {
      'id' => SecureRandom.base58(10),
      'source' => source,
      'state' => state.presence,
      'state_name' => state_name.presence,
      'fields' => fields.presence || {},
      'color' => color.presence,
      'diameter_in' => normalize_diameter(diameter_in),
      'attachment_uuid' => attachment.uuid
    }.compact
  end

  def normalize_diameter(value)
    value = Float(value, exception: false)

    value if value && value >= MIN_DIAMETER_IN && value <= MAX_DIAMETER_IN
  end

  # Seal metadata stored on the image blob, so the seal keeps its true printed
  # size wherever the image is reused (signing form, prefill, result PDF).
  def blob_metadata(state:, diameter_in:)
    { 'seal_state' => state.presence, 'seal_diameter_in' => normalize_diameter(diameter_in) }.compact
  end

  def legacy_entries(user)
    seal = UserConfigs.load_seal(user)

    return [] unless seal

    settings = UserConfigs.load_seal_settings(user)
    state = settings['state'].presence

    [{
      'id' => 'legacy',
      'source' => settings.present? ? 'generate' : 'upload',
      'state' => state,
      'fields' => settings['fields'] || {},
      'color' => settings['color'],
      'diameter_in' => normalize_diameter(seal.metadata['seal_diameter_in']),
      'attachment_uuid' => seal.uuid
    }.compact]
  end
end
