"use client"

import { Column, ColumnDef, RowData, Table } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusSelect } from "./status-select"
import { AuthorizationSelect } from "./authorization-select"
import { PaymentSelect } from "./payment-select"
import { toast } from "sonner"
import { hasScopedProgramacionColumnAccess, normalizeProgramacionAccessValue } from "@/lib/programacion-column-access"

// Extend meta to support custom cell editing
declare module "@tanstack/react-table" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        updateData: (rowId: string, columnId: string, value: unknown) => void
    }
}

// Utility to format date as DD/MM/YY
const formatDateToShort = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = String(date.getFullYear()).slice(-2)
        return `${day}/${month}/${year}`
    } catch {
        return dateStr
    }
}

// Export components for use in other column definitions
export { EditableCell, OTCell, SmartDateCell, CotizacionCell, AutorizacionCell, PaymentStatusCell, StatusCell }

export type EditableCellProps<TData> = {
    getValue: () => unknown
    row: { index: number, original: TData }
    column: { id: string }
    table: Table<TData>
    className?: string
}

// Editable Cell Component
// Editable Cell Component
const EditableCell = React.memo(({ getValue, row: { original }, column: { id }, table, className }: EditableCellProps<ProgramacionServicio>) => {
    const initialValue = getValue()
    const [value, setValue] = React.useState(initialValue)

    // --- Column-Based Permissions by Role ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)

    const getCanWriteColumn = (): boolean => {
        // 1. GLOBAL OVERRIDE (Read-only tab)
        if (meta?.canWrite === false) return false

        // 2. ROLE-SPECIFIC COLUMN LOCKS
        // lector = NO puede editar NADA
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false

        // tipificador = Puede editar TODO excepto cotizacion_lab
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) {
            const blockedColumns = ['cotizacion_lab']
            if (blockedColumns.includes(id)) return false
            return true
        }

        // vendor = Puede editar TODO excepto estado_pago
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) {
            const blockedColumns = ['estado_pago']
            if (blockedColumns.includes(id)) return false
            return true
        }

        // administrativo = Puede editar TODO excepto cotizacion_lab, cliente_nombre, proyecto
        if (userRole === 'administrativo' || userRole.includes('administrativo')) {
            const blockedColumns = ['cotizacion_lab', 'cliente_nombre', 'proyecto']
            if (blockedColumns.includes(id)) return false
            return true
        }

        // 3. DEFAULT: use global canWrite
        return meta?.canWrite ?? false
    }

    const canWrite = getCanWriteColumn()

    // Sync external changes
    React.useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    const onBlur = () => {
        if (value !== initialValue) {
            table.options.meta?.updateData(original.id, id, value)
        }
    }

    // Navigation Logic
    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()

            // Wait for blur to process, then move focus
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentElement = e.target as HTMLElement;
                const currentIndex = allInputs.indexOf(currentElement);

                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) {
                        (allInputs[currentIndex + 1] as HTMLInputElement).select();
                    }
                }
            }, 0)
        }
    }

    const isDate = id.includes('fecha') || id === 'entrega_real'
    const colorClass = "text-zinc-900"
    const textSize = className?.includes('text-') ? '' : 'text-sm'

    if (!canWrite) {
        return (
            <div className={cn("px-1 py-1 truncate cursor-not-allowed bg-zinc-50/30 font-medium", colorClass, textSize, className)} title="Sin permiso de edición">
                {isDate ? formatDateToShort(value as string) : (value as string || "-")}
            </div>
        )
    }

    if (isDate) {
        return (
            <input
                type="date"
                value={(value as string)?.split('T')[0] ?? ""}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                className={cn(
                    "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 h-full placeholder:text-zinc-400",
                    colorClass,
                    textSize,
                    className
                )}
            />
        )
    }

    return (
        <textarea
            value={(value as string) ?? ""}
            onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            rows={1}
            style={{
                fieldSizing: "content",
                minHeight: "1.5em",
                resize: "none"
            }}
            className={cn(
                "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 resize-none overflow-hidden block leading-tight whitespace-pre-wrap py-1 placeholder:text-zinc-400",
                colorClass,
                textSize,
                className
            )}
        />
    )
})
EditableCell.displayName = "EditableCell"

