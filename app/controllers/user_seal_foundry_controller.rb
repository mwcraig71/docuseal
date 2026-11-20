# frozen_string_literal: true

# Seal Foundry state list and live previews for the profile seal generator.
class UserSealFoundryController < ApplicationController
  skip_authorization_check

  def index
    render json: { states: SealFoundry.states }
  rescue SealFoundry::Error, Faraday::Error => e
    Rollbar.error(e) if defined?(Rollbar)

    render json: { states: [], error: I18n.t('seal_generator_is_unavailable') }
  end

  def preview
    svg = SealFoundry.render(state: params.require(:state).to_s,
                             fields: params.fetch(:fields, {}).permit!.to_h.first(10).to_h,
                             color: params[:color].to_s,
                             format: 'svg')

    response.headers['Cache-Control'] = 'no-store'
    render plain: svg, content_type: 'image/svg+xml'
  rescue SealFoundry::ValidationError => e
    render json: { error: e.message }, status: :unprocessable_content
  rescue SealFoundry::NotConfigured
    render json: { error: I18n.t('seal_generator_is_unavailable') }, status: :service_unavailable
  end
end
