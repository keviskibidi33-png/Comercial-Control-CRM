import { useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "")

const getApiBaseUrls = () => {
  const candidates = new Set<string>()

  const envBase = process.env.NEXT_PUBLIC_API_URL ? normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL) : ""
  if (envBase) {
    candidates.add(envBase)
    if (envBase.endsWith("/v1")) {
      candidates.add(envBase.slice(0, -3))
    } else {
      candidates.add(`${envBase}/v1`)
    }
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      candidates.add("http://localhost:8000")
    } else {
      candidates.add("https://api.geofal.com.pe")
      candidates.add("https://api.geofal.com.pe/v1")
    }
  } else if (!envBase) {
    candidates.add("https://api.geofal.com.pe")
  }

  return Array.from(candidates)
}

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem("programacion_access_token") || localStorage.getItem("token")
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const baseUrls = getApiBaseUrls()
  let lastError: Error | null = null

  for (let i = 0; i < baseUrls.length; i += 1) {
    const baseUrl = baseUrls[i]
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (res.ok) {
      const contentType = res.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        return res.json()
      }
      return res
    }

    if (res.status === 404 && i < baseUrls.length - 1) {
      lastError = new Error("No se encontró el recurso solicitado.")
      continue
    }

    const errText = await res.text().catch(() => "")
    let serverMessage = errText
    let validationDetail = ""

    try {
      if (errText) {
        const parsed = JSON.parse(errText)
        if (typeof parsed?.detail === "string") {
          serverMessage = parsed.detail
        } else if (typeof parsed?.message === "string") {
          serverMessage = parsed.message
        } else if (Array.isArray(parsed?.detail)) {
          const fieldTranslations: Record<string, string> = {
            fecha_contacto: "Fecha Contacto",
            persona_contacto: "Persona Contacto",
            numero_celular: "Celular",
            email: "Email",
            razon_social: "Razón Social",
            ruc: "RUC",
            asesor: "Asesor",
            contacto: "Contacto",
            rubro: "Rubro",
            estado_cliente: "Estado Cliente",
            servicio_solicitado: "Servicio Solicitado",
            categoria_servicio: "Categoria Cliente",
            fecha_ultimo_contacto: "Fecha Último Contacto",
            numero_cotizacion: "N° Cotización",
            estado_seguimiento: "Estado Seguimiento"
          }
          const fieldErrors = (parsed.detail as ErrorDetailItem[]).map((err) => {
            const fieldName = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : err.loc
            const fieldKey = String(fieldName ?? "")
            const fieldLabel = fieldTranslations[fieldKey] || fieldKey
            return `${fieldLabel}: ${err.msg}`
          })
          validationDetail = fieldErrors.join(", ")
        }
      }
    } catch {
      // Ignore non-JSON errors.
    }

    const friendlyMap: Record<number, string> = {
      401: "Sesión expirada o sin permisos para consultar Seguimiento Comercial.",
      403: "No tienes permisos para consultar Seguimiento Comercial.",
      404: "No se encontró el recurso solicitado.",
      422: validationDetail 
        ? `La solicitud no es válida. Detalles: ${validationDetail}`
        : "La solicitud no es válida. Revisa los filtros y los datos enviados.",
      500: "El servidor no pudo completar la operación de Seguimiento Comercial.",
    }

    throw new Error(friendlyMap[res.status] || serverMessage || `Error HTTP ${res.status}`)
  }

  throw lastError || new Error("No se encontró el recurso solicitado.")
}

export type SeguimientoRow = {
  id: number
  no?: number
  fecha_contacto?: string
  persona_contacto?: string
  numero_celular?: string
  email?: string
  razon_social?: string
  ruc?: string
  asesor?: string
  contacto?: string
  rubro?: string
  estado_cliente?: string
  servicio_solicitado?: string
  categoria_servicio?: string
  fecha_ultimo_contacto?: string
  comentarios_asistente?: string
  comentarios_asesor?: string
  numero_cotizacion?: string
  costo_cotiz_sin_igv?: string
  estado_seguimiento?: string
  creado_por?: string
  fecha_creacion?: string
  fecha_actualizacion?: string
}

export type Catalogs = {
  asesores: string[]
  contactos: string[]
  rubros: string[]
  estados: string[]
  servicios: string[]
  categorias_servicio: string[]
  estados_seguimiento: string[]
}

const DEFAULT_CATALOGS: Catalogs = {
  asesores: ["Silvia Peralta", "Juan Garcia", "Yerly Yanela Infante"],
  contactos: ["WHATSAPP", "LLAMADA", "CORREO"],
  rubros: ["LABORATORIO", "INGENIERÍA", "ALQUILER", "EN ESPERA"],
  estados: [
    "EN ESPERA DE ATENCIÓN",
    "SE SOLICITÓ INFORMACIÓN",
    "EN ESPERA DE INFORMACIÓN",
    "INFORMACIÓN RECIBIDA",
    "COTIZACIÓN EN PROCESO",
    "COTIZACIÓN REALIZADA",
    "COTIZACIÓN ENVIADA",
    "NO ENVIÓ LA INFORMACIÓN",
    "DESCARTO EL SERVICIO",
  ],
  servicios: [
    "Ensayos de Laboratorio",
    "Densidades",
    "Probetas",
    "Laboratorio en Obra",
    "Estudios de Suelos",
  ],
  categorias_servicio: [
    "Categoria 1 (DEN)",
    "Categoria 2 (PROB)",
    "Categoria 3 (EMS)",
    "Categoria 4 (ALQ)",
    "Categoria 5 (ENS.V.)",
  ],
  estados_seguimiento: [
    "Leads",
    "Contactado",
    "Cotización enviada",
    "Negociación",
    "Venta",
    "Perdido",
    "Seguimiento futuro",
  ],
}

