'use client';

import React from 'react';
import { Compass, MessageSquare, Heart, Sparkles } from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export function CostarMobileNav({ activeTab, onSelectTab }: MobileNavProps) {
  const tabs = [
    { id: 'feed', label: 'FEED', icon: Sparkles },
    { id: 'chart', label: 'CHART', icon: Compass },
    { id: 'companion', label: 'CHAT', icon: MessageSquare },
    { id: 'compatibility', label: 'SYNASTRY', icon: Heart },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-900 bg-black/95 backdrop-blur-lg px-2 py-2 flex justify-around items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 font-mono-code text-[10px] tracking-wider transition-colors ${
              isActive ? 'text-white font-bold' : 'text-zinc-600 font-normal'
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-zinc-600'}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
