import React from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Card from "../../components/Card/Card";
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await axios.post("http://127.0.0.1:8000/api/login/");
      console.log(response.data);
      navigate("/home"); // go to placeholder page
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="login-page">
      <Card
        title="UniVote"
        description="University-wide Student Council Election Management System"
      />
    </div>    // <div style={{ textAlign: "center", marginTop: "50px" }}>
    //   <h2>Login Page</h2>
    //   <button onClick={handleLogin}>Login</button>
    // </div>
  );
}
