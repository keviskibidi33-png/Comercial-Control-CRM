
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useSearchParams } from "next/navigation"

export type ViewMode = "LAB" | "COM" | "ADMIN"

type ModulePermission = {
    read?: boolean
    write?: boolean
    delete?: boolean
}

type PermissionMap = Record<string, ModulePermission>

type SessionTokenPayload = {
    access_token?: string
    currentSession?: { access_token?: string | null } | null
    session?: { access_token?: string | null } | null
}

type RoleDefinitionRecord = {
    permissions?: PermissionMap | null
}

type ProfileRecord = {
    role: string | null
    email: string | null
    full_name?: string | null
    show_kpi?: boolean | null
    tabla_seguimiento?: string | null
    role_definitions: RoleDefinitionRecord | RoleDefinitionRecord[] | null
}

const CONTROL_ACCESS_REVOKED_EMAILS = new Set([
    "tecnico2@geofal.com.pe",
    "tecnico3@geofal.com.pe",
])

const CONTROL_ACCESS_BLOCKED_ROLES = new Set([
    "tecnico",
    "tecnico_suelos",
])

function normalizeRole(value: string | null | undefined) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
}

function isBlockedControlRole(role: string | null | undefined) {
    return CONTROL_ACCESS_BLOCKED_ROLES.has(normalizeRole(role))
}

function denyControlAccess(perms: PermissionMap): PermissionMap {
    return {
        ...perms,
        laboratorio: { read: false, write: false, delete: false },
        programacion: { read: false, write: false, delete: false },
        comercial: { read: false, write: false, delete: false },
        administracion: { read: false, write: false, delete: false },
    }
}

function applyRestrictedControlAccess(
    role: string | null | undefined,
    email: string | null | undefined,
    perms: PermissionMap,
): PermissionMap {
    let result = perms
    if (isBlockedControlRole(role)) {
        result = denyControlAccess(result)
    }

    const normalizedEmail = String(email || "").toLowerCase().trim()
    if (CONTROL_ACCESS_REVOKED_EMAILS.has(normalizedEmail)) {
        result = denyControlAccess(result)
    }

    return result
}

function getAllowedViewsFromPermissions(perms: PermissionMap | null | undefined): ViewMode[] {
    const views: ViewMode[] = []

    if (perms?.laboratorio?.read === true) views.push("LAB")
    if (perms?.comercial?.read === true) views.push("COM")
    if (perms?.administracion?.read === true) views.push("ADMIN")

    return views
}

