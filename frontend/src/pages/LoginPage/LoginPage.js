import React from "react";
import axios from 'axios';

import { useNavigate } from 'react-router-dom';
import Card from "../../components/Card/Card";
import LoginForm from "../../components/LoginForm/LoginForm";

import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <Card
        title="UniVote"
        description="University-wide Student Council Election Management System"
      >
        <LoginForm />
      </Card>
    </div>   
  );
}
