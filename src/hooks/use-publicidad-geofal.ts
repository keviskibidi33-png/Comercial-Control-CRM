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
            id_cliente: "ID Cliente",
            contacto: "Contacto",
            telefono: "Teléfono",
            telefono_2: "Teléfono 2",
            correo_referencial: "Correo Referencial",
            razon_social_referencial: "Razón Social Referencial",
          }
          const fieldErrors = (parsed.detail as any[]).map((err) => {
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
      401: "Sesión expirada o sin permisos para consultar Publicidad Geofal.",
      403: "No tienes permisos para consultar Publicidad Geofal.",
      404: "No se encontró el recurso solicitado.",
      422: validationDetail 
        ? `La solicitud no es válida. Detalles: ${validationDetail}`
        : "La solicitud no es válida. Revisa los filtros y los datos enviados.",
      500: "El servidor no pudo completar la operación de Publicidad Geofal.",
    }

    throw new Error(friendlyMap[res.status] || serverMessage || `Error HTTP ${res.status}`)
  }

  throw lastError || new Error("No se encontró el recurso solicitado.")
}

export type PublicidadRow = {
  id: number
  id_cliente?: number
  contacto?: string
  telefono?: string
  telefono_2?: string
  correo_referencial?: string
  razon_social_referencial?: string
  
  junio_asistente?: string
  junio_asesor?: string
  julio_asistente?: string
  julio_asesor?: string
  agosto_asistente?: string
  agosto_asesor?: string
  setiembre_asistente?: string
  setiembre_asesor?: string
  octubre_asistente?: string
  octubre_asesor?: string
  noviembre_asistente?: string
  noviembre_asesor?: string
  diciembre_asistente?: string
  diciembre_asesor?: string
  
  observacion_1?: string
  observacion_2?: string
  creado_por?: string
  fecha_creacion?: string
  fecha_actualizacion?: string
}

export function usePublicidadGeofal(filters: { search?: string; limit?: number; offset?: number } = {}) {
  const queryClient = useQueryClient()
  const queryKey = ["publicidad-geofal", filters]
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const channel = supabase
      .channel("publicidad_geofal_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "publicidad_geofal" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["publicidad-geofal"] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  // Carga de filas del backend
  const { data, error: dataError, isLoading, refetch } = useQuery<{ total: number; items: PublicidadRow[] }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.append("search", filters.search)
      if (filters.limit) params.append("limit", String(filters.limit))
      if (filters.offset) params.append("offset", String(filters.offset))
      
      return fetchWithAuth(`/api/publicidad-geofal?${params.toString()}`)
    },
    staleTime: 15000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const errorMessage = dataError instanceof Error ? dataError.message : null

  const connectionStatus = isLoading
    ? "CONECTANDO"
    : errorMessage
      ? "SIN CONEXIÓN"
      : "EN LÍNEA"

  // Actualización optimista de celdas individuales
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PublicidadRow> }) => {
      return fetchWithAuth(`/api/publicidad-geofal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<{ total: number; items: PublicidadRow[] }>(queryKey)

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
  })

  // Inserción de nueva fila rápida
  const insertMutation = useMutation({
    mutationFn: async (newRow: Partial<PublicidadRow>) => {
      return fetchWithAuth("/api/publicidad-geofal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      })
    },
    onSuccess: () => {
      toast.success("Nuevo registro creado")
      queryClient.invalidateQueries({ queryKey: ["publicidad-geofal"] })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al crear registro"
      toast.error(`Error al crear registro: ${message}`)
    },
  })

  // Eliminar fila
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return fetchWithAuth(`/api/publicidad-geofal/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      toast.success("Registro eliminado")
      queryClient.invalidateQueries({ queryKey: ["publicidad-geofal"] })
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
      return fetchWithAuth("/api/publicidad-geofal/import", {
        method: "POST",
        body: formData,
      })
    },
    onSuccess: (res) => {
      toast.success(res.message || "Importación exitosa")
      queryClient.invalidateQueries({ queryKey: ["publicidad-geofal"] })
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
        const res = await fetch(`${baseUrls[i]}/api/publicidad-geofal/export`, { headers })
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
      a.download = "Seguimiento_cliente_publicidad.xlsx"
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
    isLoading,
    refetch,
    errorMessage,
    connectionStatus,
    updateCell: (id: number, field: keyof PublicidadRow, value: unknown) => {
      updateMutation.mutate({ id, data: { [field]: value } })
    },
    updateCellAsync: async (id: number, field: keyof PublicidadRow, value: unknown) => {
      await updateMutation.mutateAsync({ id, data: { [field]: value } })
    },
    insertRow: (newRow: Partial<PublicidadRow>, options?: { onSuccess?: () => void; onError?: (err: unknown) => void }) => {
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
