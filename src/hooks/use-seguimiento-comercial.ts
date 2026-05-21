import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000"
    }
  }
  return "https://api.geofal.com.pe/v1"
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
  
  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(errText || `API Error: ${res.statusText}`)
  }

  const contentType = res.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    return res.json()
  }
  return res
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
}

export function useSeguimientoComercial(filters: { search?: string; asesor?: string; estado_cliente?: string; limit?: number; offset?: number } = {}) {
  const queryClient = useQueryClient()
  const queryKey = ["seguimiento-comercial", filters]

  // Carga de filas del backend
  const { data, isLoading, refetch } = useQuery<{ total: number; items: SeguimientoRow[] }>({
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
  })

  // Carga de catálogos únicos para los selectores dropdown
  const { data: catalogs } = useQuery<Catalogs>({
    queryKey: ["seguimiento-comercial-catalogs"],
    queryFn: () => fetchWithAuth("/api/seguimiento-comercial/catalogs"),
    staleTime: 60000,
    initialData: { asesores: [], contactos: [], rubros: [], estados: [] }
  })

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
      const res = await fetch(`${getApiBaseUrl()}/api/seguimiento-comercial/export`, { headers })
      if (!res.ok) throw new Error("No se pudo exportar")
      
      const blob = await res.blob()
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
    catalogs,
    isLoading,
    refetch,
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
