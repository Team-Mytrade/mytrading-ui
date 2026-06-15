// import { useState, useRef, useEffect } from "react";
// import FullCalendar from "@fullcalendar/react";
// import dayGridPlugin from "@fullcalendar/daygrid";
// import timeGridPlugin from "@fullcalendar/timegrid";
// import interactionPlugin from "@fullcalendar/interaction";
// import { EventInput, DateSelectArg, EventClickArg } from "@fullcalendar/core";
// import { Modal } from "../components/ui/modal";
// import { useModal } from "../hooks/useModal";
// import PageMeta from "../components/common/PageMeta";

// interface CalendarEvent extends EventInput {
//   extendedProps: {
//     calendar: string;
//   };
// }

// const Calendar: React.FC = () => {
//   const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
//     null
//   );
//   const [eventTitle, setEventTitle] = useState("");
//   const [eventStartDate, setEventStartDate] = useState("");
//   const [eventEndDate, setEventEndDate] = useState("");
//   const [eventLevel, setEventLevel] = useState("");
//   const [events, setEvents] = useState<CalendarEvent[]>([]);
//   const calendarRef = useRef<FullCalendar>(null);
//   const { isOpen, openModal, closeModal } = useModal();

//   const calendarsEvents = {
//     Danger: "danger",
//     Success: "success",
//     Primary: "primary",
//     Warning: "warning",
//   };

//   useEffect(() => {
//     // Initialize with some events
//     setEvents([
//       {
//         id: "1",
//         title: "Event Conf.",
//         start: new Date().toISOString().split("T")[0],
//         extendedProps: { calendar: "Danger" },
//       },
//       {
//         id: "2",
//         title: "Meeting",
//         start: new Date(Date.now() + 86400000).toISOString().split("T")[0],
//         extendedProps: { calendar: "Success" },
//       },
//       {
//         id: "3",
//         title: "Workshop",
//         start: new Date(Date.now() + 172800000).toISOString().split("T")[0],
//         end: new Date(Date.now() + 259200000).toISOString().split("T")[0],
//         extendedProps: { calendar: "Primary" },
//       },
//     ]);
//   }, []);

//   const handleDateSelect = (selectInfo: DateSelectArg) => {
//     resetModalFields();
//     setEventStartDate(selectInfo.startStr);
//     setEventEndDate(selectInfo.endStr || selectInfo.startStr);
//     openModal();
//   };

//   const handleEventClick = (clickInfo: EventClickArg) => {
//     const event = clickInfo.event;
//     setSelectedEvent(event as unknown as CalendarEvent);
//     setEventTitle(event.title);
//     setEventStartDate(event.start?.toISOString().split("T")[0] || "");
//     setEventEndDate(event.end?.toISOString().split("T")[0] || "");
//     setEventLevel(event.extendedProps.calendar);
//     openModal();
//   };

//   const handleAddOrUpdateEvent = () => {
//     if (selectedEvent) {
//       // Update existing event
//       setEvents((prevEvents) =>
//         prevEvents.map((event) =>
//           event.id === selectedEvent.id
//             ? {
//                 ...event,
//                 title: eventTitle,
//                 start: eventStartDate,
//                 end: eventEndDate,
//                 extendedProps: { calendar: eventLevel },
//               }
//             : event
//         )
//       );
//     } else {
//       // Add new event
//       const newEvent: CalendarEvent = {
//         id: Date.now().toString(),
//         title: eventTitle,
//         start: eventStartDate,
//         end: eventEndDate,
//         allDay: true,
//         extendedProps: { calendar: eventLevel },
//       };
//       setEvents((prevEvents) => [...prevEvents, newEvent]);
//     }
//     closeModal();
//     resetModalFields();
//   };

//   const resetModalFields = () => {
//     setEventTitle("");
//     setEventStartDate("");
//     setEventEndDate("");
//     setEventLevel("");
//     setSelectedEvent(null);
//   };

