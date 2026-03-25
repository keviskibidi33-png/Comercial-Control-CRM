import React from "react"
import { Table as TanStackTable } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

import { z } from "zod"
import { StatusSelect } from "./status-select"
import { PaymentSelect } from "./payment-select"
import { AuthorizationSelect } from "./authorization-select"
import { toast } from "sonner"

// Zod Schema for validation
const insertSchema = z.object({
    recep_numero: z.string().min(1, "Requerido"),
    ot: z.string().min(1, "Requerido"),
    // Add other validations as needed
})

interface GhostRowProps<TData> {
    table: TanStackTable<TData>
    onInsert: (data: Partial<TData>) => Promise<void>
}

export function GhostRow<TData>({ table, onInsert }: GhostRowProps<TData>) {
    const [newData, setNewData] = React.useState<Partial<TData>>({})
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const handleChange = (columnId: string, value: string) => {
        setNewData(prev => ({ ...prev, [columnId]: value }))
        // Clear error on change
        if (errors[columnId]) {
            setErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors[columnId]
                return newErrors
            })
        }
    }

    const handleBlur = (columnId: string, value: string) => {
        // Auto-format logic
        if (!value) return

        let formatted = value.trim()

        if (columnId === 'recep_numero') {
            // Append -26 if only digits are entered
            if (/^\d+$/.test(formatted)) {
                formatted = `${formatted}-26`
            }
        }

        if (columnId === 'ot') {
            // Append -26 if only digits are entered (no LEM)
            if (/^\d+$/.test(formatted)) {
                formatted = `${formatted}-26`
            }
        }

        if (columnId === 'cotizacion_lab') {
            // Append COTIZ.N-XXX-26 if only digits are entered
            if (/^\d+$/.test(formatted)) {
                formatted = `COTIZ.N-${formatted}-26`
            }
        }

        if (columnId === 'numero_factura') {
            // FXXX-XXXX logic
            if (/^\d+$/.test(formatted)) {
                const paddedNum = formatted.length < 4 ? formatted.padStart(4, '0') : formatted
                formatted = `F001-${paddedNum}`
            } else if (/^(\d+)-(\d+)$/.test(formatted)) {
                const match = formatted.match(/^(\d+)-(\d+)$/)
                if (match) {
                    formatted = `F${match[1].padStart(3, '0')}-${match[2].padStart(4, '0')}`
                }
            } else if (/^[fF]\d+$/.test(formatted)) {
                const nums = formatted.slice(1)
                const paddedNum = nums.length < 4 ? nums.padStart(4, '0') : nums
                formatted = `F001-${paddedNum}`
            }
        }


        // Date fields: auto-complete to show DD/MM/YY format (store ISO internally for DB)
        const isDateField = ['fecha_recepcion', 'fecha_inicio', 'fecha_entrega_estimada', 'entrega_real', 'fecha_solicitud_com', 'fecha_entrega_com', 'fecha_pago'].includes(columnId)
        if (isDateField && formatted) {
            let day = ''
            let month = ''
            let yearFull = '2026'
            let yearShort = '26'

            if (/^\d{4}$/.test(formatted)) {
                // 1212 → 12/12/26
                day = formatted.slice(0, 2)
                month = formatted.slice(2, 4)
            } else if (/^\d{6}$/.test(formatted)) {
                // 121226 → 12/12/26
                day = formatted.slice(0, 2)
                month = formatted.slice(2, 4)
                yearShort = formatted.slice(4, 6)
                yearFull = `20${yearShort}`
            } else if (/^\d{8}$/.test(formatted)) {
                // 12122026 → 12/12/2026
                day = formatted.slice(0, 2)
                month = formatted.slice(2, 4)
                yearFull = formatted.slice(4, 8)
                yearShort = yearFull.slice(-2)
            } else if (/^\d{3}$/.test(formatted)) {
                // 512 → 05/12/26
                day = formatted.slice(0, 1).padStart(2, '0')
                month = formatted.slice(1, 3)
            } else if (!formatted.includes('-')) {
                const parts = formatted.split(/[./-]/)
                if (parts.length === 2) {
                    day = parts[0]
                    month = parts[1]
                } else if (parts.length === 3) {
                    day = parts[0]
                    month = parts[1]
                    const y = parts[2]
                    if (y.length === 2) {
                        yearShort = y; yearFull = `20${y}`
                    } else {
                        yearFull = y; yearShort = y.slice(-2)
                    }
                }
            }

            if (day && month) {
                day = day.padStart(2, '0')
                month = month.padStart(2, '0')
                formatted = `${day}/${month}/${yearShort}`
                setNewData(prev => ({
                    ...prev,
                    [columnId]: formatted,
                    [`_${columnId}_iso`]: `${yearFull}-${month}-${day}`
                }))
                return
            }
        }

        if (formatted !== value) {
            handleChange(columnId, formatted)
        }
    }

    // Navigate between fields with Enter, submit with Ctrl+Enter
    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()

            // Ctrl+Enter = Submit
            if (e.ctrlKey) {
                await submitRow()
                return
            }

            // Regular Enter = Navigate to next field
            const allInputs = Array.from(document.querySelectorAll('.ghost-row-input')) as HTMLInputElement[]
            const currentElement = e.currentTarget
            const currentIndex = allInputs.indexOf(currentElement)

            if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                // Move to next field
                allInputs[currentIndex + 1].focus()
                allInputs[currentIndex + 1].select()
            } else {
                // Last field - submit the row
                await submitRow()
            }
        }
    }

    const submitRow = async () => {
        // Validation
        const validationPayload = {
            recep_numero: newData['recep_numero' as keyof TData],
            ot: newData['ot' as keyof TData]
        }

        // --- DUPLICATE CODIGO MUESTRA CHECK ---
        const codigoMuestra = newData['codigo_muestra' as keyof TData] as string
        if (codigoMuestra) {
            // @ts-ignore - TData is ProgramacionServicio
            const existingData = (table.options.data as any[]) || []
            const isDuplicate = existingData.some(row =>
                row.codigo_muestra?.trim().toLowerCase() === codigoMuestra.trim().toLowerCase()
            )

            if (isDuplicate) {
                toast.error("Código de muestra duplicado", {
                    description: `El código "${codigoMuestra}" ya está registrado en la tabla.`,
                })
                return
            }
        }

        try {
            const result = insertSchema.safeParse(validationPayload)

            if (!result.success) {
                const formattedErrors: Record<string, string> = {}
                result.error.issues.forEach(issue => {
                    formattedErrors[issue.path[0] as string] = issue.message
                })
                setErrors(formattedErrors)
                return
            }

            // Submit
            setIsSubmitting(true)

            // Convert display dates to ISO format for database
            const dateFields = ['fecha_recepcion', 'fecha_inicio', 'fecha_entrega_estimada', 'entrega_real']
            const submitData = { ...newData }
            for (const field of dateFields) {
                const isoKey = `_${field}_iso` as keyof TData
                if (submitData[isoKey as keyof typeof submitData]) {
                    (submitData as Record<string, unknown>)[field] = submitData[isoKey as keyof typeof submitData]
                    delete (submitData as Record<string, unknown>)[isoKey as string]
                }
            }

            await onInsert(submitData)
            setNewData({}) // Reset
            setErrors({})
        } catch (error) {
            console.error("Insert error", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Get column header titles for placeholders
    const getPlaceholder = (colId: string): string => {
        const placeholders: Record<string, string> = {
            item_numero: "Auto",
            recep_numero: "Recepción",
            ot: "OT #",
            codigo_muestra: "Código",
            cliente_nombre: "Cliente",
            proyecto: "Proyecto",
            descripcion_servicio: "Descripción",
            fecha_recepcion: "DDMM",
            fecha_inicio: "DDMM",
            fecha_entrega: "DDMM",
            entrega_real: "DDMM",
            cotizacion_lab: "COTIZ.N-XX-26",
            numero_factura: "FXXX-XXXX",
            estado_trabajo: "Estado",
            dias_atraso_lab: "0",
            dias_atraso_envio_coti: "0",
            nota_lab: "Nota...",
            autorizacion_lab: "-",
            envio_informes: "-",
            estado_pago: "PENDIENTE",
        }
        return placeholders[colId] || "..."
    }

    // Get user role and view mode from table meta
    const meta = table.options.meta as { userRole?: string; viewMode?: string } | undefined
    const userRole = meta?.userRole || ''
    const viewMode = meta?.viewMode || ''

    // Permission check function (similar to columns.tsx)
    const getCanWriteColumn = (columnId: string): boolean => {
        // Role restrictions for ADMIN
        if (userRole === 'admin') {
            if (viewMode === 'LAB') {
                const blockedColumns = ['cotizacion_lab', 'autorizacion_lab']
                if (blockedColumns.includes(columnId)) return false
            }
            if (viewMode === 'COM') {
                const blockedColumns = ['estado_pago']
                if (blockedColumns.includes(columnId)) return false
            }
            if (viewMode === 'ADMIN') {
                const blockedColumns = ['cotizacion_lab']
                if (blockedColumns.includes(columnId)) return false
            }
            return true
        }

        // Role: laboratorio_lector - Cannot edit anything
        if (userRole === 'laboratorio_lector' || userRole.includes('lector')) {
            return false
        }

        // Role: laboratorio_tipificador - Can edit everything EXCEPT cotizacion_lab, autorizacion_lab
        if (userRole === 'laboratorio_tipificador' || userRole.includes('tipificador')) {
            const blockedColumns = ['cotizacion_lab', 'autorizacion_lab']
            if (blockedColumns.includes(columnId)) return false
            return true
        }

        // Role: vendor - Can edit everything EXCEPT estado_pago
        if (userRole === 'vendor' || userRole.includes('vendedor') || userRole.includes('asesor') || userRole.includes('comercial')) {
            const blockedColumns = ['estado_pago']
            if (blockedColumns.includes(columnId)) return false
            return true
        }

        // Role: laboratorio - Can edit everything EXCEPT estado_pago
        if (userRole === 'laboratorio') {
            const blockedColumns = ['estado_pago']
            if (blockedColumns.includes(columnId)) return false
            return true
        }

        // Default: allow editing
        return true
    }

    return (
        <tr className="group hover:bg-blue-100/50 transition-colors">
            {table.getAllLeafColumns().map((column) => {
                const isPinned = column.getIsPinned()
                const isLastPinned = isPinned === "left" && column.id === "descripcion_servicio"
                const colId = column.id
                const value = (newData as Record<string, unknown>)[colId] as string || ""
                const error = errors[colId]

                // Read-only logic for IT
                const isReadOnly = colId === 'item_numero'
                const isNumeric = colId === 'dias_atraso_lab' || colId === 'dias_atraso_envio_coti'
                const isStatus = colId === 'estado_trabajo'
                const isPaymentStatus = colId === 'estado_pago'
                const isAutorizacion = colId === 'autorizacion_lab'

                // Check permissions for this column
                const canWrite = getCanWriteColumn(colId)

                // Common TD styles matching data-table.tsx
                const tdStyle = {
                    width: column.getSize(),
                    left: isPinned ? column.getStart("left") : undefined,
                    position: isPinned ? "sticky" as const : "relative" as const,
                    zIndex: isPinned ? 15 : 0,
                    boxSizing: "border-box" as const,
                }

                const tdClassName = cn(
                    "px-2 py-3 align-middle",
                    isPinned ? "bg-white hover:!bg-blue-200" : "bg-white",
                    isPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8,0_1px_0_0_#e4e4e7]" : "shadow-[inset_-1px_0_0_0_#e4e4e7,0_1px_0_0_#e4e4e7]",
                    isLastPinned && "shadow-[inset_-1px_0_0_0_#d4d4d8,0_1px_0_0_#e4e4e7,4px_0_5px_-2px_rgba(0,0,0,0.05)]"
                )

                return (
                    <td key={`ghost-${colId}`} style={tdStyle} className={tdClassName}>
                        {isReadOnly ? (
                            <div className="px-1 text-zinc-400 italic text-base font-semibold">+</div>
                        ) : !canWrite ? (
                            <div className="w-full text-center text-zinc-300 text-sm select-none italic">-</div>
                        ) : isStatus ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <StatusSelect value={value} onChange={(val) => handleChange(colId, val)} />
                            </div>
                        ) : isPaymentStatus ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <PaymentSelect value={value} onChange={(val) => handleChange(colId, val)} />
                            </div>
                        ) : isAutorizacion ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <AuthorizationSelect value={value} onChange={(val) => handleChange(colId, val)} />
                            </div>
                        ) : (
                            <input
                                type={isNumeric ? "number" : "text"}
                                className={cn(
                                    "ghost-row-input w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded text-base h-10 px-2 font-medium text-zinc-900 border border-zinc-100 shadow-sm",
                                    "placeholder:text-zinc-300 placeholder:italic",
                                    error && "bg-red-50 text-red-900 ring-1 ring-inset ring-red-500 placeholder:text-red-400",
                                    isSubmitting && "opacity-50 cursor-wait"
                                )}
                                placeholder={error ? error : getPlaceholder(colId)}
                                value={value}
                                onChange={(e) => handleChange(colId, e.target.value)}
                                onBlur={(e) => handleBlur(colId, e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isSubmitting}
                                title={error || `Ingrese ${getPlaceholder(colId)}`}
                            />
                        )}
                    </td>
                )
            })}
        </tr>
    )
}

