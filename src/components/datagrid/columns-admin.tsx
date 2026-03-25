
"use client"

import { Column, ColumnDef } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Import shared smart cells from the main columns file
import {
    EditableCell,
    CotizacionCell,
    AutorizacionCell,
    PaymentStatusCell
} from "./columns"

const SortableHeader = ({ column, title, className }: { column: Column<ProgramacionServicio, unknown>, title: string, className?: string }) => {
    return (
        <div
            className={cn("flex items-center space-x-2 cursor-pointer select-none group hover:bg-slate-100/50 p-1 rounded", className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            <span className={cn("font-semibold whitespace-pre-line text-center leading-tight", className ? "text-current" : "text-zinc-700")}>{title}</span>
            <ArrowUpDown className={cn("ml-2 h-3.5 w-3.5 shrink-0", className ? "text-indigo-300 group-hover:text-indigo-600" : "text-zinc-400 group-hover:text-zinc-700")} />
        </div>
    )
}

// Admin Specific: Facturacion Cell
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FacturacionCell = React.memo(({ getValue, row: { original }, column: { id }, table }: any) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    // Permission: depends on permissions.administracion.write
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = table.options.meta as any
    const canWrite = meta?.canWrite || meta?.permissions?.administracion?.write || false

    const onBlur = () => {
        setIsEditing(false)
        if (!canWrite) return
        let finalValue = inputValue.trim()
        if (finalValue) {
            if (/^\d+$/.test(finalValue)) {
                const paddedNum = finalValue.length < 4 ? finalValue.padStart(4, '0') : finalValue
                finalValue = `F001-${paddedNum}`
            } else if (/^(\d+)-(\d+)$/.test(finalValue)) {
                const match = finalValue.match(/^(\d+)-(\d+)$/)
                if (match) {
                    finalValue = `F${match[1].padStart(3, '0')}-${match[2].padStart(4, '0')}`
                }
            } else if (/^[fF]\d+$/.test(finalValue)) {
                const nums = finalValue.slice(1)
                const paddedNum = nums.length < 4 ? nums.padStart(4, '0') : nums
                finalValue = `F001-${paddedNum}`
            }
        }
        if (finalValue !== value) {
            table.options.meta?.updateData(original.id, id, finalValue)
        }
    }

    if (isEditing && canWrite) {
        return <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1 text-zinc-900 font-medium" placeholder="Ej: 1234 o 002-5678" />
    }

    return (
        <div
            onClick={() => { if (canWrite) { setInputValue(value || ""); setIsEditing(true); } }}
            className={cn("w-full h-full flex items-center px-1 text-sm truncate text-zinc-900 font-medium", canWrite ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed opacity-70")}
        >
            {value || <span className="text-zinc-300 italic">...</span>}
        </div>
    )
})
FacturacionCell.displayName = "FacturacionCell"

export const columnsAdmin: ColumnDef<ProgramacionServicio>[] = [
    {
        accessorKey: "item_numero",
        header: ({ column }) => <SortableHeader column={column} title="ITEM" />,
        size: 69, minSize: 69, maxSize: 69, enablePinning: true, enableResizing: false,
        cell: info => <div className="text-zinc-400 font-mono text-sm text-center bg-white h-full flex items-center justify-center">{info.getValue() as string}</div>
    },
    {
        accessorKey: "recep_numero",
        header: ({ column }) => <SortableHeader column={column} title="RECEP" />,
        size: 100, minSize: 100, maxSize: 100, enablePinning: true, enableResizing: false,
        cell: ({ getValue }) => <div className="text-zinc-900 font-medium px-2">{getValue() as string}</div>,
    },
    {
        accessorKey: "fecha_recepcion",
        header: ({ column }) => <SortableHeader column={column} title="FECHA REC." />,
        size: 110, minSize: 110, maxSize: 110, enableResizing: false,
        cell: ({ getValue }) => <div className="text-zinc-600 font-medium text-xs text-center">{getValue() as string || '-'}</div>,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 200, minSize: 150, maxSize: 400, enableResizing: true,
        cell: ({ getValue, row, column, table }) => (
            <EditableCell getValue={getValue} row={row} column={column} table={table} className="text-[12.5px] leading-tight wrap-break-word whitespace-normal" />
        )
    },
    {
        accessorKey: "proyecto",
        header: ({ column }) => <SortableHeader column={column} title="PROYECTO" />,
        size: 150, minSize: 100, maxSize: 400, enableResizing: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: (props: any) => <EditableCell {...props} className="text-zinc-900 wrap-break-word whitespace-normal" />,
    },
    {
        accessorKey: "cotizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="COTIZACION" />,
        size: 160, minSize: 120, maxSize: 300, enableResizing: true,
        cell: CotizacionCell,
    },
    {
        accessorKey: "numero_factura",
        header: ({ column }) => <SortableHeader column={column} title="FACTURACION" className="text-blue-700" />,
        size: 160, minSize: 120, maxSize: 250, enableResizing: true,
        cell: FacturacionCell,
    },
    {
        accessorKey: "estado_pago",
        header: ({ column }) => <SortableHeader column={column} title="ESTADO PAGO" className="text-emerald-700" />,
        size: 130, minSize: 100, maxSize: 200, enableResizing: true,
        cell: PaymentStatusCell,
    },
    {
        accessorKey: "autorizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="AUTORIZADO" className="bg-indigo-50/50 text-indigo-900" />,
        size: 180, minSize: 120, maxSize: 300, enableResizing: true,
        filterFn: "equals",
        cell: AutorizacionCell,
    },
    {
        accessorKey: "nota_admin",
        header: ({ column }) => <SortableHeader column={column} title="NOTA ADMIN" />,
        size: 250, minSize: 150, maxSize: 600, enableResizing: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: (props: any) => <EditableCell {...props} className="text-xs wrap-break-word whitespace-normal" />,
    }
]