// OT Cell (Auto-adds -26 when user enters just digits)
const OTCell = React.memo(({ getValue, row: { original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const rawValue = getValue() as string
    const cleanValue = (val: string) => val ? val.replace(/LEM/i, '').replace(/-26$/, '').trim() : ""
    const [value, setValue] = React.useState(cleanValue(rawValue))

    React.useEffect(() => {
        setValue(cleanValue(rawValue))
    }, [rawValue])

    // Permission check - Column-based restrictions by role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)

    const getCanWriteColumn = (): boolean => {
        if (meta?.canWrite === false) return false
        if (userRole === 'admin') return true
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) return true
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) return true
        if (userRole === 'administrativo') return true
        return meta?.canWrite ?? false
    }
    const canWrite = getCanWriteColumn()

    const onBlur = () => {
        if (!canWrite) return
        let finalValue = value.trim()
        if (finalValue && /^\d+$/.test(finalValue)) {
            finalValue = `${finalValue}-26`
        } else if (finalValue && !finalValue.includes('-26')) {
            finalValue = finalValue.replace(/-$/, '')
            if (/^\d+$/.test(finalValue)) {
                finalValue = `${finalValue}-26`
            }
        }
        if (finalValue !== rawValue) {
            table.options.meta?.updateData(original.id, id, finalValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentIndex = allInputs.indexOf(e.target as HTMLElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) {
                        (allInputs[currentIndex + 1] as HTMLInputElement).select();
                    }
                }
            }, 0)
        }
    }

    return (
        <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            disabled={!canWrite}
            className={cn(
                "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 -mx-1 h-full text-zinc-900 font-medium disabled:opacity-70",
                !canWrite && "cursor-not-allowed"
            )}
            placeholder="OT #"
        />
    )
})
OTCell.displayName = "OTCell"

// Smart Date Cell (DD/MM -> YYYY-MM-DD)
const SmartDateCell = React.memo(({ getValue, row: { original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const rawValue = getValue() as string
    const formatDisplay = (val: string) => {
        if (!val) return ""
        try {
            const date = new Date(val)
            if (isNaN(date.getTime())) return val
            const d = String(date.getUTCDate()).padStart(2, '0')
            const m = String(date.getUTCMonth() + 1).padStart(2, '0')
            const y = String(date.getUTCFullYear()).slice(-2)
            return `${d}/${m}/${y}`
        } catch { return val }
    }

    const [inputValue, setInputValue] = React.useState(formatDisplay(rawValue))
    const [isEditing, setIsEditing] = React.useState(false)

    // Permission check - Column-based restrictions by role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)
    const hasScopedAccess = hasScopedProgramacionColumnAccess(meta?.userEmail, id, meta?.viewMode)

    const getCanWriteColumn = (): boolean => {
        if (hasScopedAccess) return true
        if (meta?.canWrite === false) return false
        if (userRole === 'admin') return true
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) return true
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) return true
        if (userRole === 'administrativo') return true
        return meta?.canWrite ?? false
    }
    const canWrite = getCanWriteColumn()

    React.useEffect(() => {
        setInputValue(formatDisplay(rawValue))
    }, [rawValue])

    const onBlur = () => {
        if (!canWrite) {
            setIsEditing(false)
            return
        }
        setIsEditing(false)
        const finalVal = inputValue.trim()
        let valToParse = finalVal
        if (/^\d{3}$/.test(valToParse)) valToParse = "0" + valToParse
        const shortDateRegex = /^(\d{1,2})[./探](\d{1,2})$/
        const numericMatch = valToParse.match(/^(\d{2})(\d{2})(\d{2}|\d{4})?$/)
        const match = valToParse.match(shortDateRegex)
        let isoDate = null
        if (numericMatch) {
            const day = numericMatch[1]; const month = numericMatch[2]
            let year = numericMatch[3] || "2026"
            if (year.length === 2) year = "20" + year
            isoDate = `${year}-${month}-${day}`
        } else if (match) {
            const day = match[1].padStart(2, '0'); const month = match[2].padStart(2, '0')
            isoDate = `2026-${month}-${day}`
        } else {
            const fullDateRegex = /^(\d{1,2})[./探](\d{1,2})[./探](\d{4}|\d{2})$/
            const fullMatch = finalVal.match(fullDateRegex)
            if (fullMatch) {
                const d = fullMatch[1].padStart(2, '0'); const m = fullMatch[2].padStart(2, '0')
                let y = fullMatch[3]; if (y.length === 2) y = "20" + y
                isoDate = `${y}-${m}-${d}`
            }
        }
        if (isoDate && !isNaN(new Date(isoDate).getTime())) {
            table.options.meta?.updateData(original.id, id, isoDate)
            setInputValue(formatDisplay(isoDate))
        } else {
            if (inputValue === "") table.options.meta?.updateData(original.id, id, null)
            else setInputValue(formatDisplay(rawValue))
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentIndex = allInputs.indexOf(e.target as HTMLElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) (allInputs[currentIndex + 1] as HTMLInputElement).select();
                }
            }, 0)
        }
    }

    if (isEditing) {
        return (
            <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                placeholder="dd/mm"
                className="w-full bg-white border border-blue-400 rounded px-1 -mx-1 h-full text-zinc-900 font-medium"
            />
        )
    }

    return (
        <div
            onClick={() => { if (canWrite) setIsEditing(true); }}
            className={cn(
                "w-full h-full flex items-center px-1 text-zinc-900 font-medium leading-tight",
                canWrite ? "cursor-pointer hover:bg-zinc-100/50" : "cursor-not-allowed bg-zinc-50/30"
            )}
            title={canWrite ? "Click para editar" : "Sin permiso de edición"}
        >
            {inputValue || <span className="text-zinc-300">--/--</span>}
        </div>
    )
})
SmartDateCell.displayName = "SmartDateCell"

