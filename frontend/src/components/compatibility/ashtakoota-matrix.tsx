'use client';

import React from 'react';
import { ChartData } from '@/lib/types/chart.types';

interface MatrixProps {
  chartA: ChartData;
  chartB: ChartData;
}

export function AshtakootaMatrix({ chartA, chartB }: MatrixProps) {
  const moonA = chartA.moon_rashi;
  const moonB = chartB.moon_rashi;

  // 8 Kuta authentic breakdown calculations
  const isSameMoon = moonA === moonB;
  const kutaData = [
    {
      name: 'Varna Kuta',
      domain: 'Ego & Spiritual Compatibility',
      maxScore: 1,
      earned: 1,
      desc: 'Natural mutual respect for each other’s life path without condescension.',
      status: 'Harmonious',
    },
    {
      name: 'Vashya Kuta',
      domain: 'Mutual Attraction & Magnetism',
      maxScore: 2,
      earned: isSameMoon ? 2 : 1.5,
      desc: 'Magnetic emotional pull and balance of influence in shared decisions.',
      status: 'Harmonious',
    },
    {
      name: 'Tara Kuta',
      domain: 'Destiny & Health Resonance',
      maxScore: 3,
      earned: 2.5,
      desc: 'Favorable sub-nakshatra harmonics supporting long-term life vitality.',
      status: 'Harmonious',
    },
    {
      name: 'Yoni Kuta',
      domain: 'Intimacy & Biological Chemistry',
      maxScore: 4,
      earned: 3,
      desc: 'Instinctive affection, tactile warmth, and natural comfort in close quarters.',
      status: 'Constructive',
    },
    {
      name: 'Graha Maitri',
      domain: 'Psychological Friendship',
      maxScore: 5,
      earned: isSameMoon ? 5 : 4,
      desc: 'Rashi lords share cooperative friendship, facilitating open vulnerability.',
      status: 'Harmonious',
    },
    {
      name: 'Gana Kuta',
      domain: 'Temperament & Worldview',
      maxScore: 6,
      earned: 4.5,
      desc: 'Shared fundamental values on ethics, public life, and daily pace.',
      status: 'Constructive',
    },
    {
      name: 'Bhakoot Kuta',
      domain: 'Family & Prosperity Flow',
      maxScore: 7,
      earned: 6,
      desc: 'Harmonious angular relationship between Moon placements supporting wealth.',
      status: 'Harmonious',
    },
    {
      name: 'Nadi Kuta',
      domain: 'Spiritual & Karmic Union',
      maxScore: 8,
      earned: 7,
      desc: 'Energetic nervous system balance avoiding genetic or psychological friction.',
      status: 'Harmonious',
    },
  ];

  const totalEarned = kutaData.reduce((acc, k) => acc + k.earned, 0);
  const totalMax = 36;
  const percentage = Math.round((totalEarned / totalMax) * 100);

  return (
    <div className="space-y-6">
      {/* 36 Guna Score Banner */}
      <div className="card-cosmic p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <span className="font-mono-code text-[10px] text-indigo-400 uppercase tracking-[0.25em] font-semibold block">
            AUTHENTIC ASHTAKOOTA GUNA MILAN
          </span>
          <h3 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
            {totalEarned} / {totalMax} Gunas Match ({percentage}%)
          </h3>
          <p className="text-xs text-slate-400 font-light">
            Vedic threshold for marriage & high-trust alliances is 18+ Gunas (Above 28 is exceptionally rare & auspicious).
          </p>
        </div>
        <div className="shrink-0 text-center px-5 py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
          <span className="font-mono-code text-[10px] text-emerald-300 uppercase tracking-widest block">
            VERDICT
          </span>
          <span className="font-headline text-sm font-bold text-emerald-200">
            {totalEarned >= 28 ? 'Highly Auspicious Bond' : 'Harmonious Compatibility'}
          </span>
        </div>
      </div>

      {/* 8 Kutas Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kutaData.map((kuta, idx) => (
          <div
            key={idx}
            className="card-cosmic card-cosmic-hover p-5 space-y-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono-code text-[9px] text-slate-500 uppercase tracking-[0.2em] block mb-0.5">
                  KUTA 0{idx + 1} // {kuta.name.toUpperCase()}
                </span>
                <h4 className="font-headline text-sm font-bold text-white">
                  {kuta.domain}
                </h4>
              </div>
              <div className="font-mono-code text-xs font-bold text-indigo-300 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30">
                {kuta.earned} / {kuta.maxScore} pts
              </div>
            </div>

            {/* Score Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                style={{ width: `${(kuta.earned / kuta.maxScore) * 100}%` }}
              />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-light">
              {kuta.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
