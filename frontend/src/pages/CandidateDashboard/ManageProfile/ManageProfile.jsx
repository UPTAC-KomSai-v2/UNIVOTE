import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CandidateCard from "../../../components/CandidateCard/CandidateCard";
import "./ManageProfile.css";
import backButton from '../../../assets/back-button-white.png'
import loi from '../../../assets/loi.jpg'

export default function ManageProfile() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState('');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
  // GET voter data
    fetch("http://localhost:8000/api/manage-profile-page/")
      .then(res => res.json())
      .then(data => {
        setVoterID(data.voter_id)
        setProfile(data.profile[0]);
      });
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

        
        <div className="candidate-details">
          <img className="candidate-image-single" src={loi} alt="Letter of Intent" />

          <button className="edit-pfp-button" onClick={() => {}}>Edit Profile Picture</button>

          <div className="profile-details">
            <h1>{profile ? profile.name : ''}</h1>

            <p>Party Name: </p>
            <input type="text" placeholder={profile ? profile.party_name : ''}/>

            <p>Alias: </p>
            <input type="text" placeholder={profile ? profile.alias : ''}/>

            <p>Position: </p>
            <h3>{profile ? profile.position : ''}</h3>
          </div>



        </div>
    </div>
  );
}