// Date Display Component (Shows DD/MM/YY, becomes picker on click)
const DateDisplayCell = React.memo(({ getValue, row, column, table, className }: EditableCellProps<ProgramacionServicio>) => {
    const [isEditing, setIsEditing] = React.useState(false)
    const value = getValue() as string
    const formatted = formatDateToShort(value)

    if (isEditing) {
        return (
            <div onBlur={() => setIsEditing(false)}>
                <EditableCell getValue={getValue} row={row} column={column} table={table} className={className} />
            </div>
        )
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={cn("w-full h-full cursor-pointer hover:bg-zinc-100/50 flex items-center px-1 text-zinc-900", className)}
        >
            {formatted || <span className="text-zinc-300">--/--/--</span>}
        </div>
    )
})
DateDisplayCell.displayName = "DateDisplayCell"

// Codigo Muestra Cell (Wraps text, multi-line display)
const CodigoMuestraCell = React.memo(({ getValue, row: { original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    // Permission check - Column-based restrictions by role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)

    const getCanWriteColumn = (): boolean => {
        if (meta?.canWrite === false) return false
        if (userRole === 'admin') return true
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) return true
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) return true
        if (userRole === 'administrativo') return true
        return meta?.canWrite ?? false
    }
    const canWrite = getCanWriteColumn()

    const onBlur = () => {
        setIsEditing(false)
        if (inputValue !== value) {
            // Validation: Check if the new code already exists in the table (excluding this row)
            const data = (table.options.data as ProgramacionServicio[]) || []
            const isDuplicate = data.some(row =>
                row.id !== original.id &&
                row.codigo_muestra?.trim().toLowerCase() === inputValue.trim().toLowerCase()
            )

            if (isDuplicate && inputValue.trim() !== "") {
                toast.error("Código de muestra duplicado", {
                    description: `El código "${inputValue}" ya existe en otra fila.`,
                })
                setInputValue(value || "") // Revert local state
                return
            }

            table.options.meta?.updateData(original.id, id, inputValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentIndex = allInputs.indexOf(e.target as HTMLElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) (allInputs[currentIndex + 1] as HTMLInputElement).select();
                }
            }, 0)
        }
    }

    if (isEditing) {
        return <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} className="w-full h-full bg-white border border-blue-300 rounded text-sm px-1 font-medium text-zinc-900" />
    }

    return (
        <div
            onClick={() => { if (canWrite) { setInputValue(value || ""); setIsEditing(true); } }}
            className={cn("w-full h-full flex items-center px-1 text-sm text-zinc-900 font-medium leading-tight break-words", canWrite ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed bg-zinc-50/30")}
            title={value || "Click para editar"}
        >
            <span className="line-clamp-3">{value || <span className="text-zinc-300 italic">...</span>}</span>
        </div>
    )
})
CodigoMuestraCell.displayName = "CodigoMuestraCell"

