import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 p-6 text-center">
            <h1 className="text-4xl font-bold text-white mb-2">404</h1>
            <p className="text-zinc-400 mb-8">La página solicitada no está disponible en la matriz.</p>
            <Link
                href="/"
                className="text-blue-500 hover:text-blue-400 font-bold underline"
            >
                Regresar al Inicio
            </Link>
        </div>
    )
}
