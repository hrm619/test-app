"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, PanelLeft, Send, User, Bot, MessageSquare, Plus, Trash2 } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { streamMessage, type ChatMessage as ApiChatMessage } from "../actions/stream-message";
import { useRouter } from "next/navigation";

// Define message types
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

// Chat session interface
interface ChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  isActive: boolean;
}

export default function Home() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! How can I assist you today?',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Chat history
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([
    {
      id: 'current',
      title: 'Current Chat',
      preview: 'Hello! How can I assist you today?',
      timestamp: new Date(),
      isActive: true
    },
    {
      id: 'chat-1',
      title: 'Previous Chat 1',
      preview: 'We discussed project requirements...',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      isActive: false
    },
    {
      id: 'chat-2',
      title: 'Code Review Session',
      preview: 'Reviewed the authentication flow...',
      timestamp: new Date(Date.now() - 172800000), // 2 days ago
      isActive: false
    }
  ]);
  
  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (message.trim() && !isStreaming) {
      // Create new user message
      const userMessageId = Date.now().toString();
      const newUserMessage: Message = {
        id: userMessageId,
        content: message.trim(),
        role: 'user',
        timestamp: new Date()
      };
      
      // Add user message to messages
      setMessages((prevMessages) => [...prevMessages, newUserMessage]);
      
      // Clear input
      setMessage("");
      
      // Create assistant message placeholder with streaming state
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        content: "",
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsStreaming(true);
      
      try {
        // Format messages for the API
        const apiMessages: ApiChatMessage[] = messages
          .concat(newUserMessage)
          .map((msg, index) => ({
            id: index,
            role: msg.role,
            content: msg.content
          }));
        
        // Start the streaming request
        const response = await streamMessage(apiMessages);
        let responseText = "";
        
        // Use a polling approach to check for updates from the streamable value
        const checkForUpdates = async () => {
          // This approach allows us to get the latest value without using stream iterators
          if (response.output) {
            const newContent = String(response.output);
            
            // Only update if content has changed
            if (newContent !== responseText) {
              responseText = newContent;
              
              // Update the message with new content
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: responseText } 
                    : msg
                )
              );
              
              // Update chat preview
              setChatHistory(prevHistory => 
                prevHistory.map(chat => 
                  chat.isActive 
                    ? { ...chat, preview: responseText.substring(0, 40) + '...' }
                    : chat
                )
              );
              
              // Continue polling if still streaming
              if (isStreaming) {
                setTimeout(checkForUpdates, 100);
              }
            } else if (isStreaming) {
              // If content hasn't changed but we're still streaming, check again
              setTimeout(checkForUpdates, 100);
            }
          }
        };
        
        // Start polling for updates
        checkForUpdates();
        
        // Set a timeout to ensure we don't poll forever
        setTimeout(() => {
          setIsStreaming(false);
        }, 30000); // 30 second max timeout
        
      } catch (error) {
        console.error("Error streaming message:", error);
        // Update with error message
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: "Sorry, I encountered an error while responding." } 
              : msg
          )
        );
        setIsStreaming(false);
      }
    }
  };
  
  const startNewChat = () => {
    // Mark all existing chats as inactive
    setChatHistory(prev => 
      prev.map(chat => ({...chat, isActive: false}))
    );
    
    // Create new chat
    const newChat = {
      id: `chat-${Date.now()}`,
      title: `New Chat ${chatHistory.length}`,
      preview: 'Start a new conversation...',
      timestamp: new Date(),
      isActive: true
    };
    
    // Add to chat history
    setChatHistory(prev => [newChat, ...prev]);
    
    // Reset messages
    setMessages([{
      id: Date.now().toString(),
      content: 'Hello! How can I assist you today?',
      role: 'assistant',
      timestamp: new Date()
    }]);
  };
  
  const switchChat = (chatId: string) => {
    // Update active status
    setChatHistory(prev => 
      prev.map(chat => ({...chat, isActive: chat.id === chatId}))
    );
    
    // In a real app, you would load the selected chat's messages here
    // For this demo, we'll just show a different greeting
    setMessages([{
      id: Date.now().toString(),
      content: `You've switched to a previous conversation. Messages would load here.`,
      role: 'assistant',
      timestamp: new Date()
    }]);
  };
  
  const deleteChat = (e: React.MouseEvent, chatId: string) => {
    // Prevent the click from bubbling up to the parent (which would trigger switchChat)
    e.stopPropagation();
    
    // Remove the chat from history
    const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
    
    // If we're deleting the active chat, switch to the first available chat
    const wasActive = chatHistory.find(chat => chat.id === chatId)?.isActive;
    
    if (wasActive && updatedHistory.length > 0) {
      // Mark the first chat as active
      updatedHistory[0].isActive = true;
      
      // Load that chat's messages
      setMessages([{
        id: Date.now().toString(),
        content: `You've switched to a different conversation after deleting the previous one.`,
        role: 'assistant',
        timestamp: new Date()
      }]);
    } else if (updatedHistory.length === 0) {
      // If no chats left, create a new one
      const newChat = {
        id: `chat-${Date.now()}`,
        title: `New Chat`,
        preview: 'Start a new conversation...',
        timestamp: new Date(),
        isActive: true
      };
      updatedHistory.push(newChat);
      
      // Reset messages
      setMessages([{
        id: Date.now().toString(),
        content: 'Hello! How can I assist you today?',
        role: 'assistant',
        timestamp: new Date()
      }]);
    }
    
    setChatHistory(updatedHistory);
  };
  
  return (
    <div className="bg-gray-900 text-white min-h-screen flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-[50px]' : 'w-[300px]'} border-r border-gray-700 p-4 transition-all duration-300 ease-in-out flex flex-col`}>
        <div className="flex justify-between items-center mb-4">
          {!sidebarCollapsed && (
            <div className="flex flex-col items-left gap-2">
              <PanelLeft size={25} />
              <h2 className="text-xl font-bold mb-4">Sidebar</h2>
            </div>
          )}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded hover:bg-gray-700 text-gray-300 hover:text-white"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        {/* Sidebar content - Chat history */}
        {!sidebarCollapsed && (
          <>
            <button
              onClick={startNewChat}
              className="w-full flex items-center gap-2 p-2 mb-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm"
            >
              <Plus size={16} />
              <span>New Chat</span>
            </button>
            
            <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Chat History</h3>
            <div className="flex-1 overflow-y-auto space-y-1">
              {chatHistory.map((chat) => (
                <div 
                  key={chat.id} 
                  className={`group w-full text-left rounded-lg flex items-start transition-colors ${
                    chat.isActive ? 'bg-gray-700' : 'hover:bg-gray-800'
                  }`}
                >
                  <button
                    onClick={() => switchChat(chat.id)}
                    className="p-1.5 flex items-start gap-2 flex-1 text-left"
                  >
                    <MessageSquare size={14} className="mt-0.5 flex-shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-xs truncate">{chat.title}</p>
                      <p className="text-xs text-gray-400 truncate">{chat.preview}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {chat.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => deleteChat(e, chat.id)}
                    className={`p-1.5 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ${chat.isActive ? 'opacity-100' : ''}`}
                    aria-label="Delete chat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Chat section */}
      <div className="flex-1 p-4 flex flex-col h-screen">
        <h2 className="text-xl font-bold mb-4">Chat</h2>
        
        {/* Chat container with centered content */}
        <div className="flex-1 flex flex-col justify-end mb-4">
          {/* Centered message container */}
          <div className="w-full max-w-[800px] mx-auto overflow-y-auto">
            {/* Chat messages */}
            <div className="flex flex-col space-y-4 pb-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[90%] rounded-lg p-3 ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-gray-700 text-white rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center mb-1">
                      {msg.role === 'user' ? (
                        <div className="flex items-center">
                          <span className="font-medium mr-2">You</span>
                          <User size={14} />
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="font-medium mr-2">Assistant</span>
                          <Bot size={14} />
                        </div>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content || (isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id ? '...' : '')}</p>
                    <span className="text-xs opacity-50 mt-1 block text-right">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
        
        {/* Message input area */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-[800px] flex items-center">
            <TextareaAutosize
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message here..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-14 resize-none text-white"
              minRows={1}
              maxRows={5}
              disabled={isStreaming}
            />
            <div className="absolute right-3 flex items-center">
              <button 
                onClick={handleSendMessage}
                disabled={!message.trim() || isStreaming}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-grey-100 opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
