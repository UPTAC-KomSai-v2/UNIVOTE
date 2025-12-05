import React, { useState, useEffect} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CandidateCard from "../../../components/CandidateCard/CandidateCard";
import "./ManageCandidates.css";
import backArrow from '../../../assets/back-button-white.png'

export default function ManageCandidates() {
  const navigate = useNavigate();
  const location = useLocation();

  const [chairpersons, setChairpersons] = useState([]);
  const [viceChairpersons, setViceChairpersons] = useState([]);
  const [councilors, setCouncilors] = useState([]);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [position, setPosition] = useState('');
  const [candidateName, setCandidateName] = useState('');
  

  const positions = [
    'Chairperson',
    'Vice Chairpaerson',
    'Councilor',
  ];
  
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

  const handleRemove = (candidateID) => {
    // Logic to remove candidate
    setIsSubmitted(false); //PLACEHOLDER
    return null;
  }

  
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
            <button onClick={() => {navigate('/admin-dashboard/')}}>
              2025 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results/?year=2024', { state: {from: "admin"}})}}>
              2024 SC ELECTIONS
            </button>
            <button onClick={() => {navigate('/view-previous-results/?year=2023', { state: {from: "admin"}})}}>
              2023 SC ELECTIONS
            </button>
            {/* <button className="submit-button" onClick={() => setIsSubmitted(true)}>
              SUBMIT
            </button> */}

          </div>

        </Card>

        {
          isSubmitted && (
            <>
              <div className="overlay" onClick={() => setIsSubmitted(false)}></div>
              <div className="submission-message">
                <p>  
                  Remove {candidateName} from the list of candidates?
                </p>
                
                <div>
                  <button onClick={() => handleRemove()}>YES</button>
                  <button onClick={() => setIsSubmitted(false)}>NO</button>
                </div>
              </div>
            </>
          )
        }
        {
          submissionConfirmed && (
            <>
              <div className="overlay" onClick={() => setIsSubmitted(false)}></div>
              <div className="submission-message">
                <p>  
                  Your ballot has been submitted successfully!
                </p>
                <p>
                  Thank you for voting.
                </p>
                <div>
                  <button onClick={() => navigate('/vote-receipt-page')}>View Voting Receipt</button>
                  <button onClick={() => navigate('/')}>Logout</button>
                </div>
              </div>
            </>
          )
        }

        <div className="candidate-list-container">
            <div className="candidate-list-card-content">
                <h1 className="candidate-list-card-title">2025 Student Council Elections</h1>

                <div className="add-candidate-content">
                    <div className="top-row">
                        <input 
                            type="text" 
                            placeholder="First Name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                        <input 
                            type="text" 
                            placeholder="Last Name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                    </div>

                    <div className="bottom-row">
                        <input 
                            type="text" 
                            placeholder="Student Number"
                            value={studentNumber}
                            onChange={(e) => setStudentNumber(e.target.value)}
                        />
                        <select
                            className="choose-position"
                            value={position} 
                            onChange={(e) => 
                            setPosition(e.target.value)}
                        >
                            <option value="" disabled>Position</option>
                            {positions.map((pos) => (
                                <option key={pos} value={pos}>
                                    {pos}
                                </option>
                            ))}
                        </select>
                        
                    </div>
                </div>
            </div>
            
            <div className="manage-candidates-buttons">
                <button className="add-candidate-button">Add Candidate</button>
                <button className="done-manage-button" onClick={() => navigate('/admin-dashboard')}>Done</button>
            </div>

            
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
                        showRemove={true}
                        onRemove={() => {
                            setIsSubmitted(true);
                            setCandidateName(candidate.name);
                        }}
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
                        showRemove={true}


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
                        showRemove={true}
                    />
                ))}
            </div>
        </div>

    </div>
  );
}
