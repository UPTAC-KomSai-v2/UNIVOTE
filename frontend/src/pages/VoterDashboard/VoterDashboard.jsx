import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import "./VoterDashboard.css";
import thumbsUp from "../../assets/thumbs-up.png";
import receiptIcon from "../../assets/thumbs-up.png"; // You might want a different icon
import api from "../../api";
import logout from "../../assets/logout.png";

export default function VoterDashboard() {
  const navigate = useNavigate();
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);
  const [hasVoted, setHasVoted] = useState(false); // New State
  const [loading, setLoading] = useState(true);    // Loading State

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data } = await api.get("/api/check-status/");
        console.log("Vote Status:", data); // Debugging: Check what the server says
        
        // Ensure we strictly set boolean
        if (data.has_voted === true) {
            setHasVoted(true);
        } else {
            setHasVoted(false);
        }
      } catch (error) {
        console.error("Error checking status:", error);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
      window.history.pushState(null, null, window.location.pathname);
  
      const handleBackButton = (event) => {
        window.history.pushState(null, null, window.location.pathname);
        
        setLogoutConfirmed(true);
      };
      window.addEventListener('popstate', handleBackButton);
      return () => {
        window.removeEventListener('popstate', handleBackButton);
      };
    }, []);

  return (
    <div className="voter-dashboard">
      <img 
          src={logout} 
          alt="Logout" 
          className="logout-button" 
          onClick={() => setLogoutConfirmed(true)} 
      />
      
      {/* ... Logout Modal Code (Same as before) ... */}
      {logoutConfirmed && (
          <>
            <div className="overlay" onClick={() => setLogoutConfirmed(false)}></div>
            <div className="submission-message">
              <p>Log out from your account?</p>
              <div>
                <button onClick={() => {
                    api.post("/api/logout/");
                    localStorage.removeItem("userRole");
                    navigate('/');
                }}>YES</button>
                <button onClick={() => setLogoutConfirmed(false)}>NO</button>
              </div>
            </div>
          </>
      )}

      <Card
        className="voter-dashboard-card"
        title="UniVote"
        description="University-wide Student Council Election Management System"
      >
      
      <div>
        {/* Conditional Rendering based on Status */}
        {loading ? (
            <p>Loading status...</p>
        ) : hasVoted ? (
            <button className="voter-vote-button" onClick={() => navigate('/vote-receipt-page')}>
              <img src={thumbsUp} alt="Receipt" /> 
              View Receipt
            </button>
        ) : (
            <button className="voter-vote-button" onClick={() => navigate('/voting-page')}>
              <img src={thumbsUp} alt="Vote" />
              Vote
            </button>
        )}
      </div>

      </Card>
    </div>
  );
}