const SortableHeader = ({ column, title, className }: { column: Column<ProgramacionServicio, unknown>, title: string, className?: string }) => {
    return (
        <div
            className={cn("flex items-center justify-center space-x-1 cursor-pointer select-none group hover:bg-slate-100/50 px-2 py-1.5 rounded", className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            <span className={cn("font-semibold whitespace-pre-line text-center leading-tight text-zinc-800", className)}>{title}</span>
            <ArrowUpDown className={cn("h-3 w-3 shrink-0 text-zinc-400 group-hover:text-zinc-700")} />
        </div>
    )
}

// Cotizacion Cell (Auto-formats number to COTIZ.N-XXX-26)
// Granular: Depends on permissions.comercial.write
const CotizacionCell = React.memo(({ getValue, row: { original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    // --- Column-based permissions: tipificador and administrativo CANNOT edit cotizacion_lab ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)

    const getCanEditCotizacion = (): boolean => {
        if (meta?.canWrite === false) return false
        const viewMode = meta?.viewMode || ""
        if (userRole === 'admin') {
            if (viewMode === 'LAB' || viewMode === 'ADMIN') return false
            return true
        }
        // tipificador cannot edit cotizacion
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) return false
        // administrativo cannot edit cotizacion
        if (userRole === 'administrativo') return false
        // lector cannot edit anything
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false
        // vendor CAN edit cotizacion
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) return true
        return meta?.canWrite ?? false
    }
    const canEdit = getCanEditCotizacion()

    const onBlur = () => {
        setIsEditing(false)
        if (!canEdit) return

        let finalValue = inputValue.trim()
        if (finalValue && /^\d+$/.test(finalValue)) {
            finalValue = `COTIZ.N-${finalValue}-26`
        } else if (finalValue.startsWith("COTIZACION-")) {
            finalValue = finalValue.replace("COTIZACION-", "COTIZ.N-")
        }

        if (finalValue !== value) {
            table.options.meta?.updateData(original.id, id, finalValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentIndex = allInputs.indexOf(e.target as HTMLElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) (allInputs[currentIndex + 1] as HTMLInputElement).select();
                }
            }, 0)
        }
    }

    if (!canEdit) {
        return (
            <div className="w-full h-full flex items-center px-1 text-sm text-zinc-900 font-medium bg-zinc-50/50 cursor-not-allowed" title="Solo Comercial puede editar">
                {value || <span className="text-zinc-300 italic">-</span>}
            </div>
        )
    }

    if (isEditing) {
        return (
            <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1 text-zinc-900 font-medium"
                placeholder="Ej: 123"
            />
        )
    }

    return (
        <div
            onClick={() => { setInputValue(value || ""); setIsEditing(true); }}
            className="w-full h-full cursor-pointer hover:bg-slate-50 flex items-center px-1 text-sm truncate text-zinc-900 font-medium"
            title={value || "Click para editar (Comercial)"}
        >
            {value || <span className="text-zinc-300 italic">...</span>}
        </div>
    )
})
CotizacionCell.displayName = "CotizacionCell"

// Status Cell (Estado de trabajo) - blocks lector role
const StatusCell = React.memo(({ getValue, row: { original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string

    // --- Column-based permissions: lector CANNOT edit estado_trabajo ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)
    const hasScopedAccess = hasScopedProgramacionColumnAccess(meta?.userEmail, id, meta?.viewMode)

    const getCanEditStatus = (): boolean => {
        if (hasScopedAccess) return true
        if (meta?.canWrite === false) return false
        if (userRole === 'admin') return true
        // lector cannot edit anything
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false
        // tipificador CAN edit estado
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) return true
        // vendor CAN edit estado
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) return true
        // administrativo CAN edit estado
        if (userRole === 'administrativo') return true
        return meta?.canWrite ?? false
    }
    const canEdit = getCanEditStatus()

    const handleChange = (newValue: string) => {
        if (!canEdit) return
        if (newValue !== value) table.options.meta?.updateData(original.id, id, newValue)
    }

    return (
        <div className={cn("text-[13px] font-medium", !canEdit && "cursor-not-allowed opacity-60")}>
            <StatusSelect value={value} onChange={handleChange} disabled={!canEdit} />
        </div>
    )
})
StatusCell.displayName = "StatusCell"

