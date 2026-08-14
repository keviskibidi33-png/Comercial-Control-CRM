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
 * KPI visibility (`canViewKpis`), `canViewTabla1`, and `canViewTabla2`
 * down to every grid component.
 *
 * Tab Access Rules:
 * - Tabla 1 (`seguimiento` / "Seguimiento B2B"): Visible ONLY to Yerly, Silvia, and Admins.
 * - Tabla 2 (`seguimiento2` / "Mi Seguimiento"): Visible to all NEW commercial advisors and Admins.
 * - KPI (`resumen_comercial_1`): Driven by `show_kpi` field in `perfiles` table.
 */
function CommercialHome() {
  const [activeTab, setActiveTab] = useState<CommercialModuleTab>("com")
  const [tabAutoSet, setTabAutoSet] = useState(false)
  const { canViewLab, canViewCom, canViewKpis, canViewTabla1, canViewTabla2, canViewPublicidad, loading } = useCurrentUser()

  // Once permissions load, auto-navigate to the correct initial tab
  // for users who only have one tabla assigned or restricted access (e.g. asesorcomercial2).
  if (!loading && !tabAutoSet) {
    setTabAutoSet(true)
    if (activeTab === "com" && !canViewCom) {
      if (canViewTabla2) {
        setActiveTab("seguimiento2")
      } else if (canViewTabla1) {
        setActiveTab("seguimiento")
      } else if (canViewLab) {
        setActiveTab("lab")
      }
    } else if (activeTab === "com") {
      const onlyTabla1 = canViewTabla1 && !canViewTabla2
      const onlyTabla2 = canViewTabla2 && !canViewTabla1
      if (onlyTabla1) {
        setActiveTab("seguimiento")
      } else if (onlyTabla2) {
        setActiveTab("seguimiento2")
      }
    }
  }

  /**
   * Safe active tab resolution:
   * 1. If tab is Lab but !canViewLab -> redirect
   * 2. If tab is Comercial but !canViewCom -> redirect to "seguimiento2"
   * 3. If tab is Publicidad but !canViewPublicidad -> redirect to "seguimiento2"
   * 4. If tab is KPI but !canViewKpis -> redirect to default "com" / "seguimiento2"
   * 5. If tab is Tabla 1 (seguimiento) but !canViewTabla1 -> redirect to Tabla 2 (seguimiento2)
   * 6. If tab is Tabla 2 (seguimiento2) but !canViewTabla2 -> redirect to Tabla 1 (seguimiento)
   */
  const safeActiveTab: CommercialModuleTab = (() => {
    if (activeTab === "com" && !canViewCom) return canViewTabla2 ? "seguimiento2" : canViewLab ? "lab" : "seguimiento2"
    if (activeTab === "publicidad" && !canViewPublicidad) return canViewTabla2 ? "seguimiento2" : canViewCom ? "com" : "lab"
    if (activeTab === "lab" && !canViewLab) return canViewTabla2 ? "seguimiento2" : "com"
    if (activeTab === "resumen_comercial_1" && !canViewKpis) return canViewCom ? "com" : "seguimiento2"
    if (activeTab === "seguimiento" && !canViewTabla1) return "seguimiento2"
    if (activeTab === "seguimiento2" && !canViewTabla2) return "seguimiento"
    return activeTab
  })()

  const handleTabChange = (tab: CommercialModuleTab) => {
    // Prevent navigating to unauthorized tabs
    if (tab === "lab" && !canViewLab) return
    if (tab === "com" && !canViewCom) return
    if (tab === "resumen_comercial_1" && !canViewKpis) return
    if (tab === "seguimiento" && !canViewTabla1) return
    if (tab === "seguimiento2" && !canViewTabla2) return
    if (tab === "publicidad" && !canViewPublicidad) return
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
              canViewLab={canViewLab}
              canViewCom={canViewCom}
              canViewKpis={canViewKpis}
              canViewTabla1={canViewTabla1}
              canViewTabla2={canViewTabla2}
              canViewPublicidad={canViewPublicidad}
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
              canViewLab={canViewLab}
              canViewCom={canViewCom}
              canViewKpis={canViewKpis}
              canViewTabla1={canViewTabla1}
              canViewTabla2={canViewTabla2}
              canViewPublicidad={canViewPublicidad}
            />
          ) : safeActiveTab === "seguimiento" ? (
            <SeguimientoClienteGrid
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewLab={canViewLab}
              canViewCom={canViewCom}
              canViewKpis={canViewKpis}
              canViewTabla1={canViewTabla1}
              canViewTabla2={canViewTabla2}
              canViewPublicidad={canViewPublicidad}
            />
          ) : safeActiveTab === "seguimiento2" ? (
            <SeguimientoClienteGrid2
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewLab={canViewLab}
              canViewCom={canViewCom}
              canViewKpis={canViewKpis}
              canViewTabla1={canViewTabla1}
              canViewTabla2={canViewTabla2}
              canViewPublicidad={canViewPublicidad}
            />
          ) : safeActiveTab === "resumen_comercial_1" ? (
            <ResumenComercial1Grid
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewLab={canViewLab}
              canViewCom={canViewCom}
              canViewKpis={canViewKpis}
              canViewTabla1={canViewTabla1}
              canViewTabla2={canViewTabla2}
              canViewPublicidad={canViewPublicidad}
            />
          ) : (
            <PublicidadGeofalGrid
              activeModuleTab={safeActiveTab}
              onModuleTabChange={handleTabChange}
              canViewLab={canViewLab}
              canViewCom={canViewCom}
              canViewKpis={canViewKpis}
              canViewTabla1={canViewTabla1}
              canViewTabla2={canViewTabla2}
              canViewPublicidad={canViewPublicidad}
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
