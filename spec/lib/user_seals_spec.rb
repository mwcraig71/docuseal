# frozen_string_literal: true

RSpec.describe UserSeals do
  let(:user) { create(:user, account: create(:account)) }

  def create_seal_attachment(diameter_in: nil, state: nil)
    blob = ActiveStorage::Blob.create_and_upload!(io: Rails.root.join('spec/fixtures/sample-image.png').open,
                                                  filename: 'seal.png', content_type: 'image/png',
                                                  metadata: described_class.blob_metadata(state:, diameter_in:))

    ActiveStorage::Attachment.create!(blob:, name: 'seal', record: user)
  end

  it 'migrates the single legacy seal into the list' do
    seal = create_seal_attachment
    UserConfig.create!(user:, key: UserConfig::SEAL_KEY, value: seal.uuid)
    UserConfig.create!(user:, key: UserConfig::SEAL_SETTINGS_KEY,
                       value: { 'state' => 'TX', 'fields' => { 'LICENSE_NO' => '1' }, 'color' => '#000000' })

    expect(described_class.list(user)).to contain_exactly(
      include('source' => 'generate', 'state' => 'TX', 'attachment_uuid' => seal.uuid)
    )

    described_class.save!(user, described_class.list(user))

    expect(user.user_configs.pluck(:key)).to eq([UserConfig::SEALS_KEY])
    expect(described_class.with_attachments(user).map(&:last)).to eq([seal])
  end

  it 'stores several seals with their own sizes' do
    entries = { 'TX' => 1.75, 'OH' => 2 }.map do |state, diameter_in|
      described_class.build_entry(source: 'generate', attachment: create_seal_attachment(state:, diameter_in:),
                                  state:, fields: { 'LICENSE_NO' => state }, diameter_in:)
    end

    described_class.save!(user, entries)

    expect(described_class.list(user).pluck('state', 'diameter_in')).to eq([['TX', 1.75], ['OH', 2.0]])
    expect(described_class.label(described_class.list(user).first)).to eq('TX #TX')
  end

  it 'ignores diameters outside the printable range' do
    expect(described_class.normalize_diameter('9')).to be_nil
    expect(described_class.normalize_diameter('1.625')).to eq(1.625)
  end
end
