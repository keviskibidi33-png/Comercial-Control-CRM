
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
    role_definitions: RoleDefinitionRecord | RoleDefinitionRecord[] | null
}

const CONTROL_ACCESS_REVOKED_EMAILS = new Set([
    "tecnico2@geofal.com.pe",
    "tecnico3@geofal.com.pe",
])

function applyRestrictedControlAccess(email: string | null | undefined, perms: PermissionMap): PermissionMap {
    const normalizedEmail = String(email || "").toLowerCase().trim()
    if (!CONTROL_ACCESS_REVOKED_EMAILS.has(normalizedEmail)) {
        return perms
    }

    return {
        ...perms,
        laboratorio: { read: false, write: false, delete: false },
        comercial: { read: false, write: false, delete: false },
        administracion: { read: false, write: false, delete: false },
    }
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
    const qCanWrite = searchParams.get("canWrite") === "true"
    const hasCanWriteParam = searchParams.has("canWrite")
    const qIsAdmin = searchParams.get("isAdmin") === "true"
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
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(qUserId)
    const [needsAuth, setNeedsAuth] = useState(false)
    const [tokenApplied, setTokenApplied] = useState(false)

    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(["LAB", "COM", "ADMIN"])

    const [permissions, setPermissions] = useState<PermissionMap>(() => {
        // Initial permissions: minimal until DB load completes
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const isSuperAdmin = rNorm === 'admin' || qIsAdmin
        const dynamicCanWrite = qCanWrite || isSuperAdmin
        const isLabRole = (rNorm.includes('laboratorio') || rNorm.includes('tipificador')) && !rNorm.includes('lector')

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
                read: isSuperAdmin || rNorm.includes('comercial') || rNorm.includes('vendor') || rNorm.includes('vendedor') || rNorm.includes('asesor'),
                write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('comercial') || rNorm.includes('vendor') || rNorm.includes('vendedor') || rNorm.includes('asesor')),
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
                const { data: profile, error: profileError } = await supabase
                    .from("perfiles")
                    .select("role, email, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", currentUid)
                    .single()

                if (profileError) {
                    setLoading(false)
                    return
                }

                if (profile) {
                    const typedProfile = profile as ProfileRecord
                    const dbRole = typeof typedProfile.role === "string" ? typedProfile.role.toLowerCase() : null
                    const dbEmail = typeof typedProfile.email === "string" ? typedProfile.email.toLowerCase() : null
                    if (!sourceOfTruthIsUrl) setRole(dbRole)
                    if (dbEmail) setEmail(dbEmail)

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

                        const effectivePerms = applyRestrictedControlAccess(typedProfile.email, normalizedPerms)

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
        loading,
        needsAuth,
        allowedViews,
        permissions,
        getCanView: (mode: ViewMode) => allowedViews.includes(mode),
        getCanWrite: (mode: ViewMode) => {
            const rNorm = (role || qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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
        }

    }
}
