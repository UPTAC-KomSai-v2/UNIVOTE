import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import './LoginForm.css';

export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // navigate("/home");

        try {
            const response = await axios.post("http://localhost:8000/api/login/", {email, password})

            if(response.status === 200){
                
                console.log("Login successful:", response.data);

                navigate("/voter-dashboard");
            }
            else{
                setError("Invalid email or password");
            }



        } catch (error) {
            setError("Invalid email or password");
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