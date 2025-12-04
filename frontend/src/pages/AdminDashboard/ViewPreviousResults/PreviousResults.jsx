import React, { useState, useEffect} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CustomPieChart from "../../../components/PieChart/CustomPieChart";
import "./PreviousResults.css";
import backArrow from '../../../assets/back-button-white.png'
import logout from '../../../assets/logout.png'

export default function PreviousResults() {
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const year = queryParams.get('year') || '2024';
  const origin = location.state?.from;

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

  const [voterChartData, setVoterChartData] = useState([]);
  const [totalVoters, setTotalVoters] = useState(0);
  const [totalNumberOfVoters, setTotalNumberOfVoters] = useState(0);
  const [chairpersonChartData, setChairpersonChartData] = useState([]);
  const [viceChairpersonChartData, setViceChairpersonChartData] = useState([]);
  const [councilorChartData, setCouncilorChartData] = useState([]);
  const [yearSelected, setYearSelected] = useState(year || '2024');
  const [timestamp, setTimestamp] = useState('');
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);
    
  
  useEffect(() => {
    setYearSelected(year);
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, [year]);

  useEffect(() => {
  // GET voter data
    fetch(`http://localhost:8000/api/view-previous-results/`)
      .then(res => res.json())
      .then(data => {
        setVoterChartData(data.voter_results)
        setTotalVoters(data.total_voters)
        setTotalNumberOfVoters(data.total_number_of_voters)
        setChairpersonChartData(data.chairperson_results)
        setViceChairpersonChartData(data.vice_chairperson_results)
        setCouncilorChartData(data.councilor_results)

      });
  }, []);

  useEffect(() => {
    const now = new Date();
    setTimestamp(now.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }))
  }, []);

  
  return (
    <div className="voting-page">
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
                  <button onClick={() => navigate('/')}>YES</button>
                  <button onClick={() => setLogoutConfirmed(false)}>NO</button>
                </div>
              </div>
            </>
          )
        }
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
            <button 
              onClick={() => {
                if (origin === "auditor") {
                  navigate('/auditor-dashboard/?year=2025');
                } else if (origin === "admin") {
                  navigate('/admin-dashboard');
                } else {
                  navigate('/auditor-dashboard/?year=2025');
                }
              }}
            >
              2025 SC ELECTIONS
            </button>
            <button onClick={() => {
              navigate('/view-previous-results/?year=2024', { 
                state: { from: origin } 
              })
            }}>
              2024 SC ELECTIONS
            </button>
            <button onClick={() => {
              navigate('/view-previous-results/?year=2023', { 
                state: { from: origin } 
              })
            }}>
              2023 SC ELECTIONS
            </button>

          </div>

        </Card>

        
        <div className="candidate-list-container">
          <button className="print-button" onClick={() => window.print()}>PRINT</button>
            <div className="candidate-list-card-content">
                <h1 className="candidate-list-card-title">{yearSelected} Student Council Elections</h1>
                <h2>RESULTS</h2>

                <i>(as of {timestamp})</i>                
            </div>
            
            

            
            <div className="candidate-list">

              <div className="voter-chart-view">
                <div className="voter-chart-container">
                  <CustomPieChart data={voterChartData} className="voter-chart" name="program" valueKey="votes"/>
                </div>

                <div className="voter-data">
                  <h1>No. Of Voters</h1>
                  <p>{totalVoters} out of {totalNumberOfVoters} ({((totalVoters / totalNumberOfVoters) * 100).toFixed(2)}%)</p>
                  
                  <h2>Voters per Degree Program</h2>
                  <ul className="map-voter-data-list">
                    {programs.map((program, index) => {
                      const programData = voterChartData.find(item => item.program === program);
                      const totalNumberOfStudents = programData ? programData.total_students : 0;
                      const votersCount = programData ? programData.votes : 0;
                      const percentage = totalVoters > 0 ? ((votersCount / totalVoters) * 100).toFixed(2) : 0;
                      return (
                        <li key={index}>
                          <strong>{program}:</strong> {votersCount} out of {totalNumberOfStudents} ({percentage}%)
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="candidates-data-chart-view">
                <div className="chairperson-vice-container">

                  <div className="chairperson-chart-view">
                    <h3>Chairperson</h3>
                    <div className="chairperson-chart-container">
                      <CustomPieChart data={chairpersonChartData} className="chairperson-chart" name="name" valueKey="votes"/>
                    </div>

                    <div className="candidates-data">                  
                      <ul className="map-voter-data-list">
                        {
                          chairpersonChartData.map((candidate, index) => {
                            const percentage = totalVoters > 0 ? ((candidate.votes / totalVoters) * 100).toFixed(2) : 0;
                            return (
                              <li key={index}>
                                <strong>{candidate.name}:</strong> {candidate.votes} votes ({percentage}%)
                              </li>
                            );
                          })
                        }
                      </ul>
                    </div>
                  </div>

                  <div className="vice-chairperson-chart-view">
                    <h3>Vice Chairperson</h3>
                    <div className="vice-chairperson-chart-container">
                      <CustomPieChart data={viceChairpersonChartData} className="vice-chairperson-chart" name="name" valueKey="votes"/>
                    </div>

                    <div className="candidates-data">                  
                      <ul className="map-voter-data-list">
                        {
                          viceChairpersonChartData.map((candidate, index) => {
                            const percentage = totalVoters > 0 ? ((candidate.votes / totalVoters) * 100).toFixed(2) : 0;
                            return (
                              <li key={index}>
                                <strong>{candidate.name}:</strong> {candidate.votes} votes ({percentage}%)
                              </li>
                            );
                          })
                        }
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="councilor-chart-view">
                  <div className="title-chart-container">
                    <h3>Councilors</h3>
                    <div className="voter-chart-container">
                      <CustomPieChart data={councilorChartData} className="councilor-chart" name="name" valueKey="votes"/>
                    </div>
                  </div>

                  <div className="voter-data">                    
                    <ul className="map-voter-data-list">
                        {
                          councilorChartData.map((candidate, index) => {
                            const percentage = totalVoters > 0 ? ((candidate.votes / totalVoters) * 100).toFixed(2) : 0;
                            return (
                              <li key={index}>
                                <strong>{candidate.name}:</strong> {candidate.votes} votes ({percentage}%)
                              </li>
                            );
                          })
                        }
                    </ul>
                  </div>
                </div>
              </div>
            </div>
        </div>

    </div>
  );
}
