"use client"

import React from "react"
import SeguimientoClienteGrid, { type SeguimientoClienteGridProps } from "./seguimiento-cliente-grid"

export default function SeguimientoClienteGrid2(props: SeguimientoClienteGridProps) {
  return <SeguimientoClienteGrid tablaId={2} {...props} />
}
