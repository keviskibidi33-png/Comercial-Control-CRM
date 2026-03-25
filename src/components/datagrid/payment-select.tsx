"use client"

import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface PaymentSelectProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}

const PAYMENT_OPTIONS = [
    { value: "PENDIENTE", label: "PENDIENTE", color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
    { value: "EN PROCESO", label: "EN PROCESO", color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
    { value: "PAGADO", label: "PAGADO", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
]

const getStatusColor = (status: string) => {
    const s = status?.toUpperCase() || ""
    if (s.includes("PAGADO")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
    if (s.includes("PROCESO")) return "bg-amber-50 text-amber-700 border-amber-200"
    if (s.includes("PENDIENTE")) return "bg-red-50 text-red-700 border-red-200"
    return "bg-white text-zinc-700 border-zinc-200"
}

export function PaymentSelect({ value, onChange, disabled }: PaymentSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 })

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const portalContent = document.getElementById("payment-select-portal-content")
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
                    width: Math.max(rect.width, 120)
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
        <div className="relative w-full h-full flex items-center justify-center font-bold" ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "px-2 py-0.5 rounded border text-[10px] font-bold text-center select-none truncate w-full transition-all flex items-center justify-center h-[22px]",
                    getStatusColor(value),
                    isOpen && "ring-2 ring-blue-400 ring-offset-1",
                    disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                )}
            >
                {value || "PENDIENTE"}
            </div>

            {isOpen && (
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        id="payment-select-portal-content"
                        style={{ top: position.top, left: position.left, minWidth: position.width }}
                        className="fixed z-[9999] bg-white rounded-md shadow-[0_4px_12px_-2px_rgba(0,0,0,0.15)] border border-zinc-200 p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 origin-top"
                    >
                        {PAYMENT_OPTIONS.map((option) => (
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
