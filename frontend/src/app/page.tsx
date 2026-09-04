'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CostarHeader } from '@/components/layout/costar-header';
import { CostarMobileNav } from '@/components/layout/costar-mobile-nav';
import { FeedView } from '@/components/views/feed-view';
import { ChartView } from '@/components/views/chart-view';
import { CompanionView } from '@/components/views/companion-view';
import { CompatibilityView } from '@/components/views/compatibility-view';
import { BirthDataModal } from '@/components/modals/birth-data-modal';
import { ChartData, BirthData } from '@/lib/types/chart.types';
import { astrologyApi } from '@/lib/api-client';

const DEFAULT_BIRTH_DATA: BirthData = {
  date: '1998-05-24',
  time: '14:30:00',
  lat: 28.6139,
  lon: 77.209,
  tz_offset: 5.5,
  city_name: 'New Delhi, India',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('chart');
  const [birthData, setBirthData] = useState<BirthData>(DEFAULT_BIRTH_DATA);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBirthModalOpen, setIsBirthModalOpen] = useState(false);

  // Load saved birth data from localStorage or fallback to default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('costar_vedic_birth');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setBirthData(parsed);
          fetchChart(parsed);
          return;
        } catch (e) {
          // ignore corrupted storage
        }
      }
    }
    fetchChart(DEFAULT_BIRTH_DATA);
  }, []);

  const fetchChart = async (birth: BirthData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await astrologyApi.computeChart(birth);
      if (birth.city_name && !res.input_echo.city_name) {
        res.input_echo.city_name = birth.city_name;
      }
      setChart(res);
      if (typeof window !== 'undefined') {
        localStorage.setItem('costar_vedic_birth', JSON.stringify(birth));
      }
    } catch (err: any) {
      console.error('Failed to compute chart:', err);
      setError(
        err.message ||
          'Failed to connect to the Vedic calculation engine. Please ensure Python backend on port 5000 is active.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBirthSubmit = (newBirth: BirthData) => {
    setBirthData(newBirth);
    fetchChart(newBirth);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col selection:bg-white selection:text-black">
      {/* Top Header */}
      <CostarHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBirthModal={() => setIsBirthModalOpen(true)}
        chart={chart}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 sm:px-12 md:px-16 py-10 md:py-16 pb-24 md:pb-20">
        {loading ? (
          <div className="h-[50vh] flex flex-col items-center justify-center space-y-4">
            <div className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
            <p className="font-mono-code text-xs text-zinc-500 uppercase tracking-widest">
              COMPUTING SIDEREAL EPHEMERIS (LAHIRI)...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 rounded border border-red-900 bg-red-950/40 text-center space-y-4 max-w-md mx-auto">
            <h3 className="font-headline text-lg font-bold text-red-200">Calculation Error</h3>
            <p className="font-mono-code text-xs text-red-300/80 leading-relaxed">{error}</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => fetchChart(birthData)}
                className="px-4 py-2 rounded bg-zinc-800 text-white font-mono-code text-xs font-bold uppercase tracking-wider hover:bg-zinc-700"
              >
                RETRY
              </button>
              <button
                onClick={() => setIsBirthModalOpen(true)}
                className="px-4 py-2 rounded bg-white text-black font-mono-code text-xs font-bold uppercase tracking-wider hover:bg-zinc-200"
              >
                EDIT BIRTH DATA
              </button>
            </div>
          </div>
        ) : chart ? (
          <div className="space-y-12 md:space-y-16">
            {/* Active Profile Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-900 font-mono-code text-xs">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-500 uppercase tracking-wider">ACTIVE MOMENT:</span>
                <span className="text-white font-bold">{birthData.city_name || 'Custom Location'}</span>
                <span className="text-zinc-500 font-normal">({birthData.date} • {birthData.time})</span>
              </div>
              <button
                onClick={() => setIsBirthModalOpen(true)}
                className="text-zinc-400 hover:text-white transition-colors uppercase text-[11px] font-bold tracking-wider underline underline-offset-4 decoration-zinc-800 hover:decoration-white"
              >
                Recalculate Chart →
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'feed' && (
                <FeedView key="feed" chart={chart} onNavigateTab={setActiveTab} />
              )}
              {activeTab === 'chart' && (
                <ChartView key="chart" chart={chart} />
              )}
              {activeTab === 'companion' && (
                <CompanionView key="companion" chart={chart} />
              )}
              {activeTab === 'compatibility' && (
                <CompatibilityView key="compatibility" primaryChart={chart} />
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <CostarMobileNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Birth Data Input Modal */}
      <BirthDataModal
        isOpen={isBirthModalOpen}
        onClose={() => setIsBirthModalOpen(false)}
        onSubmit={handleBirthSubmit}
        currentBirth={birthData}
      />
    </div>
  );
}
