import { useEffect, useCallback, useState, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { useCurrentUser } from "./use-current-user"
import { ProgramacionServicio } from "@/types/programacion"
import { toast } from "sonner"

interface DbError {
    message?: string
}

interface DbQueryBuilder<T = unknown> extends PromiseLike<{ data: T | null; error: DbError | null }> {
    select(columns?: string): DbQueryBuilder<T>
    order(column: string, options?: { ascending?: boolean }): DbQueryBuilder<T>
    range(from: number, to: number): DbQueryBuilder<T>
    eq(column: string, value: unknown): DbQueryBuilder<T>
    update(values: Record<string, unknown>): DbQueryBuilder<T>
    insert(values: Record<string, unknown>): DbQueryBuilder<T>
    maybeSingle(): PromiseLike<{ data: T extends Array<infer U> ? U | null : T | null; error: DbError | null }>
    single(): PromiseLike<{ data: T extends Array<infer U> ? U | null : T | null; error: DbError | null }>
}

interface AuthTokenPayload {
    access_token?: unknown
    currentSession?: AuthTokenPayload
    session?: AuthTokenPayload
}

interface RealtimePayload {
    eventType: string
    new: Record<string, unknown> | null
    old: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set that auto-expires entries after `ttl` ms. Prevents single-delete
 *  issues when Supabase fires multiple realtime events for a single write
 *  (e.g. lab INSERT ➜ auto-trigger creates commercial & admin rows). */
class ExpiringSet {
    private map = new Map<string, ReturnType<typeof setTimeout>>()
    add(id: string, ttl = 4000) {
        if (this.map.has(id)) clearTimeout(this.map.get(id)!)
        this.map.set(id, setTimeout(() => this.map.delete(id), ttl))
    }
    has(id: string) { return this.map.has(id) }
    delete(id: string) { if (this.map.has(id)) { clearTimeout(this.map.get(id)!); this.map.delete(id) } }
    clear() { this.map.forEach(t => clearTimeout(t)); this.map.clear() }
}


const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 1000 * 60 * 60 * 24

function parseDateOnlyUtc(dateStr: string | null | undefined) {
    if (!dateStr) return null
    const cleaned = dateStr.trim().split("T")[0]
    const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null

    const [, year, month, day] = match
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    return Number.isNaN(date.getTime()) ? null : date
}

function computeDiasAtraso(estimatedStr: string | null | undefined, realStr: string | null | undefined): number {
    const estimated = parseDateOnlyUtc(estimatedStr)
    if (!estimated) return 0

    const real = parseDateOnlyUtc(realStr)
    if (!real) {
        return -Math.round((estimated.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY)
    }

    return Math.round((real.getTime() - estimated.getTime()) / MS_PER_DAY)
}

const EXPORT_AUTH_TRACE_PREFIX = "[ProgramacionExportAuth]"
const PROGRAMACION_EXPORT_DEBUG = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_IFRAME_BRIDGE === "true"

function buildTraceId() {
    return `prog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function exportDebugLog(message: string, payload?: unknown) {
    if (PROGRAMACION_EXPORT_DEBUG) {
        console.info(`${EXPORT_AUTH_TRACE_PREFIX} ${message}`, payload)
    }
}

function extractLeadingNumber(value: unknown): number | null {
    const match = String(value ?? "").match(/\d+/)
    if (!match) return null

    const parsed = Number.parseInt(match[0], 10)
    return Number.isFinite(parsed) ? parsed : null
}

function normalizeServiceCostValue(value: unknown): string | null {
    if (value === null || value === undefined) return null

    const raw = String(value).trim()
    if (!raw) return null

    const stripped = raw
        .replace(/s\/\.?/gi, "")
        .replace(/\s+/g, "")

    const decimalNormalized = stripped.includes(",") && stripped.includes(".")
        ? stripped.replace(/\./g, "").replace(/,/g, ".")
        : stripped.replace(/,/g, ".")

    const cleaned = decimalNormalized.replace(/[^0-9.-]/g, "")
    if (!cleaned) return null

    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed.toFixed(2) : null
}

function resolveParentOrigin(): string | null {
    if (typeof window === "undefined") return null

    const selfOrigin = window.location.origin
    const candidates = [document.referrer, process.env.NEXT_PUBLIC_CRM_PARENT_ORIGIN]

    for (const candidate of candidates) {
        if (!candidate) continue
        try {
            const origin = new URL(candidate).origin
            if (origin && origin !== selfOrigin) {
                return origin
            }
        } catch {
            // Ignore malformed parent origin candidates.
        }
    }

    return null
}

type ProgramacionModuleKind = "laboratorio" | "oficina_tecnica" | "comercial" | "administracion"

export function useProgramacionData(_moduleKind?: ProgramacionModuleKind) {
    void _moduleKind
    const supabase = useMemo(() => createClient(), [])
    const queryClient = useQueryClient()
    const { loading: authLoading } = useCurrentUser()
    const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED">("CONNECTING")

    // IDs written locally — kept for 4 s so ALL cascade events are skipped
    const pendingLocalIds = useRef(new ExpiringSet())
    const getStoredAccessToken = useCallback((): string | null => {
        if (typeof window === "undefined") return null

        const direct = localStorage.getItem("programacion_access_token")
            || localStorage.getItem("token")
        if (direct) return direct

        const extractToken = (parsed: AuthTokenPayload | null): string | null => {
            if (!parsed) return null
            if (typeof parsed?.access_token === "string" && parsed.access_token) return parsed.access_token
            if (typeof parsed?.currentSession?.access_token === "string" && parsed.currentSession.access_token) return parsed.currentSession.access_token
            if (typeof parsed?.session?.access_token === "string" && parsed.session.access_token) return parsed.session.access_token
            if (Array.isArray(parsed) && typeof parsed[0]?.access_token === "string" && parsed[0].access_token) return parsed[0].access_token
            return null
        }

        // Supabase stores session in keys like sb-<project-ref>-auth-token
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue
            const raw = localStorage.getItem(key)
            if (!raw) continue
            try {
                const parsed = JSON.parse(raw)
                const token = extractToken(parsed)
                if (token) return token
            } catch {
                // Ignore malformed entries
            }
        }

        return null
    }, [])

    const requestTokenFromParent = useCallback(async (traceId: string, timeoutMs = 5000): Promise<string | null> => {
        if (typeof window === "undefined" || window.parent === window) {
            if (PROGRAMACION_EXPORT_DEBUG) {
                console.warn(`${EXPORT_AUTH_TRACE_PREFIX}[${traceId}] Parent token request skipped`, {
                    hasWindow: typeof window !== "undefined",
                    isIframe: typeof window !== "undefined" ? window.parent !== window : false,
                })
            }
            return null
        }

        const parentOrigin = resolveParentOrigin()
        const targetOrigin = parentOrigin ?? "*"

        return await new Promise<string | null>((resolve) => {
            let resolved = false
            const startedAt = Date.now()

            const cleanup = () => {
                window.removeEventListener("message", onMessage)
                clearTimeout(timeoutId)
            }

            const onMessage = (event: MessageEvent) => {
                if (event.source !== window.parent) return
                if (parentOrigin && event.origin !== parentOrigin) return
                if (event.data?.requestId && event.data.requestId !== traceId) return
                if (event.data?.type === "TOKEN_REFRESH" && event.data?.token) {
                    resolved = true
                    cleanup()
                    const token = String(event.data.token)
                    localStorage.setItem("programacion_access_token", token)
                    localStorage.setItem("token", token)
                    exportDebugLog(`[${traceId}] Token received from parent`, {
                        elapsedMs: Date.now() - startedAt,
                        origin: event.origin,
                    })
                    resolve(token)
                }
            }

            const timeoutId = window.setTimeout(() => {
                if (!resolved) {
                    cleanup()
                    console.error(`${EXPORT_AUTH_TRACE_PREFIX}[${traceId}] Parent token request timed out`, {
                        timeoutMs,
                        elapsedMs: Date.now() - startedAt,
                        expectedOrigin: parentOrigin,
                    })
                    resolve(null)
                }
            }, timeoutMs)

            exportDebugLog(`[${traceId}] Requesting token from parent`, {
                timeoutMs,
                origin: window.location.origin,
                targetOrigin,
            })
            window.addEventListener("message", onMessage)
            window.parent.postMessage({ type: "TOKEN_REFRESH_REQUEST", requestId: traceId, source: "programacion_export" }, targetOrigin)
        })
    }, [])

    // 1. Fetch Inicial (Carga los 2000 registros una sola vez)
    const { data: programacion = [], isLoading, refetch } = useQuery({
        queryKey: ["programacion"],
        enabled: !authLoading,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        queryFn: async () => {
            let allData: ProgramacionServicio[] = []
            let from = 0
            let to = 999
            let hasMore = true

            while (hasMore) {
                const { data, error } = await (supabase
                    .from("cuadro_control") as unknown as DbQueryBuilder<ProgramacionServicio[]>)
                    .select("*")
                    .order("item_numero", { ascending: true })
                    .range(from, to)

                if (error) {
                    const message = error?.message || "No se pudo cargar la programación"
                    console.error("[Programacion] No se pudieron cargar los datos de cuadro_control:", message)
                    toast.error("No se pudo cargar la programación")
                    throw new Error(message)
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data]
                    if (data.length < 1000) {
                        hasMore = false
                    } else {
                        from += 1000
                        to += 1000
                    }
                } else {
                    hasMore = false
                }
            }
            return allData
        },
    })

    // 2. Realtime handler — NEVER calls invalidateQueries for UPDATEs
    const handleRealtimePayload = useCallback((payload: RealtimePayload) => {
        const rec = payload.new || payload.old || {}
        const viewId = typeof rec.programacion_id === "string" ? rec.programacion_id : typeof rec.id === "string" ? rec.id : undefined

        // Skip ALL events caused by our own writes (kept 4 s in ExpiringSet)
        if (viewId && pendingLocalIds.current.has(viewId)) {
            return // don't delete — let it expire naturally to catch cascades
        }

        const eventType = payload.eventType

        if (eventType === "DELETE") {
            queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) =>
                old.filter(r => r.id !== viewId)
            )
            return
        }

        // INSERT from another user — add to cache directly from joined-view fetch
        // of just that one row, NOT a full refetch
        if (eventType === "INSERT" && viewId) {
            // Fetch only the new row from the view
            ;(supabase.from("cuadro_control") as unknown as DbQueryBuilder<ProgramacionServicio>)
                .select("*")
                .eq("id", viewId)
                .maybeSingle()
                .then(({ data: newRow }) => {
                    if (!newRow) return
                    queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
                        // Avoid duplicates
                        if (old.some(r => r.id === newRow.id)) return old
                        return [...old, newRow]
                    })
                })
            return
        }

        // UPDATE — merge changed fields in-place (zero network)
        if (eventType === "UPDATE" && payload.new) {
            const changed = payload.new
            queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
                return old.map(row => {
                    if (row.id !== viewId) return row
                    const merged: Record<string, unknown> = { ...row }
                    for (const key of Object.keys(changed)) {
                        if (key === "id" || key === "programacion_id" || key === "created_at") continue
                        merged[key] = changed[key]
                    }
                    return merged as unknown as ProgramacionServicio
                })
            })
        }
    }, [queryClient, supabase])

    // 3. Suscripción Realtime — ZERO invalidateQueries
    useEffect(() => {
        if (authLoading) return

        const channel = supabase
            .channel("programacion_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_lab" },
                handleRealtimePayload
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_comercial" },
                handleRealtimePayload
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_administracion" },
                handleRealtimePayload
            )
            .subscribe((status) => {
                setRealtimeStatus(status)
                if (status === "CHANNEL_ERROR") {
                    toast.error("Error de conexión en tiempo real")
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, authLoading, handleRealtimePayload])

    const updateField = useCallback(async (rowId: string, field: string, value: unknown) => {
        const normalizedValue = field === "costo_servicio" ? normalizeServiceCostValue(value) : value

        // Compute derived delay fields when date fields change.
        // DIAS ATRASO LAB follows Excel K-G: blank ENTREGA REAL means 0 - serial(FECHA ENTREGA).
        const derivedUpdates: Record<string, unknown> = {}
        if (field === "entrega_real" || field === "fecha_entrega_estimada") {
            const row = queryClient.getQueryData<ProgramacionServicio[]>(["programacion"])?.find(r => r.id === rowId)
            if (row) {
                const estimated = field === "fecha_entrega_estimada" ? (normalizedValue as string) : row.fecha_entrega_estimada
                const real = field === "entrega_real" ? (normalizedValue as string) : row.entrega_real
                derivedUpdates.dias_atraso_lab = computeDiasAtraso(estimated, real)
            }
        }

        // 1. Optimistic Update in Cache (instant UI)
        queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
            return oldData.map(row => row.id === rowId ? { ...row, [field]: normalizedValue, ...derivedUpdates } : row)
        })

        // 2. Mark this ID so realtime skips the echo
        pendingLocalIds.current.add(rowId)

        try {
            const commercialFields = ['fecha_solicitud_com', 'fecha_entrega_com', 'evidencia_solicitud_envio', 'dias_atraso_envio_coti', 'motivo_dias_atraso_com', 'costo_servicio']
            const adminFields = ['numero_factura', 'estado_pago', 'estado_autorizar', 'nota_admin', 'orden_servicio', 'numero_valorizacion']

            let targetTable = "programacion_lab"
            let idField = "id"

            if (commercialFields.includes(field)) {
                targetTable = "programacion_comercial"
                idField = "programacion_id"
            } else if (adminFields.includes(field)) {
                targetTable = "programacion_administracion"
                idField = "programacion_id"
            }

            const { error } = await (supabase
                .from(targetTable) as unknown as DbQueryBuilder)
                .update({ [field]: normalizedValue, ...derivedUpdates, updated_at: new Date().toISOString() })
                .eq(idField, rowId)

            if (error) throw error
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo guardar el cambio"
            console.error("[Programacion] Error al actualizar un registro:", message)
            toast.error("No se pudo guardar el cambio")
            pendingLocalIds.current.delete(rowId)
            // Rollback: refetch true state from DB
            queryClient.invalidateQueries({ queryKey: ["programacion"] })
        }
    }, [queryClient, supabase])

    const insertRow = useCallback(async (newRow: Partial<ProgramacionServicio>) => {
        const otNumero = extractLeadingNumber(newRow.ot)
        const labData: Record<string, unknown> = {
            ...newRow,
            ...(otNumero ? { item_numero: otNumero } : {}),
            estado_trabajo: newRow.estado_trabajo || "PENDIENTE",
        }

        if (labData.fecha_entrega_estimada) {
            labData.dias_atraso_lab = computeDiasAtraso(
                String(labData.fecha_entrega_estimada),
                labData.entrega_real ? String(labData.entrega_real) : null
            )
        }

        if (!otNumero) delete labData.item_numero
        delete labData.fecha_solicitud_com
        delete labData.fecha_entrega_com
        delete labData.evidencia_solicitud_envio
        delete labData.motivo_dias_atraso_com
        delete labData.numero_factura
        delete labData.estado_pago
        delete labData.estado_autorizar
        delete labData.nota_admin
        delete labData.orden_servicio
        delete labData.numero_valorizacion
        delete labData.dias_atraso_envio_coti
        delete labData.costo_servicio

        Object.keys(labData).forEach(key => {
            if (labData[key] === undefined || labData[key] === null || labData[key] === '') {
                delete labData[key]
            }
        })

        const { data: insertedData, error: labError } = await (supabase
            .from("programacion_lab") as unknown as DbQueryBuilder<ProgramacionServicio>)
            .insert(labData)
            .select()
            .single()

        if (labError) {
            const message = labError?.message || "No se pudo crear el registro base"
            console.error("[Programacion] Error al crear el registro base:", message)
            toast.error("No se pudo crear el registro base")
            throw new Error(message)
        }

        if (insertedData) {
            const rowId = insertedData.id
            // Mark so realtime skips our own insert echoes
            pendingLocalIds.current.add(rowId)

            const commercialData: Record<string, unknown> = {}
            if (newRow.fecha_solicitud_com) commercialData.fecha_solicitud_com = newRow.fecha_solicitud_com
            if (newRow.fecha_entrega_com) commercialData.fecha_entrega_com = newRow.fecha_entrega_com
            if (newRow.evidencia_solicitud_envio) commercialData.evidencia_solicitud_envio = newRow.evidencia_solicitud_envio
            if (newRow.motivo_dias_atraso_com) commercialData.motivo_dias_atraso_com = newRow.motivo_dias_atraso_com
            if (newRow.costo_servicio !== undefined && newRow.costo_servicio !== null && newRow.costo_servicio !== '') commercialData.costo_servicio = newRow.costo_servicio

            const adminData: Record<string, unknown> = {}
            if (newRow.numero_factura) adminData.numero_factura = newRow.numero_factura
            if (newRow.estado_pago) adminData.estado_pago = newRow.estado_pago
            if (newRow.estado_autorizar) adminData.estado_autorizar = newRow.estado_autorizar
            if (newRow.nota_admin) adminData.nota_admin = newRow.nota_admin
            if (newRow.orden_servicio) adminData.orden_servicio = newRow.orden_servicio
            if (newRow.numero_valorizacion) adminData.numero_valorizacion = newRow.numero_valorizacion

            if (Object.keys(commercialData).length > 0) {
                await (supabase.from("programacion_comercial") as unknown as DbQueryBuilder).update(commercialData).eq("programacion_id", rowId)
            }
            if (Object.keys(adminData).length > 0) {
                await (supabase.from("programacion_administracion") as unknown as DbQueryBuilder).update(adminData).eq("programacion_id", rowId)
            }

            // Add to cache directly from view (single-row fetch, NOT full refetch)
            const { data: viewRow } = await (supabase.from("cuadro_control") as unknown as DbQueryBuilder<ProgramacionServicio>)
                .select("*").eq("id", rowId).maybeSingle()
            if (viewRow) {
                queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
                    if (old.some(r => r.id === viewRow.id)) return old
                    return [...old, viewRow]
                })
            }
        }
    }, [queryClient, supabase])

    const exportToExcel = useCallback(async (items: ProgramacionServicio[], mode: 'lab' | 'comercial' | 'administracion' = 'lab') => {
        const toastId = toast.loading("Generando Excel...")
        const traceId = buildTraceId()
        const startedAt = Date.now()
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const { data: { session } } = await supabase.auth.getSession()
            let sessionToken = session?.access_token || null
            if (!sessionToken) {
                try {
                    const { data } = await supabase.auth.refreshSession()
                    sessionToken = data?.session?.access_token || null
                } catch {
                    // ignore refresh failures; fallback chain continues
                }
            }
            const urlToken = typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("token")
                : null
            const localToken = getStoredAccessToken()
            const parentToken = sessionToken || urlToken || localToken
                ? null
                : await requestTokenFromParent(traceId, 5000)
            const accessToken = sessionToken || urlToken || localToken || parentToken

            exportDebugLog(`[${traceId}] Token source evaluation`, {
                mode,
                itemCount: items.length,
                session: !!sessionToken,
                url: !!urlToken,
                local: !!localToken,
                parent: !!parentToken,
                elapsedMs: Date.now() - startedAt,
            })

            if (!accessToken) {
                const debug = {
                    traceId,
                    session: !!sessionToken,
                    url: !!urlToken,
                    local: !!localToken,
                    parent: !!parentToken,
                    iframe: typeof window !== "undefined" ? window.parent !== window : false,
                }
                if (typeof window !== "undefined" && window.parent !== window) {
                    window.parent.postMessage(
                        { type: "AUTH_REQUIRED", source: "programacion_export", debug, requestId: traceId },
                        resolveParentOrigin() ?? "*",
                    )
                }
                throw new Error(`Token de autenticación requerido para exportar ${JSON.stringify(debug)}`)
            }

            if (typeof window !== "undefined" && accessToken) {
                localStorage.setItem("programacion_access_token", accessToken)
                localStorage.setItem("token", accessToken)
            }
            exportDebugLog(`[${traceId}] Token selected`, {
                source: sessionToken ? "session" : urlToken ? "url" : localToken ? "local" : "parent",
                elapsedMs: Date.now() - startedAt,
            })

            // Determine endpoint based on mode
            const endpointMap = {
                'lab': '/programacion/export',
                'comercial': '/programacion/export/comercial',
                'administracion': '/programacion/export/administracion'
            }
            const endpoint = endpointMap[mode] || '/programacion/export'

            const response = await fetch(`${apiUrl}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ items }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                const message = errorText || "No se pudo exportar el Excel"
                console.error(`${EXPORT_AUTH_TRACE_PREFIX}[${traceId}] No se pudo generar el Excel`, {
                    endpoint,
                    status: response.status,
                    elapsedMs: Date.now() - startedAt,
                })
                throw new Error(message)
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url

            // Filename based on mode
            const modeLabels = { 'lab': 'Lab', 'comercial': 'Comercial', 'administracion': 'Administracion' }
            a.download = `Programacion_${modeLabels[mode]}_${new Date().toISOString().split("T")[0]}.xlsx`

            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast.success("Excel descargado correctamente", { id: toastId })
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo generar el Excel"
            console.error("[Programacion] Error al exportar Excel:", message)
            toast.error("No se pudo generar el Excel", { id: toastId })
        }
    }, [getStoredAccessToken, requestTokenFromParent, supabase])

    return {
        data: programacion,
        isLoading,
        refetch,
        realtimeStatus,
        updateField,
        insertRow,
        exportToExcel
    }
}
