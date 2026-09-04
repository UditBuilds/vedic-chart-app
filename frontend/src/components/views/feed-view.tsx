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
      className="space-y-16 md:space-y-20 max-w-5xl mx-auto"
    >
      {/* 1. Daily Poetic Headline Block */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
            TODAY AT A GLANCE — {todayDate}
          </span>
          <span className="font-mono-code text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            ☽ MOON IN {chart.moon_rashi?.toUpperCase() || 'GEMINI'}
          </span>
        </div>

        <h1 className="font-headline text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
          {wisdom.headline}
        </h1>

        <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-3xl font-normal">
          {wisdom.subtext}
        </p>
      </div>

      {/* 2. DO / DON'T Continuous Flowing Guidance */}
      <section className="pt-12 border-t border-zinc-900 space-y-8">
        <div>
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            DAILY ALIGNMENT
          </span>
          <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
            Harmonies & Frictions
          </h2>
        </div>

        <div className="space-y-8">
          {/* DO Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono-code text-xs font-bold text-white uppercase tracking-widest">
                DO
              </span>
              <span className="text-zinc-600 font-mono-code text-xs select-none">/</span>
              <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest">
                Harmonious Actions
              </span>
            </div>
            <ul className="space-y-3 font-sans text-sm sm:text-base text-zinc-300">
              {wisdom.dos.map((item, idx) => (
                <li key={idx} className="flex items-start gap-4 leading-relaxed">
                  <span className="text-white font-mono-code font-bold select-none text-base leading-none mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hairline Divider */}
          <div className="h-px w-full bg-zinc-900" />

          {/* DON'T Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono-code text-xs font-bold text-zinc-400 uppercase tracking-widest">
                DON&apos;T
              </span>
              <span className="text-zinc-600 font-mono-code text-xs select-none">/</span>
              <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest">
                Frictions to Avoid
              </span>
            </div>
            <ul className="space-y-3 font-sans text-sm sm:text-base text-zinc-400">
              {wisdom.donts.map((item, idx) => (
                <li key={idx} className="flex items-start gap-4 leading-relaxed">
                  <span className="text-zinc-500 font-mono-code select-none text-sm leading-none mt-1">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Today's Celestial Horizon */}
      <section className="pt-12 border-t border-zinc-900 space-y-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
              CURRENT SKY
            </span>
            <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
              Today&apos;s Celestial Horizon
            </h2>
          </div>
          <span className="font-mono-code text-[10px] text-zinc-600 uppercase tracking-widest">
            WHOLE-SIGN GOCHAR TRANSITS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {wisdom.horizon.map((h, idx) => (
            <div key={idx} className="space-y-2.5">
              <span className="font-mono-code text-[10px] text-zinc-500 uppercase tracking-widest block">
                {h.domain}
              </span>
              <div>
                <span className="font-headline text-lg sm:text-xl font-bold text-white block">
                  {h.planet}
                </span>
                <span className="font-mono-code text-xs text-zinc-400 block">
                  in {h.sign}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed pt-1">
                {h.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. AI Companion Teaser */}
      <div className="pt-12 border-t border-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
            INTERPRETIVE INTELLIGENCE
          </span>
          <h3 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
            Consult Your Grounded Vedic Companion
          </h3>
          <p className="text-sm text-zinc-400 max-w-xl">
            Ask questions grounded strictly in your natal placements, running dasha cycles, and current transits.
          </p>
        </div>
        <button
          onClick={() => onNavigateTab('companion')}
          className="px-6 py-3 bg-white text-black font-bold font-mono-code text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors shrink-0 flex items-center gap-2"
        >
          OPEN COMPANION <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
