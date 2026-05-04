import React, { useEffect } from 'react'
import Card from "../../components/Card/Card.jsx"
import LoginForm from "../../components/LoginForm/LoginForm.jsx"
import styles from "./LoginPage.module.css"

function LoginPage() {
    useEffect(() => {
        document.body.classList.add("login-bg");
        return () => document.body.classList.remove("login-bg");
    }, [])

    return (
        <div className={styles.loginPage}>
            <Card title="UniVote" description="University-wide Student Council Election Management System">
                <LoginForm />
            </Card>
        </div>
    );
}

export default LoginPage
