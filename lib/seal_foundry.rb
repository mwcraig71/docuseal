# frozen_string_literal: true

# Client for the Seal Foundry partner API, which renders state-specific
# professional seals. Seal specs stay private to Seal Foundry; DocuSeal only
# sends the licensee's fields and gets back the seal image.
#
# Configure with SEAL_FOUNDRY_URL (e.g. https://sealfoundry.com) and
# SEAL_FOUNDRY_API_KEY (one of the keys in Seal Foundry's PARTNER_API_KEYS).
module SealFoundry
  Error = Class.new(StandardError)
  NotConfigured = Class.new(Error)

  class ValidationError < Error; end

  STATES_CACHE_KEY = 'seal_foundry:states'
  STATES_CACHE_TTL = 10.minutes
  TIMEOUT = 15
  COLOR_REGEXP = /\A#[0-9a-f]{6}\z/i
  STATE_KEYS = %w[code name diameterIn fields options notes signing sources].freeze

  module_function

  def configured?
    base_url.present? && api_key.present?
  end

  def base_url
    ENV.fetch('SEAL_FOUNDRY_URL', '').chomp('/')
  end

  def api_key
    ENV.fetch('SEAL_FOUNDRY_API_KEY', '')
  end

  def states
    return [] unless configured?

    Rails.cache.fetch(STATES_CACHE_KEY, expires_in: STATES_CACHE_TTL) do
      response = connection.get('/api/partner/states')

      raise Error, "Seal Foundry states request failed (#{response.status})" unless response.success?

      JSON.parse(response.body)['states'].map { |state| state.slice(*STATE_KEYS) }
    end
  end

  def find_state(code)
    code = code.to_s.upcase

    states.find { |state| state['code'] == code } if code.present?
  end

  # A board's seal diameter in inches. Seal Foundry reports either a number or
  # a range ({ min:, max:, default: }).
  def diameter_in(state)
    value = state.is_a?(Hash) ? state['diameterIn'] : find_state(state)&.dig('diameterIn')
    value = value['default'] || value['max'] || value['min'] if value.is_a?(Hash)

    Float(value, exception: false)&.then { |v| v.positive? ? v : nil }
  rescue Error, Faraday::Error
    nil
  end

  # Returns the seal image as a String (SVG markup or PNG bytes).
  def render(state:, fields:, color: nil, format: 'svg', diameter_in: nil)
    raise NotConfigured, 'Seal Foundry is not configured' unless configured?

    body = {
      state: state.to_s.upcase.first(2),
      fields: fields.to_h.transform_keys(&:to_s).transform_values { |v| v.to_s.first(80) },
      format: format == 'png' ? 'png' : 'svg',
      color: color.to_s.match?(COLOR_REGEXP) ? color : nil,
      diameterIn: diameter_in
    }.compact

    response = connection.post('/api/partner/render') do |req|
      req.headers['Content-Type'] = 'application/json'
      req.body = body.to_json
    end

    return response.body if response.success?

    message = begin
      JSON.parse(response.body)['error']
    rescue JSON::ParserError
      nil
    end

    raise ValidationError, message.presence || 'Invalid seal fields' if response.status.in?([400, 422])

    raise Error, "Seal Foundry render failed (#{response.status})"
  end

  def connection
    Faraday.new(url: base_url, request: { timeout: TIMEOUT, open_timeout: 5 }) do |conn|
      conn.headers['Authorization'] = "Bearer #{api_key}"
      conn.headers['User-Agent'] = 'DocuSeal'
    end
  end
end
