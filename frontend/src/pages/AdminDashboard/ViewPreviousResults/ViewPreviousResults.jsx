import React, { useState, useEffect} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CandidateCard from "../../../components/CandidateCard/CandidateCard";
import "./ViewPreviousResults.css";
import backArrow from '../../../assets/back-button-white.png'

export default function ViewPreviousResults() {
  const navigate = useNavigate();
  const location = useLocation();

  

  const positions = [
    'President',
    'Vice President',
    'Councilor',
  ];
  
  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
  // GET voter data
    fetch(`http://localhost:8000/api/admin-dashboard/`)
      .then(res => res.json())
      .then(data => {
        
      });
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

          <div className="candidateButtons">
            <button onClick={() => {navigate('/admin-dashboard')}}>
              2025 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results')}}>
              2024 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results')}}>
              2023 SC ELECTIONS
            </button>

          </div>

        </Card>

        
        <div className="candidate-list-container">
            <div className="candidate-list-card-content">
                <h1 className="candidate-list-card-title">2024 Student Council Elections</h1>                
            </div>
            
            

            
            <div className="candidate-list">
                
            </div>
        </div>

    </div>
  );
}
