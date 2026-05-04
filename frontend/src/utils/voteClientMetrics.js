/**
 * Client-side signals for ballot submission audit.
 * Server stores: SHA-256(device string), optional install UUID, plus IP and User-Agent from the HTTP request.
 */

const INSTALL_KEY = "univote_ballot_install_v1"

function webglRendererFingerprint() {
    try {
        const canvas = document.createElement("canvas")
        const gl =
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl")
        if (!gl) return ""
        const ext = gl.getExtension("WEBGL_debug_renderer_info")
        if (!ext) return ""
        const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || ""
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ""
        return `${vendor}|${renderer}`
    } catch {
        return ""
    }
}

/** Persistent first-party ID for this browser profile (localStorage). */
export function getOrCreateBallotInstallId() {
    if (typeof window === "undefined") return ""
    try {
        let id = window.localStorage.getItem(INSTALL_KEY)
        const uuidRe =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!id || !uuidRe.test(id)) {
            id = crypto.randomUUID()
            window.localStorage.setItem(INSTALL_KEY, id)
        }
        return id
    } catch {
        return ""
    }
}

/** Concatenated environment string; hashed server-side (SHA-256). */
export function buildVoteDeviceFingerprint() {
    if (typeof window === "undefined") return ""
    try {
        const parts = [
            navigator.userAgent || "",
            String(screen?.width ?? ""),
            String(screen?.height ?? ""),
            String(screen?.colorDepth ?? ""),
            String(window.devicePixelRatio ?? ""),
            Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            navigator.language || "",
            navigator.platform || "",
            String(navigator.hardwareConcurrency ?? ""),
            String(navigator.maxTouchPoints ?? ""),
            webglRendererFingerprint(),
        ]
        return parts.join("|")
    } catch {
        return ""
    }
}
