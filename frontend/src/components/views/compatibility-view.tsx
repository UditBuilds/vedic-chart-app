'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Users, Sparkles, ArrowRight } from 'lucide-react';
import { ChartData, BirthData } from '@/lib/types/chart.types';
import { computeSynastryScore } from '@/lib/astrology-service';
import { astrologyApi } from '@/lib/api-client';

interface CompatibilityViewProps {
  primaryChart: ChartData;
}

export function CompatibilityView({ primaryChart }: CompatibilityViewProps) {
  const [partnerDate, setPartnerDate] = useState('2000-01-01');
  const [partnerTime, setPartnerTime] = useState('06:00:00');
  const [partnerCity, setPartnerCity] = useState('London, UK');
  const [partnerLat, setPartnerLat] = useState(51.5074);
  const [partnerLon, setPartnerLon] = useState(-0.1278);
  const [partnerTz, setPartnerTz] = useState(0.0);

  const [partnerChart, setPartnerChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleComputePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const birth: BirthData = {
        date: partnerDate,
        time: partnerTime,
        lat: partnerLat,
        lon: partnerLon,
        tz_offset: partnerTz,
        city_name: partnerCity,
      };
      const res = await astrologyApi.computeChart(birth);
      setPartnerChart(res);
    } catch (err: any) {
      alert(`Could not calculate synastry chart: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const synastry = partnerChart ? computeSynastryScore(primaryChart, partnerChart) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Header Info */}
      <div className="p-8 rounded border border-zinc-800 bg-zinc-950 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-white" />
          <h2 className="font-headline text-2xl font-bold text-white tracking-tight">
            Dual-Chart Synastry Analysis
          </h2>
        </div>
        <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
          Compare whole-sign planetary overlaps, emotional Moon harmonics, and life trajectory compatibility between two distinct birth blueprints.
        </p>
      </div>

      {/* Profiles Dual Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Person 1 (Active User) */}
        <div className="p-6 rounded border border-zinc-800 bg-zinc-950 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <span className="font-mono-code text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              PRIMARY PROFILE
            </span>
            <span className="font-mono-code text-xs font-bold text-white">
              YOU
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="font-headline text-xl font-bold text-white">
              {primaryChart.ascendant.sign} Ascendant
            </h3>
            <p className="font-mono-code text-xs text-zinc-400">
              Moon in {primaryChart.moon_rashi} • Sun in {primaryChart.planets.find((p) => p.name === 'Sun')?.sign}
            </p>
            <p className="font-mono-code text-[11px] text-zinc-600">
              {primaryChart.input_echo.city_name || 'Birth Chart'} ({primaryChart.input_echo.date})
            </p>
          </div>
        </div>

        {/* Person 2 (Partner Form) */}
        <div className="p-6 rounded border border-zinc-800 bg-zinc-950 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <span className="font-mono-code text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              PARTNER PROFILE
            </span>
            {partnerChart && (
              <span className="font-mono-code text-xs font-bold text-white">
                LOADED ✓
              </span>
            )}
          </div>

          <form onSubmit={handleComputePartner} className="space-y-3 font-mono-code text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase block">BIRTH DATE</label>
                <input
                  type="date"
                  required
                  value={partnerDate}
                  onChange={(e) => setPartnerDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white text-xs outline-none focus:border-white"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase block">BIRTH TIME</label>
                <input
                  type="time"
                  step="1"
                  required
                  value={partnerTime}
                  onChange={(e) => setPartnerTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white text-xs outline-none focus:border-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] text-zinc-500 uppercase block">CITY / REGION</label>
              <input
                type="text"
                value={partnerCity}
                onChange={(e) => setPartnerCity(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white text-xs outline-none focus:border-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-white text-black font-bold font-mono-code text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'COMPUTING SYNASTRY...' : 'COMPUTE SYNASTRY →'}
            </button>
          </form>
        </div>
      </div>

      {/* Synastry Results */}
      {synastry && (
        <div className="space-y-6 animate-fadeIn">
          {/* Score Hero Card */}
          <div className="p-8 rounded border border-zinc-800 bg-zinc-950 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="font-mono-code text-[11px] text-zinc-500 uppercase tracking-widest font-semibold block">
                COMPOSITE HARMONY SCORE
              </span>
              <h3 className="font-headline text-2xl font-bold text-white">
                {synastry.verdict}
              </h3>
            </div>
            <div className="text-center shrink-0">
              <div className="font-headline text-6xl font-extrabold text-white tracking-tight">
                {synastry.totalScore}%
              </div>
              <span className="font-mono-code text-[10px] text-zinc-500 uppercase tracking-widest">
                OVERALL COMPATIBILITY
              </span>
            </div>
          </div>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {synastry.dimensions.map((dim, idx) => (
              <div key={idx} className="p-6 rounded border border-zinc-800 bg-zinc-950 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-headline text-base font-bold text-white">
                    {dim.title}
                  </h4>
                  <span className="font-mono-code text-xs font-bold text-white">
                    {dim.score}%
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {dim.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
