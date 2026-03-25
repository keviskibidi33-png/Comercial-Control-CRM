const SPECIAL_PROGRAMACION_COLUMN_EDITOR_EMAILS = new Set([
    "oficinatecnica2@geofal.com.pe",
    "oficinatecnica3@geofal.com.pe",
    "oficinatecnica5@geofal.com.pe",
])

const SPECIAL_PROGRAMACION_EDITABLE_COLUMNS = new Set([
    "entrega_real",
    "estado_trabajo",
])

export function normalizeProgramacionAccessValue(value: string | null | undefined) {
    return String(value || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function hasScopedProgramacionViewAccess(email: string | null | undefined, viewMode: string | null | undefined) {
    const normalizedEmail = normalizeProgramacionAccessValue(email)
    const normalizedViewMode = normalizeProgramacionAccessValue(viewMode)

    return (
        SPECIAL_PROGRAMACION_COLUMN_EDITOR_EMAILS.has(normalizedEmail) &&
        (normalizedViewMode === "" || normalizedViewMode === "lab")
    )
}

export function hasScopedProgramacionColumnAccess(email: string | null | undefined, columnId: string, viewMode: string | null | undefined) {
    return (
        hasScopedProgramacionViewAccess(email, viewMode) &&
        SPECIAL_PROGRAMACION_EDITABLE_COLUMNS.has(columnId)
    )
}
