# frozen_string_literal: true

RSpec.describe 'Profile Settings' do
  let(:user) { create(:user, account: create(:account)) }

  before do
    sign_in(user)

    allow(Accounts).to receive(:can_send_emails?).and_return(true)

    visit settings_profile_index_path
  end

  it 'shows the profile settings page' do
    expect(page).to have_content('Profile')
    expect(page).to have_field('user[email]', with: user.email)
    expect(page).to have_field('user[first_name]', with: user.first_name)
    expect(page).to have_field('user[last_name]', with: user.last_name)

    expect(page).to have_content('Change Password')
    expect(page).to have_field('user[password]')
  end

  context 'when changes contact information' do
    it 'updates first name, last name and email' do
      fill_in 'First name', with: 'Devid'
      fill_in 'Last name', with: 'Beckham'
      fill_in 'Email', with: 'david.beckham@example.com'

      all(:button, 'Update')[0].click

      user.reload

      expect(user.first_name).to eq('Devid')
      expect(user.last_name).to eq('Beckham')
      expect(user.email).to eq('david.beckham@example.com')
    end

    it 'does not update if email is invalid' do
      fill_in 'Email', with: 'devid+test@example'

      all(:button, 'Update')[0].click

      expect(page).to have_content('Email is invalid')
    end
  end

  context 'when changes password' do
    it 'updates password' do
      fill_in 'New password', with: 'newpassword'
      fill_in 'Confirm new password', with: 'newpassword'
      fill_in 'Current password', with: 'password'

      all(:button, 'Update')[1].click

      expect(page).to have_content('Password has been changed')
    end

    it 'does not update if password confirmation does not match' do
      fill_in 'New password', with: 'newpassword'
      fill_in 'Confirm new password', with: 'newpassword1'
      fill_in 'Current password', with: 'password'

      all(:button, 'Update')[1].click

      expect(page).to have_content("Password confirmation doesn't match Password")
    end

    it 'does not update if current password is incorrect' do
      fill_in 'New password', with: 'newpassword'
      fill_in 'Confirm new password', with: 'newpassword'
      fill_in 'Current password', with: 'wrongpassword'

      all(:button, 'Update')[1].click

      expect(page).to have_content('Current password is invalid')
    end

    it 'resets password and signs in with new password', sidekiq: :inline do
      fill_in 'New password', with: 'newpassword'
      accept_confirm('Are you sure?') do
        find('label', text: 'Click here').click
      end

      expect(page).to have_content('An email with password reset instructions has been sent.')

      email = ActionMailer::Base.deliveries.last
      reset_password_url = email.body
                                .encoded[/href="([^"]+)"/, 1]
                                .sub(%r{https?://(.*?)/}, "#{Capybara.current_session.server.base_url}/")

      visit reset_password_url

      fill_in 'New password', with: 'new_strong_password'
      fill_in 'Confirm new password', with: 'new_strong_password'
      click_button 'Change my password'

      expect(page).to have_content('Your password has been changed successfully. You are now signed in.')

      visit new_user_session_path

      fill_in 'Email', with: user.email
      fill_in 'Password', with: 'new_strong_password'
      click_button 'Sign In'

      expect(page).to have_content('Signed in successfully')
    end
  end

  context 'when managing professional seals' do
    let(:texas) do
      {
        'code' => 'TX', 'name' => 'Texas', 'diameterIn' => 1.75, 'signing' => 'Seal plus signature and date.',
        'fields' => [{ 'key' => 'NAME', 'label' => 'Name exactly as on board record', 'required' => true },
                     { 'key' => 'LICENSE_NO', 'label' => 'License number', 'required' => true }],
        'options' => []
      }
    end

    let(:ohio) do
      {
        'code' => 'OH', 'name' => 'Ohio', 'diameterIn' => { 'min' => 1.5, 'max' => 2, 'default' => 2 },
        'fields' => [{ 'key' => 'NAME', 'label' => 'Name exactly as on board record', 'required' => true },
                     { 'key' => 'LICENSE_NO', 'label' => 'License number', 'required' => true }],
        'options' => []
      }
    end

    before do
      allow(SealFoundry).to receive_messages(configured?: true, states: [texas, ohio])
      allow(SealFoundry).to receive(:render) do |**kwargs|
        if kwargs[:format] == 'png'
          Rails.root.join('spec/fixtures/sample-image.png').binread
        else
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
        end
      end
    end

    it 'generates a seal for each checked state with its own license number and name' do
      click_link 'Manage Seals'

      within('#generate') do
        check 'Texas'

        within('[data-details="TX"]') do
          fill_in 'License number', with: '123456'

          expect(page).to have_css('img[data-preview][src^="blob:"]')
        end

        check 'Ohio'

        within('[data-details="OH"]') do
          fill_in 'Name exactly as on board record', with: 'John Q. Doe'
          fill_in 'License number', with: 'PE.98765'
        end

        click_button 'Save'
      end

      expect(page).to have_content('Seal has been saved.')

      seals = UserSeals.list(user).index_by { |entry| entry['state'] }

      expect(seals.keys).to contain_exactly('TX', 'OH')
      expect(seals['TX']).to include('source' => 'generate', 'diameter_in' => 1.75,
                                     'fields' => include('NAME' => user.full_name, 'LICENSE_NO' => '123456'))
      expect(seals['OH']).to include('diameter_in' => 2.0,
                                     'fields' => include('NAME' => 'John Q. Doe', 'LICENSE_NO' => 'PE.98765'))
      expect(UserSeals.with_attachments(user).map do |_, a|
        a.metadata['seal_diameter_in']
      end).to contain_exactly(1.75, 2.0)
      expect(SealFoundry).to have_received(:render).with(hash_including(state: 'OH', format: 'png')).once
      expect(page).to have_content('Texas #123456')
      expect(page).to have_content('Ohio #PE.98765')
    end

    it 'keeps unchanged seals and removes unchecked states' do
      click_link 'Manage Seals'

      within('#generate') do
        check 'Texas'
        within('[data-details="TX"]') { fill_in 'License number', with: '123456' }
        check 'Ohio'
        within('[data-details="OH"]') { fill_in 'License number', with: '555' }
        click_button 'Save'
      end

      expect(page).to have_content('Seal has been saved.')

      texas_uuid = UserSeals.list(user).find { |entry| entry['state'] == 'TX' }['attachment_uuid']

      click_link 'Manage Seals'

      within('#generate') do
        uncheck 'Ohio'
        click_button 'Save'
      end

      expect(page).to have_content('Seal has been saved.')

      seals = UserSeals.list(user)

      expect(seals.pluck('state')).to eq(['TX'])
      expect(seals.first['attachment_uuid']).to eq(texas_uuid)
    end

    it 'uploads a seal for a state and removes it' do
      click_link 'Manage Seals'

      within('#upload') do
        select 'Texas', from: 'State'
        find('input[type="file"]', visible: false).attach_file(Rails.root.join('spec/fixtures/sample-image.png'))
      end

      expect(page).to have_content('Seal has been saved.')
      expect(UserSeals.list(user).first).to include('source' => 'upload', 'state' => 'TX', 'diameter_in' => 1.75)

      click_button 'Remove', match: :first

      expect(page).to have_content('Seal has been removed.')
      expect(UserSeals.list(user)).to be_empty
    end
  end
end
