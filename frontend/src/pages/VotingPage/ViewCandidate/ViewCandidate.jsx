import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import "./ViewCandidate.css";
import backArrow from '../../../assets/back-button-white.png'
import loi from '../../../assets/loi.jpg'

export default function ViewCandidate() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id } = useParams();

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
    // GET voter data
    fetch("http://localhost:8000/api/voting-page/")
      .then(res => res.json())
      .then(data => {
        setVoterID(data.voter_id);
      })
      .catch(err => console.error("Error fetching voter:", err));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/view-candidate/${id}/`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Candidate not found');
        }
        return res.json();
      })
      .then(data => {
        setCandidate(data.candidate);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching candidate:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!candidate) {
    return <div>No candidate found</div>;
  }

  return (
    <div className="vote-receipt-page">
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
            <button onClick={() => {navigate('/voting-page/?position=Chairperson')}}>
              Chairperson
            </button>
            <button onClick={() => {navigate('/voting-page/?position=Vice Chairperson')}}>
              Vice Chairperson
            </button>
            <button onClick={() => {navigate('/voting-page/?position=Councilors')}}>
              Councilors
            </button>
           

          </div>

      </Card>

      <div className="candidate-details">
        <img className="candidate-image-single" src={candidate.image || loi} alt={candidate.name} />

        <h1>{candidate.name}</h1>
        <i>for {candidate.position}</i>

        <p>{candidate.alias}</p>
        <p className="mini-header"><strong>Alias</strong></p>

        <p>{candidate.party}</p>
        <p className="mini-header"><strong>Party</strong></p>

        <p>{candidate.description}</p>

        <button className="done-viewing-button" onClick={() => navigate('/voting-page')}>Done Viewing</button>
      </div>

    </div>
  );
}