//   return (
//     <>
//       <PageMeta
//         title="React.js Calendar Dashboard | TailAdmin - Next.js Admin Dashboard Template"
//         description="This is React.js Calendar Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
//       />
//       <div className="rounded-2xl border  border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
//         <div className="custom-calendar">
//           <FullCalendar
//             ref={calendarRef}
//             plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
//             initialView="dayGridMonth"
//             headerToolbar={{
//               left: "prev,next addEventButton",
//               center: "title",
//               right: "dayGridMonth,timeGridWeek,timeGridDay",
//             }}
//             events={events}
//             selectable={true}
//             select={handleDateSelect}
//             eventClick={handleEventClick}
//             eventContent={renderEventContent}
//             customButtons={{
//               addEventButton: {
//                 text: "Add Event +",
//                 click: openModal,
//               },
//             }}
//           />
//         </div>
//         <Modal
//           isOpen={isOpen}
//           onClose={closeModal}
//           className="max-w-[700px] p-6 lg:p-10"
//         >
//           <div className="flex flex-col px-2 overflow-y-auto custom-scrollbar">
//             <div>
//               <h5 className="mb-2 font-semibold text-gray-800 modal-title text-theme-xl dark:text-white/90 lg:text-2xl">
//                 {selectedEvent ? "Edit Event" : "Add Event"}
//               </h5>
//               <p className="text-sm text-gray-500 dark:text-gray-400">
//                 Plan your next big moment: schedule or edit an event to stay on
//                 track
//               </p>
//             </div>
//             <div className="mt-8">
//               <div>
//                 <div>
//                   <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
//                     Event Title
//                   </label>
//                   <input
//                     id="event-title"
//                     type="text"
//                     value={eventTitle}
//                     onChange={(e) => setEventTitle(e.target.value)}
//                     className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
//                   />
//                 </div>
//               </div>
//               <div className="mt-6">
//                 <label className="block mb-4 text-sm font-medium text-gray-700 dark:text-gray-400">
//                   Event Color
//                 </label>
//                 <div className="flex flex-wrap items-center gap-4 sm:gap-5">
//                   {Object.entries(calendarsEvents).map(([key, value]) => (
//                     <div key={key} className="n-chk">
//                       <div
//                         className={`form-check form-check-${value} form-check-inline`}
//                       >
//                         <label
//                           className="flex items-center text-sm text-gray-700 form-check-label dark:text-gray-400"
//                           htmlFor={`modal${key}`}
//                         >
//                           <span className="relative">
//                             <input
//                               className="sr-only form-check-input"
//                               type="radio"
//                               name="event-level"
//                               value={key}
//                               id={`modal${key}`}
//                               checked={eventLevel === key}
//                               onChange={() => setEventLevel(key)}
//                             />
//                             <span className="flex items-center justify-center w-5 h-5 mr-2 border border-gray-300 rounded-full box dark:border-gray-700">
//                               <span className="w-2 h-2 bg-white rounded-full dark:bg-transparent"></span>
//                             </span>
//                           </span>
//                           {key}
//                         </label>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               <div className="mt-6">
//                 <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
//                   Enter Start Date
//                 </label>
//                 <div className="relative">
//                   <input
//                     id="event-start-date"
//                     type="date"
//                     value={eventStartDate}
//                     onChange={(e) => setEventStartDate(e.target.value)}
//                     className="dark:bg-dark-900 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pl-4 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
//                   />
//                 </div>
//               </div>

//               <div className="mt-6">
//                 <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
//                   Enter End Date
//                 </label>
//                 <div className="relative">
//                   <input
//                     id="event-end-date"
//                     type="date"
//                     value={eventEndDate}
//                     onChange={(e) => setEventEndDate(e.target.value)}
//                     className="dark:bg-dark-900 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pl-4 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
//                   />
//                 </div>
//               </div>
//             </div>
//             <div className="flex items-center gap-3 mt-6 modal-footer sm:justify-end">
//               <button
//                 onClick={closeModal}
//                 type="button"
//                 className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto"
//               >
//                 Close
//               </button>
//               <button
//                 onClick={handleAddOrUpdateEvent}
//                 type="button"
//                 className="btn btn-success btn-update-event flex w-full justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 sm:w-auto"
//               >
//                 {selectedEvent ? "Update Changes" : "Add Event"}
//               </button>
//             </div>
//           </div>
//         </Modal>
//       </div>
//     </>
//   );
// };

// const renderEventContent = (eventInfo: any) => {
//   const colorClass = `fc-bg-${eventInfo.event.extendedProps.calendar.toLowerCase()}`;
//   return (
//     <div
//       className={`event-fc-color flex fc-event-main ${colorClass} p-1 rounded`}
//     >
//       <div className="fc-daygrid-event-dot"></div>
//       <div className="fc-event-time">{eventInfo.timeText}</div>
//       <div className="fc-event-title">{eventInfo.event.title}</div>
//     </div>
//   );
// };

