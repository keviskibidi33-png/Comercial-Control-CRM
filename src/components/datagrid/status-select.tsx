"use client"

import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface StatusSelectProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}

const STATUS_OPTIONS = [
    { value: "PENDIENTE", label: "PENDIENTE", color: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200" },
    { value: "PROCESO", label: "PROCESO", color: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" },
    { value: "INFORME LISTO", label: "INFORME LISTO", color: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200" },
    { value: "ENTREGADO", label: "ENTREGAR", color: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200" },
]

const getStatusColor = (status: string) => {
    const s = status?.toUpperCase() || ""
    if (s.includes("ENTREGADO")) return "bg-purple-100 text-purple-800 border-purple-200"
    if (s.includes("COMPLETADO") || s.includes("LISTO")) return "bg-emerald-100 text-emerald-800 border-emerald-200"
    if (s.includes("PROCESO")) return "bg-amber-100 text-amber-800 border-amber-200"
    if (s.includes("PENDIENTE")) return "bg-slate-100 text-slate-700 border-slate-200"
    return "bg-white text-zinc-700 border-zinc-200"
}

export function StatusSelect({ value, onChange, disabled }: StatusSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 })

    // Handle Click Outside (Modified for Portal)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside container (trigger) OR inside portal
            const portalContent = document.getElementById("status-select-portal-content")

            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                (!portalContent || !portalContent.contains(event.target as Node))
            ) {
                setIsOpen(false)
            }
        }
        if (isOpen && !disabled) {
            document.addEventListener("mousedown", handleClickOutside)
            // Calculate position
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                    width: Math.max(rect.width, 120) // Min width 120px
                })
            }
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen, disabled])

    const handleSelect = (newValue: string) => {
        if (disabled) return
        onChange(newValue)
        setIsOpen(false)
    }

    return (
        <div className="relative w-full h-full flex items-center justify-center" ref={containerRef}>
            {/* Trigger Badge */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "px-2 py-0.5 rounded border text-[11px] font-semibold text-center select-none truncate w-full transition-all flex items-center justify-center h-[22px]",
                    getStatusColor(value),
                    isOpen && "ring-2 ring-blue-400 ring-offset-1",
                    disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                )}
            >
                {value || "PENDIENTE"}
            </div>

            {/* Dropdown Menu (Portal) */}
            {isOpen && (
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        id="status-select-portal-content"
                        style={{
                            top: position.top,
                            left: position.left,
                            minWidth: position.width
                        }}
                        className="fixed z-[9999] bg-white rounded-md shadow-[0_4px_12px_-2px_rgba(0,0,0,0.15)] border border-zinc-200 p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 origin-top"
                    >
                        {STATUS_OPTIONS.map((option) => (
                            <div
                                key={option.value}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleSelect(option.value)
                                }}
                                className={cn(
                                    "px-2 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors text-center border border-transparent",
                                    option.color,
                                    value === option.value && "ring-1 ring-zinc-400"
                                )}
                            >
                                {option.label}
                            </div>
                        ))}
                    </div>,
                    document.body
                )
            )}
        </div>
    )
}
