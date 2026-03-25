"use client"

import React from "react"
import { DataTable } from "@/components/datagrid/data-table"
import { columnsLab } from "@/components/datagrid/columns"
import { columnsComercial } from "@/components/datagrid/columns-comercial"
import { columnsAdmin } from "@/components/datagrid/columns-admin"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { RefreshCw, Wifi, WifiOff, FileDown, Info, Lock, ShieldAlert } from "lucide-react"
import { LoginButton } from "@/components/login-button"
import { useCurrentUser, type ViewMode } from "@/hooks/use-current-user"
import type { ProgramacionServicio } from "@/types/programacion"
import { hasScopedProgramacionViewAccess } from "@/lib/programacion-column-access"

type FixedModuleKind = "laboratorio" | "oficina_tecnica" | "comercial" | "administracion"

interface FixedProgramacionEditorProps {
  kind: FixedModuleKind
  title: string
  subtitle: string
  viewMode: ViewMode
  exportMode: "lab" | "comercial" | "administracion"
  storageNamespace: string
}

const COLUMN_MAP = {
  LAB: columnsLab,
  COM: columnsComercial,
  ADMIN: columnsAdmin,
} as const

function normalizeRole(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function isAdminRole(role: string) {
  return role === "admin" || role === "admin_general" || role.includes("geren") || role.includes("direc") || role.includes("jefe")
}

function isOficinaTecnicaRole(role: string) {
  return role.includes("oficina_tecnica")
}

function isLaboratorioRole(role: string) {
  return (role.includes("laboratorio") || role.includes("tipificador")) && !isOficinaTecnicaRole(role)
}

function isComercialRole(role: string) {
  return role.includes("comercial") || role.includes("vendor") || role.includes("vendedor") || role.includes("asesor")
}

function isAdministracionRole(role: string) {
  return role.includes("administracion") || role.includes("administrativo")
}

function canAccessModule(kind: FixedModuleKind, roleValue: string | null | undefined) {
  const role = normalizeRole(roleValue)

  if (isAdminRole(role)) {
    return true
  }

  switch (kind) {
    case "laboratorio":
      return isLaboratorioRole(role)
    case "oficina_tecnica":
      return isOficinaTecnicaRole(role)
    case "comercial":
      return isComercialRole(role)
    case "administracion":
      return isAdministracionRole(role)
    default:
      return false
  }
}

function UnauthorizedModuleState({ title }: { title: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <ShieldAlert className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-zinc-900">Sin acceso a este módulo</h2>
        <p className="text-zinc-500">
          Tu sesión no tiene habilitado el acceso al iframe de <span className="font-semibold text-zinc-700">{title}</span>.
        </p>
      </div>
    </div>
  )
}

export function FixedProgramacionEditor({
  kind,
  title,
  subtitle,
  viewMode,
  exportMode,
  storageNamespace,
}: FixedProgramacionEditorProps) {
  const { loading: authLoading, userId, role, email, needsAuth, getCanWrite, permissions } = useCurrentUser()
  const { data, isLoading, realtimeStatus, updateField, insertRow, exportToExcel } = useProgramacionData()
  const [filteredItems, setFilteredItems] = React.useState<ProgramacionServicio[]>([])

  const currentColumns = React.useMemo(() => COLUMN_MAP[viewMode], [viewMode])
  const canWrite = React.useMemo(() => getCanWrite(viewMode), [getCanWrite, viewMode])
  const hasScopedAccess = React.useMemo(() => hasScopedProgramacionViewAccess(email, viewMode), [email, viewMode])
  const storageIdentity = React.useMemo(() => userId || email || role || "anonymous", [email, role, userId])
  const tableStateStorageKey = React.useMemo(
    () => `${storageNamespace}:table-state:v1:${storageIdentity}:${viewMode}`,
    [storageIdentity, storageNamespace, viewMode],
  )
  const isAuthorized = React.useMemo(() => canAccessModule(kind, role), [kind, role])

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-zinc-500">Verificando credenciales...</span>
        </div>
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 p-4">
        <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-zinc-900">Acceso Restringido</h2>
          <p className="mb-8 px-4 text-zinc-500">
            Para visualizar o editar este módulo debes iniciar sesión con tus credenciales del CRM.
          </p>
          <div className="mb-8 h-px w-full bg-zinc-100" />
          <LoginButton />
          <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            GEO-FAL S.A.S • Seguridad Interna
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return <UnauthorizedModuleState title={title} />
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-600 p-1.5 text-white shadow-sm">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-800">{title}</h1>
              <p className="text-[11px] text-zinc-500">{subtitle}</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
              {data.length}
            </span>
          </div>

          <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">
            {viewMode === "LAB" ? "Vista Laboratorio" : viewMode === "COM" ? "Vista Comercial" : "Vista Administración"}
          </span>

          {!canWrite && !hasScopedAccess && (
            <span
              className="flex cursor-default items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-600"
              title="Solo lectura para esta vista"
            >
              <Info className="h-3 w-3" />
              Vista Solo Lectura
            </span>
          )}
          {!canWrite && hasScopedAccess && (
            <span
              className="flex cursor-default items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700"
              title="Permiso limitado: solo Entrega real y Estado"
            >
              <Info className="h-3 w-3" />
              Edicion Limitada
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToExcel(filteredItems, exportMode)}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Exportar Excel</span>
          </button>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 shadow-inner"
              title={`Estado Realtime: ${realtimeStatus}`}
            >
              {realtimeStatus === "SUBSCRIBED" ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 animate-pulse text-red-500" />
              )}
              <span className="hidden text-[10px] font-bold uppercase text-zinc-500 sm:inline">
                {realtimeStatus === "SUBSCRIBED" ? "En Línea" : "Sin Conexión"}
              </span>
            </div>
            {isLoading && <span className="text-xs font-medium text-blue-500">Sincronizando...</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-zinc-50 p-1">
        <DataTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          columns={currentColumns as any}
          data={data}
          loading={isLoading}
          onUpdate={updateField}
          onInsert={canWrite ? insertRow : undefined}
          userRole={role || ""}
          userEmail={email || ""}
          canWrite={canWrite}
          permissions={permissions}
          viewMode={viewMode}
          onFilteredDataChange={setFilteredItems}
          storageKey={tableStateStorageKey}
          key={`${storageIdentity}:${storageNamespace}:${viewMode}`}
        />
      </div>
    </div>
  )
}
