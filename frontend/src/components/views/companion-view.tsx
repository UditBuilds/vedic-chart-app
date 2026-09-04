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

function formatCompanionError(err: any): string {
  const type = err.type || err.response?.data?.error?.type;
  const status = err.status || err.response?.status;
  const rawMsg = err.message || err.response?.data?.error?.message;

  if (type === 'missing_api_key' || status === 503) {
    return `Configuration issue: ${rawMsg || 'GROQ_API_KEY is not set in the backend environment. Export GROQ_API_KEY before starting the chat.'}`;
  }

  if (type === 'ephemeris_range') {
    return `Ephemeris range error: ${rawMsg || 'The birth date falls outside the Swiss Ephemeris calculation range.'}`;
  }

  if (type === 'dasha_range') {
    return `Dasha cycle error: ${rawMsg || 'The date falls outside the 120-year Vimshottari dasha cycle for this nativity.'}`;
  }

  if (type === 'inference_failed' || (status === 502 && type !== 'proxy_error')) {
    return `AI inference failed: ${rawMsg || 'The language model failed to complete the request. Please try again.'}`;
  }

  if (type === 'invalid_request' || status === 400) {
    return `Invalid request: ${rawMsg || 'The request was malformed or missing required parameters.'}`;
  }

  if (type === 'calculation_failed' || status === 500) {
    return `Chart calculation error: ${rawMsg || 'Astrological calculation failed.'}`;
  }

  if (type === 'proxy_error' || type === 'network_error' || status === 0 || !status) {
    return 'Network failure: Unable to reach the Vedic calculation engine. Please ensure the backend is running on port 5000.';
  }

  return rawMsg || 'An unexpected error occurred while communicating with the companion service.';
}

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
        content: formatCompanionError(err),
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
      className="space-y-4"
    >
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono-code text-xs text-zinc-400 font-semibold tracking-wider uppercase">
            GROUNDED SIDEREAL LLM
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFactsModalOpen(true)}
            className="text-zinc-400 hover:text-white font-mono-code text-[11px] transition-colors flex items-center gap-1.5 uppercase tracking-wider"
          >
            <Eye className="h-3 w-3" /> FACTS AUDITOR
          </button>
          <span className="text-zinc-700 select-none">|</span>
          <button
            onClick={handleReset}
            className="text-zinc-400 hover:text-white font-mono-code text-[11px] transition-colors flex items-center gap-1.5 uppercase tracking-wider"
          >
            <RefreshCw className="h-3 w-3" /> RESET
          </button>
        </div>
      </div>

      {/* Main Chat Stream (Unboxed Flat Layout) */}
      <div className="flex flex-col h-[65vh]">
        {/* Suggestion Chips */}
        <div className="pb-3 border-b border-zinc-900 flex items-center gap-2 overflow-x-auto select-none">
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase tracking-wider shrink-0">
            PROMPTS:
          </span>
          {PROMPT_SUGGESTIONS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1 rounded-full border border-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 text-xs whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-white text-black font-medium'
                    : msg.isError
                    ? 'bg-red-950/40 border border-red-900/80 text-red-200'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
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
            <div className="flex items-center gap-2 text-zinc-500 font-mono-code text-xs py-3">
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
          className="pt-4 border-t border-zinc-900 flex gap-3"
        >
          <input
            type="text"
            placeholder="Ask about your natal placements, running dasha, or transits..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 text-sm outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-3 rounded bg-white text-black font-bold font-mono-code text-xs uppercase tracking-wider hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0"
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
