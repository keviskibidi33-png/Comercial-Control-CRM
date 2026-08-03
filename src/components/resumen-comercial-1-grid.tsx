"use client"

import React, { useMemo, useState } from "react"
import { BarChart3, FileCheck2, RefreshCw, ShoppingCart, TrendingUp, Users } from "lucide-react"

import { useSeguimientoComercial, type SeguimientoRow } from "@/hooks/use-seguimiento-comercial"
import { CommercialModuleTabs, type CommercialModuleTab } from "@/components/commercial-module-tabs"

const CATEGORY_DEFINITIONS = [
  { key: "DEN", label: "Categoría 1 (DEN)" },
  { key: "PROB", label: "Categoría 2 (PROB)" },
  { key: "EMS", label: "Categoría 3 (EMS)" },
  { key: "ALQ", label: "Categoría 4 (ALQ)" },
  { key: "ENS.V.", label: "Categoría 5 (ENS.V.)" },
] as const

type CategoryKey = (typeof CATEGORY_DEFINITIONS)[number]["key"]
type CommercialWeeklyAmounts = [number, number, number, number]

interface CommercialTrackingCategory {
  key: CategoryKey
  label: string
  weeklyAmounts: CommercialWeeklyAmounts
  total: number
  percentage: number
}

interface CommercialTrackingAmountGroup {
  weeklyTotals: CommercialWeeklyAmounts
  categories: CommercialTrackingCategory[]
  total: number
}

interface CommercialTrackingKpis {
  weekLabels: [string, string, string, string]
  quoteSent: CommercialTrackingAmountGroup
  sales: CommercialTrackingAmountGroup
  leads: CommercialWeeklyAmounts
  newClients: CommercialWeeklyAmounts
  conversionRates: CommercialWeeklyAmounts
}

const moneyFormatter = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const countFormatter = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 0,
})

function emptyWeeklyAmounts(): CommercialWeeklyAmounts {
  return [0, 0, 0, 0]
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function parseMoney(value: unknown) {
  const raw = String(value ?? "").trim().replace(/[^0-9.,-]/g, "")
  if (!raw) return 0

  const sign = raw.startsWith("-") ? -1 : 1
  const unsigned = raw.replace(/-/g, "")
  let normalized = unsigned

  if (/^\d{1,3}(?:\.\d{3})+\.\d{1,2}$/.test(unsigned)) {
    normalized = String(Number(unsigned.replace(/\./g, "")) / 100)
  } else if (/^\d{1,3}(?:,\d{3})+,\d{1,2}$/.test(unsigned)) {
    normalized = String(Number(unsigned.replace(/,/g, "")) / 100)
  } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(unsigned)) {
    normalized = unsigned.replace(/,/g, "")
  } else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(unsigned)) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".")
  } else if (/^\d+[.,]\d{1,2}$/.test(unsigned)) {
    normalized = unsigned.replace(",", ".")
  } else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(unsigned)) {
    normalized = unsigned.replace(/[.,]/g, "")
  }

  const parsed = Number.parseFloat(normalized) * sign
  return Number.isFinite(parsed) ? parsed : 0
}

function calcPercentage(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 10_000) / 100
}

function hasQuoteNumber(value: unknown) {
  const normalized = normalizeText(value)
  return normalized !== "" && normalized !== "-"
}

function isSentQuote(row: SeguimientoRow) {
  return normalizeText(row.estado_cliente).includes("COTIZACION ENVIADA")
    && hasQuoteNumber(row.numero_cotizacion)
}

function isSale(row: SeguimientoRow) {
  return normalizeText(row.estado_seguimiento).includes("VENTA")
}

function resolveSeguimientoCategory(row: SeguimientoRow): CategoryKey | null {
  const categoryText = normalizeText(`${row.categoria_servicio ?? ""} ${row.servicio_solicitado ?? ""}`)

  if (/\bENS\s*\.?\s*V\.?\b/.test(categoryText)) return "ENS.V."
  if (/\bPROB\b/.test(categoryText)) return "PROB"
  if (/\bEMS\b/.test(categoryText)) return "EMS"
  if (/\bALQ\b/.test(categoryText)) return "ALQ"
  if (/\bDEN\b/.test(categoryText)) return "DEN"
  return null
}

function buildCommercialGroup(amountsByCategory: Map<CategoryKey, CommercialWeeklyAmounts>): CommercialTrackingAmountGroup {
  const categories = CATEGORY_DEFINITIONS.map((category) => {
    const weeklyAmounts = amountsByCategory.get(category.key) ?? emptyWeeklyAmounts()
    const total = weeklyAmounts.reduce((sum, amount) => sum + amount, 0)
    return {
      key: category.key,
      label: category.label,
      weeklyAmounts,
      total,
      percentage: 0,
    }
  })
  const total = categories.reduce((sum, category) => sum + category.total, 0)
  const weeklyTotals = [0, 1, 2, 3].map((weekIndex) => (
    categories.reduce((sum, category) => sum + category.weeklyAmounts[weekIndex], 0)
  )) as CommercialWeeklyAmounts

  return {
    weeklyTotals,
    categories: categories.map((category) => ({
      ...category,
      percentage: calcPercentage(category.total, total),
    })),
    total,
  }
}

