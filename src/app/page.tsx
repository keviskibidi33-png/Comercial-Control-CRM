import { Suspense } from "react"
import { FixedProgramacionEditor } from "@/components/fixed-programacion-editor"

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Suspense fallback={<div className="p-4">Cargando...</div>}>
        <FixedProgramacionEditor
          kind="comercial"
          title="Control Comercial"
          subtitle="Seguimiento comercial, entregas y evidencia de atención."
          viewMode="COM"
          availableViewModes={["LAB", "COM"]}
          exportMode="comercial"
          storageNamespace="programacion-comercial"
        />
      </Suspense>
    </main>
  )
}
