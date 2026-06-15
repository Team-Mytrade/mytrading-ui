import React from "react";

type InteractionType = "Email" | "Call" | "Meeting" | "Note";

interface Interaction {
  id: number;
  type: InteractionType;
  contact: string;
  subject: string;
  date: string;
}

const typeIcons: Record<InteractionType, string> = {
  Email: "📧",
  Call: "📞",
  Meeting: "📅",
  Note: "📝",
};

const RecentInteractions: React.FC = () => {
  const interactions: Interaction[] = [
    { id: 1, type: "Email", contact: "John Doe", subject: "Follow-up on proposal", date: "2025-08-08" },
    { id: 2, type: "Call", contact: "Acme Corp", subject: "Left voicemail", date: "2025-08-07" },
    { id: 3, type: "Meeting", contact: "Jane Smith", subject: "Quarterly review", date: "2025-08-05" },
    { id: 4, type: "Note", contact: "Internal", subject: "Client interested in upgrade", date: "2025-08-03" },
  ];

  return (
    <div className="bg-white shadow rounded p-6">
      <h2 className="text-xl font-bold mb-4">🕒 Recent Interactions</h2>
      <div className="divide-y">
        {interactions.map(({ id, type, contact, subject, date }) => (
          <div key={id} className="flex items-start justify-between py-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{typeIcons[type]}</div>
              <div>
                <p className="font-medium">{subject}</p>
                <p className="text-sm text-gray-500">{type} with <span className="font-medium">{contact}</span></p>
              </div>
            </div>
            <div className="text-sm text-gray-400">{date}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentInteractions;
