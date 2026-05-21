"use client"

import React from "react"
import { FlaskConical, Briefcase, Users } from "lucide-react"

export type CommercialModuleTab = "lab" | "com" | "seguimiento"

interface CommercialModuleTabsProps {
  activeTab: CommercialModuleTab
  onTabChange: (tab: CommercialModuleTab) => void
  className?: string
}

const TAB_LABELS: Record<CommercialModuleTab, { label: string; icon: React.ReactNode }> = {
  lab: {
    label: "Laboratorio",
    icon: <FlaskConical className="h-3.5 w-3.5" />,
  },
  com: {
    label: "Comercial",
    icon: <Briefcase className="h-3.5 w-3.5" />,
  },
  seguimiento: {
    label: "Seguimiento Clientes",
    icon: <Users className="h-3.5 w-3.5" />,
  },
}

export function CommercialModuleTabs({ activeTab, onTabChange, className = "" }: CommercialModuleTabsProps) {
  return (
    <div className={`flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 shadow-inner ${className}`}>
      {(Object.keys(TAB_LABELS) as CommercialModuleTab[]).map((tab) => {
        const tabMeta = TAB_LABELS[tab]
        const isActive = activeTab === tab

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tabMeta.icon}
            <span>{tabMeta.label}</span>
          </button>
        )
      })}
    </div>
  )
}
