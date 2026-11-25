# frozen_string_literal: true

# Seal Foundry state seals inside the signing form. Previews return SVG; create
# renders a PNG and stores it as the submitter's attachment for the seal field.
class SubmitFormSealsController < ActionController::API
  include ActiveStorage::SetCurrent

  before_action :load_submitter
  before_action :authorize_form!

  def index
    render json: { states: SealFoundry.states }
  rescue SealFoundry::Error, Faraday::Error => e
    Rollbar.error(e) if defined?(Rollbar)

    render json: { states: [], error: I18n.t('seal_generator_is_unavailable') }
  end

  def preview
    svg = SealFoundry.render(**seal_params, format: 'svg')

    response.headers['Cache-Control'] = 'no-store'
    render plain: svg, content_type: 'image/svg+xml'
  rescue SealFoundry::ValidationError => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  def create
    png = SealFoundry.render(**seal_params, format: 'png')

    metadata = UserSeals.blob_metadata(state: seal_params[:state].upcase.first(2),
                                       diameter_in: SealFoundry.diameter_in(seal_params[:state]))

    blob = ActiveStorage::Blob.create_and_upload!(io: StringIO.new(png),
                                                  filename: "#{seal_params[:state]}-seal.png",
                                                  content_type: 'image/png',
                                                  metadata:)

    attachment = ActiveStorage::Attachment.create!(blob:, name: 'attachments', record: @submitter)

    render json: attachment.as_json(only: %i[uuid created_at], methods: %i[url filename content_type])
  rescue SealFoundry::ValidationError => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  private

  def seal_params
    @seal_params ||= {
      state: params.require(:state).to_s,
      fields: params.fetch(:fields, {}).permit!.to_h.first(10).to_h,
      color: params[:color].to_s
    }
  end

  def load_submitter
    @submitter = Submitter.find_by!(slug: params[:submit_form_slug])
  end

  def authorize_form!
    unless can_fill?(@submitter)
      return render json: { error: I18n.t('form_has_been_archived') }, status: :unprocessable_content
    end

    unless SealFoundry.configured?
      return render json: { states: [], error: I18n.t('seal_generator_is_unavailable') }, status: :service_unavailable
    end

    return if Submitters::AuthorizedForForm.call(@submitter, current_user, request)

    render json: { error: I18n.t('verification_required_refresh_the_page_and_pass_2fa') },
           status: :unprocessable_content
  end

  def can_fill?(submitter)
    !submitter.declined_at? &&
      !submitter.completed_at? &&
      !submitter.submission.archived_at? &&
      !submitter.submission.expired? &&
      !submitter.submission.template&.archived_at?
  end
end
