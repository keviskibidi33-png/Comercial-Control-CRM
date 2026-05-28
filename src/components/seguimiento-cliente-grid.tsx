"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { useSeguimientoComercial, type SeguimientoRow } from "@/hooks/use-seguimiento-comercial"
import { useCurrentUser } from "@/hooks/use-current-user"
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
  RefreshCw
} from "lucide-react"

const DEFAULT_GHOST_ROW: Partial<SeguimientoRow> = {
  fecha_contacto: new Date().toISOString().split("T")[0],
  persona_contacto: "",
  numero_celular: "",
  email: "",
  razon_social: "",
  ruc: "",
  asesor: "",
  contacto: "WHATSAPP",
  rubro: "LABORATORIO",
  estado_cliente: "EN ESPERA DE ATENCIÓN",
  servicio_solicitado: "",
  fecha_ultimo_contacto: "",
  observaciones: "",
  numero_cotizacion: "",
  estado_seguimiento: "Pendiente"
}

const STORAGE_KEY = "seguimiento-comercial-ui:v1"

interface SeguimientoClienteGridProps {
  activeModuleTab: CommercialModuleTab
  onModuleTabChange: (tab: CommercialModuleTab) => void
}

type SortDirection = "asc" | "desc"
type SortConfig = {
  key: keyof SeguimientoRow
  direction: SortDirection
} | null

const getDisplayComment = (value: string | undefined): string => {
  if (!value) return "-"
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const last = parsed[parsed.length - 1]
      return last?.text || "-"
    }
  } catch {
    // If not JSON, it's a legacy comment
  }
  return value
}

