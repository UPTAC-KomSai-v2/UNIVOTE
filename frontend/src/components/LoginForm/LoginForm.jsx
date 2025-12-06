import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../../api";

import './LoginForm.css';

// 1. Accept the 'role' prop here
export default function LoginForm({ role }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            console.log(email)
            console.log(password)
            const response = await api.post("/api/login", { email, password });

            localStorage.setItem('userRole', response.data.role);
            navigate(response.data.redirect_url);
        } catch (error) {
            setError("Invalid credentials");
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <input type="text" placeholder='UP Mail'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />
            </div>
            <div>
                <input type="password" placeholder='Password' 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                />
            </div>

            <button>LOGIN</button>
            {error && <p style={{color: "white"}}>{error}</p>}

        </form>
    );
}