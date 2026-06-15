import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { 
  Search, MoreVertical, Phone, Video, Send, 
  Paperclip, Smile, CheckCheck, Image
} from "lucide-react";

// Mock chat data based on your notification structure
const initialChats = [
  {
    id: 1,
    name: "Terry Franci",
    status: "online",
    lastMessage: "requests permission to change Nganter App",
    time: "5 min ago",
    unread: 0,
    avatar: "/images/user/user-02.jpg",
    messages: [
      { id: 1, text: "Hey there!", time: "08:00 AM", sender: "Terry", isMe: false },
      { id: 2, text: "I need permission to make changes to the Nganter App project", time: "5 min ago", sender: "Terry", isMe: false, isTyping: true }
    ]
  },
  {
    id: 2,
    name: "Alena Franci",
    status: "online",
    lastMessage: "commented on Dashboard Design",
    time: "8 min ago",
    unread: 0,
    avatar: "/images/user/user-03.jpg",
    messages: [
      { id: 1, text: "Hi, I've reviewed the Dashboard Design", time: "Yesterday", sender: "Me", isMe: true },
      { id: 2, text: "The layout looks good, but we need to adjust the spacing", time: "8 min ago", sender: "Alena", isMe: false }
    ]
  },
  {
    id: 3,
    name: "Jocelyn Kenter",
    status: "online",
    lastMessage: "mentioned you in Team Meeting Notes",
    attachment: "Document",
    time: "15 min ago",
    unread: 0,
    avatar: "/images/user/user-04.jpg",
    messages: [
      { id: 1, text: "Hi Jocelyn, any updates on the meeting?", time: "Yesterday", sender: "Me", isMe: true },
      { id: 2, text: "Yes, I've mentioned you in the Team Meeting Notes about the new timeline", time: "15 min ago", sender: "Jocelyn", isMe: false }
    ]
  },
  {
    id: 4,
    name: "Brandon Philips",
    status: "dnd",
    lastMessage: "assigned you to Bug Fix #234",
    time: "1 hr ago",
    unread: 2,
    avatar: "/images/user/user-05.jpg",
    messages: [
      { id: 1, text: "I've assigned you to Bug Fix #234. Please check when you have time", time: "1 hr ago", sender: "Brandon", isMe: false },
      { id: 2, text: "This is a high priority issue affecting user login", time: "1 hr ago", sender: "Brandon", isMe: false }
    ]
  },
  {
    id: 5,
    name: "Sarah Johnson",
    status: "away",
    lastMessage: "approved your changes to API Documentation",
    time: "2 hrs ago",
    unread: 0,
    avatar: "/images/user/user-06.jpg",
    messages: [
      { id: 1, text: "Your API Documentation changes have been approved!", time: "2 hrs ago", sender: "Sarah", isMe: false }
    ]
  },
];

type ChatStatus = "online" | "offline" | "away" | "dnd" | "busy" | "typing" | "delivered";

type ChatMessage = {
  id: number;
  text: string;
  time: string;
  sender: string;
  isMe: boolean;
  isTyping?: boolean;
  isSystem?: boolean;
};

type Chat = {
  id: number;
  name: string;
  status: ChatStatus;
  lastMessage: string;
  attachment?: string;
  time: string;
  unread: number;
  avatar: string;
  messages: ChatMessage[];
};