function buildKpis(rows: SeguimientoRow[], selectedMonth: string, selectedYear: number): CommercialTrackingKpis {
  const month = Number.parseInt(selectedMonth, 10)
  const startDate = `${selectedYear}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? selectedYear + 1 : selectedYear
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const seguimientoRows = rows.filter((row) => {
    if (!row.fecha_contacto) return false
    const datePart = String(row.fecha_contacto).split("T")[0]
    return datePart >= startDate && datePart < endDate
  })

  const quoteAmountsByCategory = new Map<CategoryKey, CommercialWeeklyAmounts>(
    CATEGORY_DEFINITIONS.map((category) => [category.key, emptyWeeklyAmounts()]),
  )
  const saleAmountsByCategory = new Map<CategoryKey, CommercialWeeklyAmounts>(
    CATEGORY_DEFINITIONS.map((category) => [category.key, emptyWeeklyAmounts()]),
  )
  const weeklyLeads = emptyWeeklyAmounts()
  const weeklyNewClients = emptyWeeklyAmounts()

  for (const row of seguimientoRows) {
    const datePart = String(row.fecha_contacto).split("T")[0]
    const day = Number.parseInt(datePart.slice(8, 10), 10)
    const weekIndex = Number.isInteger(day) && day > 0 ? Math.min(3, Math.floor((day - 1) / 7)) : null
    const sale = isSale(row)

    if (weekIndex !== null) {
      if (hasQuoteNumber(row.numero_cotizacion)) weeklyLeads[weekIndex] += 1
      if (sale) weeklyNewClients[weekIndex] += 1
    }

    const category = resolveSeguimientoCategory(row)
    if (!category) continue
    const amount = parseMoney(row.costo_cotiz_sin_igv)
    if (weekIndex !== null && amount > 0) {
      if (isSentQuote(row)) quoteAmountsByCategory.get(category)![weekIndex] += amount
      if (sale) saleAmountsByCategory.get(category)![weekIndex] += amount
    }
  }

  const conversionRates = weeklyLeads.map((leads, index) => (
    leads > 0 ? Math.round((weeklyNewClients[index] / leads) * 10_000) / 100 : 0
  )) as CommercialWeeklyAmounts

  return {
    weekLabels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
    quoteSent: buildCommercialGroup(quoteAmountsByCategory),
    sales: buildCommercialGroup(saleAmountsByCategory),
    leads: weeklyLeads,
    newClients: weeklyNewClients,
    conversionRates,
  }
}

function LoadingRows({ rows, columns }: { rows: number; columns: number }) {
  return Array.from({ length: rows }, (_, index) => (
    <tr key={index} className="border-b border-slate-100 last:border-b-0">
      <td colSpan={columns} className="px-4 py-3">
        <div className="h-5 animate-pulse rounded bg-slate-100" />
      </td>
    </tr>
  ))
}

function AmountTable({
  title,
  data,
  weekLabels,
  loading,
  tone,
}: {
  title: string
  data: CommercialTrackingAmountGroup
  weekLabels: CommercialTrackingKpis["weekLabels"]
  loading: boolean
  tone: "blue" | "emerald"
}) {
  const toneClasses = tone === "blue"
    ? "border-blue-200 bg-blue-50 text-blue-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900"

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={`flex items-center gap-2 border-b px-4 py-3 ${toneClasses}`}>
        {tone === "blue" ? <FileCheck2 className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
        <h3 className="text-sm font-black uppercase tracking-wide">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <th rowSpan={2} className="w-[210px] border-r border-slate-200 px-3 py-2 text-left font-bold uppercase">
                Descripción
              </th>
              <th colSpan={4} className="border-r border-slate-200 px-3 py-2 text-center font-bold uppercase">
                Monto (S/.)
              </th>
              <th rowSpan={2} className="w-[125px] border-r border-slate-200 px-3 py-2 text-right font-bold uppercase">
                Total parcial (S/.)
              </th>
              <th rowSpan={2} className="w-[110px] px-3 py-2 text-right font-bold uppercase">
                Monto parcial (%)
              </th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              {weekLabels.map((week) => (
                <th key={week} className="border-r border-slate-200 px-3 py-2 text-right font-semibold last:border-r-0">
                  {week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows rows={6} columns={7} />
            ) : (
              <>
                <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-900">
                  <td className="border-r border-slate-200 px-3 py-2.5">TOTAL SEMANAL</td>
                  {data.weeklyTotals.map((amount, index) => (
                    <td key={weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {moneyFormatter.format(amount)}
                    </td>
                  ))}
                  <td className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                    {moneyFormatter.format(data.total)}
                  </td>
                  <td className="px-3 py-2.5 text-right">{data.total > 0 ? "100%" : "0%"}</td>
                </tr>

                {data.categories.map((category) => (
                  <tr key={category.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80">
                    <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">{category.label}</td>
                    {category.weeklyAmounts.map((amount, index) => (
                      <td key={weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                        {moneyFormatter.format(amount)}
                      </td>
                    ))}
                    <td className="border-r border-slate-200 px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                      {moneyFormatter.format(category.total)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {category.percentage.toLocaleString("es-PE", { maximumFractionDigits: 0 })}%
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ClientsTable({ data, loading }: { data: CommercialTrackingKpis; loading: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-3 text-violet-900">
        <Users className="h-4 w-4" />
        <h3 className="text-sm font-black uppercase tracking-wide">Número de clientes</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <th className="w-[210px] border-r border-slate-200 px-3 py-2.5 text-left font-bold uppercase">Descripción</th>
              {data.weekLabels.map((week) => (
                <th key={week} className="border-r border-slate-200 px-3 py-2.5 text-right font-bold uppercase last:border-r-0">
                  {week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows rows={3} columns={5} />
            ) : (
              <>
                <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">LEADS</td>
                  {data.leads.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {countFormatter.format(value)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-200 hover:bg-slate-50/80">
                  <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">CLIENTE NUEVOS</td>
                  {data.newClients.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {countFormatter.format(value)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-violet-50 font-black text-violet-950">
                  <td className="border-r border-violet-200 px-3 py-3">
                    <span className="inline-flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      KPI TASA CONVERSIÓN %
                    </span>
                  </td>
                  {data.conversionRates.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-violet-200 px-3 py-3 text-right tabular-nums">
                      {value.toLocaleString("es-PE", { maximumFractionDigits: 0 })}%
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function getCurrentMonthYear() {
  const now = new Date()
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: now.getFullYear(),
  }
}

export default function ResumenComercial1Grid({
  activeModuleTab,
  onModuleTabChange,
}: {
  activeModuleTab: CommercialModuleTab
  onModuleTabChange: (tab: CommercialModuleTab) => void
}) {
  const current = getCurrentMonthYear()
  const [selectedMonth, setSelectedMonth] = useState(current.month)
  const [selectedYear, setSelectedYear] = useState(current.year)
  const { rows, total, isLoading, refetch, errorMessage } = useSeguimientoComercial({ limit: 10000 })

  const availableYears = useMemo(() => {
    const years = new Set<number>([current.year])
    rows.forEach((row) => {
      const year = Number.parseInt(String(row.fecha_contacto || "").slice(0, 4), 10)
      if (Number.isInteger(year)) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [rows, current.year])

  const kpis = useMemo(() => buildKpis(rows, selectedMonth, selectedYear), [rows, selectedMonth, selectedYear])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-50">
      <div className="z-10 flex min-h-14 h-auto shrink-0 flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-2 shadow-sm xl:h-14 xl:flex-row xl:items-center xl:justify-between xl:gap-4 xl:py-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 md:gap-4">
          <div className="flex min-w-[260px] items-center gap-2">
            <div className="rounded-md bg-blue-600 p-1.5 text-white shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-800">Resumen Comercial 1</h1>
              <p className="truncate text-[11px] text-zinc-500">Cotizaciones enviadas, ventas y conversión semanal por categoría de cliente.</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">{total}</span>
          </div>
          <CommercialModuleTabs activeTab={activeModuleTab} onTabChange={onModuleTabChange} className="min-w-0 flex-1" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm outline-none transition-colors hover:bg-zinc-50 focus:border-blue-400"
          >
            {Array.from({ length: 12 }, (_, index) => {
              const monthValue = String(index + 1).padStart(2, "0")
              return <option key={monthValue} value={monthValue}>Mes {monthValue}</option>
            })}
          </select>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm outline-none transition-colors hover:bg-zinc-50 focus:border-blue-400"
          >
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Resumen Comercial 1</h3>
              <p className="mt-1 text-sm text-muted-foreground">Cotizaciones enviadas, ventas y conversión semanal por categoría de cliente.</p>
            </div>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Fuente: Seguimiento
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            <span className="font-bold text-slate-800">Reglas:</span> Cotización enviada usa Estado cliente = Cotización enviada, número de cotización y monto válido. Venta usa Estado seguimiento = Venta. Leads cuentan registros con número de cotización y Cliente nuevos los registros en Venta.
          </div>
          <AmountTable title="Cotización enviada" data={kpis.quoteSent} weekLabels={kpis.weekLabels} loading={isLoading} tone="blue" />
          <AmountTable title="Venta" data={kpis.sales} weekLabels={kpis.weekLabels} loading={isLoading} tone="emerald" />
          <ClientsTable data={kpis} loading={isLoading} />
        </section>
      </div>
    </div>
  )
}
