import React, { useState, useEffect} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CustomPieChart from "../../../components/PieChart/CustomPieChart";
import "./PreviousResults.css";
import backArrow from '../../../assets/back-button-white.png'

export default function PreviousResults() {
  const navigate = useNavigate();

  const programs = ["BS Accountancy", 
    "BS Applied Mathematics", 
    "BS Biology", 
    "BS Computer Science", 
    "BS Economics",
    "BA Literature",
    "BS Management", 
    "BS Media Arts",
    "BA Political Science",
  ];

  const [chartData, setChartData] = useState([]);
  const [totalVoters, setTotalVoters] = useState(0);
  const [totalNumberOfVoters, setTotalNumberOfVoters] = useState(0);
  
  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
  // GET voter data
    fetch(`http://localhost:8000/api/view-previous-results/`)
      .then(res => res.json())
      .then(data => {
        setChartData(data.results)
        setTotalVoters(data.total_voters);
        setTotalNumberOfVoters(data.total_number_of_voters);
      });
  }, []);

  
  return (
    <div className="voting-page">
        <Card
          className="voting-page-card"
          title="UniVote"
          description="University-wide Student Council Election Management System"
        >
          <img 
            src={backArrow} 
            alt="Back" 
            className="back-arrow" 
            onClick={() => navigate(-1)} 
          />

          <div className="candidateButtons">
            <button onClick={() => {navigate('/admin-dashboard')}}>
              2025 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results')}}>
              2024 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results')}}>
              2023 SC ELECTIONS
            </button>

          </div>

        </Card>

        
        <div className="candidate-list-container">
            <div className="candidate-list-card-content">
                <h1 className="candidate-list-card-title">2024 Student Council Elections</h1>                
            </div>
            
            

            
            <div className="candidate-list">

              <div className="voter-chart-view">
                <div className="voter-chart-container">
                  <CustomPieChart data={chartData} className="voter-chart" name="program"/>
                </div>

                <div className="voter-data">
                  <h1>No. Of Voters</h1>
                  <p>{totalVoters} out of {totalNumberOfVoters} ({((totalVoters / totalNumberOfVoters) * 100).toFixed(2)}%)</p>
                  
                  <h2>Voters per Degree Program</h2>
                  

                </div>


              </div>
                
            </div>
        </div>

    </div>
  );
}