// Autorizacion Cell (Dropdown)
// Granular: Depends on permissions.administracion.write
const AutorizacionCell = React.memo(({ getValue, row: { original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string

    // --- Column-based permissions: tipificador CANNOT edit autorizacion_lab ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)

    const getCanEditAutorizacion = (): boolean => {
        if (meta?.canWrite === false) return false
        const viewMode = meta?.viewMode || ""
        if (userRole === 'admin') {
            if (viewMode === 'LAB') return false
            return true
        }
        // tipificador cannot edit autorizacion
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) return false
        // lector cannot edit anything
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false
        // vendor/comercial CANNOT edit autorizacion - solo administrativo
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) return false
        // administrativo CAN edit autorizacion
        if (userRole === 'administrativo') return true
        return meta?.canWrite ?? false
    }
    const canEdit = getCanEditAutorizacion()

    const handleChange = (newValue: string) => {
        if (!canEdit) return
        table.options.meta?.updateData(original.id, id, newValue)
    }

    return (
        <div className={cn("w-full h-full flex items-center justify-center p-1", !canEdit && "cursor-not-allowed")}>
            <AuthorizationSelect
                value={value}
                onChange={handleChange}
                disabled={!canEdit}
            />
        </div>
    )
})
AutorizacionCell.displayName = "AutorizacionCell"

const PaymentStatusCell = React.memo(({ getValue, row, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string

    // --- Column-based permissions: vendor CANNOT edit estado_pago ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const userRole = normalizeProgramacionAccessValue(meta?.userRole)

    const getCanEditPayment = (): boolean => {
        if (meta?.canWrite === false) return false
        const viewMode = meta?.viewMode || ""
        if (userRole === 'admin') {
            if (viewMode === 'COM') return false
            return true
        }
        // vendor cannot edit estado_pago
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) return false
        // lector cannot edit anything
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) return false
        // tipificador CAN edit estado_pago
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) return true
        // administrativo CAN edit estado_pago
        if (userRole === 'administrativo') return true
        return meta?.canWrite ?? false
    }
    const canEdit = getCanEditPayment()

    const onStatusChange = (newValue: string) => {
        if (!canEdit) return
        table.options.meta?.updateData(row.original.id, id, newValue)
    }
    return (
        <div className={cn("w-full h-full flex items-center justify-center p-1", !canEdit && "cursor-not-allowed")}>
            <PaymentSelect value={value} onChange={onStatusChange} disabled={!canEdit} />
        </div>
    )
})
PaymentStatusCell.displayName = "PaymentStatusCell"

