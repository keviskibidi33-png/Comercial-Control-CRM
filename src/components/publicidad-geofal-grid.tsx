"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { usePublicidadGeofal, type PublicidadRow } from "@/hooks/use-publicidad-geofal"
import { CommercialModuleTabs, type CommercialModuleTab } from "@/components/commercial-module-tabs"
import { toast } from "sonner"
import { 
  Plus, 
  FileDown, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  X,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  Copy
} from "lucide-react"

const DEFAULT_GHOST_ROW: Partial<PublicidadRow> = {
  id_cliente: undefined,
  contacto: "",
  telefono: "",
  telefono_2: "",
  correo_referencial: "",
  razon_social_referencial: "",
  junio_asistente: "",
  junio_asesor: "",
  julio_asistente: "",
  julio_asesor: "",
  agosto_asistente: "",
  agosto_asesor: "",
  setiembre_asistente: "",
  setiembre_asesor: "",
  octubre_asistente: "",
  octubre_asesor: "",
  noviembre_asistente: "",
  noviembre_asesor: "",
  diciembre_asistente: "",
  diciembre_asesor: "",
  observacion_1: "",
  observacion_2: ""
}

const STORAGE_KEY = "publicidad-geofal-ui:v1"

type SortDirection = "asc" | "desc"
type SortConfig = {
  key: keyof PublicidadRow
  direction: SortDirection
} | null

