"use client"

import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export interface SelectOption {
    value: string
    label: string
    color: string
}

interface AuthorizationSelectProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    options?: SelectOption[]
}

const DEFAULT_AUTH_OPTIONS: SelectOption[] = [
    { value: "ENTREGADO", label: "ENTREGAR", color: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200" },
    { value: "NO ENTREGADO", label: "NO ENTREGAR", color: "bg-red-50 text-red-800 border-red-100 hover:bg-red-100" },
]

export function AuthorizationSelect({ value, onChange, disabled, options = DEFAULT_AUTH_OPTIONS }: AuthorizationSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

    const activeOption = options.find(o => o.value === value)
    const activeColor = activeOption?.color || "bg-slate-50 text-slate-500 border-slate-200 border-dashed"

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const portalContent = document.getElementById("auth-select-portal-content")
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                (!portalContent || !portalContent.contains(event.target as Node))
            ) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                    width: Math.max(rect.width, 100)
                })
            }
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    const handleSelect = (newValue: string) => {
        onChange(newValue)
        setIsOpen(false)
    }

    // If disabled (non-admin), just show the badge without click handler
    if (disabled) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div
                    className={cn(
                        "px-2 py-0.5 rounded border text-[10px] font-bold text-center select-none truncate w-full flex items-center justify-center opacity-70 cursor-not-allowed",
                        activeColor
                    )}
                >
                    {activeOption?.label || value || "-"}
                </div>
            </div>
        )
    }

    return (
        <div className="relative w-full h-full flex items-center justify-center" ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "px-2 py-0.5 rounded border text-[10px] font-bold text-center cursor-pointer select-none truncate w-full transition-all flex items-center justify-center",
                    activeColor,
                    isOpen && "ring-2 ring-blue-400 ring-offset-1"
                )}
            >
                {activeOption?.label || value || "-"}
            </div>

            {isOpen && (
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        id="auth-select-portal-content"
                        style={{
                            top: position.top,
                            left: position.left,
                            minWidth: position.width
                        }}
                        className="fixed z-[9999] bg-white rounded-md shadow-[0_4px_12px_-2px_rgba(0,0,0,0.15)] border border-zinc-200 p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 origin-top"
                    >
                        {options.map((option) => (
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
