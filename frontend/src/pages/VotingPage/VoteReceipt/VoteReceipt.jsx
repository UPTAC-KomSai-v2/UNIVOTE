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
                  <p><strong>Date:</strong> {receipt.date} | <strong>Time:</strong> {receipt.time}</p>
                  <p className="receipt-ref">Receipt ID: <strong>{receipt.receipt_id}</strong></p>
                  <hr/>
                  
                  <div className="receipt-data-container">
                      <div className="selected-candidate">
                        <h3>Chairperson:</h3>
                        <p>{receipt.chairperson}</p>
                      </div>

                      <div className="selected-candidate">
                        <h3>Vice Chairperson:</h3>
                        <p>{receipt.vice_chairperson}</p>
                      </div>

                      <div className="selected-candidate">
                        <h3>Councilors:</h3>
                        <ul>
                          {receipt.councilor && receipt.councilor.map((name, index) => (
                              <li key={index}>{name}</li>
                          ))}
                        </ul>
                      </div>
                  </div>
              </div>
          </div>
        </div>
    </div>
  );
}
