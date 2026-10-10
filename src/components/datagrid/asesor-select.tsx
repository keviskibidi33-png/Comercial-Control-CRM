"use client"

import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface AsesorSelectProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}

const ASESOR_OPTIONS = [
    { value: "Juan", label: "Juan", color: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" },
    { value: "Silvia", label: "Silvia", color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" },
    { value: "Sergio", label: "Sergio", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
    { value: "Rossy", label: "Rossy", color: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" },
    { value: "-", label: "-", color: "bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100" },
]

const getAsesorColor = (asesor: string) => {
    const a = (asesor || "").trim().toLowerCase()
    if (a === "juan") return "bg-sky-50 text-sky-700 border-sky-200"
    if (a === "silvia") return "bg-purple-50 text-purple-700 border-purple-200"
    if (a === "sergio") return "bg-emerald-50 text-emerald-700 border-emerald-200"
    if (a === "rossy") return "bg-rose-50 text-rose-700 border-rose-200"
    return "bg-zinc-50 text-zinc-400 border-zinc-200"
}

export function AsesorSelect({ value, onChange, disabled }: AsesorSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 })

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const portalContent = document.getElementById("asesor-select-portal-content")
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
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                    width: Math.max(rect.width, 110)
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

    const displayValue = (value || "").trim() || "-"

    return (
        <div className="relative w-full h-full flex items-center justify-center font-medium" ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "px-2 py-0.5 rounded border text-[11px] font-bold text-center select-none truncate w-full transition-all flex items-center justify-center h-[22px]",
                    getAsesorColor(displayValue),
                    isOpen && "ring-2 ring-blue-400 ring-offset-1",
                    disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                )}
                title={disabled ? "Sin permisos de edición" : `Asesor comercial: ${displayValue}`}
            >
                {displayValue}
            </div>

            {isOpen && (
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        id="asesor-select-portal-content"
                        style={{ top: position.top, left: position.left, minWidth: position.width }}
                        className="fixed z-[9999] bg-white rounded-md shadow-[0_4px_12px_-2px_rgba(0,0,0,0.15)] border border-zinc-200 p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 origin-top"
                    >
                        {ASESOR_OPTIONS.map((option) => (
                            <div
                                key={option.value}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleSelect(option.value)
                                }}
                                className={cn(
                                    "px-2 py-1.5 rounded text-[11px] font-semibold cursor-pointer transition-colors text-center border border-transparent",
                                    option.color,
                                    displayValue === option.value && "ring-1 ring-zinc-400 font-bold"
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
