"use client"

import React, { useRef } from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
    RowData,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button" 
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Loader2
} from "lucide-react"
import { GhostRow } from "./ghost-row"

type PersistedTableState = {
    sorting: SortingState
    columnFilters: ColumnFiltersState
    columnVisibility: VisibilityState
    globalFilter: string
    pagination: {
        pageIndex: number
        pageSize: number
    }
    deliveryDateFilter: string
    statusFilter: string
    authorizationFilter: string
    paymentFilter: string
    scrollOffset: number
}

const DEFAULT_PAGINATION = {
    pageIndex: 0,
    pageSize: 500,
}

function readPersistedTableState(storageKey?: string): PersistedTableState | null {
    if (!storageKey || typeof window === "undefined") return null

    try {
        const rawValue = window.localStorage.getItem(storageKey)
        if (!rawValue) return null

        const parsed = JSON.parse(rawValue) as Partial<PersistedTableState>
        return {
            sorting: Array.isArray(parsed.sorting) ? parsed.sorting : [],
            columnFilters: Array.isArray(parsed.columnFilters) ? parsed.columnFilters : [],
            columnVisibility: parsed.columnVisibility && typeof parsed.columnVisibility === "object" ? parsed.columnVisibility : {},
            globalFilter: typeof parsed.globalFilter === "string" ? parsed.globalFilter : "",
            pagination: parsed.pagination && typeof parsed.pagination === "object"
                ? {
                    pageIndex: typeof parsed.pagination.pageIndex === "number" ? parsed.pagination.pageIndex : DEFAULT_PAGINATION.pageIndex,
                    pageSize: typeof parsed.pagination.pageSize === "number" ? parsed.pagination.pageSize : DEFAULT_PAGINATION.pageSize,
                }
                : DEFAULT_PAGINATION,
            deliveryDateFilter: typeof parsed.deliveryDateFilter === "string" ? parsed.deliveryDateFilter : "",
            statusFilter: typeof parsed.statusFilter === "string" ? parsed.statusFilter : "TODOS",
            authorizationFilter: typeof parsed.authorizationFilter === "string" ? parsed.authorizationFilter : "TODOS",
            paymentFilter: typeof parsed.paymentFilter === "string" ? parsed.paymentFilter : "TODOS",
            scrollOffset: typeof parsed.scrollOffset === "number" ? parsed.scrollOffset : 0,
        }
    } catch {
        return null
    }
}

// Extend TableMeta to include our custom properties
declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        updateData: (rowId: string, columnId: string, value: unknown) => void
        userRole?: string
        userEmail?: string
        canWrite?: boolean
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        permissions?: any
        viewMode?: string
    }
}

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    loading?: boolean
    onUpdate?: (rowId: string, field: string, value: unknown) => void
    onInsert?: (data: Partial<TData>) => Promise<void>
    userRole?: string
    userEmail?: string
    canWrite?: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    permissions?: any
    viewMode?: string
    onFilteredDataChange?: (data: TData[]) => void
    storageKey?: string
}

