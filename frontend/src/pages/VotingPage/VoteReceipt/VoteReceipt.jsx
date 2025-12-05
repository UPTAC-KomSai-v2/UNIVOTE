import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import "./VoteReceipt.css";
import backButton from '../../../assets/back-button-white.png'

export default function VoteReceipt() {
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
    // GET voter data
    fetch("http://localhost:8000/api/vote-receipt-page/")
      .then(res => res.json())
      .then(data => {
        console.log(data); // Good for debugging
        setReceipt(data);  // Save the ENTIRE response object
      })
      .catch(err => console.error("Error fetching receipt:", err));
  }, []);

  // Format time to Philippine Time (UTC+8)
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    
    try {
      // Convert to string in case it's not
      const timeStr = String(timeString);
      
      // If it contains AM/PM, parse it and add 8 hours
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        const isPM = timeStr.includes('PM');
        const timeOnly = timeStr.replace(/AM|PM/g, '').trim();
        const parts = timeOnly.split(':');
        
        let hour = parseInt(parts[0]);
        const minutes = parts[1] || '00';
        const seconds = parts[2] || '00';
        
        // Convert to 24-hour format first
        if (isPM && hour !== 12) {
          hour += 12;
        } else if (!isPM && hour === 12) {
          hour = 0;
        }
        
        // Add 8 hours for UTC+8
        hour = hour + 8;
        
        // Handle day overflow
        if (hour >= 24) {
          hour = hour - 24;
        }
        
        // Convert back to 12-hour format
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        
        return `${hour12}:${minutes}:${seconds} ${ampm}`;
      }
      
      // If backend sends time string like "HH:MM:SS"
      const parts = timeStr.split(':');
      if (parts.length < 2) return timeStr;
      
      let hour = parseInt(parts[0]);
      const minutes = parts[1];
      const seconds = parts[2] || '00';
      
      // Add 8 hours for UTC+8
      hour = hour + 8;
      
      // Handle day overflow
      if (hour >= 24) {
        hour = hour - 24;
      }
      
      // Convert to 12-hour format
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      
      return `${hour12}:${minutes}:${seconds} ${ampm}`;
    } catch (e) {
      console.error("Error formatting time:", e);
      return timeString;
    }
  };

  if (!receipt) {
    return <div>Loading receipt...</div>;
  }

  return (
    <div className="vote-receipt-page">
      <Card
        className="vote-receipt-page-card"
        title="UniVote"
        description="University-wide Student Council Election Management System"
      >
        <img 
          src={backButton} 
          alt="Back" 
          className="back-button" 
          onClick={() => navigate('/voting-page')} 
        />
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