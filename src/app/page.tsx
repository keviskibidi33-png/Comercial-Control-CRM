"use client"

import React, { useState, Suspense } from "react"
import { FixedProgramacionEditor } from "@/components/fixed-programacion-editor"
import SeguimientoClienteGrid from "@/components/seguimiento-cliente-grid"
import SeguimientoClienteGrid2 from "@/components/seguimiento-cliente-grid-2"
import ResumenComercial1Grid from "@/components/resumen-comercial-1-grid"
import PublicidadGeofalGrid from "@/components/publicidad-geofal-grid"
import type { CommercialModuleTab } from "@/components/commercial-module-tabs"
import { useCurrentUser } from "@/hooks/use-current-user"

/**
 * Home — Orchestrates which commercial module tab is active and passes
 * KPI visibility (`canViewKpis`) down to every grid component.
 *
 * KPI visibility is driven by `show_kpi` in the `perfiles` DB table and
 * is readable via `useCurrentUser().canViewKpis`. Admin/gerencia users
 * always have access regardless of that flag.
 */
function CommercialHome() {
  const [activeTab, setActiveTab] = useState<CommercialModuleTab>("com")
  const { canViewKpis } = useCurrentUser()

  /**
   * If the active tab is the KPI panel but the user loses access (e.g., DB
   * refreshes with show_kpi=false), redirect them to the default tab.
   */
  const safeActiveTab: CommercialModuleTab =
    activeTab === "resumen_comercial_1" && !canViewKpis ? "com" : activeTab

  const handleTabChange = (tab: CommercialModuleTab) => {
    // Prevent navigating to KPI tab if not authorized
    if (tab === "resumen_comercial_1" && !canViewKpis) return
    setActiveTab(tab)
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-50 font-sans">
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 w-full overflow-hidden bg-zinc-50">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-zinc-50">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <span className="text-sm font-medium text-zinc-500">Cargando módulo...</span>
              </div>
            </div>
          }
        >
          {safeActiveTab === "lab" ? (
            <FixedProgramacionEditor
              kind="laboratorio"
              title="Control Comercial"
              subtitle="Seguimiento comercial, entregas y evidencia de atención."
              viewMode="LAB"
              availableViewModes={["LAB"]}
              exportMode="lab"
              storageNamespace="programacion-laboratorio"
              showViewTabs={false}
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewKpis={canViewKpis}
            />
          ) : safeActiveTab === "com" ? (
            <FixedProgramacionEditor
              kind="comercial"
              title="Control Comercial"
              subtitle="Seguimiento comercial, entregas y evidencia de atención."
              viewMode="COM"
              availableViewModes={["COM"]}
              exportMode="comercial"
              storageNamespace="programacion-comercial"
              showViewTabs={false}
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewKpis={canViewKpis}
            />
          ) : safeActiveTab === "seguimiento" ? (
            <SeguimientoClienteGrid
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewKpis={canViewKpis}
            />
          ) : safeActiveTab === "seguimiento2" ? (
            <SeguimientoClienteGrid2
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewKpis={canViewKpis}
            />
          ) : safeActiveTab === "resumen_comercial_1" ? (
            <ResumenComercial1Grid
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewKpis={canViewKpis}
            />
          ) : (
            <PublicidadGeofalGrid
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewKpis={canViewKpis}
            />
          )}
        </Suspense>
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-zinc-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <CommercialHome />
    </Suspense>
  )
}
