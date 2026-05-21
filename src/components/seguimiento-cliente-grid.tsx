"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSeguimientoComercial, type SeguimientoRow } from "@/hooks/use-seguimiento-comercial"
import { 
  RefreshCw, 
  Plus, 
  FileDown, 
  FileUp, 
  Search, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  User, 
  Tag, 
  SlidersHorizontal,
  X,
  ChevronsLeft,
  ChevronsRight,
  Wifi,
  WifiOff,
  Users
} from "lucide-react"
import { toast } from "sonner"

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
  estado_cliente: "1. SOLICITUD INFORMACION",
  servicio_solicitado: "",
  fecha_ultimo_contacto: "",
  observaciones: "",
  numero_cotizacion: "",
  estado_seguimiento: "Pendiente"
}

export default function SeguimientoClienteGrid() {
  // Query Filters & Pagination State
  const [search, setSearch] = useState("")
  const [selectedAsesor, setSelectedAsesor] = useState("")
  const [selectedEstado, setSelectedEstado] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(500)

  // Ghost Row State & Handlers
  const [ghostRow, setGhostRow] = useState<Partial<SeguimientoRow>>({ ...DEFAULT_GHOST_ROW })
  const [isGhostSubmitting, setIsGhostSubmitting] = useState(false)

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

  const handleGhostKeyDown = (e: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (e.ctrlKey) {
        submitGhostRow()
        return
      }
      
      const inputs = Array.from(document.querySelectorAll(".ghost-input")) as HTMLElement[]
      const nextInput = inputs[index + 1]
      if (nextInput) {
        nextInput.focus()
        if (nextInput instanceof HTMLInputElement) {
          nextInput.select()
        }
      } else {
        submitGhostRow()
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
    updateCell,
    insertRow,
    deleteRow,
    importFromExcel,
    exportToExcel,
    isMutating
  } = useSeguimientoComercial({
    search: debouncedSearch,
    asesor: selectedAsesor,
    estado_cliente: selectedEstado,
    limit: pageSize,
    offset: offset
  })

  // Local state for active autocomplete cell
  const [activeCell, setActiveCell] = useState<{ id: number; field: keyof SeguimientoRow } | null>(null)
  const [suggestionQuery, setSuggestionQuery] = useState("")
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Handles Excel upload change
  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check extension
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Por favor suba un archivo Excel (.xlsx o .xls)")
      return
    }

    toast.promise(
      new Promise((resolve, reject) => {
        try {
          importFromExcel(file)
          resolve(true)
        } catch (err) {
          reject(err)
        }
      }),
      {
        loading: "Importando base de datos de clientes...",
        success: "Base de datos importada exitosamente",
        error: "Ocurrió un error al importar"
      }
    )
    
    // Clear input
    if (e.target) e.target.value = ""
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

  // Grid columns definition
  const COLUMNS = [
    { key: "no", label: "N°", width: "w-14 min-w-[56px] text-center" },
    { key: "fecha_contacto", label: "Fecha Contacto", width: "w-36 min-w-[144px]", type: "date" },
    { key: "persona_contacto", label: "Persona Contacto", width: "w-48 min-w-[192px]", type: "text" },
    { key: "numero_celular", label: "Celular", width: "w-32 min-w-[128px]", type: "text" },
    { key: "email", label: "Email", width: "w-48 min-w-[192px]", type: "text" },
    { key: "razon_social", label: "Razón Social", width: "w-56 min-w-[224px]", type: "text" },
    { key: "ruc", label: "RUC", width: "w-32 min-w-[128px]", type: "text" },
    { key: "asesor", label: "Asesor", width: "w-44 min-w-[176px]", type: "catalog", catalogKey: "asesores" },
    { key: "contacto", label: "Contacto", width: "w-36 min-w-[144px]", type: "catalog", catalogKey: "contactos" },
    { key: "rubro", label: "Rubro", width: "w-36 min-w-[144px]", type: "catalog", catalogKey: "rubros" },
    { key: "estado_cliente", label: "Estado Cliente", width: "w-52 min-w-[208px]", type: "catalog", catalogKey: "estados" },
    { key: "servicio_solicitado", label: "Servicio Solicitado", width: "w-56 min-w-[224px]", type: "text" },
    { key: "fecha_ultimo_contacto", label: "F. Último Contacto", width: "w-36 min-w-[144px]", type: "date" },
    { key: "observaciones", label: "Observaciones", width: "w-64 min-w-[256px]", type: "text" },
    { key: "numero_cotizacion", label: "N° Cotización", width: "w-36 min-w-[144px]", type: "text" },
    { key: "estado_seguimiento", label: "Estado Seguimiento", width: "w-36 min-w-[144px]", type: "text" },
    { key: "actions", label: "Acciones", width: "w-20 min-w-[80px] text-center" }
  ] as const

  return (
    <div className="flex h-full flex-col bg-white overflow-hidden">
      {/* Toolbar Area */}
      <div className="z-20 shrink-0 border-b border-zinc-200 bg-white p-2 shadow-sm overflow-visible">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between overflow-visible">
          {/* Left search & selections */}
          <div className="flex flex-1 flex-wrap items-center gap-2 overflow-visible">
            {/* Search Input */}
            <div className="relative w-[250px] lg:w-[300px]">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar en todo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-8 pr-7 text-xs outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400 text-zinc-900"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
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
                className="h-8 border border-zinc-200 rounded-md px-2 pr-7 text-xs outline-none transition-all hover:bg-zinc-50 focus:border-blue-500 bg-white text-zinc-900 cursor-pointer"
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
                className="h-8 border border-zinc-200 rounded-md px-2 pr-7 text-xs outline-none transition-all hover:bg-zinc-50 focus:border-blue-500 bg-white text-zinc-900 cursor-pointer"
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

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Import Excel Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportChange}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isMutating || isLoading}
              title="Importar base de datos desde un archivo Excel"
              className="flex items-center gap-1 h-8 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Importar</span>
            </button>

            {/* Export Excel Button */}
            <button
              onClick={exportToExcel}
              disabled={isMutating || isLoading || total === 0}
              className="flex items-center gap-1 h-8 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Exportar</span>
            </button>

            {/* Reload Button */}
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center justify-center h-8 w-8 rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div 
        className="flex-1 w-full overflow-auto relative select-none border-b border-zinc-200 bg-white min-h-0"
        style={{ zoom: '85%' }}
      >
        <table className="min-w-full divide-y divide-zinc-200 table-fixed border-collapse overflow-visible">
          <thead className="bg-zinc-800 sticky top-0 z-30">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`${col.width} px-3 py-3 text-left text-xs font-bold text-zinc-200 uppercase tracking-wider select-none border-r border-zinc-700/60 last:border-0`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-zinc-100 overflow-visible">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-zinc-50/50 transition-colors group overflow-visible"
              >
                {COLUMNS.map((col) => {
                  const cellValue = row[col.key as keyof SeguimientoRow]
                  const isNo = col.key === "no"
                  const isAction = col.key === "actions"

                  // Renders Read-Only 'N°' cell
                  if (isNo) {
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-2 border-r border-zinc-100 text-center font-mono text-xs text-zinc-400 bg-zinc-50/40 select-none"
                        title={String(cellValue ?? row.id)}
                      >
                        {cellValue ?? row.id}
                      </td>
                    )
                  }

                  // Renders 'Actions' cell
                  if (isAction) {
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-center select-none"
                      >
                        <button
                          onClick={() => {
                            if (confirm("¿Está seguro que desea eliminar este registro?")) {
                              deleteRow(row.id)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Eliminar registro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
                        className="px-2 py-1 border-r border-zinc-100 overflow-visible relative group/cell"
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
                        className="px-2 py-1 border-r border-zinc-100"
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

                  // Renders standard Input cell (text/long content)
                  return (
                    <td
                      key={col.key}
                      className="px-2 py-1 border-r border-zinc-100"
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
            <tr className="bg-zinc-50 hover:bg-zinc-100/70 transition-colors overflow-visible border-t-2 border-zinc-200">
              {COLUMNS.map((col, idx) => {
                const isNo = col.key === "no"
                const isAction = col.key === "actions"
                
                if (isNo) {
                  return (
                    <td
                      key="ghost-no"
                      className="px-3 py-2 border-r border-zinc-100 text-center font-mono text-xs text-zinc-400 bg-zinc-100/40 select-none font-bold"
                    >
                      +
                    </td>
                  )
                }
                
                if (isAction) {
                  return (
                    <td
                      key="ghost-action"
                      className="px-3 py-2 text-center select-none"
                    >
                      <button
                        onClick={submitGhostRow}
                        disabled={isGhostSubmitting}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded disabled:opacity-50"
                        title="Agregar registro (Enter / Ctrl+Enter)"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </td>
                  )
                }
                
                if (col.type === "catalog") {
                  const catalogList = catalogs[col.catalogKey as keyof typeof catalogs] || []
                  return (
                    <td
                      key={`ghost-${col.key}`}
                      className="px-2 py-1 border-r border-zinc-100 overflow-visible relative"
                    >
                      <select
                        value={(ghostRow[col.key as keyof SeguimientoRow] as string) || ""}
                        onChange={(e) => handleGhostChange(col.key as keyof SeguimientoRow, e.target.value)}
                        onKeyDown={(e) => handleGhostKeyDown(e, idx - 1)}
                        className="ghost-input w-full bg-transparent border border-zinc-200 rounded px-1.5 py-0.5 text-xs text-zinc-800 focus:bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
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
                  return (
                    <td
                      key={`ghost-${col.key}`}
                      className="px-2 py-1 border-r border-zinc-100"
                    >
                      <input
                        type="date"
                        value={(ghostRow[col.key as keyof SeguimientoRow] as string) || ""}
                        onChange={(e) => handleGhostChange(col.key as keyof SeguimientoRow, e.target.value)}
                        onKeyDown={(e) => handleGhostKeyDown(e, idx - 1)}
                        className="ghost-input w-full bg-transparent border border-zinc-200 rounded px-1 py-0.5 text-xs text-zinc-800 focus:bg-white focus:ring-1 focus:ring-blue-500 h-7"
                      />
                    </td>
                  )
                }
                
                // Standard text inputs
                return (
                  <td
                    key={`ghost-${col.key}`}
                    className="px-2 py-1 border-r border-zinc-100"
                  >
                    <input
                      type="text"
                      placeholder={`${col.label}...`}
                      value={(ghostRow[col.key as keyof SeguimientoRow] as string) || ""}
                      onChange={(e) => handleGhostChange(col.key as keyof SeguimientoRow, e.target.value)}
                      onKeyDown={(e) => handleGhostKeyDown(e, idx - 1)}
                      className="ghost-input w-full bg-transparent border border-zinc-200 rounded px-1 py-0.5 text-xs text-zinc-800 focus:bg-white focus:ring-1 focus:ring-blue-500 h-7"
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
          0 of {total} row(s) selected.
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
            Page {currentPage} of {totalPages}
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
    </div>
  )
}
