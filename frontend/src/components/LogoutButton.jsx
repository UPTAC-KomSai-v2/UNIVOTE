import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { logoutUser } from "../utils/logout.jsx";
import logout from "../assets/logout.png"
import styles from "../utils/logout_utils.module.css"

function LogoutButton() {
    const [logoutConfirmed, setLogoutConfirmed] = useState(false);
    const navigate = useNavigate();

    return (
        <>
            <img
                src={logout}
                alt="Logout"
                className={styles.logoutButton}
                onClick={() => setLogoutConfirmed(true)}
            />
            {logoutConfirmed && (
                <>
                    <div className={styles.overlay} onClick={() => setLogoutConfirmed(false)}></div>
                    <div className={styles.submissionMessage}>
                        <p>Log out from your account?</p>
                        <div>
                            <button onClick={() => logoutUser(navigate, "/login")}>YES</button>
                            <button onClick={() => setLogoutConfirmed(false)}>NO</button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

export default LogoutButton
