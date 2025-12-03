import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import LoginForm from "../../components/LoginForm/LoginForm";
import "./LoginPage.css";
import backButton from '../../assets/back-button-maroon.png'

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("login-bg");
    document.body.classList.remove("dashboard-bg"); // optional
    return () => document.body.classList.remove("login-bg");
  }, []);
  
  return (
    <div className="login-page">
        <img 
            src={backButton} 
            alt="Back" 
            className="back-button" 
            onClick={() => navigate('/')} 
          />

        <Card
          title="UniVote"
          description="University-wide Student Council Election Management System"
        >
          
          <LoginForm />
        </Card>
    </div>
  );
}
