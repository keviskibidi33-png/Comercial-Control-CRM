"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { useSeguimientoComercial, type SeguimientoRow } from "@/hooks/use-seguimiento-comercial"
import { useSeguimientoComercial2 } from "@/hooks/use-seguimiento-comercial-2"
import { CommercialModuleTabs, type CommercialModuleTab } from "@/components/commercial-module-tabs"
import { useCurrentUser } from "@/hooks/use-current-user"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
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

import type { CommentFieldKey } from "./types"
export type { CommentFieldKey }

const DEFAULT_GHOST_ROW: Partial<SeguimientoRow> = {
  fecha_contacto: new Date().toISOString().split("T")[0],
  persona_contacto: "",
  numero_celular: "",
  email: "",
  razon_social: "",
  ruc: "",
  contacto: "WHATSAPP",
  rubro: "LABORATORIO",
  estado_cliente: "EN ESPERA DE ATENCIÓN",
  servicio_solicitado: "",
  categoria_servicio: "",
  fecha_ultimo_contacto: "",
  numero_cotizacion: "",
  costo_cotiz_sin_igv: "",
  estado_seguimiento: "Leads"
}

const STORAGE_KEY = "seguimiento-comercial-ui:v1"
const COMMENT_DRAFT_STORAGE_PREFIX = "seguimiento-comercial-comment-draft:v1"

