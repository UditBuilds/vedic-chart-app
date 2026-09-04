'use client';

import React from 'react';
import { Sparkles, X, Shield, Eye, Flame, Moon, Compass } from 'lucide-react';
import { ChartData } from '@/lib/types/chart.types';

interface NakshatraModalProps {
  isOpen: boolean;
  onClose: () => void;
  nakshatraName: string;
  signName: string;
  pada: number;
}

const NAKSHATRA_ARCHETYPES: Record<
  string,
  {
    title: string;
    archetype: string;
    symbol: string;
    deity: string;
    animal: string;
    superpower: string;
    shadow: string;
    coreTruth: string;
  }
> = {
  Jyeshtha: {
    title: 'THE SOVEREIGN GENERAL',
    archetype: 'The Elder Protector & Uncompromising Strategist',
    symbol: 'Circular Amulet / Talisman (Raksha)',
    deity: 'Indra (King of Gods & Master of Storms)',
    animal: 'Male Deer (Keen Perception & Alert Solitude)',
    superpower: 'Innate authority and ability to hold high-stakes pressure when everyone else panics.',
    shadow: 'Secret jealousy, intense fear of being surpassed or outranked, and using emotional withdrawal as a weapon.',
    coreTruth: 'True sovereignty does not need to constantly defend its throne. You do not need to control everything to be safe.',
  },
  Ashlesha: {
    title: 'THE HYPNOTIC SERPENT',
    archetype: 'The Master of Subconscious Cling & Occult Depth',
    symbol: 'Coiled Serpent (Kundalini)',
    deity: 'Nagas (Serpent Deities of Wisdom & Venom)',
    animal: 'Male Cat (Silent Stalking & Unflinching Independence)',
    superpower: 'Psychological X-ray vision. You instinctively detect what people are hiding within 30 seconds of meeting them.',
    shadow: 'Suffocating possessiveness, passive-aggressive testing of loyalty, and venomous sarcasm when hurt.',
    coreTruth: 'Holding on tighter does not prevent abandonment; it creates it. Learn to let people breathe.',
  },
  Rohini: {
    title: 'THE ROYAL CHARMER',
    archetype: 'The Seductive Artisan & Empress of Sensory Form',
    symbol: 'Temple Cart / Chariot',
    deity: 'Brahma (The Cosmic Creator)',
    animal: 'Male Serpent (Magnetic Charm)',
    superpower: 'Irresistible aesthetic magnetism. You naturally attract resources, beauty, and devoted allies.',
    shadow: 'Material indulgence, subtle manipulation to maintain comfort, and intense vanity.',
    coreTruth: 'Your worth is not tied to how much people desire you or how beautiful your surroundings are.',
  },
  Mula: {
    title: 'THE ROOT DESTROYER',
    archetype: 'The Unflinching Truthseeker & Alchemist of Ruin',
    symbol: 'Tied Bundle of Roots',
    deity: 'Nirriti (Goddess of Dissolution & Calamity)',
    animal: 'Male Dog (Fierce Loyalty & Relentless Scenting)',
    superpower: 'Ability to burn down rotten, expired structures and rebuild indestructible foundations from scratch.',
    shadow: 'Nihilistic impulses, self-inflicted chaos when life feels too peaceful, and blunt cruelty disguised as honesty.',
    coreTruth: 'Not everything broken needs to be incinerated. Some things simply require gentle repair.',
  },
  PurvaPhalguni: {
    title: 'THE ROYAL HEDONIST',
    archetype: 'The Cultivator of Pleasure & Creative Magnetism',
    symbol: 'Swinging Hammock / Front Legs of a Bed',
    deity: 'Bhaga (God of Prosperity & Conjugal Bliss)',
    animal: 'Female Rat (Tactile Resourcefulness)',
    superpower: 'Social grace, creative relaxation, and the ability to make hard work look effortless.',
    shadow: 'Indolence, avoiding difficult conflicts until they explode, and entitlement.',
    coreTruth: 'Rest is medicine; complacency is poison. Distinguish between recovery and evasion.',
  },
  Bharani: {
    title: 'THE EXTREME ALCHEMIST',
    archetype: 'The Bearer of Souls & Endurer of Fire',
    symbol: 'The Yoni / Crucible of Transformation',
    deity: 'Yama (God of Death, Justice & Truth)',
    animal: 'Male Elephant (Unyielding Gravity & Power)',
    superpower: 'Unbelievable pain tolerance and capacity to birth massive projects through sheer grit.',
    shadow: 'Obsessive all-or-nothing extremes, harsh judgment of perceived weakness in others.',
    coreTruth: 'You do not have to suffer intensely for something to be meaningful.',
  },
};

