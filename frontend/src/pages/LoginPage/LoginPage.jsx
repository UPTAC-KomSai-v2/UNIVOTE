import React, { useEffect } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import Card from "../../components/Card/Card";
import LoginForm from "../../components/LoginForm/LoginForm";
import "./LoginPage.css";
import backButton from '../../assets/back-button-maroon.png'

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const userRole = location.state?.role || 'Voter';
  
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
          
          <LoginForm role={userRole} />
        </Card>
    </div>
  );
}
