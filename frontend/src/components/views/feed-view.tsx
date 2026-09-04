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
      className="space-y-16"
    >
      {/* 1. Daily Poetic Headline Block — Sole Primary Element on Feed */}
      <div className="space-y-4">
        <div className="flex items-baseline gap-2 flex-wrap font-mono-code text-[11px]">
          <span className="text-zinc-500 uppercase tracking-widest font-semibold">
            TODAY AT A GLANCE — {todayDate}
          </span>
          <span className="text-zinc-700 select-none">•</span>
          <span className="text-zinc-500 font-semibold uppercase tracking-wider">
            ☽ MOON IN {chart.moon_rashi?.toUpperCase() || 'GEMINI'}
          </span>
        </div>

        <h1 className="font-headline text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          {wisdom.headline}
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-normal">
          {wisdom.subtext}
        </p>
      </div>

      {/* 2. DO / DON'T Continuous Flowing Guidance */}
      <section className="pt-16 border-t border-zinc-900 space-y-4">
        <div>
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            DAILY ALIGNMENT
          </span>
          <h2 className="font-headline text-lg sm:text-xl font-bold text-zinc-300 tracking-tight">
            Harmonies & Frictions
          </h2>
        </div>

        <div className="space-y-8">
          {/* DO Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs font-bold text-zinc-300 uppercase tracking-widest">
                DO
              </span>
              <span className="text-zinc-700 font-mono-code text-xs select-none">/</span>
              <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest">
                Harmonious Actions
              </span>
            </div>
            <ul className="space-y-2 font-sans text-sm text-zinc-300">
              {wisdom.dos.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 leading-relaxed">
                  <span className="text-zinc-400 font-mono-code font-bold select-none text-sm leading-none mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hairline Divider */}
          <div className="h-px w-full bg-zinc-900" />

          {/* DON'T Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs font-bold text-zinc-400 uppercase tracking-widest">
                DON&apos;T
              </span>
              <span className="text-zinc-700 font-mono-code text-xs select-none">/</span>
              <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest">
                Frictions to Avoid
              </span>
            </div>
            <ul className="space-y-2 font-sans text-sm text-zinc-400">
              {wisdom.donts.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 leading-relaxed">
                  <span className="text-zinc-600 font-mono-code select-none text-xs leading-none mt-1">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Today's Celestial Horizon — stacked vertically */}
      <section className="pt-16 border-t border-zinc-900 space-y-4">
        <div>
          <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            CURRENT SKY • WHOLE-SIGN GOCHAR TRANSITS
          </span>
          <h2 className="font-headline text-lg sm:text-xl font-bold text-zinc-300 tracking-tight">
            Today&apos;s Celestial Horizon
          </h2>
        </div>

        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          {wisdom.horizon.map((h, idx) => (
            <div key={idx} className="py-3.5 space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono-code text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
                  {h.domain}
                </span>
                <span className="text-zinc-700 select-none">•</span>
                <span className="font-headline text-sm font-bold text-zinc-200">
                  {h.planet}
                </span>
                <span className="text-zinc-600 text-xs font-serif-poetic">in</span>
                <span className="font-headline text-sm font-bold text-zinc-200">
                  {h.sign}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
                {h.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. AI Companion Teaser */}
      <div className="pt-16 border-t border-zinc-900 space-y-2">
        <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
          INTERPRETIVE INTELLIGENCE
        </span>
        <h3 className="font-headline text-lg sm:text-xl font-bold text-zinc-300 tracking-tight">
          Consult Your Grounded Vedic Companion
        </h3>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
          Ask questions grounded strictly in your natal placements, running dasha cycles, and current transits.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigateTab('companion')}
            className="text-zinc-400 hover:text-white transition-colors text-[11px] font-bold font-mono-code tracking-wider uppercase underline underline-offset-4 decoration-zinc-800 hover:decoration-white inline-flex items-center gap-1.5"
          >
            Open Companion →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
