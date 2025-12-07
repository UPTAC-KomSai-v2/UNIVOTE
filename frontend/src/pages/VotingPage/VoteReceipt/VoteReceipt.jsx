import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import "./VoteReceipt.css";
import backButton from '../../../assets/back-button-white.png'
import api from "../../../api";
import logout from "../../../assets/logout.png"; // Make sure to import the logout image

export default function VoteReceipt() {
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  
  // 1. Add logout state
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
    api.get("/api/vote-receipt-page/")
      .then((res) => {
        console.log(res.data);
        setReceipt(res.data);
      })
      .catch((err) => {
        console.error("Error fetching receipt:", err);
      });
  }, []);

  // Format time function (kept same as yours)
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      const timeStr = String(timeString);
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        const isPM = timeStr.includes('PM');
        const timeOnly = timeStr.replace(/AM|PM/g, '').trim();
        const parts = timeOnly.split(':');
        let hour = parseInt(parts[0]);
        const minutes = parts[1] || '00';
        const seconds = parts[2] || '00';
        if (isPM && hour !== 12) hour += 12;
        else if (!isPM && hour === 12) hour = 0;
        hour = hour + 8;
        if (hour >= 24) hour = hour - 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes}:${seconds} ${ampm}`;
      }
      return timeString; // Fallback
    } catch (e) {
      return timeString;
    }
  };

  if (!receipt) {
    return <div>Loading receipt...</div>;
  }

  return (
    <div className="vote-receipt-page">
      
      {/* 2. Add Logout Button (Top Right) */}
      <img 
          src={logout} 
          alt="Logout" 
          className="logout-button" 
          onClick={() => setLogoutConfirmed(true)} 
      />

      {/* 3. Add Logout Confirmation Modal */}
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
        className="vote-receipt-page-card"
        title="UniVote"
        description="University-wide Student Council Election Management System"
      >
        <div className="voter-id">
          Voter ID: {receipt.voter_id}
        </div>
        <div className="print-receipt-button">
          <button onClick={() => window.print()}>Print Receipt</button>
        </div>
      </Card>

      <div className="candidate-list-container">
        <div className="candidate-list-card-content">
          <div className="candidate-list-card-title">2025 Student Council Elections</div>
          <div className="candidate-list-card-type">Voting Receipt</div>
          <div className="receipt-details">
            <p><strong>Date:</strong> {receipt.date} | <strong>Time:</strong> {formatTime(receipt.time)}</p>
            <p className="receipt-ref">Receipt ID: <strong>{receipt.receipt_id}</strong></p>
            <hr/>
            <div className="receipt-data-container">
              <div className="selected-candidate">
                <h3>Chairperson:</h3>
                <p>{receipt.chairperson || 'None'}</p>
              </div>
              <div className="selected-candidate">
                <h3>Vice Chairperson:</h3>
                <p>{receipt.vice_chairperson || 'None'}</p>
              </div>
              <div className="selected-candidate">
                <h3>Councilors:</h3>
                {receipt.councilor && receipt.councilor.length > 0 ? (
                  <ul>
                    {receipt.councilor.map((name, index) => (
                      <li key={index}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p>None</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}