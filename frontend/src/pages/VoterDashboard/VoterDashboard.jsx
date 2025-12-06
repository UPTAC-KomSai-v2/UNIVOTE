import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import "./VoterDashboard.css";
import thumbsUp from "../../assets/thumbs-up.png";
import api from "../../api";
import logout from "../../assets/logout.png";


export default function VoterDashboard() {
  const navigate = useNavigate();
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);
  
  return (
    <div className="voter-dashboard">
      <img 
          src={logout} 
          alt="Logout" 
          className="logout-button" 
          onClick={() => setLogoutConfirmed(true)} 
      />
      {
        logoutConfirmed && (
          <>
            <div className="overlay" onClick={() => setLogoutConfirmed(false)}></div>
            <div className="submission-message">
              <p>  
                Log out from your account?
              </p>
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
          )
        }

      <Card
        className="voter-dashboard-card"
        title="UniVote"
        description="University-wide Student Council Election Management System"
      >
      
      <div>
        <button className="voter-vote-button" onClick={() => navigate('/voting-page')}>
          <img src={thumbsUp} alt="Vote" />
          Vote
        </button>
      </div>

      </Card>
    </div>
  );
}
