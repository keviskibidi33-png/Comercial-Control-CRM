"use client"

import React, { useState, Suspense } from "react"
import { FixedProgramacionEditor } from "@/components/fixed-programacion-editor"
import SeguimientoClienteGrid from "@/components/seguimiento-cliente-grid"
import SeguimientoClienteGrid2 from "@/components/seguimiento-cliente-grid-2"
import ResumenComercial1Grid from "@/components/resumen-comercial-1-grid"
import PublicidadGeofalGrid from "@/components/publicidad-geofal-grid"
import type { CommercialModuleTab } from "@/components/commercial-module-tabs"

export default function Home() {
  const [activeTab, setActiveTab] = useState<CommercialModuleTab>("com")

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
          {activeTab === "lab" ? (
            <FixedProgramacionEditor
              kind="laboratorio"
              title="Control Comercial"
              subtitle="Seguimiento comercial, entregas y evidencia de atención."
              viewMode="LAB"
              availableViewModes={["LAB"]}
              exportMode="lab"
              storageNamespace="programacion-laboratorio"
              showViewTabs={false}
              activeModuleTab={activeTab}
              onModuleTabChange={setActiveTab}
            />
          ) : activeTab === "com" ? (
            <FixedProgramacionEditor
              kind="comercial"
              title="Control Comercial"
              subtitle="Seguimiento comercial, entregas y evidencia de atención."
              viewMode="COM"
              availableViewModes={["COM"]}
              exportMode="comercial"
              storageNamespace="programacion-comercial"
              showViewTabs={false}
              activeModuleTab={activeTab}
              onModuleTabChange={setActiveTab}
            />
          ) : activeTab === "seguimiento" ? (
            <SeguimientoClienteGrid
              activeModuleTab={activeTab}
              onModuleTabChange={setActiveTab}
            />
          ) : activeTab === "resumen_comercial_1" ? (
            <ResumenComercial1Grid
              activeModuleTab={activeTab}
              onModuleTabChange={setActiveTab}
            />
          ) : (
            <PublicidadGeofalGrid
              activeModuleTab={activeTab}
              onModuleTabChange={setActiveTab}
            />
          )}
        </Suspense>
      </div>
    </main>
  )
}
