import { useId } from "react"
import { createPortal } from "react-dom"
import modalStyles from "../../utils/logout_utils.module.css"

/**
 * Same look as the logout confirmation (overlay + centered card + YES / NO pill buttons).
 * Portaled to document.body so admin main panel overflow does not clip it.
 */
export default function ConfirmModal({
    open,
    message,
    error,
    confirmLabel = "YES",
    cancelLabel = "NO",
    onConfirm,
    onCancel,
    loading = false,
}) {
    const titleId = useId()
    const errorId = useId()

    if (!open) return null

    return createPortal(
        <>
            <div
                className={modalStyles.overlay}
                style={{ zIndex: 9998 }}
                onClick={() => {
                    if (!loading) onCancel?.()
                }}
                aria-hidden="true"
            />
            <div
                className={modalStyles.submissionMessage}
                style={{ zIndex: 9999 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={error ? errorId : undefined}
            >
                <p id={titleId}>{message}</p>
                {error ? (
                    <p
                        id={errorId}
                        className={modalStyles.confirmModalError}
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                <div>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => onCancel?.()}
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </>,
        document.body
    )
}
