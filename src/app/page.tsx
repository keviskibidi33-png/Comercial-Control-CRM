"use client"

import React, { useState, Suspense } from "react"
import { FixedProgramacionEditor } from "@/components/fixed-programacion-editor"
import SeguimientoClienteGrid from "@/components/seguimiento-cliente-grid"
import { Calendar, Users, Shield, Briefcase } from "lucide-react"

export default function Home() {
  const [activeTab, setActiveTab] = useState<"programacion" | "seguimiento">("programacion")

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans">
      {/* Premium Top Navigation Bar */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 shadow-lg">
        {/* Left Side: Brand Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
            <Briefcase className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              GEOFAL CRM
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Área Comercial
            </span>
          </div>
        </div>

        {/* Center: Sliding Tab Pill Controls */}
        <div className="flex rounded-xl bg-zinc-900/90 p-1 border border-zinc-800/60 shadow-inner">
          <button
            onClick={() => setActiveTab("programacion")}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-300 ${
              activeTab === "programacion"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/10 scale-105"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Programación</span>
          </button>
          
          <button
            onClick={() => setActiveTab("seguimiento")}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-300 ${
              activeTab === "seguimiento"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/10 scale-105"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Seguimiento Clientes</span>
          </button>
        </div>

        {/* Right Side: Security Badging */}
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full border border-blue-900/40 bg-blue-950/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 sm:flex">
            <Shield className="h-3 w-3" />
            Módulo Comercial
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 w-full overflow-hidden bg-white">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-zinc-950">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <span className="text-sm font-medium text-zinc-400">Cargando módulo...</span>
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
