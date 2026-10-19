"use client"

import React, { useMemo, useState } from "react"
import { BarChart3, Download, FileCheck2, FileSpreadsheet, RefreshCw, ShoppingCart, TrendingUp, Users } from "lucide-react"
import { toast } from "sonner"

import { useSeguimientoComercial, fetchWithAuth, type SeguimientoRow } from "@/hooks/use-seguimiento-comercial"
import { useSeguimientoComercial2 } from "@/hooks/use-seguimiento-comercial-2"
import { CommercialModuleTabs, type CommercialModuleTab } from "@/components/commercial-module-tabs"
import { useCurrentUser } from "@/hooks/use-current-user"

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
  if (!normalized || normalized === "-") return false
  // Excluir placeholders de fecha ingresados provisionalmente por los asesores (ej: 04/08, 02/06, 04-08)
  if (/^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(normalized)) return false
  return true
}

function toIsoDatePart(value: unknown): string | null {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (iso) {
    const year = iso[1]
    const month = iso[2].padStart(2, "0")
    const day = iso[3].padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const slash = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/)
  if (slash) {
    const day = slash[1].padStart(2, "0")
    const month = slash[2].padStart(2, "0")
    const numericYear = Number.parseInt(slash[3], 10)
    const year = slash[3].length === 2 ? 2000 + numericYear : numericYear
    return `${year}-${month}-${day}`
  }

  return null
}

function getRowAmount(row: SeguimientoRow & Record<string, unknown>): number {
  return parseMoney(
    row.costo_cotiz_sin_igv ?? row.monto ?? row.costo ?? row.costo_cotizacion
  )
}

function getRowDate(row: SeguimientoRow & { created_at?: unknown }): string | null {
  return (
    toIsoDatePart(row.fecha_contacto) ||
    toIsoDatePart(row.fecha_ultimo_contacto) ||
    toIsoDatePart(row.fecha_creacion) ||
    toIsoDatePart(row.created_at)
  )
}

function getMonthYearFromRows(rows: SeguimientoRow[]) {
  const latest = rows
    .map((row) => getRowDate(row))
    .filter((datePart): datePart is string => Boolean(datePart))
    .sort()
    .at(-1)

  if (!latest) return null

  return {
    month: latest.slice(5, 7),
    year: Number.parseInt(latest.slice(0, 4), 10),
  }
}

/**
 * Cotización enviada se alimenta del patrón: Fecha de contacto + costo sin IGV + categoría cliente.
 */
function isSentQuote(_row: SeguimientoRow) {
  return true
}

function isSale(row: SeguimientoRow) {
  const estadoSegNorm = normalizeText(row.estado_seguimiento)
  return estadoSegNorm === "VENTA"
}

