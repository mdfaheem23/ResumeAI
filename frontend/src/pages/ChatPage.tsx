import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { ArrowLeft } from "lucide-react";

const API_BASE = "/api";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const ChatPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageCounterRef = useRef(0);

  // Get initial message from navigation state
  useEffect(() => {
    if (location.state?.initialMessage) {
      const initialMsg: Message = {
        id: `msg-${++messageCounterRef.current}`,
        type: "user",
        content: location.state.initialMessage,
        timestamp: new Date(),
      };
      setMessages([initialMsg]);
      handleSendToBackend(location.state.initialMessage, location.state?.files);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const readApiResponse = async (response: Response) => {
    const raw = await response.text();

    try {
      return JSON.parse(raw);
    } catch {
      if (!response.ok) {
        throw new Error(raw || `Request failed with status ${response.status}`);
      }
      throw new Error("Server returned an invalid response.");
    }
  };

  const handleSendToBackend = async (message: string, files?: File[]) => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", message);
      if (files && files.length > 0) {
        formData.append("resume", files[0]);
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        body: formData,
      });

      const data = await readApiResponse(response);
      console.log("Response from backend:", data);

      if (response.ok && data.success && data.reply) {
        const assistantMessage: Message = {
          id: `msg-${++messageCounterRef.current}`,
          type: "assistant",
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const fallbackMessage: Message = {
          id: `msg-${++messageCounterRef.current}`,
          type: "assistant",
          content: data.error || `Request failed with status ${response.status}.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const messageText =
        error instanceof Error
          ? error.message
          : "Error connecting to the server. Make sure the backend is running on port 3001.";

      const errorMessage: Message = {
        id: `msg-${++messageCounterRef.current}`,
        type: "assistant",
        content: messageText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (message: string, files?: File[]) => {
    const userMessage: Message = {
      id: `msg-${++messageCounterRef.current}`,
      type: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await handleSendToBackend(message, files);
  };

  return (
    <div className="flex w-full h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex-col relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-gray-700/50 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-gray-900/50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/demo")}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-white">Resume Builder</h1>
              <p className="text-sm text-gray-400">Chat with AI about your resume</p>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 backdrop-blur-sm">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {msg.type === "user" ? (
                // User Message
                <div className="flex justify-end">
                  <div className="max-w-[70%]">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl px-5 py-3 inline-block shadow-lg hover:shadow-xl transition-shadow">
                      <p className="text-base">{msg.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ) : (
                // Assistant Message
                <div className="flex justify-start">
                  <div className="max-w-[70%]">
                    <div className="bg-gray-800/80 text-gray-100 rounded-2xl px-5 py-3 border border-gray-700/50 shadow-lg">
                      <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-gray-800/80 text-gray-100 rounded-2xl px-5 py-3 border border-gray-700/50">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-300">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Section */}
        <div className="border-t border-gray-700/50 bg-gray-900/50 backdrop-blur-sm px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <PromptInputBox
              onSend={handleSendMessage}
              isLoading={isLoading}
              placeholder="Ask about your resume or continue chatting..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export { ChatPage };
