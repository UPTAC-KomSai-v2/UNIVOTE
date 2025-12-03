import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import "./CandidateDashboard.css";
import thumbsUp from "../../assets/thumbs-up.png";

export default function VoterDashboard() {
  const navigate = useNavigate();
  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);
  
  return (
    <div className="candidate-dashboard">
        <Card
          className="candidate-dashboard-card"
          title="UniVote"
          description="University-wide Student Council Election Management System"
        >

        <div>
          <button className="manage-profile-button" onClick={() => navigate('/manage-profile-page')}>
            <img src={thumbsUp} alt="Manage Profile" />
            Vote
          </button>
        </div>
        
        <div>
          <button className="vote-button" onClick={() => navigate('/voting-page')}>
            <img src={thumbsUp} alt="Vote" />
            Vote
          </button>
        </div>

        </Card>
    </div>
  );
}
