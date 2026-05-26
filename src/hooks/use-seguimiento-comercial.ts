import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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

    try {
      if (errText) {
        const parsed = JSON.parse(errText)
        serverMessage = typeof parsed?.detail === "string" ? parsed.detail : typeof parsed?.message === "string" ? parsed.message : errText
      }
    } catch {
      // Ignore non-JSON errors.
    }

    const friendlyMap: Record<number, string> = {
      401: "Sesión expirada o sin permisos para consultar Seguimiento Comercial.",
      403: "No tienes permisos para consultar Seguimiento Comercial.",
      404: "No se encontró el recurso solicitado.",
      422: "La solicitud no es válida. Revisa los filtros y los datos enviados.",
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
  fecha_ultimo_contacto?: string
  observaciones?: string
  numero_cotizacion?: string
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
}

const DEFAULT_CATALOGS: Catalogs = {
  asesores: ["Silvia Peralta", "Juan Garcia"],
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
    "Morteros",
    "Extracción de Diamantina",
    "Laboratorio en Obra",
    "Estudios de Suelos",
    "EMS – CIMENTACIÓN",
    "EMS – PAVIMENTACIÓN",
    "EMS – ALCANTARILLADO",
    "Estudios Geotécnicos",
  ],
}

export function useSeguimientoComercial(filters: { search?: string; asesor?: string; estado_cliente?: string; limit?: number; offset?: number } = {}) {
  const queryClient = useQueryClient()
  const queryKey = ["seguimiento-comercial", filters]

  // Carga de filas del backend
  const { data, error: dataError, isLoading, refetch } = useQuery<{ total: number; items: SeguimientoRow[] }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.append("search", filters.search)
      if (filters.asesor) params.append("asesor", filters.asesor)
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
      toast.error(`Error al guardar: ${err.message}`)
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
      toast.error(`Error al crear registro: ${err.message}`)
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
      toast.error(`Error al eliminar registro: ${err.message}`)
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
      toast.error(`Error de importación: ${err.message}`)
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
    } catch (err: any) {
      toast.error(`Error de exportación: ${err.message}`)
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
    updateCell: (id: number, field: keyof SeguimientoRow, value: any) => {
      updateMutation.mutate({ id, data: { [field]: value } })
    },
    insertRow: (newRow: Partial<SeguimientoRow>, options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
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
