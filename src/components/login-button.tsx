"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { LogIn, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function LoginButton() {
    const [isLoading, setIsLoading] = useState(false)
    const [showInput, setShowInput] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) {
                toast.error("Error: " + error.message)
            } else {
                toast.success("Sesión iniciada correctamente")
                setShowInput(false)
                // Reload page to refresh data context
                window.location.reload()
            }
        } catch (err) {
            console.error(err)
            toast.error("Error al iniciar sesión")
        } finally {
            setIsLoading(false)
        }
    }

    if (showInput) {
        return (
            <form onSubmit={handleLogin} className="flex items-center gap-2 bg-white p-1 rounded-md border shadow-sm absolute top-14 right-4 z-50 animate-in slide-in-from-top-2">
                <input
                    type="email"
                    placeholder="Email"
                    className="text-sm border rounded px-2 py-1 w-40"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Pass"
                    className="text-sm border rounded px-2 py-1 w-32"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                </button>
                <button
                    type="button"
                    onClick={() => setShowInput(false)}
                    className="text-zinc-400 hover:text-zinc-600 px-1"
                >
                    ✕
                </button>
            </form>
        )
    }

    return (
        <button
            onClick={() => setShowInput(true)}
            className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded-md border border-zinc-200 transition-colors flex items-center gap-2"
        >
            <LogIn className="w-3 h-3" />
            Login
        </button>
    )
}