export default function MessageSection() {
  const [chats, setChats] = useState<Chat[]>(initialChats as Chat[]);
  const [activeChat, setActiveChat] = useState<Chat>(initialChats[3] as Chat); // Start with Brandon Philips
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat.messages]);

  const getStatusIndicator = (status: ChatStatus) => {
    switch (status) {
      case "online": return "bg-green-500 ring-2 ring-green-100 dark:ring-green-900/50";
      case "offline": return "bg-gray-400 ring-2 ring-gray-100 dark:ring-gray-700/50";
      case "away": return "bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-900/50";
      case "dnd": return "bg-red-500 ring-2 ring-red-100 dark:ring-red-900/50";
      case "busy": return "bg-red-500 ring-2 ring-red-100 dark:ring-red-900/50";
      default: return "bg-gray-400 ring-2 ring-gray-100 dark:ring-gray-700/50";
    }
  };

  // Teams-like status text with colors
  const getStatusText = (status: ChatStatus) => {
    switch (status) {
      case "online": return "text-green-600 dark:text-green-400";
      case "offline": return "text-gray-500 dark:text-gray-400";
      case "away": return "text-amber-600 dark:text-amber-400";
      case "dnd": return "text-red-600 dark:text-red-400";
      case "busy": return "text-red-600 dark:text-red-400";
      default: return "text-gray-500 dark:text-gray-400";
    }
  };

  // Status display text
  const getStatusDisplayText = (status: ChatStatus) => {
    switch (status) {
      case "online": return "Available";
      case "offline": return "Offline";
      case "away": return "Away";
      case "dnd": return "Do not disturb";
      case "busy": return "Busy";
      default: return "Offline";
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const updatedChats: Chat[] = chats.map(chat => {
      if (chat.id === activeChat.id) {
        const newMessageObj: ChatMessage = {
          id: chat.messages.length + 1,
          text: newMessage,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: "Me",
          isMe: true
        };

        return {
          ...chat,
          status: "delivered" as ChatStatus,
          lastMessage: newMessage,
          time: newMessageObj.time,
          messages: [...chat.messages, newMessageObj]
        };
      }
      return chat;
    });

    setChats(updatedChats);
    setActiveChat(updatedChats.find(chat => chat.id === activeChat.id) ?? activeChat);
    setNewMessage("");
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredChats = searchQuery
    ? chats.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chats;

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Left Sidebar - Chat List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chats</h2>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search For Contacts or Messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 dark:text-white border-0 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          <div className="py-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-2">ALL CHATS</h3>
            <div className="space-y-0.5">
              {filteredChats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    activeChat.id === chat.id ? "bg-blue-50 dark:bg-gray-800" : ""
                  }`}
                >
                  {/* Avatar with status indicator */}
                  <div className="relative">
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-10 h-10 rounded-full"
                    />
                    {/* Status indicator */}
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${getStatusIndicator(chat.status)}`} />
                    {chat.unread > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {chat.unread}
                      </div>
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {chat.name}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {chat.time}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {chat.status === "typing" ? (
                        <span className="text-xs text-green-500 font-medium">{chat.lastMessage}</span>
                      ) : (
                        <>
                          {chat.attachment ? (
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <span className="text-xs truncate">{chat.attachment}</span>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                              {chat.lastMessage}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={activeChat.avatar}
                  alt={activeChat.name}
                  className="w-10 h-10 rounded-full"
                />
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${getStatusIndicator(activeChat.status)}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{activeChat.name}</h3>
                <p className={`text-sm ${getStatusText(activeChat.status)} font-medium`}>
                  {getStatusDisplayText(activeChat.status)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <Video className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-800">
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-3">
              {activeChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md ${message.isSystem ? 'text-center w-full' : ''}`}>
                    {message.isSystem ? (
                      <div className="text-center">
                        <span className="inline-block px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full">
                          {message.text}
                        </span>
                      </div>
                    ) : (
                      <div className={`rounded-lg px-3 py-2 ${message.isMe ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'}`}>
                        <p className="text-sm">{message.text}</p>
                        <div className={`flex items-center gap-1 mt-1 ${message.isMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          <span className="text-xs">{message.time}</span>
                          {message.isMe && (
                            <CheckCheck className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <Paperclip className="w-5 h-5" />
            </button>
            
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type Your Message"
                className="w-full px-4 py-3 pr-12 bg-gray-100 dark:bg-gray-800 dark:text-white border-0 rounded-full focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700 focus:outline-none"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                <button className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