export function NakshatraArchetypeModal({
  isOpen,
  onClose,
  nakshatraName,
  signName,
  pada,
}: NakshatraModalProps) {
  if (!isOpen) return null;

  const data = NAKSHATRA_ARCHETYPES[nakshatraName] || {
    title: `THE ${nakshatraName.toUpperCase()} INITIATE`,
    archetype: `Ancient Lunar Mansion of ${signName}`,
    symbol: 'Sacred Star Cluster',
    deity: 'Cosmic Intelligence',
    animal: 'Celestial Guardian',
    superpower: `Sharp instinctive insight governed by ${nakshatraName} Pada ${pada}.`,
    shadow: 'Subconscious blindspots that emerge when operating under stress or sleep deprivation.',
    coreTruth: 'Self-mastery begins by acknowledging your shadow without defensive rationalization.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fadeIn">
      <div className="card-cosmic w-full max-w-xl p-6 sm:p-8 space-y-6 shadow-2xl relative border-white/20">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="font-mono-code text-[10px] text-indigo-300 uppercase tracking-[0.25em] font-semibold">
                NAKSHATRA ARCHETYPE DOSSIER
              </span>
            </div>
            <h3 className="font-headline text-2xl font-bold text-white tracking-tight mt-1">
              {nakshatraName} ({data.title})
            </h3>
            <p className="font-mono-code text-xs text-slate-400 mt-0.5">
              {signName} • Pada {pada} • {data.archetype}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white font-mono-code text-sm transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mythic Attributes Grid */}
        <div className="grid grid-cols-3 gap-3 font-mono-code text-xs">
          <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06]">
            <span className="text-[9px] text-slate-500 uppercase block">SACRED SYMBOL</span>
            <span className="font-semibold text-slate-200 block truncate">{data.symbol}</span>
          </div>
          <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06]">
            <span className="text-[9px] text-slate-500 uppercase block">RULING DEITY</span>
            <span className="font-semibold text-slate-200 block truncate">{data.deity}</span>
          </div>
          <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06]">
            <span className="text-[9px] text-slate-500 uppercase block">ANIMAL TOTEM</span>
            <span className="font-semibold text-slate-200 block truncate">{data.animal}</span>
          </div>
        </div>

        {/* Superpower Card */}
        <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30 space-y-1">
          <span className="font-mono-code text-[10px] text-emerald-300 uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5" /> PSYCHOLOGICAL SUPERPOWER
          </span>
          <p className="text-xs text-slate-200 leading-relaxed font-light">
            {data.superpower}
          </p>
        </div>

        {/* Shadow Nature Card (Unflinching Psychoanalysis) */}
        <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-500/30 space-y-1">
          <span className="font-mono-code text-[10px] text-rose-300 uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> THE SHADOW NATURE (BLUNT PSYCHOANALYSIS)
          </span>
          <p className="text-xs text-slate-200 leading-relaxed font-light">
            {data.shadow}
          </p>
        </div>

        {/* Core Truth Callout */}
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-mono-code text-[10px] text-amber-300 uppercase tracking-widest font-semibold block">
              CORE KARMIC TRUTH:
            </span>
            <p className="text-xs text-slate-300 font-light italic leading-relaxed">
              &ldquo;{data.coreTruth}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
