import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import LoginForm from "../../components/LoginForm/LoginForm";
// import "./VoterDashboard.css";
import thumbsUp from "../../assets/thumbs-up.png";

export default function VotingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);
  
  return (
    <div className="voter-dashboard">
        <Card
          title="UniVote"
          description="University-wide Student Council Election Management System"
        >
        </Card>
    </div>
  );
}
