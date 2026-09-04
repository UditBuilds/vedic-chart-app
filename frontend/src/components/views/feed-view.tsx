'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Share2, Compass, MessageSquare } from 'lucide-react';
import { ChartData } from '@/lib/types/chart.types';
import { getDailyTransitWisdom } from '@/lib/astrology-service';

interface FeedViewProps {
  chart: ChartData;
  onNavigateTab: (tab: string) => void;
}

export function FeedView({ chart, onNavigateTab }: FeedViewProps) {
  const wisdom = getDailyTransitWisdom(chart);
  const todayDate = new Date().toISOString().split('T')[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      {/* 1. Daily Poetic Headline Block */}
      <div className="p-8 sm:p-10 rounded border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md relative overflow-hidden group hover:border-zinc-700 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
            TODAY AT A GLANCE — {todayDate}
          </span>
          <span className="font-mono-code text-xs font-bold text-white px-3 py-1 rounded bg-zinc-900 border border-zinc-800 tracking-wider">
            ☽ MOON IN {chart.moon_rashi?.toUpperCase() || 'GEMINI'}
          </span>
        </div>

        <h2 className="font-headline text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight mb-4">
          {wisdom.headline}
        </h2>

        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
          {wisdom.subtext}
        </p>
      </div>

      {/* 2. DO / DON'T High-Contrast Guidance Pills */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DO Card */}
        <div className="p-6 sm:p-8 rounded border border-zinc-800 bg-zinc-950 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
              <span className="font-mono-code text-xs font-extrabold px-3 py-1 rounded bg-white text-black tracking-widest">
                DO
              </span>
              <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
                HARMONIOUS ACTIONS
              </span>
            </div>
            <ul className="space-y-4 font-sans text-sm text-zinc-200">
              {wisdom.dos.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 leading-relaxed">
                  <span className="text-white font-mono-code font-bold select-none">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* DON'T Card */}
        <div className="p-6 sm:p-8 rounded border border-zinc-800 bg-zinc-950 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
              <span className="font-mono-code text-xs font-extrabold px-3 py-1 rounded border border-white text-white tracking-widest">
                DON&apos;T
              </span>
              <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
                FRICTIONS TO AVOID
              </span>
            </div>
            <ul className="space-y-4 font-sans text-sm text-zinc-200">
              {wisdom.donts.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 leading-relaxed">
                  <span className="text-zinc-500 font-mono-code text-xs select-none mt-0.5">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Today's Celestial Horizon */}
      <div className="p-6 sm:p-8 rounded border border-zinc-800 bg-zinc-950 space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <span className="font-mono-code text-xs text-zinc-400 uppercase tracking-wider font-semibold">
            TODAY&apos;S CELESTIAL HORIZON
          </span>
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase">
            WHOLE-SIGN GOCHAR TRANSITS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {wisdom.horizon.map((h, idx) => (
            <div
              key={idx}
              className="p-4 rounded border border-zinc-900 bg-zinc-900/60 flex flex-col justify-between space-y-2 hover:border-zinc-700 transition-colors"
            >
              <div>
                <span className="font-mono-code text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">
                  [ {h.domain} ]
                </span>
                <span className="font-headline text-sm font-bold text-white block">
                  {h.planet}
                </span>
                <span className="font-mono-code text-[11px] text-zinc-400 block mb-2">
                  {h.sign}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {h.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. AI Companion Teaser Card */}
      <div className="p-6 sm:p-8 rounded border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900/60 to-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <MessageSquare className="h-4 w-4 text-white" />
            <h3 className="font-headline text-base font-bold text-white">
              Consult Your Grounded Vedic Companion
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Ask deep questions about your running dasha, transits, or career blueprint.
          </p>
        </div>
        <button
          onClick={() => onNavigateTab('companion')}
          className="px-6 py-2.5 rounded bg-white text-black font-bold font-mono-code text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors shrink-0 flex items-center gap-2"
        >
          OPEN COMPANION <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
