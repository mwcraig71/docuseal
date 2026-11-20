# frozen_string_literal: true

class UserSealsController < ApplicationController
  SETTINGS_KEYS = %w[state profession name license discipline expiration color].freeze

  before_action :load_user_config
  authorize_resource :user_config

  def edit
    @seal_settings = UserConfigs.load_seal_settings(current_user)

    render layout: 'plain'
  end

  def update
    file = params[:file]

    return redirect_to settings_profile_index_path, notice: I18n.t('unable_to_save_seal') if file.blank?

    extension = FilenameUtils.dangerous_extension(file.original_filename)

    raise Submitters::MaliciousFileExtension, "File type '.#{extension}' is not allowed." if extension

    blob = ActiveStorage::Blob.create_and_upload!(io: file.open,
                                                  filename: file.original_filename,
                                                  content_type: file.content_type)

    attachment = ActiveStorage::Attachment.create!(
      blob:,
      name: 'seal',
      record: current_user
    )

    save_seal_settings

    if @user_config.update(value: attachment.uuid)
      redirect_to settings_profile_index_path, notice: I18n.t('seal_has_been_saved')
    else
      redirect_to settings_profile_index_path, notice: I18n.t('unable_to_save_seal')
    end
  end

  def destroy
    @user_config.destroy

    redirect_to settings_profile_index_path, notice: I18n.t('seal_has_been_removed')
  end

  private

  def save_seal_settings
    settings = params[:seal_settings]

    return if settings.blank?

    value = settings.permit(*SETTINGS_KEYS).to_h.transform_values { |v| v.to_s.first(200) }

    UserConfig.find_or_initialize_by(user: current_user, key: UserConfig::SEAL_SETTINGS_KEY).update!(value:)
  end

  def load_user_config
    @user_config = UserConfig.find_or_initialize_by(user: current_user, key: UserConfig::SEAL_KEY)
  end
end