type ErrorDetailItem = {
  loc?: Array<string | number> | string
  msg: string
}

export function useSeguimientoComercial(filters: { search?: string; estado_cliente?: string; limit?: number; offset?: number } = {}) {
  const queryClient = useQueryClient()
  const queryKey = ["seguimiento-comercial", filters]
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // Supabase Realtime subscription disabled to avoid concurrency race conditions during inline editing.
    // Users can refresh data manually using the 'Recargar' button.
    return () => {}
  }, [supabase, queryClient])

  // Carga de filas del backend
  const { data, error: dataError, isLoading, refetch } = useQuery<{ total: number; items: SeguimientoRow[] }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.append("search", filters.search)
      if (filters.estado_cliente) params.append("estado_cliente", filters.estado_cliente)
      if (filters.limit) params.append("limit", String(filters.limit))
      if (filters.offset) params.append("offset", String(filters.offset))
      
      return fetchWithAuth(`/api/seguimiento-comercial?${params.toString()}`)
    },
    staleTime: 15000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Carga de catálogos únicos para los selectores dropdown
  const { data: catalogs, error: catalogsError } = useQuery<Catalogs>({
    queryKey: ["seguimiento-comercial-catalogs"],
    queryFn: () => fetchWithAuth("/api/seguimiento-comercial/catalogs"),
    staleTime: 60000,
    initialData: DEFAULT_CATALOGS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const errorMessage =
    (dataError instanceof Error ? dataError.message : null) ||
    (catalogsError instanceof Error ? catalogsError.message : null)

  const connectionStatus = isLoading
    ? "CONECTANDO"
    : errorMessage
      ? "SIN CONEXIÓN"
      : "EN LÍNEA"

  // Actualización optimista de celdas individuales
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SeguimientoRow> }) => {
      return fetchWithAuth(`/api/seguimiento-comercial/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<{ total: number; items: SeguimientoRow[] }>(queryKey)

      if (previousData) {
        queryClient.setQueryData(queryKey, {
          ...previousData,
          items: previousData.items.map((item) =>
            item.id === id ? { ...item, ...data } : item
          ),
        })
      }

      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
      const message = err instanceof Error ? err.message : "Error al guardar la celda"
      toast.error(`Error al guardar: ${message}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seguimiento-comercial-catalogs"] })
    },
  })

  // Inserción de nueva fila rápida
  const insertMutation = useMutation({
    mutationFn: async (newRow: Partial<SeguimientoRow>) => {
      return fetchWithAuth("/api/seguimiento-comercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      })
    },
    onSuccess: () => {
      toast.success("Nuevo registro creado")
      queryClient.invalidateQueries({ queryKey: ["seguimiento-comercial"] })
      queryClient.invalidateQueries({ queryKey: ["seguimiento-comercial-catalogs"] })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al crear registro"
      toast.error(`Error al crear registro: ${message}`)
    },
  })

  // Eliminar fila
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return fetchWithAuth(`/api/seguimiento-comercial/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      toast.success("Registro eliminado")
      queryClient.invalidateQueries({ queryKey: ["seguimiento-comercial"] })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al eliminar registro"
      toast.error(`Error al eliminar registro: ${message}`)
    },
  })

  // Carga de Excel (Importación)
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return fetchWithAuth("/api/seguimiento-comercial/import", {
        method: "POST",
        body: formData,
      })
    },
    onSuccess: (res) => {
      toast.success(res.message || "Importación exitosa")
      queryClient.invalidateQueries({ queryKey: ["seguimiento-comercial"] })
      queryClient.invalidateQueries({ queryKey: ["seguimiento-comercial-catalogs"] })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error de importación"
      toast.error(`Error de importación: ${message}`)
    },
  })

  // Exportar Excel
  const exportToExcel = async () => {
    try {
      const token = getStoredToken()
      const headers: Record<string, string> = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      const baseUrls = getApiBaseUrls()
      let response: Response | null = null

      for (let i = 0; i < baseUrls.length; i += 1) {
        const res = await fetch(`${baseUrls[i]}/api/seguimiento-comercial/export`, { headers })
        if (res.ok) {
          response = res
          break
        }
        if (res.status === 404 && i < baseUrls.length - 1) {
          continue
        }
        throw new Error("No se pudo exportar")
      }

      if (!response) {
        throw new Error("No se pudo exportar")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "Seguimiento_cliente_comercial.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success("Spreadsheet exportado con éxito")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error de exportación"
      toast.error(`Error de exportación: ${message}`)
    }
  }

  return {
    rows: data?.items || [],
    total: data?.total || 0,
    catalogs: catalogs ?? DEFAULT_CATALOGS,
    isLoading,
    refetch,
    errorMessage,
    connectionStatus,
    updateCell: (id: number, field: keyof SeguimientoRow, value: unknown) => {
      updateMutation.mutate({ id, data: { [field]: value } })
    },
    updateCellAsync: async (id: number, field: keyof SeguimientoRow, value: unknown) => {
      await updateMutation.mutateAsync({ id, data: { [field]: value } })
    },
    insertRow: (newRow: Partial<SeguimientoRow>, options?: { onSuccess?: () => void; onError?: (err: unknown) => void }) => {
      insertMutation.mutate(newRow, options)
    },
    deleteRow: (id: number) => {
      deleteMutation.mutate(id)
    },
    importFromExcel: (file: File) => {
      importMutation.mutate(file)
    },
    exportToExcel,
    isMutating: updateMutation.isPending || insertMutation.isPending || deleteMutation.isPending || importMutation.isPending,
  }
}
