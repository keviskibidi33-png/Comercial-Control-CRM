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
  const { canViewLab, canViewCom, canViewKpis, canViewTabla1, canViewTabla2, canViewTabla3, canViewPublicidad, isAdmin, loading } = useCurrentUser()

  // Once permissions load, auto-navigate to the correct initial tab
  // for users who only have one tabla assigned or restricted access (e.g. Rossy or Sergio).
  if (!loading && !tabAutoSet) {
    setTabAutoSet(true)
    if (activeTab === "com" && !canViewCom) {
      if (canViewTabla3 && !canViewTabla2 && !canViewTabla1) {
        setActiveTab("seguimiento3")
      } else if (canViewTabla2 && !canViewTabla1) {
        setActiveTab("seguimiento2")
      } else if (canViewTabla1) {
        setActiveTab("seguimiento")
      } else if (canViewLab) {
        setActiveTab("lab")
      }
    } else if (activeTab === "com") {
      const onlyTabla1 = canViewTabla1 && !canViewTabla2 && !canViewTabla3
      const onlyTabla2 = canViewTabla2 && !canViewTabla1 && !canViewTabla3
      const onlyTabla3 = canViewTabla3 && !canViewTabla1 && !canViewTabla2
      if (onlyTabla1) {
        setActiveTab("seguimiento")
      } else if (onlyTabla2) {
        setActiveTab("seguimiento2")
      } else if (onlyTabla3) {
        setActiveTab("seguimiento3")
      }
    }
  }

  /**
   * Safe active tab resolution:
   * Redirects if current active tab is not permitted for the user.
   */
  const safeActiveTab: CommercialModuleTab = (() => {
    const fallbackTab: CommercialModuleTab = canViewTabla3
      ? "seguimiento3"
      : canViewTabla2
      ? "seguimiento2"
      : canViewTabla1
      ? "seguimiento"
      : canViewCom
      ? "com"
      : "lab"

    if (activeTab === "com" && !canViewCom) return fallbackTab
    if (activeTab === "publicidad" && !canViewPublicidad) return fallbackTab
    if (activeTab === "lab" && !canViewLab) return fallbackTab
    if (activeTab === "resumen_comercial_1" && !canViewKpis) return fallbackTab
    if (activeTab === "seguimiento" && !canViewTabla1) return fallbackTab
    if (activeTab === "seguimiento2" && !canViewTabla2) return fallbackTab
    if (activeTab === "seguimiento3" && !canViewTabla3) return fallbackTab
    return activeTab
  })()

  const handleTabChange = (tab: CommercialModuleTab) => {
    // Prevent navigating to unauthorized tabs
    if (tab === "lab" && !canViewLab) return
    if (tab === "com" && !canViewCom) return
    if (tab === "resumen_comercial_1" && !canViewKpis) return
    if (tab === "seguimiento" && !canViewTabla1) return
    if (tab === "seguimiento2" && !canViewTabla2) return
    if (tab === "seguimiento3" && !canViewTabla3) return
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
              canViewTabla3={canViewTabla3}
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
              canViewTabla3={canViewTabla3}
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
              canViewTabla3={canViewTabla3}
              canViewPublicidad={canViewPublicidad}
            />
          ) : safeActiveTab === "seguimiento2" || (safeActiveTab as string) === "seguimiento3" ? (
            <SeguimientoClienteGrid2
              activeModuleTab="seguimiento2"
              onModuleTabChange={handleTabChange}
              canViewLab={canViewLab}
              canViewCom={canViewCom}
              canViewKpis={canViewKpis}
              canViewTabla1={canViewTabla1}
              canViewTabla2={canViewTabla2}
              canViewTabla3={false}
              canViewPublicidad={canViewPublicidad}
              seguimientoTitle="Seguimiento 2"
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
              canViewTabla3={canViewTabla3}
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
              canViewTabla3={canViewTabla3}
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
