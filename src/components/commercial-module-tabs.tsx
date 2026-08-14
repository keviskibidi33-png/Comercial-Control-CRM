"use client"

import React from "react"
import { FlaskConical, Briefcase, Users, BarChart3 } from "lucide-react"

export type CommercialModuleTab = "lab" | "com" | "seguimiento" | "seguimiento2" | "resumen_comercial_1" | "publicidad"

interface CommercialModuleTabsProps {
  activeTab: CommercialModuleTab
  onTabChange: (tab: CommercialModuleTab) => void
  className?: string
  /** If false, the KPI tab (resumen_comercial_1) is hidden entirely */
  canViewKpis?: boolean
  /** If false, Tabla 1 (seguimiento) is hidden */
  canViewTabla1?: boolean
  /** If false, Tabla 2 (seguimiento2) is hidden */
  canViewTabla2?: boolean
}

export function CommercialModuleTabs({
  activeTab,
  onTabChange,
  className = "",
  canViewKpis = true,
  canViewTabla1 = true,
  canViewTabla2 = true,
}: CommercialModuleTabsProps) {
  const isAdminView = canViewTabla1 && canViewTabla2

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
      label: "Seguimiento 1",
      icon: <Users className="h-3.5 w-3.5" />,
    },
    seguimiento2: {
      label: "Seguimiento 2",
      icon: <Users className="h-3.5 w-3.5" />,
    },
    resumen_comercial_1: {
      label: isAdminView ? "Resumen en KPIs" : "KPI Personal",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
    },
    publicidad: {
      label: "Publicidad Geofal",
      icon: <Users className="h-3.5 w-3.5 text-blue-600" />,
    },
  }

  const visibleTabs = (Object.keys(TAB_LABELS) as CommercialModuleTab[]).filter((tab) => {
    // Hide KPI tab entirely when user doesn't have permission
    if (tab === "resumen_comercial_1" && !canViewKpis) return false
    // Hide Tabla 1 ("Seguimiento") for non-legacy commercial users
    if (tab === "seguimiento" && !canViewTabla1) return false
    // Hide Tabla 2 ("Seguimiento 2") for legacy users
    if (tab === "seguimiento2" && !canViewTabla2) return false
    return true
  })

  return (
    <div className={`commercial-tabs-scroll min-w-0 max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100 p-1 shadow-inner ${className}`}>
      <div className="flex w-max min-w-full items-center gap-2">
        {visibleTabs.map((tab) => {
          const tabMeta = TAB_LABELS[tab]
          const isActive = activeTab === tab

          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
                isActive
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:bg-white/70 hover:text-zinc-700 hover:shadow-sm"
              }`}
            >
              {tabMeta.icon}
              <span>{tabMeta.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
