import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Building2, Search, MapPin, DollarSign, BedDouble, Phone } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, Property } from '../../types/property';
import { getGeminiResponse } from '../../services/gemini';
import { PropertyCard } from '../Property/PropertyCard';
import { PropertyModal } from '../Property/PropertyModal';
import { LiveCall } from './LiveCall';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm EstateAI, your professional property assistant. How can I help you find your dream property today? I have listings in Karachi, Lahore, and Islamabad.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user', content: input });

      const response = await getGeminiResponse(chatHistory);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        properties: response.properties,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error getting response:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">EstateAI</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-slate-500">Online Assistant</span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-slate-500 text-sm font-medium">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            Karachi, Lahore, Islamabad
          </div>
          <button 
            onClick={() => setIsCallOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Phone className="w-4 h-4" />
            Live Call
          </button>
        </div>
        <div className="md:hidden">
          <button 
            onClick={() => setIsCallOpen(true)}
            className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 active:scale-95"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3 md:gap-4 max-w-4xl mx-auto",
                message.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                message.role === 'user' ? "bg-slate-800 text-white" : "bg-blue-600 text-white"
              )}>
                {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              
              <div className={cn(
                "flex flex-col gap-2 max-w-[85%] md:max-w-[75%]",
                message.role === 'user' ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "px-4 py-3 rounded-2xl text-sm md:text-base leading-relaxed shadow-sm",
                  message.role === 'user' 
                    ? "bg-slate-800 text-white rounded-tr-none" 
                    : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                )}>
                  <div className="prose prose-slate prose-sm md:prose-base max-w-none prose-p:leading-relaxed prose-strong:text-blue-600">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
                
                {message.properties && message.properties.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 w-full">
                    {message.properties.map((prop) => (
                      <PropertyCard 
                        key={prop.id} 
                        property={prop} 
                        onClick={(p) => setSelectedProperty(p)}
                      />
                    ))}
                  </div>
                )}
                
                <span className="text-[10px] font-medium text-slate-400 px-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 max-w-4xl mx-auto"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-slate-500 font-medium italic">Searching properties...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-4 md:p-6 z-10">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSend} className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Try: '2-bedroom apartment in Karachi under 15 lakh'"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 pr-16 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            <button 
              onClick={() => setInput("Show me apartments in Karachi")}
              className="text-[10px] md:text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Search className="w-3 h-3" />
              Karachi Apartments
            </button>
            <button 
              onClick={() => setInput("Commercial space in Lahore")}
              className="text-[10px] md:text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Building2 className="w-3 h-3" />
              Lahore Commercial
            </button>
            <button 
              onClick={() => setInput("Houses in Islamabad F-7")}
              className="text-[10px] md:text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <MapPin className="w-3 h-3" />
              Islamabad F-7
            </button>
          </div>
        </div>
      </div>

      {/* Property Modal */}
      <PropertyModal 
        property={selectedProperty} 
        onClose={() => setSelectedProperty(null)} 
      />

      {/* Live Call Modal */}
      <LiveCall 
        isOpen={isCallOpen} 
        onClose={() => setIsCallOpen(false)} 
      />
    </div>
  );
};
