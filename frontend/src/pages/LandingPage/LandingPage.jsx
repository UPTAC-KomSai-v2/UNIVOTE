import React from "react";
import axios from 'axios';

import { useNavigate } from 'react-router-dom';
import Card from "../../components/Card/Card";

import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <Card
        title="UniVote"
        description="University-wide Student Council Election Management System"
      >
        <div className="buttons">
            <button onClick={() => navigate('/login')}>Admin</button>
            <button onClick={() => navigate('/login')}>Candidate</button>
            <button onClick={() => navigate('/login')}>Voter</button>
            <button onClick={() => navigate('/login')}>Auditor</button>
        </div>
      </Card>
    </div>   
  );
}
