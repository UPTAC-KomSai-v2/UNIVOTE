import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout from "../../components/DashboardLayout/DashboardLayout.jsx"
import api from "../../api"
import upSeal from "../../assets/UP-Seal.png"
import styles from "./CandidateManageProfilePage.module.css"

function extractApiError(data) {
    if (!data || typeof data !== "object") return "Something went wrong. Please try again."
    if (typeof data.detail === "string") return data.detail
    const firstKey = Object.keys(data)[0]
    const val = data[firstKey]
    if (Array.isArray(val)) return val[0] || "Please check your input."
    if (typeof val === "string") return val
    return "Please check your input."
}

export default function CandidateManageProfilePage() {
    const navigate = useNavigate()
    const fileRef = useRef(null)

    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)
    const [alias, setAlias] = useState("")
    const [description, setDescription] = useState("")
    const [pendingFile, setPendingFile] = useState(null)
    const [objectUrl, setObjectUrl] = useState(null)
    const [removePhoto, setRemovePhoto] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const res = await api.get("/api/me/candidate-profile/")
            const p = res.data
            setProfile(p)
            setAlias(p.alias ?? "")
            setDescription(p.description ?? "")
            setPendingFile(null)
            setRemovePhoto(false)
        } catch (err) {
            const status = err.response?.status
            if (status === 404) {
                navigate("/candidate-dashboard", { replace: true })
                return
            }
            setError(extractApiError(err.response?.data))
            setProfile(null)
        } finally {
            setLoading(false)
        }
    }, [navigate])

    useEffect(() => {
        document.body.classList.add("dashboard-bg")
        document.body.classList.remove("login-bg")
        return () => document.body.classList.remove("dashboard-bg")
    }, [])

    useEffect(() => {
        load()
    }, [load])

    useEffect(() => {
        if (!pendingFile) {
            setObjectUrl(null)
            return
        }
        const url = URL.createObjectURL(pendingFile)
        setObjectUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [pendingFile])

    const avatarSrc = useMemo(() => {
        if (pendingFile && objectUrl) return objectUrl
        if (removePhoto) return null
        return profile?.profile_photo_url || null
    }, [pendingFile, objectUrl, removePhoto, profile?.profile_photo_url])

    const previewDesc =
        (description || "").trim() || "—"

    const handlePickFile = () => fileRef.current?.click()

    const onFileChange = (e) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file) return
        setRemovePhoto(false)
        setPendingFile(file)
        setError("")
    }

    const handleRemovePhotoIntent = () => {
        setPendingFile(null)
        setRemovePhoto(true)
        setError("")
    }

    const handleSave = async () => {
        if (saving || loading) return
        setSaving(true)
        setError("")
        try {
            const fd = new FormData()
            fd.append("alias", alias)
            fd.append("description", description)
            if (pendingFile) fd.append("profile_photo", pendingFile)
            if (removePhoto && !pendingFile) fd.append("remove_photo", "true")

            const res = await api.patch("/api/me/candidate-profile/", fd)
            const p = res.data
            setProfile(p)
            setAlias(p.alias ?? "")
            setDescription(p.description ?? "")
            setPendingFile(null)
            setRemovePhoto(false)
        } catch (err) {
            setError(extractApiError(err.response?.data))
        } finally {
            setSaving(false)
        }
    }

    const sidebar = (
        <>
            <button type="button" onClick={() => navigate("/candidate-dashboard")}>
                BACK TO DASHBOARD
            </button>
            <div className={styles.voterIdBlock}>
                <p className={styles.voterIdLabel}>Voter ID</p>
                <p className={styles.voterIdValue}>
                    {loading ? "Loading…" : profile?.voter_public_id ?? "—"}
                </p>
            </div>
            <button
                type="button"
                className={`submitVote ${styles.sidebarSave}`}
                disabled={loading || saving || !profile}
                onClick={handleSave}
            >
                {saving ? "Saving…" : "Save changes"}
            </button>
        </>
    )

    if (loading && !profile) {
        return (
            <DashboardLayout sidebar={sidebar}>
                <div className={styles.mainInner}>
                    <p className={styles.loading}>Loading profile…</p>
                </div>
            </DashboardLayout>
        )
    }

    if (!profile) {
        return (
            <DashboardLayout sidebar={sidebar}>
                <div className={styles.mainInner}>
                    {error ? (
                        <p className={styles.errorText} role="alert">
                            {error}
                        </p>
                    ) : (
                        <p className={styles.loading}>Redirecting…</p>
                    )}
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout sidebar={sidebar}>
            <div className={styles.mainInner}>
                <header>
                    <h1 className={styles.pageTitle}>Manage profile</h1>
                    <p className={styles.lead}>
                        Update how you appear on the ballot. Party and position are set by
                        election administrators and cannot be changed here.
                    </p>
                </header>

                {error ? (
                    <p className={styles.errorText} role="alert">
                        {error}
                    </p>
                ) : null}

                <section className={styles.photoSection} aria-label="Profile photo">
                    <div className={styles.avatarWrap}>
                        {avatarSrc ? (
                            <img className={styles.avatar} src={avatarSrc} alt="" />
                        ) : (
                            <span className={styles.avatarPlaceholder}>
                                No photo
                                <br />
                                (seal on ballot)
                            </span>
                        )}
                    </div>
                    <input
                        ref={fileRef}
                        className={styles.hiddenFile}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={onFileChange}
                    />
                    <div className={styles.photoActions}>
                        <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={handlePickFile}
                            disabled={saving}
                        >
                            Edit profile picture
                        </button>
                        {(profile.profile_photo_url || pendingFile) && !removePhoto ? (
                            <button
                                type="button"
                                className={styles.btnDangerOutline}
                                onClick={handleRemovePhotoIntent}
                                disabled={saving}
                            >
                                Remove photo
                            </button>
                        ) : null}
                    </div>
                    <p className={styles.formHint}>
                        JPG, PNG, or WebP — max 2 MB. Shown on the voting page as your
                        ballot portrait.
                    </p>
                </section>

                <section aria-labelledby="official-heading">
                    <h2 id="official-heading" className={styles.previewTitle}>
                        Official record
                    </h2>
                    <dl className={styles.readGrid}>
                        <dt>Legal name</dt>
                        <dd>{profile.full_name || "—"}</dd>
                        <dt>Student number</dt>
                        <dd>{profile.student_number || "—"}</dd>
                        <dt>Email</dt>
                        <dd>{profile.email || "—"}</dd>
                        <dt>Party</dt>
                        <dd>{profile.party?.trim() ? profile.party : "—"}</dd>
                        <dt>Position</dt>
                        <dd>{profile.position?.trim() ? profile.position : "—"}</dd>
                        <dt>Election</dt>
                        <dd>{profile.election_name?.trim() ? profile.election_name : "—"}</dd>
                    </dl>
                </section>

                <section aria-labelledby="edit-heading">
                    <h2 id="edit-heading" className={styles.previewTitle}>
                        Your edits
                    </h2>
                    <label className={styles.formLabel} htmlFor="alias-input">
                        Ballot alias
                        <span className={styles.formHint}>
                            Public display name on the ballot (max 100 characters).
                        </span>
                        <input
                            id="alias-input"
                            className={styles.textInput}
                            maxLength={100}
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            disabled={saving}
                            placeholder="Enter alias"
                            autoComplete="off"
                        />
                    </label>
                </section>

                <section aria-labelledby="stmt-heading">
                    <label className={styles.formLabel} htmlFor="desc-input">
                        <span id="stmt-heading">Statement to voters</span>
                        <span className={styles.formHint}>
                            Optional — max 4,000 characters. Same text voters see when they
                            expand your profile on the ballot.
                        </span>
                        <textarea
                            id="desc-input"
                            className={styles.textArea}
                            maxLength={4000}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={saving}
                            placeholder="Enter a short statement…"
                        />
                    </label>
                </section>

                <section className={styles.previewSection} aria-labelledby="preview-heading">
                    <h2 id="preview-heading" className={styles.previewTitle}>
                        How voters see you
                    </h2>
                    <div className={styles.previewCard}>
                        <img
                            className={`${styles.previewSeal} ${avatarSrc ? styles.previewSealPhoto : ""}`}
                            src={avatarSrc || upSeal}
                            alt=""
                        />
                        <div className={styles.previewHead}>
                            <p className={styles.previewName}>
                                {profile.full_name || "—"}
                            </p>
                            <p className={styles.previewMeta}>
                                <strong>Alias:</strong> {alias.trim() || "—"}
                                <br />
                                <strong>Party:</strong>{" "}
                                {profile.party?.trim() ? profile.party : "—"}
                                <br />
                                <strong>Running for:</strong>{" "}
                                {profile.position?.trim() ? profile.position : "—"}
                            </p>
                        </div>
                        <div className={styles.previewDescWrap}>
                            <p className={styles.previewDesc}>{previewDesc}</p>
                        </div>
                    </div>
                </section>
            </div>
        </DashboardLayout>
    )
}