export function useCurrentUser() {
    const supabase = useMemo(() => createClient(), [])
    const searchParams = useSearchParams()

    // Stable key for URL changes to keep dependency array safe
    const urlKey = searchParams.toString()

    // Derived values from URL (Reactive because they depend on searchParams)
    const qUserId = searchParams.get("userId")
    const qRole = searchParams.get("role")?.toLowerCase() || null
    const qUserName = searchParams.get("userName") || null
    const qCanWrite = searchParams.get("canWrite") === "true"
    const hasCanWriteParam = searchParams.has("canWrite")
    const qIsAdmin = searchParams.get("isAdmin") === "true"
    // Parent shell passes showKpi=true|false in iframe URL for fast first-render (avoids DB round-trip)
    const qShowKpi = searchParams.has("showKpi") ? searchParams.get("showKpi") === "true" : null
    const passedToken = searchParams.get("token")
    const requestedModeParam = (searchParams.get("mode") || "").toLowerCase()
    const requestedMode: ViewMode =
        requestedModeParam === "comercial" || requestedModeParam === "com"
            ? "COM"
            : requestedModeParam === "admin"
                ? "ADMIN"
                : "LAB"

    const [role, setRole] = useState<string | null>(qRole)
    const [email, setEmail] = useState<string | null>(null)
    // Use the userName passed from the parent shell as the initial displayName (sync, no DB wait)
    const [displayName, setDisplayName] = useState<string | null>(qUserName)
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(qUserId)
    const [needsAuth, setNeedsAuth] = useState(false)
    const [tokenApplied, setTokenApplied] = useState(false)
    const qTablaSeguimiento = searchParams.get("tabla_seguimiento") || searchParams.get("tabla")
    // show_kpi: null = loading, true = show KPI tab, false = hide KPI tab
    const [showKpi, setShowKpi] = useState<boolean | null>(qShowKpi)
    const [tablaSeguimiento, setTablaSeguimiento] = useState<string | null>(qTablaSeguimiento)

    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(["LAB", "COM", "ADMIN"])

    const [permissions, setPermissions] = useState<PermissionMap>(() => {
        // Initial permissions: minimal until DB load completes
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const blockedControlRole = isBlockedControlRole(rNorm)
        const isSuperAdmin = rNorm === 'admin' || qIsAdmin
        const dynamicCanWrite = qCanWrite || isSuperAdmin
        const isLabRole = (rNorm.includes('laboratorio') || rNorm.includes('tipificador')) && !rNorm.includes('lector')

        if (blockedControlRole) {
            return {
                laboratorio: { read: false, write: false, delete: false },
                programacion: { read: false, write: false, delete: false },
                comercial: { read: false, write: false, delete: false },
                administracion: { read: false, write: false, delete: false },
            }
        }

        return {
            laboratorio: {
                read: true, // Everyone with access to Programacion can read Lab (at least read-only)
                write: dynamicCanWrite && (isSuperAdmin || isLabRole),
                delete: false
            },
            programacion: {
                read: true,
                write: dynamicCanWrite && (isSuperAdmin || isLabRole),
                delete: false
            },
            comercial: {
                read: isSuperAdmin || rNorm.includes('comercial'),
                write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('comercial')),
                delete: false
            },
            administracion: {
                read: isSuperAdmin || rNorm.includes('administrativo'),
                write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('administrativo')),
                delete: false
            }
        }
    })

    useEffect(() => {
        async function fetchIdentityAndPerms() {
            setLoading(true)

            const getStoredToken = (): string | null => {
                if (typeof window === "undefined") return null
                const direct = localStorage.getItem("programacion_access_token") || localStorage.getItem("token")
                if (direct) return direct

                const extractToken = (parsed: unknown): string | null => {
                    if (!parsed) return null
                    if (Array.isArray(parsed)) {
                        const first = parsed[0] as SessionTokenPayload | undefined
                        if (typeof first?.access_token === "string" && first.access_token) return first.access_token
                        return null
                    }

                    if (typeof parsed !== "object") return null

                    const tokenPayload = parsed as SessionTokenPayload
                    if (typeof tokenPayload.access_token === "string" && tokenPayload.access_token) return tokenPayload.access_token
                    if (typeof tokenPayload.currentSession?.access_token === "string" && tokenPayload.currentSession.access_token) {
                        return tokenPayload.currentSession.access_token
                    }
                    if (typeof tokenPayload.session?.access_token === "string" && tokenPayload.session.access_token) {
                        return tokenPayload.session.access_token
                    }
                    return null
                }

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue
                    const raw = localStorage.getItem(key)
                    if (!raw) continue
                    try {
                        const parsed = JSON.parse(raw)
                        const token = extractToken(parsed)
                        if (token) return token
                    } catch {
                        // ignore
                    }
                }
                return null
            }

            // 0. Session Auth Bridge (for RLS)
            const bridgeToken = passedToken || getStoredToken()
            if (bridgeToken && !tokenApplied) {
                console.log("[useCurrentUser] Setting session token from parent URL...")
                try {
                    if (typeof window !== "undefined") {
                        localStorage.setItem("programacion_access_token", bridgeToken)
                        localStorage.setItem("token", bridgeToken)
                    }
                    await supabase.auth.setSession({
                        access_token: bridgeToken,
                        refresh_token: ""
                    })
                    setTokenApplied(true)
                } catch (e) {
                    console.error("[useCurrentUser] Error setting bridged session:", e)
                }
            }

            // 1. Get User ID (either from URL or Supabase Session)
            let currentUid = qUserId
            const sourceOfTruthIsUrl = !!qUserId

            if (!currentUid) {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    currentUid = session.user.id
                    setUserId(currentUid)
                    setEmail(session.user.email?.toLowerCase() || null)
                } else {
                    // NO USER DETECTED AT ALL
                    setNeedsAuth(true)
                    setLoading(false)
                    return
                }
            } else {
                setUserId(currentUid)
                setNeedsAuth(false)
            }

            // 2. Sync basic identity state
            if (qRole) setRole(qRole)


            // 4. Fetch Profile & Permissions Matrix
            try {
                let profile: ProfileRecord | null = null

                const res1: any = await supabase
                    .from("perfiles")
                    .select("role, email, full_name, show_kpi, tabla_seguimiento, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", currentUid)
                    .single()

                if (res1.error) {
                    const fallback: any = await supabase
                        .from("perfiles")
                        .select("role, email, full_name, role_definitions!fk_perfiles_role(permissions)")
                        .eq("id", currentUid)
                        .single()

                    if (fallback?.data) {
                        profile = fallback.data as ProfileRecord
                    } else {
                        setLoading(false)
                        return
                    }
                } else {
                    profile = res1.data as ProfileRecord
                }

                if (profile) {
                    const typedProfile = profile as ProfileRecord
                    const dbRole = typeof typedProfile.role === "string" ? typedProfile.role.toLowerCase() : null
                    const dbEmail = typeof typedProfile.email === "string" ? typedProfile.email.toLowerCase() : null
                    const dbDisplayName = typeof typedProfile.full_name === "string" && typedProfile.full_name.trim()
                        ? typedProfile.full_name.trim()
                        : null
                    if (!sourceOfTruthIsUrl) setRole(dbRole)
                    if (dbEmail) setEmail(dbEmail)
                    if (dbDisplayName) setDisplayName(dbDisplayName)
                    // show_kpi: fallback to true if column doesn't exist yet (migration pending)
                    const dbShowKpi = typeof typedProfile.show_kpi === "boolean" ? typedProfile.show_kpi : true
                    setShowKpi(dbShowKpi)
                    if (typeof typedProfile.tabla_seguimiento === "string" && typedProfile.tabla_seguimiento) {
                        setTablaSeguimiento(typedProfile.tabla_seguimiento)
                    }

                    const roleDef = Array.isArray(typedProfile.role_definitions)
                        ? typedProfile.role_definitions[0]
                        : typedProfile.role_definitions

                    const dbPerms = roleDef?.permissions
                    if (dbPerms && Object.keys(dbPerms).length > 0) {
                        const normalizedPerms = {
                            ...dbPerms,
                            programacion: {
                                read: true,
                                write: dbPerms.programacion?.write || false,
                                delete: dbPerms.programacion?.delete || false
                            },
                            laboratorio: {
                                read: true,
                                write: dbPerms.laboratorio?.write || false,
                                delete: dbPerms.laboratorio?.delete || false
                            },
                            comercial: {
                                read: true,
                                write: dbPerms.comercial?.write || false,
                                delete: dbPerms.comercial?.delete || false
                            },
                            administracion: {
                                read: true,
                                write: dbPerms.administracion?.write || false,
                                delete: dbPerms.administracion?.delete || false
                            }
                        }

                        const effectivePerms = applyRestrictedControlAccess(dbRole, typedProfile.email, normalizedPerms)

                        setPermissions(effectivePerms)
                        setAllowedViews(getAllowedViewsFromPermissions(effectivePerms))
                    }

                }
            } catch {
                // Fallback
            } finally {
                setLoading(false)
            }
        }

        fetchIdentityAndPerms()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlKey, supabase])

    return {
        userId,
        role,
        email,
        displayName,
        loading,
        needsAuth,
        allowedViews,
        permissions,
        // qIsAdmin is set by the parent shell (crm-geofal) via URL param — reliable, synchronous
        isAdminFromUrl: qIsAdmin,
        getCanView: (mode: ViewMode) => allowedViews.includes(mode),
        getCanWrite: (mode: ViewMode) => {
            const rNorm = (role || qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            if (isBlockedControlRole(rNorm)) return false
            const isSuperAdmin = rNorm === 'admin' || qIsAdmin

            // Priority 1: Superadmin always has access
            if (isSuperAdmin) return true

            // Parent shell is the authority for the initially requested mode.
            // If it sends canWrite=false, keep strict read-only in that view.
            if (mode === requestedMode && hasCanWriteParam) {
                return qCanWrite
            }

            // Logic shared with EditableCell: block write if viewing LAB as non-lab staff
            if (mode === "LAB") {
                const isLabReadOnly = rNorm.includes('lector')
                if (isLabReadOnly) return false
                return permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }

            if (mode === "COM") {
                return permissions?.comercial?.write || false
            }
            if (mode === "ADMIN") {
                return permissions?.administracion?.write || false
            }
            return false
        },
        isAdmin: (() => {
            const rNorm = (role || qRole || "").toLowerCase()
            return rNorm.includes("admin") || rNorm.includes("gerencia") || rNorm.includes("administrador") || qIsAdmin
        })(),
        // canViewKpis: driven by show_kpi from DB (perfiles). Falls back to URL param, then true for admins.
        canViewKpis: (() => {
            // Admin always sees KPI regardless of show_kpi
            const rNorm = (role || qRole || "").toLowerCase()
            if (rNorm.includes("admin") || rNorm.includes("gerencia") || qIsAdmin) return true
            // DB value takes priority once loaded
            if (showKpi !== null) return showKpi
            // URL param as fast first-render value
            if (qShowKpi !== null) return qShowKpi
            // Default: show KPI while loading (prevents tab flash-hiding)
            return true
        })(),
        /** Legacy users are Yerly and Silvia who feed Tabla 1 */
        isLegacyUser: isLegacyTrackingUser(email, displayName, role),
        /** Tabla 1 (seguimiento) is visible for Yerly/Silvia, users assigned to tabla1, and Admins */
        canViewTabla1: (() => {
            const rNorm = (role || qRole || "").toLowerCase()
            if (rNorm.includes("admin") || rNorm.includes("gerencia") || qIsAdmin) return true
            if (tablaSeguimiento === "tabla1") return true
            if (tablaSeguimiento === "tabla2") return false
            return isLegacyTrackingUser(email, displayName, role)
        })(),
        /** Tabla 2 (seguimiento2) is visible for new commercial advisors, users assigned to tabla2, and Admins */
        canViewTabla2: (() => {
            const rNorm = (role || qRole || "").toLowerCase()
            if (rNorm.includes("admin") || rNorm.includes("gerencia") || qIsAdmin) return true
            if (tablaSeguimiento === "tabla2") return true
            if (tablaSeguimiento === "tabla1") return false
            return !isLegacyTrackingUser(email, displayName, role)
        })(),
    }
}

