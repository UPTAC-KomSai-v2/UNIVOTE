import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import "./ManageProfile.css";
import backButton from '../../../assets/back-button-white.png'
import loi from '../../../assets/loi.jpg'
import api from "../../../api";

export default function ManageProfile() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(loi);

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
    const fetchProfile = async () => {
      try {
        const { data } = await api.get("/api/manage-profile-page/");

        setVoterID(data.voter_id);
        if (data.profile && data.profile[0]) {
          setProfile(data.profile[0]);
          // Set the image preview if an image URL exists
          if (data.profile[0].image_url) {
            setImagePreview(data.profile[0].image_url);
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile()
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prevProfile => ({
        ...prevProfile, 
        [name]: value  
    }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditProfilePicture = () => {
    // Trigger the hidden file input
    document.getElementById('profile-picture-input').click();
  };

  const handleSave = async () => {
    try {
      // If there's a selected image, upload it first
      if (selectedImage) {
        const formData = new FormData();
        formData.append('image', selectedImage);
        formData.append('party_name', profile.party_name);
        formData.append('alias', profile.alias);

        const response = await api.post("/api/manage-profile-page/", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        // Just update text fields
        const response = await api.post("/api/manage-profile-page/", profile);
      }

      console.log("Profile saved!");
      navigate('/candidate-dashboard');
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile.");
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
          <input 
            type="file" 
            id="profile-picture-input"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          
          <img className="candidate-image-single" src={imagePreview} alt="Letter of Intent" />

          <button className="edit-pfp-button" onClick={handleEditProfilePicture}>Edit Profile Picture</button>

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