'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('PROGRAMACION ERROR:', error)
    }, [error])

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-900 p-6">
            <div className="bg-zinc-800 p-8 rounded-xl border border-zinc-700 shadow-2xl max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-white tracking-tight">Error de Sistema</h1>
                    <p className="text-zinc-400 text-sm">
                        La matriz de programación ha encontrado un problema. Intente recargar los datos.
                    </p>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                    <button
                        onClick={() => reset()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Recargar Matriz
                    </button>
                </div>

                {error.digest && (
                    <p className="text-[10px] text-zinc-600 font-mono italic">Trace ID: {error.digest}</p>
                )}
            </div>
        </div>
    )
}