const KPI_AUTHORIZED_IDENTITIES = ["irma.coaquira", "irma", "fabian", "labprueba"]

export function isKpiAuthorizedUser(role: string | null | undefined, email: string | null | undefined, userId?: string | null): boolean {
    const normRole = String(role || "").toLowerCase().trim()
    const normEmail = String(email || "").toLowerCase().trim()
    const normId = String(userId || "").toLowerCase().trim()

    if (normRole.includes("admin") || normRole.includes("gerencia") || normRole.includes("administrador") || normRole.includes("kpi")) {
        return true
    }

    return KPI_AUTHORIZED_IDENTITIES.some(
        (id) => normEmail.includes(id) || normId.includes(id)
    )
}

export function isLegacyTrackingUser(
    email?: string | null,
    displayName?: string | null,
    role?: string | null
): boolean {
    const normEmail = String(email || "").toLowerCase().trim()
    const normName = String(displayName || "").toLowerCase().trim()

    // Yerly & Silvia are legacy tracking users (Tabla 1)
    if (normEmail.includes("yerly") || normEmail.includes("silvia") || normEmail.includes("speralta") || normEmail.includes("yyerly")) return true
    if (normName.includes("yerly") || normName.includes("silvia") || normName.includes("peralta") || normName.includes("infante")) return true
    return false
}