export default function SeguimientoClienteGrid({
  activeModuleTab,
  onModuleTabChange,
}: SeguimientoClienteGridProps) {
  const { email } = useCurrentUser()
  const currentUserName = useMemo(() => {
    if (!email) return "Usuario"
    const part = email.split("@")[0]
    return part.charAt(0).toUpperCase() + part.slice(1)
  }, [email])

  // Modal state for comments
  const [commentModalRow, setCommentModalRow] = useState<SeguimientoRow | null>(null)
  const [activeCommentField, setActiveCommentField] = useState<"comentarios_asistente" | "comentarios_asesor" | null>(null)
  const [commentInput, setCommentInput] = useState("")
  const [rowComments, setRowComments] = useState<CommentHistoryEntry[]>([])

  interface CommentHistoryEntry {
    text: string
    timestamp: string
    author: string
  }

  const loadComments = (row: SeguimientoRow, field: "comentarios_asistente" | "comentarios_asesor") => {
    const val = row[field]
    if (!val) return []
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) {
        return parsed as CommentHistoryEntry[]
      }
    } catch (e) {
      // Return single legacy comment
      return [{
        text: val,
        timestamp: "-",
        author: row.creado_por || "Sistema"
      }] as CommentHistoryEntry[]
    }
    return []
  }

  const openCommentsModal = (row: SeguimientoRow, field: "comentarios_asistente" | "comentarios_asesor") => {
    setCommentModalRow(row)
    setActiveCommentField(field)
    const history = loadComments(row, field)
    setRowComments(history)
    setCommentInput("")
  }

  const saveComment = () => {
    if (!commentModalRow || !activeCommentField || !commentInput.trim()) return

    const now = new Date()
    const formattedDate = now.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })
    const formattedTime = now.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
    const timestamp = `${formattedDate} ${formattedTime}`
    const author = currentUserName || "Usuario"

    const newEntry: CommentHistoryEntry = {
      text: commentInput.trim(),
      timestamp,
      author
    }

    const updatedHistory = [...rowComments, newEntry]
    
    setRowComments(updatedHistory)
    setCommentInput("")

    // Update active field directly in database with the serialized JSON array
    updateCell(commentModalRow.id, activeCommentField, JSON.stringify(updatedHistory))

    // Show success toast notification
    toast.success("Comentario guardado correctamente.")
  }

  // Query Filters & Pagination State
  const [search, setSearch] = useState("")
  const [selectedAsesor, setSelectedAsesor] = useState("")
  const [selectedEstado, setSelectedEstado] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(500)
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [uiHydrated, setUiHydrated] = useState(false)

  // Ghost Row State & Handlers
  const [ghostRow, setGhostRow] = useState<Partial<SeguimientoRow>>({ ...DEFAULT_GHOST_ROW })
  const [isGhostSubmitting, setIsGhostSubmitting] = useState(false)

  const [pageErrorMessage, setPageErrorMessage] = useState<string | null>(null)

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
        selectedAsesor: string
        selectedEstado: string
        currentPage: number
        pageSize: number
        sortKey: keyof SeguimientoRow
        sortDirection: SortDirection
      }>

      if (typeof parsed.search === "string") setSearch(parsed.search)
      if (typeof parsed.selectedAsesor === "string") setSelectedAsesor(parsed.selectedAsesor)
      if (typeof parsed.selectedEstado === "string") setSelectedEstado(parsed.selectedEstado)
      if (Number.isInteger(parsed.currentPage) && (parsed.currentPage as number) > 0) setCurrentPage(parsed.currentPage as number)
      if (Number.isInteger(parsed.pageSize) && (parsed.pageSize as number) > 0) setPageSize(parsed.pageSize as number)
      if (parsed.sortKey) {
        setSortConfig({
          key: parsed.sortKey,
          direction: parsed.sortDirection === "desc" ? "desc" : "asc",
        })
      }
    } catch {
      // Ignore malformed persisted state and fall back to defaults.
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
        selectedAsesor,
        selectedEstado,
        currentPage,
        pageSize,
        sortKey: sortConfig?.key ?? null,
        sortDirection: sortConfig?.direction ?? null,
      }),
    )
  }, [search, selectedAsesor, selectedEstado, currentPage, pageSize, sortConfig, uiHydrated])

  // Sync advisor filter with ghost row advisor if filter changes
  useEffect(() => {
    setGhostRow(prev => ({ ...prev, asesor: selectedAsesor || "" }))
  }, [selectedAsesor])

  const handleGhostChange = (field: keyof SeguimientoRow, val: any) => {
    setGhostRow(prev => ({ ...prev, [field]: val }))
  }

  const submitGhostRow = () => {
    if (isGhostSubmitting) return
    setIsGhostSubmitting(true)
    
    insertRow(ghostRow, {
      onSuccess: () => {
        setGhostRow({
          ...DEFAULT_GHOST_ROW,
          asesor: selectedAsesor || ""
        })
        setIsGhostSubmitting(false)
        // Focus first input after query update
        setTimeout(() => {
          const firstInput = document.querySelector(".ghost-input") as HTMLElement
          if (firstInput) {
            firstInput.focus()
          }
        }, 50)
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
    
    if (e.key === " ") {
      const target = e.target as HTMLElement
      const isTextInput = target.tagName === "INPUT" && (target as HTMLInputElement).type === "text"
      
      if (!isTextInput) {
        e.preventDefault()
        const inputs = Array.from(document.querySelectorAll(".ghost-input")) as HTMLElement[]
        const currentIndex = inputs.indexOf(document.activeElement as HTMLElement)
        const nextInput = inputs[currentIndex + 1]
        if (nextInput) {
          nextInput.focus()
          if (nextInput instanceof HTMLInputElement) {
            nextInput.select()
          }
        }
      }
    }
  }

  // Debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1) // Reset to page 1 on search
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  const offset = (currentPage - 1) * pageSize

  // Fetch tracking hook
  const {
    rows,
    total,
    catalogs,
    isLoading,
    refetch,
    errorMessage,
    connectionStatus,
    updateCell,
    insertRow,
    exportToExcel,
    isMutating
  } = useSeguimientoComercial({
    search: debouncedSearch,
    asesor: selectedAsesor,
    estado_cliente: selectedEstado,
    limit: 10000,
    offset: 0
  })

  // Local state for active autocomplete cell
  const [activeCell, setActiveCell] = useState<{ id: number; field: keyof SeguimientoRow } | null>(null)
  const [suggestionQuery, setSuggestionQuery] = useState("")
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  // Close suggestion menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setActiveCell(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Keep page within boundaries if total changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [total, totalPages, currentPage])

  const compareValues = (left: unknown, right: unknown) => {
    const leftValue = left ?? ""
    const rightValue = right ?? ""

    const leftNumber = typeof leftValue === "number" ? leftValue : Number(String(leftValue).replace(/[^0-9.-]/g, ""))
    const rightNumber = typeof rightValue === "number" ? rightValue : Number(String(rightValue).replace(/[^0-9.-]/g, ""))

    const leftLooksNumeric = Number.isFinite(leftNumber) && String(leftValue).trim() !== ""
    const rightLooksNumeric = Number.isFinite(rightNumber) && String(rightValue).trim() !== ""

    if (leftLooksNumeric && rightLooksNumeric) {
      return leftNumber - rightNumber
    }

    const leftDate = Date.parse(String(leftValue))
    const rightDate = Date.parse(String(rightValue))
    const leftLooksDate = Number.isFinite(leftDate) && String(leftValue).includes("-")
    const rightLooksDate = Number.isFinite(rightDate) && String(rightValue).includes("-")

    if (leftLooksDate && rightLooksDate) {
      return leftDate - rightDate
    }

    return String(leftValue).localeCompare(String(rightValue), "es", {
      numeric: true,
      sensitivity: "base",
    })
  }

  const sortedRows = useMemo(() => {
    const baseRows = [...rows]
    if (!sortConfig) return baseRows

    const { key, direction } = sortConfig
    return baseRows.sort((leftRow, rightRow) => {
      const result = compareValues(leftRow[key], rightRow[key])
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

  const toggleSort = (field: keyof SeguimientoRow) => {
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
  const handleCellBlur = (id: number, field: keyof SeguimientoRow, currentValue: any, newValue: any) => {
    if (currentValue !== newValue) {
      updateCell(id, field, newValue)
    }
  }

  // Handles Autocomplete cell keyboard navigation
  const handleAutocompleteKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: number,
    field: keyof SeguimientoRow,
    options: string[]
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusedSuggestionIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (focusedSuggestionIndex >= 0 && focusedSuggestionIndex < options.length) {
        updateCell(id, field, options[focusedSuggestionIndex])
        setActiveCell(null)
      } else {
        // Just save input value on Enter
        updateCell(id, field, e.currentTarget.value)
        setActiveCell(null)
      }
    } else if (e.key === "Escape") {
      setActiveCell(null)
    }
  }

  interface GridColumn {
    readonly key: string
    readonly label: string
    readonly width: string
    readonly type?: "text" | "date" | "catalog"
    readonly catalogKey?: "asesores" | "contactos" | "rubros" | "estados" | "servicios" | "estados_seguimiento"
    readonly stickyLeft?: string
    readonly isLastPinned?: boolean
  }

  // Grid columns definition
  const COLUMNS: readonly GridColumn[] = [
    { key: "no", label: "N°", width: "w-14 min-w-[56px] text-center", stickyLeft: "0px" },
    { key: "fecha_contacto", label: "Fecha Contacto", width: "w-36 min-w-[144px]", type: "date", stickyLeft: "56px" },
    { key: "persona_contacto", label: "Persona Contacto", width: "w-48 min-w-[192px]", type: "text", stickyLeft: "200px" },
    { key: "numero_celular", label: "Celular", width: "w-[100px] min-w-[100px]", type: "text", stickyLeft: "392px" },
    { key: "email", label: "Email", width: "w-48 min-w-[192px]", type: "text", stickyLeft: "492px" },
    { key: "razon_social", label: "Razón Social", width: "w-56 min-w-[224px]", type: "text", stickyLeft: "684px" },
    { key: "ruc", label: "RUC", width: "w-32 min-w-[128px]", type: "text", stickyLeft: "908px", isLastPinned: true },
    { key: "asesor", label: "Asesor", width: "w-[130px] min-w-[130px]", type: "catalog", catalogKey: "asesores" },
    { key: "contacto", label: "Contacto", width: "w-[110px] min-w-[110px]", type: "catalog", catalogKey: "contactos" },
    { key: "rubro", label: "Rubro", width: "w-[120px] min-w-[120px]", type: "catalog", catalogKey: "rubros" },
    { key: "estado_cliente", label: "Estado Cliente", width: "w-52 min-w-[208px]", type: "catalog", catalogKey: "estados" },
    { key: "servicio_solicitado", label: "Servicio Solicitado", width: "w-56 min-w-[224px]", type: "catalog", catalogKey: "servicios" },
    { key: "fecha_ultimo_contacto", label: "F. Último Contacto", width: "w-36 min-w-[144px]", type: "date" },
    { key: "comentarios_asistente", label: "Asistente Comentario", width: "w-[180px] min-w-[180px]", type: "text" },
    { key: "comentarios_asesor", label: "Asesor Comentario", width: "w-[180px] min-w-[180px]", type: "text" },
    { key: "numero_cotizacion", label: "N° Cotización", width: "w-36 min-w-[144px]", type: "text" },
    { key: "estado_seguimiento", label: "Estado Seguimiento", width: "w-36 min-w-[144px]", type: "catalog", catalogKey: "estados_seguimiento" },
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
              <h1 className="text-lg font-semibold tracking-tight text-zinc-800">Seguimiento Clientes</h1>
              <p className="text-[11px] text-zinc-500">
                Seguimiento comercial, entregas y evidencia de atención.
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
              placeholder="Buscar en todo..."
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

          {/* Asesor Filter */}
          <div className="relative">
            <select
              value={selectedAsesor}
              onChange={(e) => {
                setSelectedAsesor(e.target.value)
                setCurrentPage(1)
              }}
              className="h-8 border border-zinc-200 rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-zinc-900 cursor-pointer hover:bg-zinc-50"
            >
              <option value="">Todos los Asesores</option>
              {catalogs?.asesores?.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Estado Cliente Filter */}
          <div className="relative">
            <select
              value={selectedEstado}
              onChange={(e) => {
                setSelectedEstado(e.target.value)
                setCurrentPage(1)
              }}
              className="h-8 border border-zinc-200 rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-zinc-900 cursor-pointer hover:bg-zinc-50"
            >
              <option value="">Todos los Estados</option>
              {catalogs?.estados?.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
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
      <div 
        className="flex-1 w-full overflow-auto relative select-none bg-zinc-50 min-h-0"
        style={{ zoom: '85%' }}
      >
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
                    onClick={() => toggleSort(col.key as keyof SeguimientoRow)}
                    style={
                      isPinned
                        ? {
                            position: "sticky",
                            left: col.stickyLeft,
                            zIndex: 35,
                          }
                        : undefined
                    }
                    className={`
                      ${col.width} px-3 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider select-none cursor-pointer bg-[#f4f4f5] hover:bg-zinc-200 transition-colors
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
                  const cellValue = row[col.key as keyof SeguimientoRow]
                  const isNo = col.key === "no"
                  const isPinned = col.stickyLeft !== undefined
                  const isLastPinned = col.isLastPinned === true
                  const baseCellClass = `
                    py-1 overflow-visible relative
                    ${isPinned ? `sticky z-10 ${idx % 2 === 0 ? "bg-white" : "bg-sky-50"} group-hover:bg-sky-100` : ""}
                    ${isPinned 
                      ? (isLastPinned 
                          ? "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.15)]" 
                          : "shadow-[inset_-1px_0_0_0_#d4d4d8]") 
                      : "shadow-[inset_-1px_0_0_0_#e4e4e7]"}
                  `

                  // Renders Read-Only 'N°' cell
                  if (isNo) {
                    return (
                      <td
                        key={col.key}
                        style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                        className={`px-3 py-2 text-center font-mono text-xs font-semibold text-zinc-500 select-none
                          ${isPinned ? `sticky z-10 ${idx % 2 === 0 ? "bg-zinc-50" : "bg-zinc-100"} group-hover:bg-sky-100` : "bg-zinc-50"}
                          ${isPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8]" : "shadow-[inset_-1px_0_0_0_#e4e4e7]"}
                        `}
                        title={String(cellValue ?? row.id)}
                      >
                        {cellValue ?? row.id}
                      </td>
                    )
                  }

                  // Renders Autocomplete suggestion dropdowns cell
                  if (col.type === "catalog") {
                    const catalogList = catalogs[col.catalogKey as keyof typeof catalogs] || []
                    const isActive = activeCell?.id === row.id && activeCell?.field === col.key
                    
                    // Filter suggestions: show all if query matches the current cell value exactly, otherwise filter
                    const filteredSuggestions = catalogList.filter((opt) => {
                      if (suggestionQuery === (cellValue || "")) {
                        return true
                      }
                      return opt.toLowerCase().includes(suggestionQuery.toLowerCase())
                    })

                    return (
                      <td
                        key={col.key}
                        style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                        className={`px-2 ${baseCellClass} group/cell`}
                      >
                        {isActive ? (
                          <div ref={autocompleteRef} className="relative w-full z-40 overflow-visible">
                            <input
                              type="text"
                              autoComplete="off"
                              data-lpignore="true"
                              value={suggestionQuery}
                              onChange={(e) => {
                                setSuggestionQuery(e.target.value)
                                setFocusedSuggestionIndex(-1)
                              }}
                              onBlur={(e) => {
                                // Delay blur slightly so click on suggestions executes first
                                setTimeout(() => {
                                  if (activeCell?.id === row.id && activeCell?.field === col.key) {
                                    handleCellBlur(row.id, col.key as keyof SeguimientoRow, cellValue, e.target.value)
                                    setActiveCell(null)
                                  }
                                }, 150)
                              }}
                              onKeyDown={(e) => handleAutocompleteKeyDown(e, row.id, col.key as keyof SeguimientoRow, filteredSuggestions)}
                              className="w-full bg-white border border-blue-500 rounded px-1.5 py-0.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              title={suggestionQuery}
                            />
                            {filteredSuggestions.length > 0 && (
                              <div className="absolute left-0 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg z-50">
                                {filteredSuggestions.map((opt, idx) => (
                                  <div
                                    key={opt}
                                    onMouseDown={() => {
                                      updateCell(row.id, col.key as keyof SeguimientoRow, opt)
                                      setActiveCell(null)
                                    }}
                                    className={`px-2 py-1.5 text-xs cursor-pointer select-none ${
                                      focusedSuggestionIndex === idx
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-zinc-700 hover:bg-zinc-50"
                                    }`}
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setActiveCell({ id: row.id, field: col.key as keyof SeguimientoRow })
                              setSuggestionQuery((cellValue as string) || "")
                              setFocusedSuggestionIndex(-1)
                            }}
                            title={String(cellValue || "")}
                            className="w-full min-h-[24px] cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 flex items-center justify-between"
                          >
                            <span className="truncate">{cellValue || <span className="text-zinc-300">-</span>}</span>
                            <span className="opacity-0 group-hover/cell:opacity-40 text-zinc-500 text-[10px]">▼</span>
                          </div>
                        )}
                      </td>
                    )
                  }

                  // Renders Date cell input
                  if (col.type === "date") {
                    const dateValue = cellValue ? (cellValue as string).split("T")[0] : ""
                    return (
                      <td
                        key={col.key}
                        style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                        className={`px-2 ${baseCellClass}`}
                      >
                        <input
                          type="date"
                          value={dateValue}
                          title={dateValue}
                          onChange={(e) => updateCell(row.id, col.key as keyof SeguimientoRow, e.target.value || null)}
                          className="w-full bg-transparent border-none outline-none text-xs text-zinc-800 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    )
                  }

                  if (col.key === "comentarios_asistente" || col.key === "comentarios_asesor") {
                    const displayVal = getDisplayComment(cellValue as string)
                    const isEmpty = !cellValue || displayVal === "-"
                    const commentBoxClass = isEmpty
                      ? "bg-red-100 border-red-300 text-red-800 hover:bg-red-200"
                      : "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200"

                    return (
                      <td
                        key={col.key}
                        style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                        className={`px-2 ${baseCellClass}`}
                      >
                        <div
                          onClick={() => openCommentsModal(row, col.key as "comentarios_asistente" | "comentarios_asesor")}
                          title={`Haga clic para ver/editar ${col.label}`}
                          className={`w-full min-h-[24px] cursor-pointer rounded px-1.5 py-0.5 text-xs border flex items-center justify-between transition-colors ${commentBoxClass}`}
                        >
                          <span className="truncate">{displayVal}</span>
                          <span className="text-[10px] opacity-70 shrink-0 ml-1">💬</span>
                        </div>
                      </td>
                    )
                  }

                  // Renders standard Input cell (text/long content)
                  return (
                    <td
                      key={col.key}
                      style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                      className={`px-2 ${baseCellClass}`}
                    >
                      <input
                        type="text"
                        key={`${row.id}-${col.key}-${cellValue ?? ""}`}
                        defaultValue={(cellValue as string) ?? ""}
                        title={String(cellValue ?? "")}
                        onBlur={(e) => handleCellBlur(row.id, col.key as keyof SeguimientoRow, cellValue, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur()
                          }
                        }}
                        className="w-full bg-transparent border-none outline-none text-xs text-zinc-800 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-500 truncate"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Ghost Row for Quick Inline Adding */}
            <tr className="bg-zinc-50 hover:bg-zinc-100/70 transition-colors overflow-visible border-t-2 border-zinc-200 group">
              {COLUMNS.map((col, idx) => {
                const isNo = col.key === "no"
                const isPinned = col.stickyLeft !== undefined
                const isLastPinned = col.isLastPinned === true
                const baseGhostClass = `
                  py-1 overflow-visible relative
                  ${isPinned ? "sticky z-10 bg-zinc-50 group-hover:bg-zinc-100" : ""}
                  ${isPinned 
                    ? (isLastPinned 
                        ? "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.15)]" 
                        : "shadow-[inset_-1px_0_0_0_#d4d4d8]") 
                    : "shadow-[inset_-1px_0_0_0_#e4e4e7]"}
                `
                
                if (isNo) {
                  return (
                    <td
                      key="ghost-no"
                      style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                      className={`px-3 py-2 text-center font-mono text-xs text-blue-700 select-none font-bold cursor-pointer hover:bg-zinc-200
                        ${isPinned ? "sticky z-10 bg-zinc-100 group-hover:bg-zinc-200" : "bg-zinc-100"}
                        ${isPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8]" : "shadow-[inset_-1px_0_0_0_#e4e4e7]"}
                      `}
                      onClick={submitGhostRow}
                      title="Agregar registro (Enter / Ctrl+Enter)"
                    >
                      <Plus className="mx-auto h-3.5 w-3.5" />
                    </td>
                  )
                }
                
              if (col.type === "catalog") {
                const catalogList = catalogs[col.catalogKey as keyof typeof catalogs] || []
                const isCommentField = col.key === "comentarios_asistente" || col.key === "comentarios_asesor"
                return (
                  <td
                    key={`ghost-${col.key}`}
                    style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                    className={`px-2 ${baseGhostClass}`}
                  >
                    <select
                      value={(ghostRow[col.key as keyof SeguimientoRow] as string) || ""}
                      onChange={(e) => handleGhostChange(col.key as keyof SeguimientoRow, e.target.value)}
                      onKeyDown={handleGhostKeyDown}
                      className={`${isCommentField ? "" : "ghost-input"} w-full bg-transparent border border-zinc-200 rounded px-1.5 py-0.5 text-xs text-zinc-800 focus:bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer h-7`}
                    >
                      <option value="">- Seleccione -</option>
                      {catalogList.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                )
              }
                
              if (col.type === "date") {
                const isCommentField = col.key === "comentarios_asistente" || col.key === "comentarios_asesor"
                return (
                  <td
                    key={`ghost-${col.key}`}
                    style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                    className={`px-2 ${baseGhostClass}`}
                  >
                    <input
                      type="date"
                      value={(ghostRow[col.key as keyof SeguimientoRow] as string) || ""}
                      onChange={(e) => handleGhostChange(col.key as keyof SeguimientoRow, e.target.value)}
                      onKeyDown={handleGhostKeyDown}
                      className={`${isCommentField ? "" : "ghost-input"} w-full bg-transparent border border-zinc-200 rounded px-1 py-0.5 text-xs text-zinc-800 focus:bg-white focus:ring-1 focus:ring-blue-500 h-7`}
                    />
                  </td>
                )
              }
                
              // Standard text inputs
              const isCommentField = col.key === "comentarios_asistente" || col.key === "comentarios_asesor"
              return (
                <td
                  key={`ghost-${col.key}`}
                  style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                  className={`px-2 ${baseGhostClass}`}
                >
                  <input
                    type="text"
                    placeholder={`${col.label}...`}
                    value={(ghostRow[col.key as keyof SeguimientoRow] as string) || ""}
                    onChange={(e) => handleGhostChange(col.key as keyof SeguimientoRow, e.target.value)}
                    onKeyDown={handleGhostKeyDown}
                    className={`${isCommentField ? "" : "ghost-input"} w-full bg-transparent border border-zinc-200 rounded px-1 py-0.5 text-xs text-zinc-800 focus:bg-white focus:ring-1 focus:ring-blue-500 h-7`}
                  />
                </td>
              )
              })}
            </tr>

            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-8 w-8 text-zinc-300" />
                    <span className="text-sm font-medium">
                      {isLoading ? "Cargando registros..." : "No se encontraron registros de seguimiento."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="z-10 shrink-0 border-t border-zinc-200 bg-white px-4 py-2 flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          Mostrando {Math.min((currentPage - 1) * pageSize + 1, total)}-{Math.min(currentPage * pageSize, total)} de {total} registro(s).
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || isLoading}
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-zinc-600">
            Página {currentPage} de {totalPages}
          </span>
          <button
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || isLoading}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="h-6 w-16 text-xs border border-zinc-200 rounded"
          >
            {[100, 500, 1000, 2000, 5000, 8000].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comments Modal */}
      {commentModalRow && activeCommentField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Fixed Header */}
            <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <span>💬 {activeCommentField === "comentarios_asistente" ? "Asistente Comentario" : "Asesor Comentario"}</span>
                </h2>
                <button 
                  onClick={() => setCommentModalRow(null)}
                  className="rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Comments History list - Scrollable container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white min-h-0">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Historial de Cambios / Comentarios</h3>
                <span className="text-[9px] text-zinc-400 italic">Almacenado en la Base de Datos</span>
              </div>
              
              {rowComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-400">
                  <span className="text-lg">💬</span>
                  <p className="text-xs italic mt-1">Sin comentarios para este registro.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rowComments.map((comment, index) => (
                    <div key={index} className="rounded border border-zinc-100 bg-zinc-50 p-2 text-xs shadow-sm transition-all hover:border-zinc-200">
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 mb-1 font-medium border-b border-zinc-100/50 pb-0.5">
                        <span>Por: <strong className="text-zinc-700">{comment.author}</strong></span>
                        <span>{comment.timestamp}</span>
                      </div>
                      <p className="text-zinc-800 whitespace-pre-wrap leading-relaxed text-[11px]">{comment.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Comment form - Bottom panel */}
            <div className="border-t border-zinc-200 p-4 bg-zinc-50 flex-shrink-0 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Nuevo Comentario</label>
                  <span className="text-[10px] text-zinc-500">
                    Registrando como: <strong className="text-blue-600">{currentUserName}</strong>
                  </span>
                </div>
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-zinc-300 p-2 text-xs bg-white text-zinc-800 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow resize-none"
                  placeholder="Escriba un comentario para guardar..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCommentModalRow(null)}
                  className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
                >
                  Cerrar
                </button>
                <button
                  onClick={saveComment}
                  disabled={!commentInput.trim()}
                  className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1"
                >
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
