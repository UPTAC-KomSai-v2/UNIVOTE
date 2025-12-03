import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import CandidateCard from "../../components/CandidateCard/CandidateCard";
import "./VotingPage.css";
import backArrow from '../../assets/arrow-back.png'

export default function VotingPage() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState('');
  const [candidateNumChoice, setCandidateNumChoice] = useState(1);

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
  // GET voter data
    fetch("http://localhost:8000/api/voting-page/")
      .then(res => res.json())
      .then(data => setVoterID(data.voter_id));
  }, []);
  
  return (
    <div className="voting-page">
        <Card
          className="voting-page-card"
          title="UniVote"
          description="University-wide Student Council Election Management System"
        >
          <img 
            src={backArrow} 
            alt="Back" 
            className="back-arrow" 
            onClick={() => navigate(-1)} 
          />

          Voter ID: {voterID}

          <div className="candidateButtons">
            <button>Chairperson</button>
            <button>Vice Chairperson</button>
            <button>Councilors</button>

            
            <button className="submit-button">SUBMIT</button>

          </div>

        </Card>

        <div className="candidate-list-container">
          <div className="candidate-list-card-content">
              <div className="candidate-list-card-title">2025 Student Council Elections</div>
              <div className="candidate-list-card-type">Chairperson</div>
              <div className="candidate-list-card-number">(Choose only {candidateNumChoice})</div>
          </div>
          <div className="candidate-list">
              <CandidateCard
                studentName="Juan Dela Cruz"
                studentNumber="202100123"
                studentAlias="JuanCruz"
                studentParty="Party A"
                studentPosition="Chairperson"
                studentDescription="A dedicated student leader committed to excellence." 
              />
              <CandidateCard
                studentName="Juan Dela Cruz"
                studentNumber="202100123"
                studentAlias="JuanCruz"
                studentParty="Party A"
                studentPosition="Chairperson"
                studentDescription="A dedicated student leader committed to excellence." 
              />
              <CandidateCard
                studentName="Juan Dela Cruz"
                studentNumber="202100123"
                studentAlias="JuanCruz"
                studentParty="Party A"
                studentPosition="Chairperson"
                studentDescription="A dedicated student leader committed to excellence." 
              />
          </div>
        </div>

    </div>
  );
}
