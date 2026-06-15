import React, { useState } from "react";

const EmailSmsSettings: React.FC = () => {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);

  const [smtpSettings, setSmtpSettings] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    fromEmail: "",
  });

  const [smsSettings, setSmsSettings] = useState({
    provider: "twilio",
    apiKey: "",
    senderId: "",
  });

  const handleSave = () => {
    // Placeholder: Replace with API POST/PUT
    console.log("Email Settings:", smtpSettings);
    console.log("SMS Settings:", smsSettings);
    alert("Settings saved successfully!");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white border rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Email & SMS Settings</h2>

      {/* Email Settings */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">📧 Email (SMTP) Settings</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={() => setEmailEnabled(!emailEnabled)}
            />
            <span className="text-sm">Enable Email</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            className="form-input"
            placeholder="SMTP Host"
            value={smtpSettings.host}
            onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
            disabled={!emailEnabled}
          />
          <input
            type="number"
            className="form-input"
            placeholder="Port"
            value={smtpSettings.port}
            onChange={(e) =>
              setSmtpSettings({ ...smtpSettings, port: Number(e.target.value) })
            }
            disabled={!emailEnabled}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Username"
            value={smtpSettings.username}
            onChange={(e) => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
            disabled={!emailEnabled}
          />
          <input
            type="password"
            className="form-input"
            placeholder="Password"
            value={smtpSettings.password}
            onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
            disabled={!emailEnabled}
          />
          <input
            type="email"
            className="form-input md:col-span-2"
            placeholder="From Email Address"
            value={smtpSettings.fromEmail}
            onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
            disabled={!emailEnabled}
          />
        </div>
      </div>

      {/* SMS Settings */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">📱 SMS Gateway Settings</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={() => setSmsEnabled(!smsEnabled)}
            />
            <span className="text-sm">Enable SMS</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            className="form-select"
            value={smsSettings.provider}
            onChange={(e) => setSmsSettings({ ...smsSettings, provider: e.target.value })}
            disabled={!smsEnabled}
          >
            <option value="twilio">Twilio</option>
            <option value="msg91">MSG91</option>
            <option value="nexmo">Nexmo</option>
          </select>
          <input
            type="text"
            className="form-input"
            placeholder="API Key / Auth Token"
            value={smsSettings.apiKey}
            onChange={(e) => setSmsSettings({ ...smsSettings, apiKey: e.target.value })}
            disabled={!smsEnabled}
          />
          <input
            type="text"
            className="form-input md:col-span-2"
            placeholder="Sender ID"
            value={smsSettings.senderId}
            onChange={(e) => setSmsSettings({ ...smsSettings, senderId: e.target.value })}
            disabled={!smsEnabled}
          />
        </div>
      </div>

      <button
        className="btn btn-primary mt-6"
        onClick={handleSave}
      >
        💾 Save Settings
      </button>
    </div>
  );
};

export default EmailSmsSettings;
