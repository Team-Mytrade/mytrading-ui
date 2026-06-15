import React, { useState } from 'react';
//import FullCalendar, { DateSelectArg, EventClickArg, EventApi } from '@fullcalendar/react';

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { DateSelectArg, EventClickArg } from "@fullcalendar/core";
//import interactionPlugin from '@fullcalendar/interaction';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: 'Meeting' | 'Call' | 'Task' | 'Reminder';
}

const ActivityCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<DateSelectArg | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<{ title: string; type: CalendarEvent['type'] }>({
    title: '',
    type: 'Meeting',
  });

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedInfo(selectInfo);
    setModalVisible(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = () => {
    if (selectedInfo) {
      const newEvent: CalendarEvent = {
        id: String(Date.now()),
        title: `${form.type}: ${form.title}`,
        start: selectedInfo.startStr,
        end: selectedInfo.endStr,
        type: form.type,
      };

      setEvents([...events, newEvent]);
      setModalVisible(false);
      setForm({ title: '', type: 'Meeting' });
    }
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (confirm(`Delete event "${clickInfo.event.title}"?`)) {
      setEvents(events.filter((e) => e.id !== clickInfo.event.id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-4">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Activity Calendar</h2>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        select={handleDateSelect}
        events={events}
        eventClick={handleEventClick}
        height="auto"
        editable={true}
      />

      {/* Modal */}
      {modalVisible && selectedInfo && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Activity</h3>
            <div className="space-y-4">
              <input
                type="text"
                name="title"
                placeholder="Activity title"
                value={form.title}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border rounded"
              />
              <select
                name="type"
                value={form.type}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="Meeting">Meeting</option>
                <option value="Call">Call</option>
                <option value="Task">Task</option>
                <option value="Reminder">Reminder</option>
              </select>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setModalVisible(false)}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFormSubmit}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityCalendar;
