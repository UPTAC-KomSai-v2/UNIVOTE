import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CandidateCard from "../../../components/CandidateCard/CandidateCard";
import "./ManageProfile.css";
import backButton from '../../../assets/back-button-white.png'

export default function ManageProfile() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState('');

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
  // GET voter data
    fetch("http://localhost:8000/api/manage-profile-page/")
      .then(res => res.json())
      .then(data => setVoterID(data.voter_id));
  }, []);
  
  return (
    <div className="manage-profile-page">
        <Card
          className="manage-profile-page-card"
          title="UniVote"
          description="University-wide Student Council Election Management System"
        >
          <img 
            src={backButton} 
            alt="Back" 
            className="back-button" 
            onClick={() => navigate(-1)} 
          />

          <div className="voter-id">
            Voter ID: {voterID}
          </div>

          <div className="confirm-button">
            <button>Confirm</button>

          </div>

        </Card>

        <div className="candidate-list-container">
          <div className="candidate-list-card-content">
              <div className="candidate-list-card-title">2025 Student Council Elections</div>
              <div className="candidate-list-card-type">Chairperson</div>
          </div>
          
        </div>
    </div>
  );
}
