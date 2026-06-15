import React, { useState } from "react";

// Simulated integration options
type Integration = {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  icon: string; // emoji or icon path
};

const initialIntegrations: Integration[] = [
  {
    id: "google",
    name: "Google Calendar",
    description: "Sync meetings, reminders & activities with Google Calendar.",
    connected: false,
    icon: "📅",
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Connect with Microsoft Outlook for email and calendar sync.",
    connected: false,
    icon: "📧",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send and receive SMS using Twilio.",
    connected: false,
    icon: "📲",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Manage email campaigns and marketing automation.",
    connected: false,
    icon: "📬",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Integrate WhatsApp for direct customer communication.",
    connected: false,
    icon: "🟢",
  },
];

const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, connected: !i.connected } : i
      )
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow border">
      <h2 className="text-2xl font-bold mb-6">🔗 Integrations</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="p-4 border rounded shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{integration.icon}</span>
                <h3 className="font-semibold text-lg">{integration.name}</h3>
              </div>
              <p className="text-sm text-gray-600">{integration.description}</p>
            </div>

            <div className="mt-4">
              {integration.connected ? (
                <button
                  className="btn btn-danger w-full"
                  onClick={() => toggleConnection(integration.id)}
                >
                  🔌 Disconnect
                </button>
              ) : (
                <button
                  className="btn btn-primary w-full"
                  onClick={() => toggleConnection(integration.id)}
                >
                  🔗 Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrationsPage;
