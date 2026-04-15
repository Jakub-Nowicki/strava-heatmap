import './PrivacyPolicy.css'

export default function PrivacyPolicy({ onBack }) {
  return (
    <div className="pp-page">
      <div className="pp-container">

        <button className="pp-back" onClick={onBack}>← Back</button>

        <div className="pp-logo">
          <span className="pp-logo-icon">⬡</span>
          <span className="pp-logo-text">HeatRun</span>
        </div>

        <h1 className="pp-title">Privacy Policy</h1>
        <p className="pp-date">Last updated: April 2026</p>

        <section className="pp-section">
          <h2>1. What HeatRun does</h2>
          <p>
            HeatRun is a personal running heatmap application. It connects to your Strava account
            via Strava's official OAuth API and displays your own running activities as an
            interactive map — organized by city, year, and distance. Only you can see your data.
          </p>
        </section>

        <section className="pp-section">
          <h2>2. Data we collect and how</h2>
          <p>When you connect your Strava account, HeatRun imports and stores:</p>
          <ul>
            <li>Your Strava athlete ID, first name, last name, and profile picture URL</li>
            <li>Your running activity records: name, date, distance, and GPS route polyline</li>
            <li>City names derived by reverse-geocoding your activity start coordinates (via Mapbox)</li>
            <li>Your Strava OAuth access and refresh tokens (used only to fetch your data)</li>
          </ul>
          <p>
            Data is collected exclusively through the Strava API after you explicitly authorize
            HeatRun during the OAuth flow. No data is collected without your authorization.
          </p>
        </section>

        <section className="pp-section">
          <h2>3. How we use your data</h2>
          <ul>
            <li>To render your personal running heatmap and statistics</li>
            <li>To keep your activity list up to date via Strava webhook events</li>
            <li>To maintain your login session via a secure cookie</li>
          </ul>
          <p>
            Your data is never shared with other users, sold to third parties, used for advertising,
            or used to train AI or machine-learning models.
          </p>
        </section>

        <section className="pp-section">
          <h2>4. Data storage and security</h2>
          <p>
            Your data is stored in a private PostgreSQL database hosted on Railway. All data is
            transmitted over HTTPS. Access tokens are stored securely and used only to authenticate
            requests to the Strava API on your behalf.
          </p>
          <p>
            HeatRun follows Strava's API Agreement security requirements and applies appropriate
            technical and organisational measures to protect your personal data.
          </p>
        </section>

        <section className="pp-section">
          <h2>5. Strava data attribution</h2>
          <p>
            Activity data displayed in HeatRun is sourced from Strava. HeatRun is not endorsed
            by Strava. Data is displayed in accordance with the{' '}
            <a href="https://www.strava.com/legal/api" target="_blank" rel="noopener noreferrer">
              Strava API Agreement
            </a>.
            HeatRun uses the "Powered by Strava" mark as required by Strava's brand guidelines.
          </p>
          <p>
            Activity data may include data sourced from Garmin devices. Where applicable,
            attribution to Garmin is acknowledged in accordance with Garmin's brand guidelines.
          </p>
        </section>

        <section className="pp-section">
          <h2>6. Withdrawing consent and deleting your data</h2>
          <p>You can withdraw consent and have your data deleted at any time:</p>
          <ul>
            <li>
              <strong>Delete account:</strong> Use the "Delete Account" button in the app sidebar.
              This permanently deletes all your runs and account data from HeatRun's database.
            </li>
            <li>
              <strong>Disconnect from Strava:</strong> You can also revoke HeatRun's access in your
              Strava account settings under "My Apps". HeatRun will automatically delete your data
              when it receives the deauthorization notification from Strava.
            </li>
          </ul>
          <p>
            Upon deletion, all personal data (athlete profile, activity records, tokens) is
            permanently removed from our database within 48 hours.
          </p>
        </section>

        <section className="pp-section">
          <h2>7. Data retention</h2>
          <p>
            Your data is retained for as long as your account is active. If you delete your account
            or revoke access via Strava, all data is deleted immediately. No backups contain
            identifiable personal data beyond 7 days.
          </p>
        </section>

        <section className="pp-section">
          <h2>8. Strava usage monitoring</h2>
          <p>
            You acknowledge that Strava may monitor and collect certain usage data and information
            related to HeatRun's use of the Strava API Materials and the Strava Platform in
            connection with this application ("Usage Data"), and that Strava may use such Usage
            Data for any business purpose, internal or external, including providing enhancements
            to the Strava API Materials or Strava Platform, providing developer or user support,
            and ensuring compliance with the Strava API Agreement.
          </p>
          <p>
            In the event of any conflict between this Privacy Policy and the{' '}
            <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              Strava Privacy Policy
            </a>
            , the Strava Privacy Policy shall control with respect to data held by Strava.
          </p>
        </section>

        <section className="pp-section">
          <h2>9. Third-party services</h2>
          <ul>
            <li>
              <strong>Strava:</strong> Activity data is fetched via the Strava API.
              Strava's own{' '}
              <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>{' '}
              governs data held by Strava and controls in any conflict with this policy.
            </li>
            <li>
              <strong>Mapbox:</strong> Start coordinates of activities are sent to the Mapbox
              Geocoding API to determine the city name. Only approximate coordinates are shared;
              no personal identifiers are sent to Mapbox.
            </li>
            <li>
              <strong>Railway:</strong> HeatRun's backend and database are hosted on Railway.app.
            </li>
          </ul>
        </section>

        <section className="pp-section">
          <h2>10. Your rights (GDPR / UK GDPR)</h2>
          <p>
            If you are located in the European Economic Area or the United Kingdom, you have the
            right to access, rectify, or erase your personal data. You may exercise these rights
            by contacting us at the email below or by using the in-app Delete Account feature.
          </p>
          <p>
            HeatRun processes your personal data on the basis of your consent, which you provide
            when you authorize the app via Strava's OAuth flow.
          </p>
        </section>

        <section className="pp-section">
          <h2>11. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this
            page with an updated date. Continued use of HeatRun after any change constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section className="pp-section">
          <h2>12. Contact</h2>
          <p>
            For questions, data requests, or support, contact us at:{' '}
            <a href="mailto:support@heatrun.app">support@heatrun.app</a>
          </p>
        </section>

        <button className="pp-back pp-back-bottom" onClick={onBack}>← Back to app</button>

      </div>
    </div>
  )
}
