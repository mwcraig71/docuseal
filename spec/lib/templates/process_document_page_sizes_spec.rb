# frozen_string_literal: true

RSpec.describe Templates::ProcessDocument do
  describe '.page_sizes' do
    it 'returns each page size in PDF points' do
      data = Rails.root.join('spec/fixtures/sample-document.pdf').binread

      Pdfium::Document.open_bytes(data) do |doc|
        sizes = described_class.page_sizes(doc)

        expect(sizes.size).to eq(doc.page_count)
        expect(sizes.first.map(&:round)).to eq([595, 842])
      end
    end
  end
end
