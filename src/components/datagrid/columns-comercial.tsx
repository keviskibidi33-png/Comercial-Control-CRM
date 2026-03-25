
"use client"

import { Column, ColumnDef } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Import shared smart cells from the main columns file
import {
    EditableCell,
    SmartDateCell,
    CotizacionCell
} from "./columns"

const SortableHeader = ({ column, title, className }: { column: Column<ProgramacionServicio, unknown>, title: string, className?: string }) => {
    return (
        <div
            className={cn("flex items-center justify-center space-x-1 cursor-pointer select-none group hover:bg-slate-100/50 p-1.5 rounded w-full h-full min-h-[40px]", className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            <span className={cn("font-bold whitespace-pre-line text-center leading-tight text-[11px] uppercase tracking-tight", className ? "text-current" : "text-zinc-700")}>{title}</span>
            <ArrowUpDown className={cn("ml-1 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity", className ? "text-indigo-400" : "text-zinc-400")} />
        </div>
    )
}

export const columnsComercial: ColumnDef<ProgramacionServicio>[] = [
    {
        accessorKey: "item_numero",
        header: ({ column }) => <SortableHeader column={column} title="ITEM" />,
        size: 70, minSize: 70, maxSize: 70, enablePinning: true, enableResizing: false,
        cell: info => <div className="text-zinc-400 font-mono text-sm text-center bg-white h-full flex items-center justify-center border-r border-zinc-100">{info.getValue() as string}</div>
    },
    {
        accessorKey: "recep_numero",
        header: ({ column }) => <SortableHeader column={column} title="RECEP. N" />,
        size: 85, minSize: 85, maxSize: 85, enablePinning: true, enableResizing: false,
        cell: ({ getValue }) => <div className="text-zinc-900 font-bold px-2 text-center">{getValue() as string}</div>,
    },
    {
        accessorKey: "fecha_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nRECEPCIÓN`} />,
        size: 110, minSize: 110, maxSize: 110,
        cell: ({ getValue }) => {
            const dateStr = getValue() as string
            if (!dateStr) return <div className="text-zinc-300 text-center">-</div>
            return <div className="text-zinc-900 text-center text-sm font-medium">{dateStr.split('-').reverse().join('/')}</div>
        }
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 200, minSize: 150, maxSize: 400, enableResizing: true,
        cell: ({ getValue }) => (
            <div className="line-clamp-2 whitespace-normal break-words leading-tight text-[12px] font-bold text-zinc-900 uppercase" title={getValue() as string}>
                {getValue() as string}
            </div>
        )
    },
    {
        accessorKey: "proyecto",
        header: ({ column }) => <SortableHeader column={column} title="PROYECTO" />,
        size: 200, minSize: 150, maxSize: 500, enableResizing: true,
        cell: ({ getValue }) => <div className="text-zinc-900 font-medium whitespace-normal break-words leading-tight max-w-full">{getValue() as string}</div>,
    },
    {
        accessorKey: "cotizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="COTIZACION" />,
        size: 160, minSize: 140, maxSize: 300, enableResizing: true,
        cell: CotizacionCell,
    },
    {
        accessorKey: "fecha_solicitud_com",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nSOLICITUD`} />,
        size: 110, minSize: 110, maxSize: 110,
        cell: SmartDateCell,
    },
    {
        accessorKey: "fecha_entrega_com",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nENTREGA`} />,
        size: 110, minSize: 110, maxSize: 110,
        cell: SmartDateCell,
    },
    {
        accessorKey: "evidencia_solicitud_envio",
        header: ({ column }) => <SortableHeader column={column} title="EVIDENCIAS" />,
        size: 110, minSize: 110, maxSize: 150, enableResizing: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: (props: any) => <EditableCell {...props} className="text-zinc-800 text-[12px] text-center" />,
    },
    {
        accessorKey: "dias_atraso_envio_coti",
        header: ({ column }) => <SortableHeader column={column} title={`DIAS ATRASO\nENVIO COTIZ.`} />,
        size: 110, minSize: 100, maxSize: 150, enableResizing: true,
        cell: ({ row }) => {
            const solicitudDateStr = row.original.fecha_solicitud_com
            const entregaDateStr = row.original.fecha_entrega_com

            if (!solicitudDateStr || !entregaDateStr) return <div className="text-zinc-300 text-center">-</div>

            const solicitud = new Date(solicitudDateStr)
            const entrega = new Date(entregaDateStr)

            solicitud.setHours(0, 0, 0, 0)
            entrega.setHours(0, 0, 0, 0)

            const diffTime = entrega.getTime() - solicitud.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            return (
                <div className={`text-center font-mono text-sm ${diffDays > 0 ? "text-zinc-900" : "text-zinc-900"}`}>
                    {diffDays}
                </div>
            )
        }
    },
    {
        accessorKey: "motivo_dias_atraso_com",
        header: ({ column }) => <SortableHeader column={column} title={`MOTIVO\nDIAS ATRASO`} />,
        size: 400, minSize: 200, maxSize: 800, enableResizing: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: (props: any) => <EditableCell {...props} className="text-zinc-800 text-[12px] whitespace-normal break-words" />,
    },
]
