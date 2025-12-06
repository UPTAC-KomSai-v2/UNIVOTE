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
            console.log("Email:", email);
            console.log("Password:", password);
            
            const response = await api.post("/api/login/", { email, password });
            
            console.log("Login response:", response.data);
            
            // Debug: Check if cookies are set
            console.log("All cookies after login:", document.cookie);
            
            // Check specifically for access_token
            const hasAccessToken = document.cookie.includes('access_token');
            console.log("Has access_token cookie?", hasAccessToken);

            localStorage.setItem('userRole', response.data.role);
            
            // Small delay to ensure cookies are set before navigation
            setTimeout(() => {
                navigate(response.data.redirect_url);
            }, 100);
            
        } catch (error) {
            console.error("Login error:", error);
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