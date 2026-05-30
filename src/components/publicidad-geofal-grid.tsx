"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { usePublicidadGeofal, type PublicidadRow } from "@/hooks/use-publicidad-geofal"
import { CommercialModuleTabs, type CommercialModuleTab } from "@/components/commercial-module-tabs"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const COMMENT_DRAFT_STORAGE_PREFIX = "publicidad-geofal-comment-draft:v1"

type CommentFieldKey = "observacion_1" | "observacion_2"

const getCommentDraftStorageKey = (rowId: number, field: CommentFieldKey) =>
  `${COMMENT_DRAFT_STORAGE_PREFIX}:${rowId}:${field}`

const readLegacyCommentValue = (value: string | undefined | null): string => {
  if (!value) return ""

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const lastEntry = parsed[parsed.length - 1]
      if (typeof lastEntry?.text === "string") {
        return lastEntry.text
      }
    }
  } catch {
    // Keep raw text for the new notepad flow and legacy plain strings.
  }

  return value
}

const getCommentDisplayValue = (value: string | undefined | null): string => {
  const normalized = readLegacyCommentValue(value).trim()
  return normalized.length > 0 ? normalized : "-"
}
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
  Copy,
  Mail
} from "lucide-react"

const getWhatsAppUrl = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, "")
  if (!cleanPhone) return ""
  const hasCountryCode = cleanPhone.length > 9 || cleanPhone.startsWith("51")
  const prefix = hasCountryCode ? "" : "51"
  return `https://wa.me/${prefix}${cleanPhone}`
}

const WhatsAppIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="13"
    height="13"
    fill="currentColor"
    className="text-emerald-600 hover:text-emerald-500 transition-colors"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

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
  const [pageSize, setPageSize] = useState(100)
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [uiHydrated, setUiHydrated] = useState(false)
  const [userRole, setUserRole] = useState<string>("")

  // Comment Modal States & Handlers
  const [commentModalRow, setCommentModalRow] = useState<PublicidadRow | null>(null)
  const [activeCommentField, setActiveCommentField] = useState<CommentFieldKey | null>(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [hasStoredCommentDraft, setHasStoredCommentDraft] = useState(false)
  const [isSavingComment, setIsSavingComment] = useState(false)

  const readStoredCommentDraft = (rowId: number, field: CommentFieldKey, fallbackValue: string) => {
    if (typeof window === "undefined") return fallbackValue

    try {
      const stored = window.localStorage.getItem(getCommentDraftStorageKey(rowId, field))
      return stored !== null ? stored : fallbackValue
    } catch {
      return fallbackValue
    }
  }

  const persistCommentDraft = (rowId: number, field: CommentFieldKey, value: string) => {
    if (typeof window === "undefined") return

    try {
      window.localStorage.setItem(getCommentDraftStorageKey(rowId, field), value)
    } catch {
      // Ignore localStorage write failures
    }
  }

  const clearCommentDraft = (rowId: number, field: CommentFieldKey) => {
    if (typeof window === "undefined") return

    try {
      window.localStorage.removeItem(getCommentDraftStorageKey(rowId, field))
    } catch {
      // Ignore localStorage cleanup failures
    }
  }

  const openCommentsModal = (row: PublicidadRow, field: CommentFieldKey) => {
    setCommentModalRow(row)
    setActiveCommentField(field)
    const fallbackValue = readLegacyCommentValue(row[field])
    const draftValue = readStoredCommentDraft(row.id, field, fallbackValue)
    setCommentDraft(draftValue)
    let storedDraftExists = false
    if (typeof window !== "undefined") {
      try {
        storedDraftExists = window.localStorage.getItem(getCommentDraftStorageKey(row.id, field)) !== null
      } catch {
        storedDraftExists = false
      }
    }
    setHasStoredCommentDraft(storedDraftExists)
  }

  const closeCommentsModal = () => {
    setCommentModalRow(null)
    setActiveCommentField(null)
    setIsSavingComment(false)
  }

  const saveComment = async () => {
    if (!commentModalRow || !activeCommentField) return

    const payload = commentDraft

    setIsSavingComment(true)
    try {
      await updateCellAsync(commentModalRow.id, activeCommentField, payload)
      clearCommentDraft(commentModalRow.id, activeCommentField)
      setHasStoredCommentDraft(false)
      toast.success("Comentario guardado correctamente.")
    } catch {
      toast.error("No se pudo guardar el comentario. El borrador local se mantuvo.")
    } finally {
      setIsSavingComment(false)
    }
  }

  const handleCommentDraftChange = (value: string) => {
    setCommentDraft(value)
    if (!commentModalRow || !activeCommentField) return

    persistCommentDraft(commentModalRow.id, activeCommentField, value)
    setHasStoredCommentDraft(true)
  }

  const activeCommentTitle = activeCommentField === "observacion_1" ? "Observación 1" : "Observación 2"
  const commentSyncState = hasStoredCommentDraft
    ? {
        label: "Borrador local",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      }
    : {
        label: "Sin cambios",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }

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
    updateCellAsync,
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
    if (field === "id_cliente") return false
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
    { key: "contacto", label: "Contacto", width: "w-[100px] min-w-[100px] max-w-[100px]", stickyLeft: "48px" },
    { key: "telefono", label: "Teléfono", width: "w-[130px] min-w-[130px] max-w-[130px]", stickyLeft: "148px" },
    { key: "correo_referencial", label: "Correo\nReferencial", width: "w-[160px] min-w-[160px] max-w-[160px]", stickyLeft: "278px" },
    { key: "razon_social_referencial", label: "Razón\nSocial", width: "w-[110px] min-w-[110px] max-w-[110px]", stickyLeft: "438px" },
    { key: "observacion_1", label: "OBS. 1", width: "w-[85px] min-w-[85px] max-w-[85px]", stickyLeft: "548px" },
    { key: "observacion_2", label: "OBS. 2", width: "w-[85px] min-w-[85px] max-w-[85px]", stickyLeft: "633px", isLastPinned: true },
    
    // Monthly comments
    { key: "junio_asistente", label: "JUNIO\n(AUX)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    { key: "junio_asesor", label: "JUNIO\n(ASES)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    
    { key: "julio_asistente", label: "JULIO\n(AUX)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    { key: "julio_asesor", label: "JULIO\n(ASES)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    
    { key: "agosto_asistente", label: "AGOSTO\n(AUX)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    { key: "agosto_asesor", label: "AGOSTO\n(ASES)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    
    { key: "setiembre_asistente", label: "SETIEMBRE\n(AUX)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    { key: "setiembre_asesor", label: "SETIEMBRE\n(ASES)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    
    { key: "octubre_asistente", label: "OCTUBRE\n(AUX)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    { key: "octubre_asesor", label: "OCTUBRE\n(ASES)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    
    { key: "noviembre_asistente", label: "NOVIEMBRE\n(AUX)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    { key: "noviembre_asesor", label: "NOVIEMBRE\n(ASES)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    
    { key: "diciembre_asistente", label: "DICIEMBRE\n(AUX)", width: "w-[130px] min-w-[130px] max-w-[130px]" },
    { key: "diciembre_asesor", label: "DICIEMBRE\n(ASES)", width: "w-[130px] min-w-[130px] max-w-[130px]" }
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
                       ${col.width} px-2 py-2 text-left text-[10.5px] font-bold text-zinc-700 uppercase tracking-wide select-none cursor-pointer bg-[#f4f4f5] hover:bg-zinc-200 transition-colors whitespace-pre-line
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

                  const isPhone = col.key === "telefono" || col.key === "telefono_2"
                  const hasPhoneValue = isPhone && cellValue && String(cellValue).trim().length > 0

                  const isEmail = col.key === "correo_referencial"
                  const hasEmailValue = isEmail && cellValue && String(cellValue).trim().length > 0

                  if (col.key === "observacion_1" || col.key === "observacion_2") {
                    const displayVal = getCommentDisplayValue(cellValue as string)
                    const isEmpty = !cellValue || displayVal === "-"
                    const commentBoxClass = isEmpty
                      ? "bg-red-100 border-red-300 text-red-800 hover:bg-red-200"
                      : "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200"

                    return (
                      <td
                        key={col.key}
                        style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                        className={`px-1.5 ${baseCellClass}`}
                      >
                        <div
                          onClick={() => openCommentsModal(row, col.key as "observacion_1" | "observacion_2")}
                          title={`Haga clic para ver/editar ${col.label}`}
                          className={`w-full min-w-0 min-h-[22px] cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-bold border flex items-center justify-between transition-colors ${commentBoxClass}`}
                        >
                          <span className="truncate min-w-0">{displayVal}</span>
                          <span className="text-[9px] opacity-70 shrink-0 ml-1">📝</span>
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={col.key}
                      style={col.stickyLeft ? { position: "sticky", left: col.stickyLeft, zIndex: 10 } : undefined}
                      className={`px-1.5 ${baseCellClass}`}
                    >
                      <div className="flex items-center gap-1 w-full h-full">
                        <input
                          type={col.key === "id_cliente" ? "number" : "text"}
                          disabled={!editable}
                          defaultValue={cellValue !== null && cellValue !== undefined ? String(cellValue) : ""}
                          onBlur={(e) => {
                            const val = col.key === "id_cliente" ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value
                            handleCellBlur(row.id, col.key, cellValue, val)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur()
                            }
                          }}
                          className={`flex-1 min-w-0 bg-transparent border-0 rounded px-1.5 py-0.5 text-[11px] text-zinc-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:opacity-80 font-bold`}
                          title={cellValue !== null && cellValue !== undefined ? String(cellValue) : ""}
                        />
                        {hasPhoneValue && (
                          <>
                            <a
                              href={getWhatsAppUrl(String(cellValue))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center p-0.5 rounded hover:bg-emerald-50 shrink-0 select-none mr-0.5"
                              title="Abrir WhatsApp"
                            >
                              <WhatsAppIcon />
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(String(cellValue))
                                  .then(() => toast.success("Teléfono copiado al portapapeles."))
                                  .catch(() => toast.error("Error al copiar al portapapeles."))
                              }}
                              className="flex items-center justify-center p-0.5 rounded hover:bg-blue-50 text-zinc-400 hover:text-blue-600 shrink-0 select-none"
                              title="Copiar teléfono"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {hasEmailValue && (
                          <>
                            <a
                              href={`mailto:${String(cellValue)}`}
                              className="flex items-center justify-center p-0.5 rounded hover:bg-blue-50 text-zinc-400 hover:text-blue-600 shrink-0 select-none mr-0.5"
                              title="Enviar correo (Outlook/Mail)"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(String(cellValue))
                                  .then(() => toast.success("Correo copiado al portapapeles."))
                                  .catch(() => toast.error("Error al copiar al portapapeles."))
                              }}
                              className="flex items-center justify-center p-0.5 rounded hover:bg-blue-50 text-zinc-400 hover:text-blue-600 shrink-0 select-none"
                              title="Copiar correo"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
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

      {/* Comments/Observation Modal */}
      {commentModalRow && activeCommentField && (
        <div
          onClick={closeCommentsModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl max-h-[90vh]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 border-t-4 border-t-primary bg-[#eef5ff] px-6 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/90">
                  Geofal CRM · Publicidad
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
                  {activeCommentTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {commentModalRow.razon_social_referencial || "Sin razón social"} · Contacto: {commentModalRow.contacto || "-"}
                </p>
              </div>
              <button
                onClick={closeCommentsModal}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar comentario"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  Observación / Nota
                </label>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${commentSyncState.className}`}>
                  {commentSyncState.label}
                </span>
              </div>

              <textarea
                value={commentDraft}
                onChange={(e) => handleCommentDraftChange(e.target.value)}
                placeholder="Escribe aquí la observación o comentario..."
                className="min-h-[280px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-muted-foreground">
                {commentDraft.length > 0 ? `${commentDraft.length} caracteres escritos` : "Sin texto todavía"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="h-9 px-4 text-xs text-muted-foreground hover:bg-muted hover:text-foreground border border-zinc-200 bg-white"
                  onClick={closeCommentsModal}
                >
                  Cerrar
                </Button>
                <Button
                  className="h-9 px-5 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  onClick={saveComment}
                  disabled={isSavingComment}
                >
                  {isSavingComment ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
