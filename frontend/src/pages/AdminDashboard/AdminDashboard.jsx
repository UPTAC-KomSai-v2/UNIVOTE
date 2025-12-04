import React, { useState, useEffect} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Card from "../../components/Card/Card";
import CandidateCard from "../../components/CandidateCard/CandidateCard";
import "./AdminDashboard.css";
import backArrow from '../../assets/back-button-white.png'
import logout from '../../assets/logout.png'

export default function AdminDashboard() {
  const navigate = useNavigate();
//   const location = useLocation();

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const years = ['2024', '2025', '2026', '2027', '2028'];

  const [chairpersons, setChairpersons] = useState([]);
  const [viceChairpersons, setViceChairpersons] = useState([]);
  const [councilors, setCouncilors] = useState([]);

  const [startMonth, setStartMonth] = useState('Sep');
  const [startDay, setStartDay] = useState('1');
  const [startYear, setStartYear] = useState('2025');
  const [endMonth, setEndMonth] = useState('Sep');
  const [endDay, setEndDay] = useState('10');
  const [endYear, setEndYear] = useState('2025');
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);
      
  


  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
  // GET voter data
    fetch(`http://localhost:8000/api/admin-dashboard/`)
      .then(res => res.json())
      .then(data => {
        setChairpersons(data.chairpersons);
        setViceChairpersons(data.vice_chairpersons);
        setCouncilors(data.councilors);
      });
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
            <button onClick={() => {navigate('/admin-dashboard/')}}>
              2025 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results/?year=2024', { state: {from: "admin"}})}}>
              2024 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results/?year=2023', { state: {from: "admin"}})}}>
              2023 SC ELECTIONS
            </button>

          </div>

        </Card>


        <div className="candidate-list-container">
            <div className="candidate-list-card-content">
                <h1 className="candidate-list-card-title">2025 Student Council Elections</h1>
                <h2 className="voting-period-header">Voting Period</h2>

                <div className="voting-period-content">
                    <div className="start-date">
                        <label htmlFor="">Start: </label>
                        <select
                            value={startMonth}
                            onChange={(e) => setStartMonth(e.target.value)}
                            >
                            {months.map((month) => (
                                <option key={month} value={month}>
                                {month}
                                </option>
                            ))}
                        </select>
                        <select
                            value={startDay}
                            onChange={(e) => setStartDay(e.target.value)}
                            >
                            {days.map((day) => (
                                <option key={day} value={day}>
                                {day}
                                </option>
                            ))}
                        </select>

                        <select
                            value={startYear}
                            onChange={(e) => setStartYear(e.target.value)}
                            >
                            {years.map((year) => (
                                <option key={year} value={year}>
                                {year}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="end-date">
                        <label htmlFor="">End: </label>
                        <select
                            value={endMonth}
                            onChange={(e) => setEndMonth(e.target.value)}
                            >
                            {months.map((month) => (
                                <option key={month} value={month}>
                                {month}
                                </option>
                            ))}
                        </select>
                        <select
                            value={endDay}
                            onChange={(e) => setEndDay(e.target.value)}
                            >
                            {days.map((day) => (
                                <option key={day} value={day}>
                                {day}
                                </option>
                            ))}
                        </select>

                        <select
                            value={endYear}
                            onChange={(e) => setEndYear(e.target.value)}
                            >
                            {years.map((year) => (
                                <option key={year} value={year}>
                                {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <button className="manage-candidates-button" onClick={() => navigate('/manage-candidates')}>Manage Candidates</button>

            
            <strong>
            List of Candidates
            </strong>
            <div className="candidate-list">
                {chairpersons.map((candidate) => (
                    <CandidateCard
                        key={candidate.id}
                        image={candidate.image}
                        studentName={candidate.name}
                        studentNumber={candidate.student_number}
                        studentAlias={candidate.alias}
                        studentParty={candidate.party}
                        studentPosition={candidate.position}
                        studentDescription={candidate.description}
                        
                        showSelect={false}
                        showView={false}


                    />
                ))}
                {viceChairpersons.map((candidate) => (
                    <CandidateCard
                        key={candidate.id}
                        image={candidate.image}
                        studentName={candidate.name}
                        studentNumber={candidate.student_number}
                        studentAlias={candidate.alias}
                        studentParty={candidate.party}
                        studentPosition={candidate.position}
                        studentDescription={candidate.description}

                        showSelect={false}
                        showView={false}


                    />
                ))}
                {councilors.map((candidate) => (
                    <CandidateCard
                        key={candidate.id}
                        image={candidate.image}
                        studentName={candidate.name}
                        studentNumber={candidate.student_number}
                        studentAlias={candidate.alias}
                        studentParty={candidate.party}
                        studentPosition={candidate.position}
                        studentDescription={candidate.description}

                        showSelect={false}
                        showView={false}
                    />
                ))}
            </div>
        </div>

    </div>
  );
}
