"use client"

import React, { useMemo } from "react"
import { BarChart3, FileCheck2, ShoppingCart, TrendingUp, Users } from "lucide-react"

import { useSeguimientoComercial } from "@/hooks/use-seguimiento-comercial"
import { CommercialModuleTabs, type CommercialModuleTab } from "@/components/commercial-module-tabs"

function StatCard({ title, value, subtitle, tone }: { title: string; value: string; subtitle: string; tone: "blue" | "emerald" | "violet" }) {
  const toneClasses = tone === "blue"
    ? "border-blue-200 bg-blue-50 text-blue-900"
    : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-violet-200 bg-violet-50 text-violet-900"

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center gap-2 border-b px-4 py-3 ${toneClasses}`}>
        {tone === "blue" ? <FileCheck2 className="h-4 w-4" /> : tone === "emerald" ? <ShoppingCart className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        <h3 className="text-sm font-black uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-4">
        <div className="text-3xl font-black text-slate-950">{value}</div>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
    </section>
  )
}

export default function ResumenComercial1Grid({
  activeModuleTab,
  onModuleTabChange,
}: {
  activeModuleTab: CommercialModuleTab
  onModuleTabChange: (tab: CommercialModuleTab) => void
}) {
  const { rows, total, catalogs, isLoading, refetch } = useSeguimientoComercial()

  const summary = useMemo(() => {
    const sentQuotes = rows.filter((row) => String(row.estado_cliente || "").toUpperCase().includes("COTIZACIÓN ENVIADA")).length
    const sales = rows.filter((row) => String(row.estado_seguimiento || "").toUpperCase().includes("VENTA")).length
    const byCategory = catalogs.categorias_servicio.map((category) => ({
      category,
      count: rows.filter((row) => (row.categoria_servicio || "") === category).length,
    }))
    return { sentQuotes, sales, byCategory }
  }, [rows, catalogs.categorias_servicio])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-50">
      <div className="z-10 flex min-h-14 h-auto md:h-14 shrink-0 flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 border-b border-zinc-200 bg-white px-4 py-2 md:py-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 md:gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-600 p-1.5 text-white shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-800">Resumen Comercial 1</h1>
              <p className="text-[11px] text-zinc-500">Indicadores resumidos del seguimiento comercial para auxiliar comercial.</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">{total}</span>
          </div>
          <CommercialModuleTabs activeTab={activeModuleTab} onTabChange={onModuleTabChange} className="shrink-0" />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <TrendingUp className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Recargar</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard title="TOTAL REGISTROS" value={String(total)} subtitle="Registros visibles en seguimiento comercial" tone="blue" />
          <StatCard title="COTIZACIÓN ENVIADA" value={String(summary.sentQuotes)} subtitle="Registros con estado de cotización enviada" tone="emerald" />
          <StatCard title="VENTA" value={String(summary.sales)} subtitle="Registros cerrados como venta" tone="violet" />
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-slate-900">
            <Users className="h-4 w-4" />
            <h3 className="text-sm font-black uppercase tracking-wide">Categorías del resumen</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                  <th className="w-[280px] border-r border-slate-200 px-3 py-2.5 text-left font-bold uppercase">Descripción</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-right font-bold uppercase">Cantidad</th>
                  <th className="px-3 py-2.5 text-right font-bold uppercase">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {summary.byCategory.map((item, index) => (
                  <tr key={item.category} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80">
                    <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">{item.category}</td>
                    <td className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">{item.count}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">Categoría {index + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
