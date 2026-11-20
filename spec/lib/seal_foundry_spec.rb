# frozen_string_literal: true

RSpec.describe SealFoundry do
  before do
    stub_const('ENV', ENV.to_h.merge('SEAL_FOUNDRY_URL' => 'https://foundry.example.com/',
                                     'SEAL_FOUNDRY_API_KEY' => 'partner-key-0123456789'))
    Rails.cache.delete(described_class::STATES_CACHE_KEY)
  end

  it 'lists partner states with the bearer key' do
    stub_request(:get, 'https://foundry.example.com/api/partner/states')
      .with(headers: { 'Authorization' => 'Bearer partner-key-0123456789' })
      .to_return(body: { states: [{ code: 'TX', name: 'Texas', fields: [], secret: 'x' }] }.to_json)

    expect(described_class.states).to eq([{ 'code' => 'TX', 'name' => 'Texas', 'fields' => [] }])
  end

  it 'renders a seal and drops invalid colors' do
    stub = stub_request(:post, 'https://foundry.example.com/api/partner/render')
           .with(body: { state: 'TX', fields: { 'NAME' => 'Jane' }, format: 'png' }.to_json)
           .to_return(body: 'PNGDATA')

    expect(described_class.render(state: 'tx', fields: { NAME: 'Jane' }, color: 'red', format: 'png')).to eq('PNGDATA')
    expect(stub).to have_been_requested
  end

  it 'raises a validation error with the foundry message' do
    stub_request(:post, 'https://foundry.example.com/api/partner/render')
      .to_return(status: 422, body: { error: 'License number is required' }.to_json)

    expect { described_class.render(state: 'TX', fields: {}) }
      .to raise_error(SealFoundry::ValidationError, 'License number is required')
  end
end
