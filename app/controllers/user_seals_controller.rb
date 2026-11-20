# frozen_string_literal: true

class UserSealsController < ApplicationController
  before_action :load_user_config
  authorize_resource :user_config

  def edit
    @seal_settings = UserConfigs.load_seal_settings(current_user)

    render layout: 'plain'
  end

  def update
    blob = params[:seal_settings].present? ? generate_seal_blob : upload_seal_blob

    return redirect_to settings_profile_index_path, notice: I18n.t('unable_to_save_seal') unless blob

    attachment = ActiveStorage::Attachment.create!(blob:, name: 'seal', record: current_user)

    if @user_config.update(value: attachment.uuid)
      redirect_to settings_profile_index_path, notice: I18n.t('seal_has_been_saved')
    else
      redirect_to settings_profile_index_path, notice: I18n.t('unable_to_save_seal')
    end
  rescue SealFoundry::ValidationError => e
    redirect_to settings_profile_index_path, alert: e.message
  rescue SealFoundry::Error, Faraday::Error
    redirect_to settings_profile_index_path, alert: I18n.t('seal_generator_is_unavailable')
  end

  def destroy
    @user_config.destroy

    redirect_to settings_profile_index_path, notice: I18n.t('seal_has_been_removed')
  end

  private

  def upload_seal_blob
    file = params[:file]

    return if file.blank?

    extension = FilenameUtils.dangerous_extension(file.original_filename)

    raise Submitters::MaliciousFileExtension, "File type '.#{extension}' is not allowed." if extension

    ActiveStorage::Blob.create_and_upload!(io: file.open,
                                           filename: file.original_filename,
                                           content_type: file.content_type)
  end

  # Renders the seal through Seal Foundry and remembers the inputs so the
  # signing form can pre-fill the generator.
  def generate_seal_blob
    settings = seal_settings

    png = SealFoundry.render(state: settings['state'], fields: settings['fields'],
                             color: settings['color'], format: 'png')

    UserConfig.find_or_initialize_by(user: current_user, key: UserConfig::SEAL_SETTINGS_KEY)
              .update!(value: settings)

    ActiveStorage::Blob.create_and_upload!(io: StringIO.new(png),
                                           filename: "#{settings['state']}-seal.png",
                                           content_type: 'image/png')
  end

  def seal_settings
    raw = params.require(:seal_settings)

    {
      'state' => raw[:state].to_s.upcase.first(2),
      'color' => raw[:color].to_s.first(7),
      'fields' => raw.fetch(:fields, {}).permit!.to_h.first(10).to_h.transform_values { |v| v.to_s.first(80) }
    }
  end

  def load_user_config
    @user_config = UserConfig.find_or_initialize_by(user: current_user, key: UserConfig::SEAL_KEY)
  end
end