function resolveSeguimientoCategory(row: SeguimientoRow): CategoryKey | null {
  // 1. Strict priority for explicit categoria_cliente / categoria_servicio selection
  const explicitCategory = normalizeText(
    `${row.categoria_cliente ?? ""} ${row.categoria_servicio ?? ""}`
  )

  if (explicitCategory) {
    if (explicitCategory.includes("CATEGORIA 1") || /\bDEN\b/.test(explicitCategory)) {
      return "DEN"
    }
    if (explicitCategory.includes("CATEGORIA 2") || /\bPROB\b/.test(explicitCategory)) {
      return "PROB"
    }
    if (explicitCategory.includes("CATEGORIA 3") || /\bEMS\b/.test(explicitCategory)) {
      return "EMS"
    }
    if (explicitCategory.includes("CATEGORIA 4") || /\bALQ\b/.test(explicitCategory)) {
      return "ALQ"
    }
    if (explicitCategory.includes("CATEGORIA 5") || /\bENS\s*\.?\s*V\.?\b/.test(explicitCategory)) {
      return "ENS.V."
    }
  }

  // 2. Fallback only if no explicit category is assigned
  const serviceText = normalizeText(row.servicio_solicitado ?? "")
  if (!serviceText) return null

  if (/DENSIDA|DENSIME|\bDEN\b/.test(serviceText)) {
    return "DEN"
  }
  if (/PROBETA|ROTURA.*PROB|COMPRESION.*PROB|\bPROB\b/.test(serviceText)) {
    return "PROB"
  }
  if (/ESTUDIO.*SUELO|ENSAYO.*SUELO|SUELOS|\bEMS\b/.test(serviceText)) {
    return "EMS"
  }
  if (/ALQUILER|\bALQ\b/.test(serviceText)) {
    return "ALQ"
  }
  if (/ENSAYO|MEZCLA|AGREGADO|LADRILLO|CORTE DIRECTO|PROCTOR|BLOQUE|ROCA|LABORATORIO|\bENS\s*\.?\s*V\.?\b/.test(serviceText)) {
    return "ENS.V."
  }

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
    const datePart = getRowDate(row)
    return datePart !== null && datePart >= startDate && datePart < endDate
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
    const datePart = getRowDate(row)
    const day = Number.parseInt(datePart?.slice(8, 10) ?? "", 10)
    const weekIndex = Number.isInteger(day) && day > 0 ? Math.min(3, Math.floor((day - 1) / 7)) : null
    const sale = isSale(row)

    if (weekIndex !== null) {
      if (hasQuoteNumber(row.numero_cotizacion)) weeklyLeads[weekIndex] += 1
      if (sale) weeklyNewClients[weekIndex] += 1
    }

    const category = resolveSeguimientoCategory(row)
    if (!category) continue
    const amount = getRowAmount(row)
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
        <table className="min-w-230 w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <th rowSpan={2} className="w-52.5 border-r border-slate-200 px-3 py-2 text-left font-bold uppercase">
                Descripción
              </th>
              <th colSpan={4} className="border-r border-slate-200 px-3 py-2 text-center font-bold uppercase">
                Monto (S/.)
              </th>
              <th rowSpan={2} className="w-31.25 border-r border-slate-200 px-3 py-2 text-right font-bold uppercase">
                Total parcial (S/.)
              </th>
              <th rowSpan={2} className="w-27.5 px-3 py-2 text-right font-bold uppercase">
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
  const totalLeads = data.leads.reduce((sum, v) => sum + v, 0)
  const totalNewClients = data.newClients.reduce((sum, v) => sum + v, 0)
  const totalClientsSum = totalLeads + totalNewClients
  const overallConversion = totalLeads > 0 ? Math.round((totalNewClients / totalLeads) * 100) : 0

  const leadsPct = totalClientsSum > 0 ? Math.round((totalLeads / totalClientsSum) * 100) : 0
  const newClientsPct = totalClientsSum > 0 ? Math.round((totalNewClients / totalClientsSum) * 100) : 0

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-3 text-violet-900">
        <Users className="h-4 w-4" />
        <h3 className="text-sm font-black uppercase tracking-wide">Número de clientes</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-230 w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <th className="w-52.5 border-r border-slate-200 px-3 py-2.5 text-left font-bold uppercase">Descripción</th>
              {data.weekLabels.map((week) => (
                <th key={week} className="border-r border-slate-200 px-3 py-2.5 text-right font-bold uppercase">
                  {week}
                </th>
              ))}
              <th className="w-31.25 border-r border-slate-200 px-3 py-2.5 text-right font-bold uppercase text-slate-900">
                Total parcial
              </th>
              <th className="w-27.5 px-3 py-2.5 text-right font-bold uppercase text-slate-900">
                Monto parcial (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows rows={3} columns={7} />
            ) : (
              <>
                <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">LEADS</td>
                  {data.leads.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {countFormatter.format(value)}
                    </td>
                  ))}
                  <td className="border-r border-slate-200 px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">
                    {countFormatter.format(totalLeads)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-700">
                    {leadsPct}%
                  </td>
                </tr>
                <tr className="border-b border-slate-200 hover:bg-slate-50/80">
                  <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">CLIENTE NUEVOS</td>
                  {data.newClients.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {countFormatter.format(value)}
                    </td>
                  ))}
                  <td className="border-r border-slate-200 px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">
                    {countFormatter.format(totalNewClients)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-700">
                    {newClientsPct}%
                  </td>
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
                  <td className="border-r border-violet-200 px-3 py-3 text-right font-mono text-sm tabular-nums text-violet-950">
                    {overallConversion}%
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-violet-950">
                    {overallConversion}%
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export type AdvisorFilter = "ALL" | "SILVIA" | "ROSSY" | "SERGIO"

function matchesAdvisor(
  row: SeguimientoRow & { _sourceTable?: 1 | 2 },
  advisor: "SILVIA" | "ROSSY" | "SERGIO"
): boolean {
  const aName = (row.asesor || "").toLowerCase().trim()
  const cPor = (row.creado_por || "").toLowerCase().trim()
  const aMail = (row.asesor_email || "").toLowerCase().trim()

  if (advisor === "SERGIO") {
    return (
      aName.includes("sergio") ||
      cPor.includes("ejecutivocomercial3") ||
      cPor.includes("asesorcomercial3") ||
      aMail.includes("ejecutivocomercial3") ||
      aMail.includes("asesorcomercial3")
    )
  }

  if (advisor === "ROSSY") {
    return (
      aName.includes("rossy") ||
      cPor.includes("ejecutivocomercial2") ||
      cPor.includes("asesorcomercial2") ||
      aMail.includes("ejecutivocomercial2") ||
      aMail.includes("asesorcomercial2")
    )
  }

  if (advisor === "SILVIA") {
    if (
      aName.includes("sergio") ||
      cPor.includes("ejecutivocomercial3") ||
      cPor.includes("asesorcomercial3") ||
      aName.includes("rossy") ||
      cPor.includes("ejecutivocomercial2") ||
      cPor.includes("asesorcomercial2")
    ) {
      return false
    }

    return (
      aName.includes("silvia") ||
      aName.includes("yerly") ||
      aName.includes("speralta") ||
      cPor.includes("asesorcomercial@") ||
      cPor.includes("asesorcomercial1") ||
      aMail.includes("asesorcomercial@") ||
      aMail.includes("asesorcomercial1") ||
      row._sourceTable === 1
    )
  }

  return false
}

function calculateWeeklyLeadsByAdvisor(
  rows: (SeguimientoRow & { _sourceTable?: 1 | 2 })[],
  selectedMonth: string,
  selectedYear: number
) {
  const month = Number.parseInt(selectedMonth, 10)
  const startDate = `${selectedYear}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? selectedYear + 1 : selectedYear
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const silvia: [number, number, number, number] = [0, 0, 0, 0]
  const rossy: [number, number, number, number] = [0, 0, 0, 0]
  const sergio: [number, number, number, number] = [0, 0, 0, 0]

  for (const row of rows) {
    const datePart = getRowDate(row)
    if (!datePart || datePart < startDate || datePart >= endDate) continue
    if (!hasQuoteNumber(row.numero_cotizacion)) continue

    const day = Number.parseInt(datePart.slice(8, 10), 10)
    const weekIndex = Number.isInteger(day) && day > 0 ? Math.min(3, Math.floor((day - 1) / 7)) : null
    if (weekIndex === null) continue

    if (matchesAdvisor(row, "SERGIO")) {
      sergio[weekIndex] += 1
    } else if (matchesAdvisor(row, "ROSSY")) {
      rossy[weekIndex] += 1
    } else if (matchesAdvisor(row, "SILVIA")) {
      silvia[weekIndex] += 1
    }
  }

  return { silvia, rossy, sergio }
}

function LeadsAssignmentTable({
  leads,
  loading,
  selectedAdvisor,
  onSelectAdvisor,
  onExport,
  isExporting,
}: {
  leads: {
    silvia: [number, number, number, number]
    rossy: [number, number, number, number]
    sergio: [number, number, number, number]
  }
  loading: boolean
  selectedAdvisor: AdvisorFilter
  onSelectAdvisor: (advisor: AdvisorFilter) => void
  onExport: () => void
  isExporting: boolean
}) {
  const totSilvia = leads.silvia.reduce((a, b) => a + b, 0)
  const totRossy = leads.rossy.reduce((a, b) => a + b, 0)
  const totSergio = leads.sergio.reduce((a, b) => a + b, 0)

  const totS1 = leads.silvia[0] + leads.rossy[0] + leads.sergio[0]
  const totS2 = leads.silvia[1] + leads.rossy[1] + leads.sergio[1]
  const totS3 = leads.silvia[2] + leads.rossy[2] + leads.sergio[2]
  const totS4 = leads.silvia[3] + leads.rossy[3] + leads.sergio[3]
  const totOverall = totS1 + totS2 + totS3 + totS4

  const advisors = [
    { key: "SILVIA" as const, name: "Silvia", weekly: leads.silvia, total: totSilvia },
    { key: "ROSSY" as const, name: "Rossy", weekly: leads.rossy, total: totRossy },
    { key: "SERGIO" as const, name: "Sergio", weekly: leads.sergio, total: totSergio },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Resumen de Asignación de Leads y Metas
          </h3>
        </div>
        <button
          onClick={onExport}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          title="Descargar archivo Excel oficial con formato de metas y leads"
        >
          {isExporting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span>{isExporting ? "Generando Excel..." : "Exportar Metas (Excel)"}</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-230 w-full text-xs border-collapse">
          <thead>
            {/* Banner superior idéntico a la imagen */}
            <tr className="bg-[#d9d9d9] text-slate-900 border-b border-slate-400">
              <th
                colSpan={7}
                className="px-4 py-2 text-center text-xs font-black uppercase tracking-wide border border-slate-400"
              >
                Cuadro de resumen de asignación de Leads
              </th>
            </tr>
            {/* Cabecera azul marino idéntica a la imagen */}
            <tr className="bg-[#003366] text-white">
              <th className="w-48 border border-slate-400 px-3 py-2 text-left font-bold uppercase">
                Acciones
              </th>
              <th className="w-36 border border-slate-400 px-3 py-2 text-center font-bold uppercase">
                Meta
              </th>
              <th className="w-28 border border-slate-400 px-3 py-2 text-center font-bold uppercase">
                Semana 1
              </th>
              <th className="w-28 border border-slate-400 px-3 py-2 text-center font-bold uppercase">
                Semana 2
              </th>
              <th className="w-28 border border-slate-400 px-3 py-2 text-center font-bold uppercase">
                Semana 3
              </th>
              <th className="w-28 border border-slate-400 px-3 py-2 text-center font-bold uppercase">
                Semana 4
              </th>
              <th className="w-28 border border-slate-400 px-3 py-2 text-center font-bold uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows rows={4} columns={7} />
            ) : (
              <>
                {advisors.map((adv) => {
                  const isSelected = selectedAdvisor === adv.key
                  return (
                    <tr
                      key={adv.key}
                      onClick={() => onSelectAdvisor(isSelected ? "ALL" : adv.key)}
                      className={`cursor-pointer border-b border-slate-200 transition-colors ${
                        isSelected
                          ? "bg-blue-50/90 font-semibold"
                          : "hover:bg-slate-50/80"
                      }`}
                      title={`Clic para filtrar las tablas inferiores por ${adv.name}`}
                    >
                      <td className="border border-slate-300 px-3 py-2.5 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{adv.name}</span>
                          {isSelected && (
                            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                              Filtrado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border border-slate-300 px-3 py-2.5 text-center font-mono text-slate-400">
                        {/* Vacío según requerimiento para llenado manual en Excel */}
                        -
                      </td>
                      {adv.weekly.map((val, idx) => (
                        <td
                          key={idx}
                          className="border border-slate-300 px-3 py-2.5 text-center font-mono tabular-nums text-slate-800"
                        >
                          {val > 0 ? val : ""}
                        </td>
                      ))}
                      <td className="border border-slate-300 px-3 py-2.5 text-center font-mono font-bold tabular-nums text-slate-900">
                        {adv.total > 0 ? adv.total : ""}
                      </td>
                    </tr>
                  )
                })}

                {/* Total mes idéntico a la imagen */}
                <tr className="bg-[#d9d9d9] font-black text-slate-900 border-t-2 border-b-4 border-slate-600">
                  <td className="border border-slate-400 px-3 py-2.5 font-black">
                    Total mes
                  </td>
                  <td className="border border-slate-400 px-3 py-2.5 text-center font-mono text-slate-400">
                    -
                  </td>
                  <td className="border border-slate-400 px-3 py-2.5 text-center font-mono tabular-nums">
                    {totS1}
                  </td>
                  <td className="border border-slate-400 px-3 py-2.5 text-center font-mono tabular-nums">
                    {totS2}
                  </td>
                  <td className="border border-slate-400 px-3 py-2.5 text-center font-mono tabular-nums">
                    {totS3}
                  </td>
                  <td className="border border-slate-400 px-3 py-2.5 text-center font-mono tabular-nums">
                    {totS4}
                  </td>
                  <td className="border border-slate-400 px-3 py-2.5 text-center font-mono tabular-nums">
                    {totOverall}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

interface PeriodOption {
  value: string
  label: string
  month: string
  year: number
}

function generateAvailablePeriods(): PeriodOption[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const periods: PeriodOption[] = []

  for (let year = currentYear; year >= currentYear - 2; year--) {
    const startMonth = year === currentYear ? currentMonth : 12
    const endMonth = 1
    for (let m = startMonth; m >= endMonth; m--) {
      periods.push({
        value: `${year}-${String(m).padStart(2, "0")}`,
        label: `${MONTH_NAMES[m - 1]} ${year}`,
        month: String(m).padStart(2, "0"),
        year,
      })
    }
  }

  return periods
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
  canViewLab = true,
  canViewCom = true,
  canViewKpis = true,
  canViewTabla1 = true,
  canViewTabla2 = true,
  canViewTabla3 = true,
  canViewPublicidad = true,
}: {
  activeModuleTab: CommercialModuleTab
  onModuleTabChange: (tab: CommercialModuleTab) => void
  canViewLab?: boolean
  canViewCom?: boolean
  canViewKpis?: boolean
  canViewTabla1?: boolean
  canViewTabla2?: boolean
  canViewTabla3?: boolean
  canViewPublicidad?: boolean
}) {
  const current = getCurrentMonthYear()
  const { role, email, displayName, loading: userLoading, isAdminFromUrl } = useCurrentUser()
  const normalizedRole = (role || "").toLowerCase()
  const normalizedEmail = (email || "").toLowerCase()

  // isAdminFromUrl: set synchronously by the parent shell (crm-geofal) via ?isAdmin=true URL param.
  // Falls back to role-based check once the DB fetch completes.
  const isAdmin = useMemo(() => {
    if (isAdminFromUrl) return true // immediate — no async wait
    if (userLoading) return false   // safe default until role loads
    return (
      normalizedRole.includes("admin") ||
      normalizedRole.includes("gerencia") ||
      normalizedRole.includes("administrador")
    )
  }, [isAdminFromUrl, userLoading, normalizedRole])

  // Detect Yerly-Silvia team by email/displayName.
  // Any other user uses their own displayName or email local part as scope.
  const resolvedAdvisorScope = useMemo(() => {
    if (isAdmin || userLoading) return undefined
    const nameHint = (displayName || "").toLowerCase()
    const emailHint = normalizedEmail
    // Yerly is Silvia's assistant → shares Silvia's scope
    if (nameHint.includes("yerly") || emailHint.includes("asesorcomercial1")) {
      return "Silvia Peralta"
    }
    // Silvia herself
    if (nameHint.includes("silvia") || emailHint.includes("asesorcomercial@")) {
      return "Silvia Peralta"
    }
    // Other advisors: use their display name if available, else undefined (backend resolves via JWT)
    return displayName || undefined
  }, [isAdmin, userLoading, displayName, normalizedEmail])

  // Label shown in the locked badge for non-admin users
  const scopeBadgeLabel = useMemo(() => {
    if (!resolvedAdvisorScope) return "Cargando..."
    const nameHint = (displayName || "").toLowerCase()
    const emailHint = normalizedEmail
    if (nameHint.includes("yerly") || emailHint.includes("asesorcomercial1")) {
      return "Equipo Comercial — Asesora Senior"
    }
    return resolvedAdvisorScope
  }, [resolvedAdvisorScope, displayName, normalizedEmail])

  const [selectedPeriod, setSelectedPeriod] = useState<{ month: string; year: number } | null>(null)
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorFilter>("ALL")
  const [isExporting, setIsExporting] = useState(false)

  const tracker1 = useSeguimientoComercial({
    limit: 10000,
  })

  const tracker2 = useSeguimientoComercial2({
    limit: 10000,
  })

  // Tag rows with their source table for accurate team assignment
  const allTaggedRows = useMemo(() => {
    const t1 = tracker1.rows.map((r) => ({ ...r, _sourceTable: 1 as const }))
    const t2 = tracker2.rows.map((r) => ({ ...r, _sourceTable: 2 as const }))
    return [...t1, ...t2]
  }, [tracker1.rows, tracker2.rows])

  const isLoading = tracker1.isLoading || tracker2.isLoading
  const errorMessage = tracker1.errorMessage || tracker2.errorMessage
  const refetch = () => {
    tracker1.refetch()
    tracker2.refetch()
  }

  const availablePeriods = useMemo(() => generateAvailablePeriods(), [])
  const latestPeriod = useMemo(() => getMonthYearFromRows(allTaggedRows), [allTaggedRows])
  const activePeriod = selectedPeriod ?? latestPeriod ?? current
  const activeValue = `${activePeriod.year}-${String(activePeriod.month).padStart(2, "0")}`

  const weeklyLeadsByAdvisor = useMemo(
    () => calculateWeeklyLeadsByAdvisor(allTaggedRows, activePeriod.month, activePeriod.year),
    [allTaggedRows, activePeriod.month, activePeriod.year]
  )

  const filteredRowsForKpis = useMemo(() => {
    if (!isAdmin) {
      const scope = (resolvedAdvisorScope || "").toLowerCase()
      if (scope.includes("silvia") || scope.includes("yerly") || scope.includes("asesorcomercial1")) {
        return allTaggedRows.filter((r) => matchesAdvisor(r, "SILVIA"))
      }
      if (scope.includes("rossy")) {
        return allTaggedRows.filter((r) => matchesAdvisor(r, "ROSSY"))
      }
      if (scope.includes("sergio")) {
        return allTaggedRows.filter((r) => matchesAdvisor(r, "SERGIO"))
      }
      return canViewTabla1 ? tracker1.rows : tracker2.rows
    }

    if (selectedAdvisor === "SILVIA") {
      return allTaggedRows.filter((r) => matchesAdvisor(r, "SILVIA"))
    }
    if (selectedAdvisor === "ROSSY") {
      return allTaggedRows.filter((r) => matchesAdvisor(r, "ROSSY"))
    }
    if (selectedAdvisor === "SERGIO") {
      return allTaggedRows.filter((r) => matchesAdvisor(r, "SERGIO"))
    }
    return allTaggedRows
  }, [isAdmin, resolvedAdvisorScope, selectedAdvisor, allTaggedRows, canViewTabla1, tracker1.rows, tracker2.rows])

  const kpis = useMemo(
    () => buildKpis(filteredRowsForKpis, activePeriod.month, activePeriod.year),
    [filteredRowsForKpis, activePeriod.month, activePeriod.year]
  )

  const fuenteLabel = useMemo(() => {
    if (!isAdmin) {
      return `Ámbito: ${scopeBadgeLabel}`
    }
    if (selectedAdvisor === "SILVIA") return "Asesor: Silvia Peralta"
    if (selectedAdvisor === "ROSSY") return "Asesora: Rossy Prado"
    if (selectedAdvisor === "SERGIO") return "Asesor: Sergio Diaz"
    return "Ámbito: Consolidado General (Todos)"
  }, [isAdmin, selectedAdvisor, scopeBadgeLabel])

  const handleExportMetasExcel = async () => {
    try {
      setIsExporting(true)
      const params = new URLSearchParams({
        mes: String(Number.parseInt(activePeriod.month, 10)),
        anio: String(activePeriod.year),
        s1_silvia: String(weeklyLeadsByAdvisor.silvia[0]),
        s2_silvia: String(weeklyLeadsByAdvisor.silvia[1]),
        s3_silvia: String(weeklyLeadsByAdvisor.silvia[2]),
        s4_silvia: String(weeklyLeadsByAdvisor.silvia[3]),
        s1_rossy: String(weeklyLeadsByAdvisor.rossy[0]),
        s2_rossy: String(weeklyLeadsByAdvisor.rossy[1]),
        s3_rossy: String(weeklyLeadsByAdvisor.rossy[2]),
        s4_rossy: String(weeklyLeadsByAdvisor.rossy[3]),
        s1_sergio: String(weeklyLeadsByAdvisor.sergio[0]),
        s2_sergio: String(weeklyLeadsByAdvisor.sergio[1]),
        s3_sergio: String(weeklyLeadsByAdvisor.sergio[2]),
        s4_sergio: String(weeklyLeadsByAdvisor.sergio[3]),
      })

      const res = await fetchWithAuth(`/api/seguimiento-comercial/export-kpi-metas?${params.toString()}`)
      const blob = await (res as Response).blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Resumen_Metas_Leads_${activePeriod.month}_${activePeriod.year}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Excel de metas y leads exportado exitosamente")
    } catch (err) {
      console.error("Export error:", err)
      toast.error("Error al exportar metas de leads")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-50">
      <div className="z-10 flex min-h-14 h-auto md:h-14 shrink-0 flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 border-b border-zinc-200 bg-white px-4 py-2 md:py-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 md:gap-4 min-w-0">
          <div className="flex w-116.5 max-w-full items-center gap-2">
            <div className="rounded-md bg-blue-600 p-1.5 text-white shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-800">
                {isAdmin ? "Resumen en KPIs" : "KPI Comercial Personal"}
              </h1>
              <p className="truncate text-[11px] text-zinc-500">Cotizaciones enviadas, ventas y conversión semanal por categoría de cliente.</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">{filteredRowsForKpis.length}</span>
          </div>
          <CommercialModuleTabs
            activeTab={activeModuleTab}
            onTabChange={onModuleTabChange}
            className="min-w-0 flex-1"
            isAdmin={isAdmin}
            canViewLab={canViewLab}
            canViewCom={canViewCom}
            canViewKpis={canViewKpis}
            canViewTabla1={canViewTabla1}
            canViewTabla2={canViewTabla2}
            canViewTabla3={canViewTabla3}
            canViewPublicidad={canViewPublicidad}
          />
        </div>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <select
              value={selectedAdvisor}
              onChange={(event) => setSelectedAdvisor(event.target.value as AdvisorFilter)}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md focus:border-blue-400 focus:ring-2 focus:ring-blue-100 active:translate-y-0"
            >
              <option value="ALL">Consolidado General (Todos)</option>
              <option value="SILVIA">Silvia</option>
              <option value="ROSSY">Rossy</option>
              <option value="SERGIO">Sergio</option>
            </select>
          ) : (
            <div className="flex h-9 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/90 px-3 text-xs font-semibold text-blue-800 shadow-sm">
              <span>📌 Ámbito: {scopeBadgeLabel}</span>
            </div>
          )}

          <select
            value={activeValue}
            onChange={(event) => {
              const selected = availablePeriods.find((p) => p.value === event.target.value)
              if (selected) {
                setSelectedPeriod({ month: selected.month, year: selected.year })
              }
            }}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md focus:border-blue-400 focus:ring-2 focus:ring-blue-100 active:translate-y-0"
          >
            {availablePeriods.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-5">
        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-950">KPI Comercial Personal</h3>
              <p className="mt-1 text-sm text-muted-foreground">Cotizaciones enviadas, ventas y conversión semanal por categoría de cliente.</p>
            </div>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
              {fuenteLabel}
            </span>
          </div>

          {/* Cuadro de resumen de asignación de Leads con Exportable Excel (Idéntico a la plantilla) */}
          <LeadsAssignmentTable
            leads={weeklyLeadsByAdvisor}
            loading={isLoading}
            selectedAdvisor={selectedAdvisor}
            onSelectAdvisor={setSelectedAdvisor}
            onExport={handleExportMetasExcel}
            isExporting={isExporting}
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            <span className="font-bold text-slate-800">Reglas:</span>{" "}
            <span className="text-blue-700 font-semibold">Cotización enviada</span>: Fecha de contacto + costo sin IGV + categoría cliente.{" "}
            <span className="text-emerald-700 font-semibold">Venta</span>: Estado <strong>seguimiento</strong> = <em>&quot;Venta&quot;</em> (columna exclusiva).{" "}
            Leads = registros con número de cotización. Clientes nuevos = registros en Venta.
          </div>
          <AmountTable title="Cotización enviada" data={kpis.quoteSent} weekLabels={kpis.weekLabels} loading={isLoading} tone="blue" />
          <AmountTable title="Venta" data={kpis.sales} weekLabels={kpis.weekLabels} loading={isLoading} tone="emerald" />
          <ClientsTable data={kpis} loading={isLoading} />
        </section>
      </div>
    </div>
  )
}