export const columnsLab: ColumnDef<ProgramacionServicio>[] = [
    {
        accessorKey: "item_numero",
        header: ({ column }) => <SortableHeader column={column} title="ITEM" />,
        size: 69,
        minSize: 69,
        maxSize: 69,
        enablePinning: true,
        enableResizing: false,
        cell: info => <div className="text-zinc-600 font-mono text-sm text-center bg-white h-full flex items-center justify-center">{info.getValue() as string}</div>
    },
    {
        accessorKey: "recep_numero",
        header: ({ column }) => <SortableHeader column={column} title="RECEP" />,
        size: 78,
        minSize: 78,
        maxSize: 78,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "ot",
        header: ({ column }) => <SortableHeader column={column} title="OT" />,
        size: 125,
        minSize: 125,
        maxSize: 125,
        enablePinning: true,
        enableResizing: false,
        cell: OTCell,
    },
    {
        accessorKey: "codigo_muestra",
        header: ({ column }) => <SortableHeader column={column} title="CODIGO MUESTRA" />,
        size: 140,
        minSize: 140,
        maxSize: 140,
        enablePinning: true,
        enableResizing: false,
        cell: CodigoMuestraCell,
    },
    {
        accessorKey: "fecha_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nRECEPCION`} />,
        size: 115,
        minSize: 115,
        maxSize: 115,
        enablePinning: true,
        enableResizing: false,
        cell: SmartDateCell,
    },
    {
        accessorKey: "fecha_inicio",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nINICIO`} />,
        size: 110,
        minSize: 110,
        maxSize: 110,
        enablePinning: true,
        enableResizing: false,
        cell: SmartDateCell,
    },
    {
        accessorKey: "fecha_entrega_estimada",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nENTREGA`} />,
        size: 110,
        minSize: 110,
        maxSize: 110,
        enablePinning: true,
        enableResizing: false,
        cell: SmartDateCell,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 160,
        minSize: 160,
        maxSize: 160,
        enablePinning: true,
        enableResizing: false,
        cell: (props) => <EditableCell {...props} className="text-[12.5px] leading-3 text-zinc-900 font-medium break-words whitespace-normal" />,
    },
    {
        accessorKey: "proyecto",
        header: ({ column }) => <SortableHeader column={column} title="PROYECTO" />,
        size: 150,
        minSize: 100,
        maxSize: 400,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-900 break-words whitespace-normal" />,
    },
    {
        accessorKey: "descripcion_servicio",
        header: ({ column }) => <SortableHeader column={column} title="DESCRIPCION DEL SERVICIO" />,
        size: 157,
        minSize: 157,
        maxSize: 157,
        enablePinning: true,
        enableResizing: false,
        cell: (props) => <EditableCell {...props} className="text-zinc-900 break-words whitespace-normal" />,
    },
    {
        accessorKey: "entrega_real",
        header: ({ column }) => <SortableHeader column={column} title={`ENTREGA\nREAL`} />,
        size: 130,
        minSize: 100,
        maxSize: 300,
        enableResizing: true,
        cell: SmartDateCell,
    },
    {
        accessorKey: "estado_trabajo",
        header: ({ column }) => <SortableHeader column={column} title="ESTADO" className="text-base font-semibold" />,
        size: 180,
        minSize: 160,
        maxSize: 280,
        enableResizing: true,
        filterFn: "equals",
        cell: StatusCell,
    },
    {
        accessorKey: "cotizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="COTIZACION" />,
        size: 150,
        minSize: 120,
        maxSize: 300,
        enableResizing: true,
        cell: CotizacionCell,
    },
    {
        accessorKey: "autorizacion_lab",
        header: ({ column }) => (
            <div className="flex flex-col items-center">
                <SortableHeader column={column} title="AUTORIZADO" className="bg-indigo-50/50 text-indigo-900" />
                <span className="text-[9px] text-indigo-500 font-medium -mt-1">ADMINISTRACIÓN</span>
            </div>
        ),
        size: 130,
        minSize: 100,
        maxSize: 200,
        enableResizing: true,
        filterFn: "equals",
        cell: AutorizacionCell,
    },

    {
        accessorKey: "nota_lab",
        header: ({ column }) => <SortableHeader column={column} title="NOTA LAB" className="text-base font-semibold" />,
        size: 350,
        minSize: 250,
        maxSize: 700,
        enableResizing: true,
        cell: ({ getValue, row, column, table }) => (
            <EditableCell getValue={getValue} row={row} column={column} table={table} className="text-[13px] text-zinc-900" />
        ),
    },
    {
        accessorKey: "dias_atraso_lab",
        header: ({ column }) => <SortableHeader column={column} title={`DIAS\nATRASO`} />,
        size: 80,
        minSize: 60,
        maxSize: 90,
        enableResizing: true,
        filterFn: (row, columnId, filterValue) => {
            if (!filterValue) return true
            const val = row.getValue(columnId) as number
            return val > 0
        },
        cell: ({ row }) => {
            const estimatedDateStr = row.original.fecha_entrega_estimada
            const realDateStr = row.original.entrega_real

            if (!estimatedDateStr) return <div className="text-zinc-300 text-center">-</div>

            const estimated = new Date(estimatedDateStr)
            const real = realDateStr ? new Date(realDateStr) : new Date()

            estimated.setHours(0, 0, 0, 0)
            real.setHours(0, 0, 0, 0)

            const diffTime = real.getTime() - estimated.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (!realDateStr && diffDays <= 0) {
                return <div className="text-center font-mono text-zinc-900">0</div>
            }

            return (
                <div className={`text-center font-mono ${diffDays > 0 ? "text-red-600 font-bold" : "text-zinc-900"}`}>
                    {diffDays > 0 ? `+${diffDays}` : diffDays}
                </div>
            )
        }
    },
    {
        accessorKey: "motivo_dias_atraso_lab",
        header: ({ column }) => <SortableHeader column={column} title={`MOTIVO\nATRASO`} />,
        size: 140,
        minSize: 120,
        maxSize: 300,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-900" />,
    },
    {
        accessorKey: "evidencia_envio_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`EVID.\nRECEP.`} />,
        size: 70,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-center text-[11px] font-bold text-zinc-900 uppercase" />,
    },
    {
        accessorKey: "envio_informes",
        header: ({ column }) => <SortableHeader column={column} title={`ENVIO\nINF.`} />,
        size: 70,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-center text-[11px] font-bold text-zinc-900 uppercase" />,
    },
]