export default function PublicidadGeofalGrid({
  activeModuleTab,
  onModuleTabChange,
}: {
  activeModuleTab: CommercialModuleTab
  onModuleTabChange: (tab: CommercialModuleTab) => void
}) {
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(500)
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [uiHydrated, setUiHydrated] = useState(false)
  const [userRole, setUserRole] = useState<string>("")

  // Ghost Row State & Handlers
  const [ghostRow, setGhostRow] = useState<Partial<PublicidadRow>>({ ...DEFAULT_GHOST_ROW })
  const [isGhostSubmitting, setIsGhostSubmitting] = useState(false)
  const [pageErrorMessage, setPageErrorMessage] = useState<string | null>(null)

  // Read role from URL params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      setUserRole(params.get("role") || "auxiliar_comercial")
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setUiHydrated(true)
        return
      }

      const parsed = JSON.parse(raw) as Partial<{
        search: string
        currentPage: number
        pageSize: number
        sortKey: keyof PublicidadRow
        sortDirection: SortDirection
      }>

      if (typeof parsed.search === "string") setSearch(parsed.search)
      if (Number.isInteger(parsed.currentPage) && (parsed.currentPage as number) > 0) setCurrentPage(parsed.currentPage as number)
      if (Number.isInteger(parsed.pageSize) && (parsed.pageSize as number) > 0) setPageSize(parsed.pageSize as number)
      if (parsed.sortKey) {
        setSortConfig({
          key: parsed.sortKey,
          direction: parsed.sortDirection === "desc" ? "desc" : "asc",
        })
      }
    } catch {
      // Ignore
    } finally {
      setUiHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!uiHydrated || typeof window === "undefined") return
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        search,
        currentPage,
        pageSize,
        sortKey: sortConfig?.key ?? null,
        sortDirection: sortConfig?.direction ?? null,
      }),
    )
  }, [search, currentPage, pageSize, sortConfig, uiHydrated])

  const handleGhostChange = (field: keyof PublicidadRow, val: string | number | null) => {
    setGhostRow(prev => ({ ...prev, [field]: val }))
  }

  const submitGhostRow = () => {
    if (isGhostSubmitting) return
    setIsGhostSubmitting(true)
    
    insertRow(ghostRow, {
      onSuccess: () => {
        setGhostRow({ ...DEFAULT_GHOST_ROW })
        setIsGhostSubmitting(false)
        toast.success("Cliente de publicidad agregado")
      },
      onError: () => {
        setIsGhostSubmitting(false)
      }
    })
  }

  const handleGhostKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submitGhostRow()
      return
    }
  }

  // Debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Fetch publicity hook
  const {
    rows,
    total,
    isLoading,
    refetch,
    errorMessage,
    connectionStatus,
    updateCell,
    insertRow,
    exportToExcel,
    isMutating
  } = usePublicidadGeofal({
    search: debouncedSearch,
    limit: 10000,
    offset: 0
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Keep page within boundaries
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [total, totalPages, currentPage])

  const sortedRows = useMemo(() => {
    const baseRows = [...rows]
    if (!sortConfig) return baseRows

    const { key, direction } = sortConfig
    return baseRows.sort((leftRow, rightRow) => {
      const leftVal = leftRow[key] ?? ""
      const rightVal = rightRow[key] ?? ""
      const result = String(leftVal).localeCompare(String(rightVal), "es", { numeric: true, sensitivity: "base" })
      return direction === "asc" ? result : -result
    })
  }, [rows, sortConfig])

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [currentPage, pageSize, sortedRows])

  useEffect(() => {
    setPageErrorMessage(errorMessage || null)
  }, [errorMessage])

  const toggleSort = (field: keyof PublicidadRow) => {
    setCurrentPage(1)
    setSortConfig((current) => {
      if (current?.key !== field) {
        return { key: field, direction: "asc" }
      }
      if (current.direction === "asc") {
        return { key: field, direction: "desc" }
      }
      return null
    })
  }

  // Handle cell edit save
  const handleCellBlur = (id: number, field: keyof PublicidadRow, currentValue: unknown, newValue: unknown) => {
    if (currentValue !== newValue) {
      updateCell(id, field, newValue)
    }
  }

  // Check if a field is editable based on role
  const isFieldEditable = (field: keyof PublicidadRow): boolean => {
    const isAdmin = ["admin", "admin_general", "administrativo"].includes(userRole)
    if (isAdmin) return true

    const isAsistenteField = field.toString().endsWith("_asistente")
    const isAsesorField = field.toString().endsWith("_asesor")

    // Comercial (Advisor/Asesor) edits advisor fields
    if (userRole === "comercial") {
      return isAsesorField || !isAsistenteField
    }

    // Auxiliar (Assistant/Auxiliar) edits assistant fields
    if (userRole === "auxiliar_comercial") {
      return isAsistenteField || !isAsesorField
    }

    return true
  }

  interface GridColumn {
    readonly key: keyof PublicidadRow
    readonly label: string
    readonly width: string
    readonly type?: "text" | "number"
    readonly stickyLeft?: string
    readonly isLastPinned?: boolean
  }

  const COLUMNS: readonly GridColumn[] = [
    { key: "id_cliente", label: "N°", width: "w-12 min-w-[48px] max-w-[48px] text-center", stickyLeft: "0px" },
    { key: "contacto", label: "CONTACTO", width: "w-[180px] min-w-[180px] max-w-[180px]", stickyLeft: "48px" },
    { key: "telefono", label: "TELÉFONO", width: "w-[120px] min-w-[120px] max-w-[120px]", stickyLeft: "228px" },
    { key: "telefono_2", label: "TELÉFONO 2", width: "w-[120px] min-w-[120px] max-w-[120px]", stickyLeft: "348px" },
    { key: "correo_referencial", label: "CORREO REFERENCIAL", width: "w-[180px] min-w-[180px] max-w-[180px]", stickyLeft: "468px" },
    { key: "razon_social_referencial", label: "RAZON SOCIAL REFERENCIAL", width: "w-[220px] min-w-[220px] max-w-[220px]", stickyLeft: "648px", isLastPinned: true },
    
    // Monthly comments
    { key: "junio_asistente", label: "JUNIO (Aux)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    { key: "junio_asesor", label: "JUNIO (Ases)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    
    { key: "julio_asistente", label: "JULIO (Aux)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    { key: "julio_asesor", label: "JULIO (Ases)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    
    { key: "agosto_asistente", label: "AGOSTO (Aux)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    { key: "agosto_asesor", label: "AGOSTO (Ases)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    
    { key: "setiembre_asistente", label: "SETIEMBRE (Aux)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    { key: "setiembre_asesor", label: "SETIEMBRE (Ases)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    
    { key: "octubre_asistente", label: "OCTUBRE (Aux)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    { key: "octubre_asesor", label: "OCTUBRE (Ases)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    
    { key: "noviembre_asistente", label: "NOVIEMBRE (Aux)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    { key: "noviembre_asesor", label: "NOVIEMBRE (Ases)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    
    { key: "diciembre_asistente", label: "DICIEMBRE (Aux)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    { key: "diciembre_asesor", label: "DICIEMBRE (Ases)", width: "w-[140px] min-w-[140px] max-w-[140px]" },
    
    { key: "observacion_1", label: "OBSERVACIÓN 1", width: "w-[150px] min-w-[150px] max-w-[150px]" },
    { key: "observacion_2", label: "OBSERVACIÓN 2", width: "w-[150px] min-w-[150px] max-w-[150px]" }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-50">
      {/* Module Header */}
      <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-600 p-1.5 text-white shadow-sm">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-800">Publicidad Geofal</h1>
              <p className="text-[11px] text-zinc-500">
                Seguimiento de campañas publicitarias y prospección.
              </p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
              {total}
            </span>
          </div>

          <CommercialModuleTabs activeTab={activeModuleTab} onTabChange={onModuleTabChange} className="shrink-0" />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            disabled={isMutating || isLoading || total === 0}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Exportar Excel</span>
          </button>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 shadow-inner"
              title={connectionStatus}
            >
              {connectionStatus === "EN LÍNEA" ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              ) : connectionStatus === "SIN CONEXIÓN" ? (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
              )}
              <span className="hidden text-[10px] font-bold uppercase text-zinc-500 sm:inline">
                {connectionStatus === "CONECTANDO" ? "Conectando" : connectionStatus === "EN LÍNEA" ? "En Línea" : "Sin Conexión"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="flex items-center justify-between p-2 border-b border-zinc-200 bg-white gap-2 z-20 shrink-0 overflow-visible">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Search Input */}
          <div className="relative w-[200px] lg:w-[250px]">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar en publicidad..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="h-8 w-full border border-zinc-200 rounded-md pl-8 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("")
                  setCurrentPage(1)
                }}
                className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {pageErrorMessage && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-800 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span className="font-medium">{pageErrorMessage}</span>
            </div>
            <button
              onClick={() => refetch()}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div className="flex-1 w-full overflow-auto relative select-none bg-zinc-50 min-h-0">
        <table className="min-w-full divide-y divide-zinc-200 table-fixed border-collapse overflow-visible">
          <thead className="bg-white sticky top-0 z-30 border-b border-zinc-200 shadow-sm">
            <tr>
              {COLUMNS.map((col) => {
                const isPinned = col.stickyLeft !== undefined
                const isLastPinned = col.isLastPinned === true
                return (
                  <th
                     key={col.key}
                     scope="col"
                     onClick={() => toggleSort(col.key)}
                     style={isPinned ? { position: "sticky", left: col.stickyLeft, zIndex: 35 } : undefined}
                     className={`
                       ${col.width} px-2 py-2 text-left text-[10.5px] font-bold text-zinc-700 uppercase tracking-wide select-none cursor-pointer bg-[#f4f4f5] hover:bg-zinc-200 transition-colors
                       ${isPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8]" : "shadow-[inset_-1px_0_0_0_#e4e4e7]"}
                       ${isLastPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.15)]" : ""}
                     `}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {sortConfig?.key === col.key && (
                        <span className="text-[10px] text-blue-600">
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-zinc-100 overflow-visible">
            {pagedRows.map((row, idx) => (
              <tr
                key={row.id}
                className={`transition-colors group overflow-visible ${
                  idx % 2 === 0 ? "bg-white hover:bg-sky-100/70" : "bg-sky-100/50 hover:bg-sky-200/50"
                }`}
              >
                {COLUMNS.map((col) => {
                  const cellValue = row[col.key]
                  const isPinned = col.stickyLeft !== undefined
                  const isLastPinned = col.isLastPinned === true
                  const editable = isFieldEditable(col.key)
                  const baseCellClass = `
                    py-0.5 overflow-visible relative ${col.width}
                    ${isPinned ? `sticky z-10 ${idx % 2 === 0 ? "bg-white" : "bg-sky-50"} group-hover:bg-sky-100` : ""}
                    ${isPinned 
                      ? (isLastPinned 
                          ? "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.15)]" 
                          : "shadow-[inset_-1px_0_0_0_#d4d4d8]") 
                      : "shadow-[inset_-1px_0_0_0_#e4e4e7]"}
                  `

                  return (
                    <td
                      key={col.key}
                      style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                      className={`px-1.5 ${baseCellClass}`}
                    >
                      <input
                        type={col.key === "id_cliente" ? "number" : "text"}
                        disabled={!editable}
                        defaultValue={cellValue !== null && cellValue !== undefined ? String(cellValue) : ""}
                        onBlur={(e) => {
                          const val = col.key === "id_cliente" ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value
                          handleCellBlur(row.id, col.key, cellValue, val)
                        }}
                        className={`w-full bg-transparent border-0 rounded px-1.5 py-0.5 text-[11px] text-zinc-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:opacity-80`}
                        title={cellValue !== null && cellValue !== undefined ? String(cellValue) : ""}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            
            {/* Ghost Row for adding new items */}
            <tr className="bg-zinc-50 border-t border-zinc-200">
              {COLUMNS.map((col) => {
                const isPinned = col.stickyLeft !== undefined
                const isLastPinned = col.isLastPinned === true
                const cellValue = ghostRow[col.key]

                if (col.key === "id_cliente") {
                  return (
                    <td
                      key="ghost-id_cliente"
                      style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                      className={`px-1.5 py-1.5 ${col.width} text-center font-mono text-[11px] text-blue-700 select-none font-bold cursor-pointer hover:bg-zinc-200 bg-zinc-100
                        ${isPinned ? "sticky z-10" : ""}
                        ${isLastPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.15)]" : "shadow-[inset_-1px_0_0_0_#d4d4d8]"}
                      `}
                      onClick={submitGhostRow}
                      title="Agregar registro (Enter)"
                    >
                      <Plus className="mx-auto h-3.5 w-3.5" />
                    </td>
                  )
                }

                return (
                  <td
                    key={`ghost-${col.key}`}
                    style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                    className={`px-1.5 py-1.5 ${col.width} bg-zinc-50 shadow-[inset_-1px_0_0_0_#d4d4d8] ${
                      isPinned ? "sticky z-10" : ""
                    } ${
                      isLastPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.15)]" : ""
                    }`}
                  >
                    <input
                      type="text"
                      placeholder="+"
                      value={cellValue !== undefined && cellValue !== null ? String(cellValue) : ""}
                      onChange={(e) => {
                        handleGhostChange(col.key, e.target.value)
                      }}
                      onKeyDown={handleGhostKeyDown}
                      className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[11px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="z-10 flex h-10 shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-4 text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          <span>Total: <b>{total}</b> registros</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="border border-zinc-200 rounded px-1.5 py-0.5 cursor-pointer bg-white"
          >
            {[50, 100, 200, 500, 1000].map((sz) => (
              <option key={sz} value={sz}>
                Mostrar {sz}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2">
            Página <b>{currentPage}</b> de <b>{totalPages}</b>
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
