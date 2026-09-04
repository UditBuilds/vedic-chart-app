'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, RefreshCw, Eye, MessageSquare, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import { ChartData } from '@/lib/types/chart.types';
import { ChatMessage } from '@/lib/types/companion.types';
import { astrologyApi } from '@/lib/api-client';
import { FactsAuditorModal } from '@/components/modals/facts-auditor-modal';

interface CompanionViewProps {
  chart: ChartData;
}

const PROMPT_SUGGESTIONS = [
  'What is the central theme of my current Mahadasha?',
  'Explain how my Moon sign affects my emotional processing.',
  'How are current transits impacting my career and focus?',
  'What are the strengths and friction points of my Big Three?',
];

export function CompanionView({ chart }: CompanionViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `I am your grounded Vedic astrological companion. My interpretations are strictly derived from your pre-computed D1 chart (${chart.ascendant.sign} Ascendant, ${chart.moon_rashi} Moon) and your active ${chart.dasha?.current_mahadasha?.lord || 'Jupiter'} Mahadasha. Ask me anything about your placements or current cycles.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [factsModalOpen, setFactsModalOpen] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input.trim();
    if (!messageText || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await astrologyApi.sendChatMessage(chart.input_echo, messageText);
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: `Could not reach the AI interpretation engine: ${err.message || 'Please check backend status.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    await astrologyApi.resetChatHistory();
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation history has been reset. What would you like to explore in your Vedic chart?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="max-w-3xl mx-auto space-y-4"
    >
      {/* Top Action Bar */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono-code text-xs text-zinc-400 font-semibold tracking-wider uppercase">
            GROUNDED SIDEREAL LLM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFactsModalOpen(true)}
            className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 font-mono-code text-xs transition-colors flex items-center gap-1.5"
          >
            <Eye className="h-3 w-3" /> /FACTS AUDITOR
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 font-mono-code text-xs transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="h-3 w-3" /> RESET
          </button>
        </div>
      </div>

      {/* Main Chat Shell */}
      <div className="rounded border border-zinc-800 bg-zinc-950 flex flex-col h-[65vh] overflow-hidden">
        {/* Suggestion Chips */}
        <div className="p-3 border-b border-zinc-900 bg-black/60 flex items-center gap-2 overflow-x-auto select-none">
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase tracking-wider shrink-0">
            PROMPTS:
          </span>
          {PROMPT_SUGGESTIONS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-white hover:text-white text-xs whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-white text-black font-medium'
                    : msg.isError
                    ? 'bg-red-950/40 border border-red-900 text-red-200'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                }`}
              >
                {msg.content}
              </div>
              <span className="font-mono-code text-[10px] text-zinc-600 mt-1 px-1">
                {msg.timestamp}
              </span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-zinc-500 font-mono-code text-xs p-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              Grounded AI companion is interpreting ephemeris context...
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-4 border-t border-zinc-800 bg-black flex gap-3"
        >
          <input
            type="text"
            placeholder="Ask about your natal placements, running dasha, or transits..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm outline-none focus:border-white transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 rounded bg-white text-black font-bold font-mono-code text-xs uppercase tracking-wider hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            SEND <Send className="h-3 w-3" />
          </button>
        </form>
      </div>

      {/* Facts Auditor Modal */}
      <FactsAuditorModal
        isOpen={factsModalOpen}
        onClose={() => setFactsModalOpen(false)}
        birth={chart.input_echo}
      />
    </motion.div>
  );
}
