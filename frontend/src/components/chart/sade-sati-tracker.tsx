'use client';

import React from 'react';
import { Shield, AlertCircle, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { ChartData } from '@/lib/types/chart.types';
import { computeSadeSatiStatus } from '@/lib/astrology-service';

interface SadeSatiProps {
  chart: ChartData;
}

export function SadeSatiTracker({ chart }: SadeSatiProps) {
  const moonSign = chart.moon_rashi || 'Scorpio';
  const status = computeSadeSatiStatus(moonSign);

  const PHASES = [
    {
      num: 'PHASE 01',
      title: 'Rising Phase (12th)',
      theme: 'Mental Clearing & Subconscious Letting Go',
      active: status.phase === 'Rising',
    },
    {
      num: 'PHASE 02',
      title: 'Peak Janma Shani (1st)',
      theme: 'Core Structural Grit & Ego Refinement',
      active: status.phase === 'Peak',
    },
    {
      num: 'PHASE 03',
      title: 'Setting Phase (2nd)',
      theme: 'Financial Grounding & Asset Building',
      active: status.phase === 'Setting',
    },
  ];

  return (
    <div className="card-cosmic p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse" />
            <span className="font-mono-code text-[10px] text-slate-400 uppercase tracking-[0.25em] font-semibold">
              7.5-YEAR SATURN TRANSIT RADAR
            </span>
          </div>
          <h3 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
            Sade Sati & Karmic Endurance
          </h3>
        </div>
        <div className="self-start sm:self-auto">
          {status.isActive ? (
            <span className="font-mono-code text-xs font-bold px-3 py-1 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {status.phase.toUpperCase()} PHASE ACTIVE
            </span>
          ) : (
            <span className="font-mono-code text-xs font-bold px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> CURRENTLY FREE FROM SADE SATI
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
        {status.phaseDescription}
      </p>

      {/* 3-Phase Progression Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        {PHASES.map((p, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border transition-all ${
              p.active
                ? 'bg-amber-950/30 border-amber-500/50 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
                : 'bg-white/[0.02] border-white/[0.06] opacity-60'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className={`font-mono-code text-[9px] uppercase tracking-wider font-bold ${p.active ? 'text-amber-300' : 'text-slate-500'}`}>
                {p.num}
              </span>
              {p.active && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <h4 className="font-headline text-sm font-bold text-white mb-1">
              {p.title}
            </h4>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              {p.theme}
            </p>
          </div>
        ))}
      </div>

      {/* Grounded Vedic Remedy Callout */}
      <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] flex items-start gap-3">
        <Shield className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-mono-code text-[10px] text-indigo-300 uppercase tracking-widest font-semibold block">
            GROUNDED VEDIC REMEDIAL GUIDANCE:
          </span>
          <p className="text-xs text-slate-300 font-light leading-relaxed">
            {status.remedy}
          </p>
        </div>
      </div>
    </div>
  );
}