export function SeguimientoClienteGrid() {
  const { user } = useCurrentUser()
  const currentTab: CommercialModuleTab = "seguimiento-cliente-1"

  const hook1 = useSeguimientoComercial()
  const hook2 = useSeguimientoComercial2()
  const {
    rows,
    catalogs,
    loading,
    error,
    onlineCount,
    activeEditors,
    activeFieldEditors,
    editingCells,
    activeFieldEditorName,
    updateCell,
    broadcastCellBlur,
    addRow,
    deleteRow,
    fetchRows
  } = hook1

  const isRealtimeConnected = true

  const [activeTab, setActiveTab] = useState<CommercialModuleTab>(currentTab)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [contactFilter, setContactFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [seguimientoFilter, setSeguimientoFilter] = useState("all")
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isCreating, setIsCreating] = useState(false)
  const [ghostRow, setGhostRow] = useState<Partial<SeguimientoRow>>(DEFAULT_GHOST_ROW)

  const [commentModalRow, setCommentModalRow] = useState<SeguimientoRow | null>(null)
  const [commentModalField, setCommentModalField] = useState<CommentFieldKey | null>(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [isSavingComment, setIsSavingComment] = useState(false)

  const [uiStateLoaded, setUiStateLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery)
        if (parsed.contactFilter !== undefined) setContactFilter(parsed.contactFilter)
        if (parsed.statusFilter !== undefined) setStatusFilter(parsed.statusFilter)
        if (parsed.seguimientoFilter !== undefined) setSeguimientoFilter(parsed.seguimientoFilter)
        if (parsed.rowsPerPage !== undefined) setRowsPerPage(parsed.rowsPerPage)
        if (parsed.currentPage !== undefined) setCurrentPage(parsed.currentPage)
      }
    } catch {
      // Ignore UI restoration errors
    } finally {
      setUiStateLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!uiStateLoaded) return
    try {
      const stateToSave = {
        searchQuery,
        contactFilter,
        statusFilter,
        seguimientoFilter,
        rowsPerPage,
        currentPage
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch {
      // Ignore UI save errors
    }
  }, [searchQuery, contactFilter, statusFilter, seguimientoFilter, rowsPerPage, currentPage, uiStateLoaded])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, contactFilter, statusFilter, seguimientoFilter, rowsPerPage])

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success(`Copiado ${label}`, {
      description: text,
      duration: 2000
    })
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        searchQuery === "" ||
        r.razon_social?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.persona_contacto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.numero_celular?.includes(searchQuery) ||
        r.ruc?.includes(searchQuery) ||
        r.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.numero_cotizacion?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesContact = contactFilter === "all" || r.contacto === contactFilter
      const matchesStatus = statusFilter === "all" || r.estado_cliente === statusFilter
      const matchesSeguimiento = seguimientoFilter === "all" || r.estado_seguimiento === seguimientoFilter

      return matchesSearch && matchesContact && matchesStatus && matchesSeguimiento
    })
  }, [rows, searchQuery, contactFilter, statusFilter, seguimientoFilter])

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredRows.slice(start, start + rowsPerPage)
  }, [filteredRows, currentPage, rowsPerPage])

  const openCommentsModal = (row: SeguimientoRow, field: CommentFieldKey) => {
    setCommentModalRow(row)
    setCommentModalField(field)
    
    const draftKey = `${COMMENT_DRAFT_STORAGE_PREFIX}:${row.id}:${field}`
    const savedDraft = localStorage.getItem(draftKey)
    
    if (savedDraft !== null) {
      setCommentDraft(savedDraft)
    } else {
      setCommentDraft(row[field] || "")
    }
  }

  const handleCommentDraftChange = (value: string) => {
    setCommentDraft(value)
    if (commentModalRow && commentModalField) {
      const draftKey = `${COMMENT_DRAFT_STORAGE_PREFIX}:${commentModalRow.id}:${commentModalField}`
      localStorage.setItem(draftKey, value)
    }
  }

  const closeCommentsModal = () => {
    if (commentModalRow && commentModalField) {
      const draftKey = `${COMMENT_DRAFT_STORAGE_PREFIX}:${commentModalRow.id}:${commentModalField}`
      localStorage.removeItem(draftKey)
    }
    setCommentModalRow(null)
    setCommentModalField(null)
    setCommentDraft("")
  }

  const saveComment = async () => {
    if (!commentModalRow || !commentModalField) return
    setIsSavingComment(true)
    try {
      await updateCell(commentModalRow.id, commentModalField, commentDraft)
      toast.success("Comentario guardado")
      closeCommentsModal()
    } catch {
      toast.error("Error al guardar comentario")
    } finally {
      setIsSavingComment(false)
    }
  }

  const handleCreateGhostRow = async () => {
    try {
      await addRow(ghostRow)
      toast.success("Nuevo registro creado")
      setIsCreating(false)
      setGhostRow(DEFAULT_GHOST_ROW)
    } catch {
      toast.error("No se pudo agregar el registro")
    }
  }

  const commentSyncState = useMemo(() => {
    if (!commentModalRow || !commentModalField) return { label: "SIN CAMBIOS", className: "bg-slate-100 text-slate-500 border-slate-200" }
    const original = commentModalRow[commentModalField] || ""
    if (commentDraft === original) {
      return { label: "GUARDADO", className: "bg-emerald-50 text-emerald-600 border-emerald-200" }
    }
    return { label: "CAMBIOS SIN GUARDAR", className: "bg-amber-50 text-amber-600 border-amber-200 animate-pulse" }
  }, [commentModalRow, commentModalField, commentDraft])

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Seguimiento Comercial de Clientes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Control de prospectos, cotizaciones y oportunidades B2B</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => fetchRows()}
            disabled={loading}
            variant="outline"
            className="h-9 font-bold text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Recargar
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreating(true)}
            className="h-9 font-bold text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/50">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente, RUC, cotización..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Modal de Comentarios */}
      {commentModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-100 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-zinc-50/50">
                <div className="min-w-0 pr-4">
                  <h3 className="text-base font-bold text-zinc-900 truncate">
                    {commentModalField === "comentarios_asistente" ? "Comentarios de Asistente" : "Comentarios de Asesor"}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    Cliente: <strong className="text-zinc-800 font-semibold">{commentModalRow.persona_contacto || commentModalRow.razon_social || "Sin nombre"}</strong>
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

              <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-3 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs shrink-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Razón Social</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input
                      type="text"
                      defaultValue={commentModalRow.razon_social || ""}
                      onBlur={(e) => {
                        if ((commentModalRow.razon_social || "") !== e.target.value) {
                          updateCell(commentModalRow.id, "razon_social", e.target.value)
                          setCommentModalRow(prev => prev ? { ...prev, razon_social: e.target.value } : null)
                        }
                      }}
                      className="font-semibold text-zinc-800 bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-500 w-full min-w-0 outline-none"
                    />
                    {commentModalRow.razon_social && (
                      <button
                        onClick={() => copyToClipboard(commentModalRow.razon_social, "Razón Social")}
                        className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 shrink-0 transition-colors"
                        title="Copiar Razón Social"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">RUC</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input
                      type="text"
                      defaultValue={commentModalRow.ruc || ""}
                      onBlur={(e) => {
                        if ((commentModalRow.ruc || "") !== e.target.value) {
                          updateCell(commentModalRow.id, "ruc", e.target.value)
                          setCommentModalRow(prev => prev ? { ...prev, ruc: e.target.value } : null)
                        }
                      }}
                      className="font-mono font-semibold text-zinc-800 bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-500 w-full min-w-0 outline-none"
                    />
                    {commentModalRow.ruc && (
                      <button
                        onClick={() => copyToClipboard(commentModalRow.ruc, "RUC")}
                        className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 shrink-0 transition-colors"
                        title="Copiar RUC"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Email</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input
                      type="email"
                      defaultValue={commentModalRow.email || ""}
                      onBlur={(e) => {
                        if ((commentModalRow.email || "") !== e.target.value) {
                          updateCell(commentModalRow.id, "email", e.target.value)
                          setCommentModalRow(prev => prev ? { ...prev, email: e.target.value } : null)
                        }
                      }}
                      className="font-semibold text-blue-600 bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-500 w-full min-w-0 outline-none"
                    />
                    {commentModalRow.email && (
                      <button
                        onClick={() => copyToClipboard(commentModalRow.email, "Email")}
                        className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 shrink-0 transition-colors"
                        title="Copiar Email"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Medio de Contacto</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <select
                      value={commentModalRow.contacto || ""}
                      onChange={(e) => {
                        updateCell(commentModalRow.id, "contacto", e.target.value)
                        setCommentModalRow(prev => prev ? { ...prev, contacto: e.target.value } : null)
                      }}
                      className="font-semibold text-zinc-800 bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-500 w-full min-w-0 outline-none h-5.5"
                    >
                      <option value="">- Seleccione -</option>
                      {catalogs?.contactos?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  Comentario
                </label>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${commentSyncState.className}`}>
                  {commentSyncState.label}
                </span>
              </div>

              <textarea
                value={commentDraft}
                onChange={(e) => handleCommentDraftChange(e.target.value)}
                placeholder="Escribe aquí la observación o comentario..."
                className="min-h-70 w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-muted-foreground">
                {commentDraft.length > 0 ? `${commentDraft.length} caracteres escritos` : "Sin texto todavía"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="h-9 px-4 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
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
