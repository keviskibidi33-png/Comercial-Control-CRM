"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const ProgramacionButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, ...props }, ref) => {
        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
                    "hover:bg-accent hover:text-accent-foreground",
                    "h-9 px-4 py-2",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
ProgramacionButton.displayName = "ProgramacionButton"

export { ProgramacionButton as Button }
