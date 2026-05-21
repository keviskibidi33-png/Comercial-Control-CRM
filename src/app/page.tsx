"use client"

import React, { useState, Suspense } from "react"
import { FixedProgramacionEditor } from "@/components/fixed-programacion-editor"
import SeguimientoClienteGrid from "@/components/seguimiento-cliente-grid"
import { Calendar, Users, Shield, Briefcase, X } from "lucide-react"

export default function Home() {
  const [activeTab, setActiveTab] = useState<"programacion" | "seguimiento">("programacion")

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-50 font-sans">
      {/* Compact App Shell Header */}
      <header className="z-30 flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
            <Briefcase className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-900">
            Seguimiento Comercial - Geofal CRM
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 shadow-inner">
          <button
            onClick={() => setActiveTab("programacion")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
              activeTab === "programacion"
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Programación</span>
          </button>
          
          <button
            onClick={() => setActiveTab("seguimiento")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
              activeTab === "seguimiento"
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Seguimiento Clientes</span>
          </button>
        </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 sm:flex">
              <Shield className="h-3 w-3" />
              Módulo Comercial
            </span>
            <button
              type="button"
              aria-label="Cerrar módulo"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-800"
              title="Cerrar"
            >
              <X className="h-4 w-4" />
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
          {activeTab === "programacion" ? (
            <FixedProgramacionEditor
              kind="comercial"
              title="Control Comercial"
              subtitle="Seguimiento comercial, entregas y evidencia de atención."
              viewMode="COM"
              availableViewModes={["LAB", "COM"]}
              exportMode="comercial"
              storageNamespace="programacion-comercial"
            />
          ) : (
            <SeguimientoClienteGrid />
          )}
        </Suspense>
      </div>
    </main>
  )
}