// export default Calendar;

import { useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { EventInput, DateSelectArg, EventClickArg } from "@fullcalendar/core";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Edit2, 
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  MapPin,
  Users,
  AlertCircle,
  ChevronRightIcon
} from "lucide-react";

interface CalendarEvent extends EventInput {
  extendedProps: {
    calendar: string;
    description?: string;
    location?: string;
    attendees?: number;
  };
}

const Calendar: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventAttendees, setEventAttendees] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLevel, setEventLevel] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const calendarRef = useRef<FullCalendar>(null);
  const { isOpen, openModal, closeModal } = useModal();

  const calendarsEvents = {
    Danger: { color: "danger", bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-600", dot: "bg-red-500" },
    Success: { color: "success", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600", dot: "bg-emerald-500" },
    Primary: { color: "primary", bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-600", dot: "bg-blue-500" },
    Warning: { color: "warning", bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600", dot: "bg-amber-500" },
    Purple: { color: "purple", bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-600", dot: "bg-purple-500" },
    Pink: { color: "pink", bg: "bg-pink-500/10", border: "border-pink-500/20", text: "text-pink-600", dot: "bg-pink-500" },
  };

  useEffect(() => {
    // Initialize with some events
    setEvents([
      {
        id: "1",
        title: "Annual Conference",
        start: new Date().toISOString().split("T")[0],
        extendedProps: { 
          calendar: "Primary",
          description: "Annual tech conference with industry leaders",
          location: "Convention Center",
          attendees: 150
        },
      },
      {
        id: "2",
        title: "Team Meeting",
        start: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        extendedProps: { 
          calendar: "Success",
          description: "Quarterly team planning session",
          location: "Meeting Room A",
          attendees: 12
        },
      },
      {
        id: "3",
        title: "Workshop Series",
        start: new Date(Date.now() + 172800000).toISOString().split("T")[0],
        end: new Date(Date.now() + 259200000).toISOString().split("T")[0],
        extendedProps: { 
          calendar: "Warning",
          description: "3-day workshop on advanced techniques",
          location: "Training Hall",
          attendees: 45
        },
      },
      {
        id: "4",
        title: "Product Launch",
        start: new Date(Date.now() + 345600000).toISOString().split("T")[0],
        extendedProps: { 
          calendar: "Danger",
          description: "Launch of new product line",
          location: "Main Auditorium",
          attendees: 200
        },
      },
      {
        id: "5",
        title: "Client Presentation",
        start: new Date(Date.now() + 432000000).toISOString().split("T")[0],
        extendedProps: { 
          calendar: "Purple",
          description: "Quarterly review with key clients",
          location: "Board Room",
          attendees: 25
        },
      },
      {
        id: "6",
        title: "Team Building",
        start: new Date(Date.now() + 518400000).toISOString().split("T")[0],
        extendedProps: { 
          calendar: "Pink",
          description: "Monthly team building activity",
          location: "Outdoor Park",
          attendees: 50
        },
      },
    ]);
  }, []);

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    resetModalFields();
    setEventStartDate(selectInfo.startStr);
    setEventEndDate(selectInfo.endStr || selectInfo.startStr);
    openModal();
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = clickInfo.event;
    setSelectedEvent(event as unknown as CalendarEvent);
    setEventTitle(event.title);
    setEventDescription(event.extendedProps.description || "");
    setEventLocation(event.extendedProps.location || "");
    setEventAttendees(event.extendedProps.attendees?.toString() || "");
    setEventStartDate(event.start?.toISOString().split("T")[0] || "");
    setEventEndDate(event.end?.toISOString().split("T")[0] || "");
    setEventLevel(event.extendedProps.calendar);
    openModal();
  };

  const handleAddOrUpdateEvent = () => {
    if (selectedEvent) {
      // Update existing event
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === selectedEvent.id
            ? {
                ...event,
                title: eventTitle,
                start: eventStartDate,
                end: eventEndDate,
                extendedProps: { 
                  calendar: eventLevel,
                  description: eventDescription,
                  location: eventLocation,
                  attendees: eventAttendees ? parseInt(eventAttendees) : undefined
                },
              }
            : event
        )
      );
    } else {
      // Add new event
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        title: eventTitle,
        start: eventStartDate,
        end: eventEndDate,
        allDay: true,
        extendedProps: { 
          calendar: eventLevel,
          description: eventDescription,
          location: eventLocation,
          attendees: eventAttendees ? parseInt(eventAttendees) : undefined
        },
      };
      setEvents((prevEvents) => [...prevEvents, newEvent]);
    }
    closeModal();
    resetModalFields();
  };

  const handleDeleteEvent = () => {
    if (selectedEvent) {
      setEvents((prevEvents) => prevEvents.filter(event => event.id !== selectedEvent.id));
      closeModal();
      resetModalFields();
    }
  };

  const resetModalFields = () => {
    setEventTitle("");
    setEventDescription("");
    setEventLocation("");
    setEventAttendees("");
    setEventStartDate("");
    setEventEndDate("");
    setEventLevel("");
    setSelectedEvent(null);
  };

  const handleViewChange = (view: 'month' | 'week' | 'day') => {
    setViewMode(view);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(view === 'month' ? 'dayGridMonth' : view === 'week' ? 'timeGridWeek' : 'timeGridDay');
    }
  };

  // Get upcoming events (next 7 days)
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.start as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return eventDate >= today && eventDate <= nextWeek;
    })
    .sort((a, b) => new Date(a.start as string).getTime() - new Date(b.start as string).getTime())
    .slice(0, 5);

  return (
    <>
      <PageMeta
        title="React.js Calendar Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Calendar Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      
      <div className="space-y-6">
        {/* Calendar Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Schedule and manage your events with ease
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              <button
                onClick={() => handleViewChange('month')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
              >
                <Grid size={16} />
                Month
              </button>
              <button
                onClick={() => handleViewChange('week')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === 'week' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
              >
                <List size={16} />
                Week
              </button>
              <button
                onClick={() => handleViewChange('day')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === 'day' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
              >
                <CalendarIcon size={16} />
                Day
              </button>
            </div>
            
            <button
              onClick={openModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Plus size={18} />
              Add Event
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Container - Takes 2/3 width on large screens */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden shadow-xl">
              <div className="custom-calendar">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: "",
                    center: "",
                    right: "",
                  }}
                  events={events}
                  selectable={true}
                  select={handleDateSelect}
                  eventClick={handleEventClick}
                  eventContent={renderEventContent}
                  height="auto"
                  dayHeaderClassNames="text-gray-700 dark:text-gray-300 font-medium"
                  dayCellClassNames="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  viewClassNames="!p-6"
                  buttonText={{
                    today: "Today",
                    month: "Month",
                    week: "Week",
                    day: "Day"
                  }}
                  customButtons={{
                    prev: {
                      text: '<ChevronLeft size={18} />',
                      click: () => {
                        const calendarApi = calendarRef.current?.getApi();
                        calendarApi?.prev();
                      },
                    },
                    next: {
                      text: '<ChevronRight size={18} />',
                      click: () => {
                        const calendarApi = calendarRef.current?.getApi();
                        calendarApi?.next();
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Upcoming Events Sidebar - Takes 1/3 width on large screens */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden shadow-xl h-full">
              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                    <CalendarIcon size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Upcoming Events
                    </h3>
                      {/* <p className="text-sm text-gray-600 dark:text-gray-400">
                        Next 7 days
                      </p> */}

                     {/* <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"> */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Total events: <span className="font-semibold text-gray-900 dark:text-white">{events.length}</span>
                  </span>
                  {/* <button
                    onClick={openModal}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    View all →
                  </button> */}
                </div>
              </div>
                  </div>
                {/* </div> */}
              </div>
              
              {/* Scrollable events container */}
              <div className="overflow-y-auto custom-scrollbar h-[calc(100%-120px)]">
                <div className="p-4">
                  {upcomingEvents.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingEvents.map(event => {
                        const colors = calendarsEvents[event.extendedProps.calendar as keyof typeof calendarsEvents];
                        const eventDate = new Date(event.start as string);
                        const today = new Date();
                        const tomorrow = new Date(today);
                        tomorrow.setDate(today.getDate() + 1);
                        
                        let dateLabel = "";
                        if (eventDate.toDateString() === today.toDateString()) {
                          dateLabel = "Today";
                        } else if (eventDate.toDateString() === tomorrow.toDateString()) {
                          dateLabel = "Tomorrow";
                        } else {
                          dateLabel = eventDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          });
                        }

                        return (
                          <div 
                            key={event.id} 
                            className={`p-4 rounded-xl border ${colors?.border} ${colors?.bg} hover:shadow-md transition-all cursor-pointer group`}
                            onClick={() => handleEventClick({ 
                              event: { 
                                ...event,
                                extendedProps: event.extendedProps
                              } 
                            } as any)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${colors?.dot}`} />
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                    {event.title}
                                  </h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {dateLabel} • {eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                              <ChevronRightIcon size={16} className="text-gray-400 group-hover:text-blue-500" />
                            </div>
                            
                            {event.extendedProps.description && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                                {event.extendedProps.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                              {event.extendedProps.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin size={12} />
                                  <span className="truncate max-w-[100px]">{event.extendedProps.location}</span>
                                </div>
                              )}
                              
                              {event.extendedProps.attendees && (
                                <div className="flex items-center gap-1">
                                  <Users size={12} />
                                  <span>{event.extendedProps.attendees}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <CalendarIcon size={24} className="text-gray-400" />
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        No upcoming events
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        You don't have any events scheduled for the next week
                      </p>
                      <button
                        onClick={openModal}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Plus size={16} />
                        Add your first event
                      </button>
                    </div>
                  )}
             
                </div>
              </div>
              
              {/* Footer */}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Modal */}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="max-w-4xl p-0 overflow-hidden"
      >
        <div className="relative">
          {/* Modal Header with Gradient */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xl font-bold">
                  {selectedEvent ? "Edit Event" : "Create New Event"}
                </h5>
                <p className="text-blue-100 mt-1">
                  {selectedEvent ? "Update your event details" : "Plan your next important moment"}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto">
            {/* Left Column - Event Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Event Title */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Edit2 size={16} />
                  Event Title
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Enter event title"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Add event description"
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                />
              </div>

              {/* Location and Attendees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <MapPin size={16} />
                    Location
                  </label>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Event location"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Users size={16} />
                    Attendees
                  </label>
                  <input
                    type="number"
                    value={eventAttendees}
                    onChange={(e) => setEventAttendees(e.target.value)}
                    placeholder="Number of attendees"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <CalendarIcon size={16} />
                    Start Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={eventStartDate}
                      onChange={(e) => setEventStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <CalendarIcon size={16} />
                    End Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={eventEndDate}
                      onChange={(e) => setEventEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Upcoming Events Preview */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={18} className="text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Upcoming Events
                  </h3>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar max-h-[300px]">
                  {upcomingEvents.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingEvents.map(event => {
                        const colors = calendarsEvents[event.extendedProps.calendar as keyof typeof calendarsEvents];
                        return (
                          <div 
                            key={event.id} 
                            className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {event.title}
                              </h4>
                              {colors && (
                                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                <Clock size={12} />
                                <span>
                                  {new Date(event.start as string).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                              
                              {event.extendedProps.attendees && (
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                  <Users size={12} />
                                  <span>{event.extendedProps.attendees}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CalendarIcon size={24} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No upcoming events in the next week
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    You have <span className="font-semibold text-gray-700 dark:text-gray-300">{events.length}</span> total events scheduled
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-800">
            {selectedEvent && (
              <button
                onClick={handleDeleteEvent}
                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                Delete Event
              </button>
            )}
            
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={closeModal}
                className="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOrUpdateEvent}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Check size={18} />
                {selectedEvent ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

const renderEventContent = (eventInfo: any) => {
  const eventColors = {
    Danger: { bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500" },
    Success: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500" },
    Primary: { bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-500" },
    Warning: { bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500" },
    Purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", dot: "bg-purple-500" },
    Pink: { bg: "bg-pink-500/10", border: "border-pink-500/20", dot: "bg-pink-500" },
  };

  const colorKey = eventInfo.event.extendedProps.calendar;
  const colors = eventColors[colorKey as keyof typeof eventColors] || eventColors.Primary;

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg p-2 m-1 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md`}>
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 mt-1 rounded-full ${colors.dot} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-gray-900 dark:text-white">
            {eventInfo.event.title}
          </div>
          {eventInfo.timeText && (
            <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Clock size={10} />
              {eventInfo.timeText}
            </div>
          )}
          {eventInfo.event.extendedProps.location && (
            <div className="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">
              📍 {eventInfo.event.extendedProps.location}
            </div>
          )}
          {eventInfo.event.extendedProps.attendees && (
            <div className="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">
              👥 {eventInfo.event.extendedProps.attendees} people
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;