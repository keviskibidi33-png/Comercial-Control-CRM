
"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import { DataTable } from "@/components/datagrid/data-table"
import { columnsLab } from "@/components/datagrid/columns"
import { columnsComercial } from "@/components/datagrid/columns-comercial"
import { columnsAdmin } from "@/components/datagrid/columns-admin"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { RefreshCw, Wifi, WifiOff, FileDown, Info, Lock } from "lucide-react"
import { LoginButton } from "@/components/login-button"
import { useCurrentUser } from "@/hooks/use-current-user"
import type { ProgramacionServicio } from "@/types/programacion"
import { hasScopedProgramacionViewAccess } from "@/lib/programacion-column-access"

type ViewMode = "LAB" | "COM" | "ADMIN"

const PROGRAMACION_VIEW_STORAGE_PREFIX = "programacion:last-view:v1"
const PROGRAMACION_TABLE_STORAGE_PREFIX = "programacion:table-state:v1"

const roleToViewMap: Record<string, ViewMode> = {
    admin: "ADMIN",
    administrativo: "ADMIN",
    vendor: "COM",
    auxiliar_comercial: "COM",
    laboratorio_lector: "LAB",
    laboratorio_tipificador: "LAB",
    oficina_tecnica: "LAB",
    oficina_tecnica_humedad: "LAB",
    oficina_tecnica_humedad_tipificador: "LAB",
}

function normalizeModeParam(modeParam: string | null): ViewMode | null {
    if (modeParam === "comercial" || modeParam === "com") return "COM"
    if (modeParam === "admin" || modeParam === "administracion") return "ADMIN"
    if (modeParam === "lab" || modeParam === "laboratorio") return "LAB"
    return null
}

function inferViewFromRole(roleParam: string): ViewMode {
    const normalizedRole = roleParam.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    if (roleToViewMap[normalizedRole]) {
        return roleToViewMap[normalizedRole]
    }

    if (normalizedRole.includes("admin") || normalizedRole.includes("geren") || normalizedRole.includes("direc") || normalizedRole.includes("jefe")) {
        return "ADMIN"
    }
    if (normalizedRole.includes("comercial") || normalizedRole.includes("vendedor") || normalizedRole.includes("asesor") || normalizedRole.includes("vendor") || normalizedRole.includes("ventas")) {
        return "COM"
    }
    return "LAB"
}

function readStoredView(identity: string): ViewMode | null {
    if (typeof window === "undefined") return null

    try {
        const rawValue = window.localStorage.getItem(`${PROGRAMACION_VIEW_STORAGE_PREFIX}:${identity}`)
        if (rawValue === "LAB" || rawValue === "COM" || rawValue === "ADMIN") {
            return rawValue
        }
    } catch {
        // Ignore localStorage read errors and continue with defaults.
    }

    return null
}

