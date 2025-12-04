import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import "./ManageProfile.css";
import backButton from '../../../assets/back-button-white.png'
import loi from '../../../assets/loi.jpg'

export default function ManageProfile() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState('');

  const [profile, setProfile] = useState({
    name: '',
    party_name: '',
    alias: '',
    position: ''
  });

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
    fetch("http://localhost:8000/api/manage-profile-page/")
      .then(res => res.json())
      .then(data => {
        setVoterID(data.voter_id)
        if (data.profile && data.profile[0]) {
            setProfile(data.profile[0]);
        }
      });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prevProfile => ({
        ...prevProfile, 
        [name]: value  
    }));
  };

  const handleSave = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/manage-profile-page/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        console.log("Profile saved!");
        navigate('/candidate-dashboard'); 
      } else {
        alert("Failed to save profile. Check console for details.");
      }

    } catch (error) {
      console.error("Network error:", error);
      alert("Could not connect to server.");
    }
  };
  
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

          <div className="confirm-button" onClick={() => navigate('/candidate-dashboard')}>
            <button onClick={handleSave}>Confirm</button>
          </div>

        </Card>

        
        <div className="candidate-details">
          <img className="candidate-image-single" src={loi} alt="Letter of Intent" />

          <button className="edit-pfp-button" onClick={() => {}}>Edit Profile Picture</button>

          <div className="profile-details">
            <h1>{profile.name}</h1>

            <p>Party Name: </p>
            <input 
                type="text" 
                name="party_name"
                value={profile.party_name || ''} 
                onChange={handleInputChange}
                placeholder="Enter Party Name"
            />

            <p>Alias: </p>
            <input 
                type="text" 
                name="alias"
                value={profile.alias || ''} 
                onChange={handleInputChange}
                placeholder="Enter Alias"
            />

            <p>Position: </p>
            <h3>{profile.position}</h3>
          </div>

        </div>
    </div>
  );
}