export function DataTable<TData, TValue>({
    columns,
    data,
    loading,
    onUpdate,
    onInsert,
    userRole,
    userEmail,
    canWrite,
    permissions,
    viewMode,
    onFilteredDataChange,
    storageKey
}: DataTableProps<TData, TValue>) {
    const persistedStateRef = React.useRef<PersistedTableState | null>(readPersistedTableState(storageKey))
    const persistedState = persistedStateRef.current

    const [sorting, setSorting] = React.useState<SortingState>(() => persistedState?.sorting ?? [])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() => persistedState?.columnFilters ?? [])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => persistedState?.columnVisibility ?? {})
    const [globalFilter, setGlobalFilter] = React.useState(() => persistedState?.globalFilter ?? "")
    const [deliveryDateFilter, setDeliveryDateFilter] = React.useState(() => persistedState?.deliveryDateFilter ?? "")
    const [statusFilter, setStatusFilter] = React.useState(() => persistedState?.statusFilter ?? "TODOS")
    const [authorizationFilter, setAuthorizationFilter] = React.useState(() => persistedState?.authorizationFilter ?? "TODOS")
    const [paymentFilter, setPaymentFilter] = React.useState(() => persistedState?.paymentFilter ?? "TODOS")
    const [scrollOffset, setScrollOffset] = React.useState(() => persistedState?.scrollOffset ?? 0)
    const hasRestoredScrollRef = React.useRef(false)

    // Pagination for High Volume: Default 500
    const [pagination, setPagination] = React.useState(() => persistedState?.pagination ?? DEFAULT_PAGINATION)

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        columnResizeMode: "onChange",
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
            pagination,
        },
        initialState: {
            columnPinning: {
                left: [
                    "item_numero",
                    "recep_numero",
                    "ot",
                    "codigo_muestra",
                    "fecha_recepcion",
                    "fecha_inicio",
                    "fecha_entrega_estimada",
                    "cliente_nombre",
                    "proyecto"
                ]
            }
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        meta: {
            updateData: (rowId: string, columnId: string, value: unknown) => {
                if (rowId && onUpdate) {
                    onUpdate(rowId, columnId, value)
                }
            },
            userRole: userRole || '',
            userEmail: userEmail || '',
            canWrite: canWrite ?? false,
            permissions: permissions || null,
            viewMode: viewMode || ''
        },
    })

    React.useEffect(() => {
        if (!storageKey || typeof window === "undefined") return

        try {
            window.localStorage.setItem(
                storageKey,
                JSON.stringify({
                    sorting,
                    columnFilters,
                    columnVisibility,
                    globalFilter,
                    pagination,
                    deliveryDateFilter,
                    statusFilter,
                    authorizationFilter,
                    paymentFilter,
                    scrollOffset,
                } satisfies PersistedTableState),
            )
        } catch {
            // Ignore localStorage write errors to avoid breaking table interaction.
        }
    }, [
        authorizationFilter,
        columnFilters,
        columnVisibility,
        deliveryDateFilter,
        globalFilter,
        pagination,
        paymentFilter,
        scrollOffset,
        sorting,
        statusFilter,
        storageKey,
    ])

    // --- Virtualization ---
    const tableContainerRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 40, // Base row height
        overscan: 20, // Buffer rows
    })

    React.useEffect(() => {
        const scrollContainer = tableContainerRef.current
        if (!scrollContainer) return

        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const handleScroll = () => {
            const nextOffset = scrollContainer.scrollTop
            if (timeoutId) {
                clearTimeout(timeoutId)
            }

            timeoutId = setTimeout(() => {
                setScrollOffset((previousOffset) => {
                    if (Math.abs(previousOffset - nextOffset) < 4) {
                        return previousOffset
                    }
                    return nextOffset
                })
            }, 120)
        }

        scrollContainer.addEventListener("scroll", handleScroll, { passive: true })

        return () => {
            scrollContainer.removeEventListener("scroll", handleScroll)
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [])

    React.useEffect(() => {
        if (hasRestoredScrollRef.current) return
        if (rows.length === 0) return

        const scrollContainer = tableContainerRef.current
        if (!scrollContainer) return

        hasRestoredScrollRef.current = true
        if (scrollOffset <= 0) return

        const frameId = window.requestAnimationFrame(() => {
            scrollContainer.scrollTop = scrollOffset
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [rows.length, scrollOffset])

    // Notify parent about filtered items
    React.useEffect(() => {
        if (onFilteredDataChange) {
            const filteredItems = table.getFilteredRowModel().rows.map(row => row.original)
            onFilteredDataChange(filteredItems)
        }
    }, [table.getFilteredRowModel().rows, onFilteredDataChange])

    return (
        <div className="flex flex-col h-full bg-white font-sans text-sm">
            {/* Toolbar Area */}
            <div className="flex items-center justify-between p-2 border-b border-zinc-200 bg-white gap-2">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <input
                        placeholder="Buscar en todo..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="h-8 w-[200px] lg:w-[250px] border border-zinc-200 rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400"
                    />

                    {/* Filter for Fecha de Entrega (Lab or Comercial) */}
                    {(table.getAllColumns().find(c => c.id === "fecha_entrega_estimada") || table.getAllColumns().find(c => c.id === "fecha_entrega_com")) && (
                        <input
                            type="date"
                            value={deliveryDateFilter}
                            className="h-8 border border-zinc-200 rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-zinc-900 cursor-pointer hover:bg-zinc-50"
                            onChange={e => {
                                const val = e.target.value
                                setDeliveryDateFilter(val)
                                // Try to filter both potential date columns if they exist
                                table.getColumn("fecha_entrega_estimada")?.setFilterValue(val)
                                table.getColumn("fecha_entrega_com")?.setFilterValue(val)
                            }}
                            title="Filtrar por Fecha de Entrega"
                        />
                    )}

                    {/* Status Filter */}
                    {table.getAllColumns().find(c => c.id === "estado_trabajo") && (
                        <select
                            value={statusFilter}
                            className="h-8 border border-zinc-200 rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-zinc-900 cursor-pointer hover:bg-zinc-50"
                            onChange={e => {
                                const nextValue = e.target.value
                                setStatusFilter(nextValue)
                                table.getColumn("estado_trabajo")?.setFilterValue(nextValue === "TODOS" ? "" : nextValue)
                            }}
                        >
                            <option value="TODOS">Estado: Todos</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="PROCESO">En Proceso</option>
                            <option value="INFORME LISTO">Informe Listo</option>
                            <option value="ENTREGADO">Entregar</option>
                        </select>
                    )}

                    {/* Authorization Filter (Admin/Lab) */}
                    {table.getAllColumns().find(c => c.id === "autorizacion_lab") && (
                        <select
                            value={authorizationFilter}
                            className="h-8 border border-zinc-200 rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-indigo-50 text-indigo-900 cursor-pointer hover:bg-indigo-100 font-medium"
                            onChange={e => {
                                const nextValue = e.target.value
                                setAuthorizationFilter(nextValue)
                                table.getColumn("autorizacion_lab")?.setFilterValue(nextValue === "TODOS" ? "" : nextValue)
                            }}
                        >
                            <option value="TODOS">Autorización: Todas</option>
                            <option value="ENTREGADO">Entregar</option>
                            <option value="NO ENTREGADO">No Entregar</option>
                        </select>
                    )}

                    {/* Payment Status Filter (Admin) - Using 'envio_informes' as field */}
                    {table.getAllColumns().find(c => c.id === "envio_informes") && (
                        <select
                            value={paymentFilter}
                            className="h-8 border border-zinc-200 rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-emerald-50 text-emerald-900 cursor-pointer hover:bg-emerald-100 font-medium"
                            onChange={e => {
                                const nextValue = e.target.value
                                setPaymentFilter(nextValue)
                                table.getColumn("envio_informes")?.setFilterValue(nextValue === "TODOS" ? "" : nextValue)
                            }}
                        >
                            <option value="TODOS">Pago: Todos</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="EN PROCESO">En Proceso</option>
                            <option value="PAGADO">Pagado</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Table Area with Virtualization */}
            {/* Height must be fixed for virtualization. h-full takes parent's flex-1 height */}
            <div
                ref={tableContainerRef}
                className="flex-1 overflow-auto relative bg-zinc-50 border-b border-zinc-200 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent"
                style={{ height: '100%', contain: 'strict', zoom: '85%' }}
            >
                <table
                    className="border-collapse"
                    style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}
                >
                    <thead className="sticky top-0 z-40 bg-white shadow-sm h-10 text-sm">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="border-b border-zinc-200">
                                {headerGroup.headers.map((header) => {
                                    const isPinned = header.column.getIsPinned()
                                    const isLastPinned = isPinned === "left" && header.column.id === "descripcion_servicio"

                                    return (
                                        <th
                                            key={header.id}
                                            style={{
                                                width: header.getSize(),
                                                left: isPinned ? header.column.getStart("left") : undefined,
                                                position: isPinned ? "sticky" : "relative",
                                                zIndex: isPinned ? 20 : 0,
                                                boxSizing: "border-box",
                                            }}
                                            className={cn(
                                                "px-2 py-2 text-left bg-[#f4f4f5] select-none relative group",
                                                isPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8]" : "shadow-[inset_-1px_0_0_0_#e4e4e7]",
                                                isLastPinned && "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                            )}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    )
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="bg-white">

                        {/* Virtual Items */}
                        {rowVirtualizer.getVirtualItems().length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {/* Top Spacer */}
                                {rowVirtualizer.getVirtualItems()[0].index > 0 && (
                                    <tr>
                                        <td style={{ height: `${rowVirtualizer.getVirtualItems()[0].start - 0}px` }} />
                                    </tr>
                                )}

                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const row = rows[virtualRow.index]
                                    return (

                                        <tr
                                            key={row.id}
                                            data-index={virtualRow.index}
                                            ref={rowVirtualizer.measureElement} // Enable dynamic measurement
                                            className="hover:bg-blue-100/50 transition-colors group" // Removed row striping, kept hover
                                            style={{
                                                // Removed fixed height logic, let content drive height
                                            }}
                                        >
                                            {row.getVisibleCells().map((cell) => {
                                                const isPinned = cell.column.getIsPinned()
                                                const isLastPinned = isPinned === "left" && cell.column.id === "descripcion_servicio"
                                                const isEvenRow = virtualRow.index % 2 === 0

                                                return (
                                                    <td
                                                        key={cell.id}
                                                        style={{
                                                            width: cell.column.getSize(),
                                                            left: isPinned ? cell.column.getStart("left") : undefined,
                                                            position: isPinned ? "sticky" : "relative",
                                                            zIndex: isPinned ? 10 : 0,
                                                            boxSizing: "border-box",
                                                        }}
                                                        className={cn(
                                                            "px-2 py-1.5 align-middle",
                                                            isPinned
                                                                ? (isEvenRow ? "bg-blue-50 hover:!bg-blue-200" : "bg-white hover:!bg-blue-200")
                                                                : (isEvenRow ? "bg-blue-50/80 hover:!bg-blue-200" : "bg-white hover:!bg-blue-200"),
                                                            isPinned ? "shadow-[inset_-1px_0_0_0_#d4d4d8,0_1px_0_0_#e4e4e7]" : "shadow-[inset_-1px_0_0_0_#e4e4e7,0_1px_0_0_#e4e4e7]",
                                                            isLastPinned && "shadow-[inset_-1px_0_0_0_#d4d4d8,0_1px_0_0_#e4e4e7,4px_0_5px_-2px_rgba(0,0,0,0.05)]"
                                                        )}
                                                    >
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}

                                {/* Bottom Spacer */}
                                {rowVirtualizer.getVirtualItems().length > 0 && (
                                    <tr>
                                        <td style={{
                                            height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`
                                        }} />
                                    </tr>
                                )}
                            </>
                        )}

                        {/* Ghost Row - At bottom like Excel */}
                        {onInsert && <GhostRow table={table} onInsert={onInsert} />}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2 py-2 border-t border-zinc-200 bg-white">
                <div className="text-xs text-zinc-500">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-zinc-600">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </span>
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                    <select
                        value={table.getState().pagination.pageSize}
                        onChange={e => {
                            table.setPageSize(Number(e.target.value))
                        }}
                        className="h-6 w-16 text-xs border border-zinc-200 rounded"
                    >
                        {[100, 500, 1000, 2000, 5000, 8000].map(pageSize => (
                            <option key={pageSize} value={pageSize}>
                                {pageSize}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
            )}
        </div>
    )
}