export function DatagridEditor() {
    const searchParams = useSearchParams()
    const modeParam = searchParams.get('mode')
    const { loading: authLoading, userId, role, email, allowedViews, getCanView, getCanWrite, needsAuth, permissions } = useCurrentUser()
    const { data, isLoading, realtimeStatus, updateField, insertRow, exportToExcel } = useProgramacionData()

    // State to track filtered data for Excel export
    const [filteredItems, setFilteredItems] = React.useState<ProgramacionServicio[]>([])

    // Initialize state based on URL param, with role-based fallback
    const roleParam = searchParams.get('role') || ''
    const explicitMode = React.useMemo(() => normalizeModeParam(modeParam), [modeParam])
    const storageIdentity = React.useMemo(
        () => userId || roleParam || role || "anonymous",
        [role, roleParam, userId],
    )
    const hasRestoredStoredViewRef = React.useRef<string | null>(null)

    const [viewMode, setViewMode] = React.useState<ViewMode>(() => explicitMode ?? inferViewFromRole(roleParam))


    const canWrite = React.useMemo(() => getCanWrite(viewMode), [viewMode, getCanWrite])
    const hasScopedLabColumnAccess = hasScopedProgramacionViewAccess(email, viewMode)

    // URL mode always wins over local persistence.
    React.useEffect(() => {
        if (explicitMode) {
            setViewMode(explicitMode)
        }
    }, [explicitMode])

    // Restore the user's last view when there is no explicit URL override.
    React.useEffect(() => {
        if (authLoading || explicitMode || !storageIdentity) return
        if (hasRestoredStoredViewRef.current === storageIdentity) return

        hasRestoredStoredViewRef.current = storageIdentity
        const storedView = readStoredView(storageIdentity)
        if (storedView) {
            setViewMode(storedView)
        }
    }, [authLoading, explicitMode, storageIdentity])


    // Enforce Permissions Logic: Sync view mode with allowed views
    React.useEffect(() => {
        if (!authLoading && !needsAuth && allowedViews.length > 0) {
            // High-level role detection for bypass
            const rNorm = (role || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const isHighLevel = rNorm.includes("admin") || rNorm.includes("geren") || rNorm.includes("administra") || rNorm.includes("direc") || rNorm.includes("jefe")

            // Bypass security reset if we have high-level role or explicit permission
            const hasAccess = isHighLevel || allowedViews.includes(viewMode)

            if (!hasAccess) {
                setViewMode(allowedViews[0])
            }
        }
    }, [authLoading, needsAuth, allowedViews, viewMode, role])

    React.useEffect(() => {
        if (authLoading || needsAuth || explicitMode || !storageIdentity) return
        if (typeof window === "undefined") return

        const normalizedRole = (role || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const isHighLevel = normalizedRole.includes("admin") || normalizedRole.includes("geren") || normalizedRole.includes("administra") || normalizedRole.includes("direc") || normalizedRole.includes("jefe")

        if (!isHighLevel && allowedViews.length > 0 && !allowedViews.includes(viewMode)) return

        try {
            window.localStorage.setItem(`${PROGRAMACION_VIEW_STORAGE_PREFIX}:${storageIdentity}`, viewMode)
        } catch {
            // Ignore localStorage write errors to avoid blocking the UI.
        }
    }, [allowedViews, authLoading, explicitMode, needsAuth, role, storageIdentity, viewMode])

    // Determine which columns to show based on view mode
    const currentColumns = React.useMemo(() => {
        if (viewMode === 'COM') return columnsComercial
        if (viewMode === 'ADMIN') return columnsAdmin
        return columnsLab
    }, [viewMode])

    const tableStateStorageKey = React.useMemo(
        () => `${PROGRAMACION_TABLE_STORAGE_PREFIX}:${storageIdentity}:${viewMode}`,
        [storageIdentity, viewMode],
    )

    // 1. Loading State
    if (authLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-zinc-500 text-sm font-medium">Verificando credenciales...</span>
                </div>
            </div>
        )
    }

    // 2. Auth Required State (Direct access protection)
    if (needsAuth) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 p-4">
                <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-zinc-200 p-8 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 mb-2">Acceso Restringido</h2>
                    <p className="text-zinc-500 mb-8 px-4">
                        Para visualizar o editar la programación, debes iniciar sesión con tus credenciales de usuario.
                    </p>
                    <div className="w-full h-px bg-zinc-100 mb-8" />
                    <LoginButton />
                    <p className="mt-6 text-[11px] text-zinc-400 uppercase tracking-widest font-semibold font-mono">
                        GEO-FAL S.A.S • Seguridad Interna
                    </p>
                </div>
            </div>
        )
    }

    // 3. Main Dashboard View
    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header / Actions */}
            <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-4 bg-white shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white p-1.5 rounded-md shadow-sm">
                            <RefreshCw className="w-4 h-4" />
                        </div>
                        <h1 className="font-semibold text-lg tracking-tight text-zinc-800">
                            Programación
                        </h1>
                        <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200 font-mono">
                            {data.length}
                        </span>
                    </div>

                    {/* VIEW TOGGLE TABS */}
                    <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                        {getCanView("LAB") && (
                            <button
                                onClick={() => setViewMode("LAB")}
                                className={`px-4 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === "LAB" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                            >
                                Laboratorio
                            </button>
                        )}
                        {getCanView("COM") && (
                            <button
                                onClick={() => setViewMode("COM")}
                                className={`px-4 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === "COM" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                            >
                                Comercial
                            </button>
                        )}
                        {getCanView("ADMIN") && (
                            <button
                                onClick={() => setViewMode("ADMIN")}
                                className={`px-4 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === "ADMIN" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                            >
                                Administración
                            </button>
                        )}
                    </div>

                    {!canWrite && !hasScopedLabColumnAccess && (
                        <span className="px-2.5 py-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-1.5 cursor-default" title="Solo lectura para esta vista">
                            <Info className="w-3 h-3" />
                            Vista Solo Lectura
                        </span>
                    )}
                    {!canWrite && hasScopedLabColumnAccess && (
                        <span className="px-2.5 py-1 text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-1.5 cursor-default" title="Permiso limitado: solo Entrega real y Estado">
                            <Info className="w-3 h-3" />
                            Edicion Limitada
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const modeMap = { 'LAB': 'lab', 'COM': 'comercial', 'ADMIN': 'administracion' } as const
                            exportToExcel(filteredItems, modeMap[viewMode])
                        }}
                        disabled={data.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Exportar Excel</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-50 border border-zinc-200 shadow-inner" title={`Estado Realtime: ${realtimeStatus}`}>
                            {realtimeStatus === "SUBSCRIBED" ? (
                                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                                <WifiOff className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                            )}
                            <span className="text-[10px] uppercase font-bold text-zinc-500 hidden sm:inline">
                                {realtimeStatus === "SUBSCRIBED" ? "En Línea" : "Sin Conexión"}
                            </span>
                        </div>
                        {isLoading && <span className="text-xs text-blue-500 animate-pulse font-medium">Sincronizando...</span>}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden bg-zinc-50 p-1">
                <DataTable
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    columns={currentColumns as any}
                    data={data}
                    loading={isLoading}
                    onUpdate={updateField}
                    onInsert={canWrite ? insertRow : undefined}
                    userRole={role || ''}
                    userEmail={email || ''}
                    canWrite={canWrite}
                    permissions={permissions}
                    viewMode={viewMode}
                    onFilteredDataChange={setFilteredItems}
                    storageKey={tableStateStorageKey}
                    key={`${storageIdentity}:${viewMode}`} // Reset table internals only when user/view changes.
                />
            </div>
        </div>
    )
}
