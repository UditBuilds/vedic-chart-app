'use client';

import React, { useState } from 'react';
import { ChartData } from '@/lib/types/chart.types';

interface PushProps {
  chart: ChartData;
}

const CRYPTIC_NOTIFICATIONS = [
  'You are not the exception to the rule. Wash your sheets.',
  'Stop trying to outsmart your own feelings.',
  'Take a shower, you are acting like a martyr.',
  'Do not text them first. You already know how this ends.',
  'Your ambition is a bulldozer, but your anxiety is a brick wall.',
  'You cannot intellectualize your way out of heartbreak.',
  'Stop testing people’s loyalty with deliberate silence.',
  'Being exhausted is not a personality trait. Go to sleep.',
  'You are romanticizing a version of them that never existed.',
  'Say what you mean without the protective layer of sarcasm.',
];

export function PushNotificationStudio({ chart }: PushProps) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeMessage = CRYPTIC_NOTIFICATIONS[index];

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % CRYPTIC_NOTIFICATIONS.length);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${activeMessage}" — Jyoti Astro`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="py-8 border-b border-white/[0.08] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono-code text-[10px] text-slate-500 uppercase tracking-[0.25em]">
            DAILY HOOK //
          </span>
          <span className="font-mono-code text-xs text-white font-bold tracking-widest uppercase">
            LOCK-SCREEN NOTIFICATION
          </span>
        </div>
        <button
          onClick={handleNext}
          className="font-mono-code text-[10px] text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
        >
          [ SHUFFLE HOOK ⟳ ]
        </button>
      </div>

      {/* Lockscreen Notification Simulated Card */}
      <div className="p-6 border border-white/15 bg-black max-w-xl mx-auto space-y-3">
        <div className="flex justify-between items-center font-mono-code text-[10px] text-slate-500 tracking-widest uppercase">
          <span className="text-white font-bold">JYOTI ASTRO</span>
          <span>NOW</span>
        </div>

        <p className="font-sans text-base sm:text-lg text-slate-100 font-normal leading-snug">
          {activeMessage}
        </p>

        <div className="pt-2 flex justify-between items-center font-mono-code text-[9px] text-slate-600 border-t border-white/[0.08] uppercase tracking-wider">
          <span>{chart.moon_rashi?.toUpperCase()} MOON</span>
          <span>SLIDE TO OPEN</span>
        </div>
      </div>

      {/* Action Trigger */}
      <div className="flex justify-center">
        <button
          onClick={handleCopy}
          className="font-mono-code text-[11px] text-slate-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white/30 px-4 py-2 transition-colors"
        >
          {copied ? '[ COPIED TO CLIPBOARD ✓ ]' : '[ COPY FOR X / TWITTER ]'}
        </button>
      </div>
    </div>
  );
}
