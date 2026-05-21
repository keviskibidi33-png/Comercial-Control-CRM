"use client"

import React, { useState, Suspense } from "react"
import { FixedProgramacionEditor } from "@/components/fixed-programacion-editor"
import SeguimientoClienteGrid from "@/components/seguimiento-cliente-grid"
import { FlaskConical, Briefcase, Users } from "lucide-react"

type ModuleTab = "lab" | "com" | "seguimiento"

export default function Home() {
  const [activeTab, setActiveTab] = useState<ModuleTab>("com")

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-50 font-sans">
      <header className="z-30 shrink-0 border-b border-zinc-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("lab")}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "lab"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Laboratorio</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("com")}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "com"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Comercial</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("seguimiento")}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "seguimiento"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Seguimiento Clientes</span>
            </button>
          </div>
        </div>
      </header>

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
            />
          ) : (
            <SeguimientoClienteGrid />
          )}
        </Suspense>
      </div>
    </main>
  )
}
