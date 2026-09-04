'use client';

import React, { useState, useEffect } from 'react';
import { astrologyApi } from '@/lib/api-client';
import { BirthData } from '@/lib/types/chart.types';

interface FactsAuditorProps {
  isOpen: boolean;
  onClose: () => void;
  birth: BirthData;
}

export function FactsAuditorModal({ isOpen, onClose, birth }: FactsAuditorProps) {
  const [promptText, setPromptText] = useState<string>('Loading ground truth astrological facts...');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      astrologyApi
        .getPromptFacts(birth)
        .then((res) => {
          setPromptText(res.prompt || 'No prompt facts returned.');
        })
        .catch((err) => {
          setPromptText(`Failed to load facts: ${err.message}`);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, birth]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="font-headline text-lg font-bold text-white tracking-tight">
              /FACTS — GROUND TRUTH SYSTEM PROMPT AUDITOR
            </h2>
            <p className="font-mono-code text-xs text-zinc-500 mt-0.5">
              Exact pre-computed facts injected into the Groq AI Companion (Zero Hallucination Protocol)
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white font-mono-code text-sm">
            [✕]
          </button>
        </div>

        {/* Facts Code Box */}
        <div className="flex-1 overflow-y-auto rounded border border-zinc-800 bg-black p-4 font-mono-code text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {loading ? 'Computing deterministic ephemeris facts from Swiss Ephemeris...' : promptText}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-zinc-800 shrink-0 text-xs font-mono-code">
          <span className="text-zinc-500">Ayanamsa: Lahiri (24.12°) • Mean Lunar Node</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-white text-black font-bold hover:bg-zinc-200 transition-colors"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
