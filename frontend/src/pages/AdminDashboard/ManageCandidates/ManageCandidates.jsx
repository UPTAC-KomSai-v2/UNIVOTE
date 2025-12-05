import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CandidateCard from "../../../components/CandidateCard/CandidateCard";
import "./ManageCandidates.css";
import backArrow from '../../../assets/back-button-white.png'

export default function ManageCandidates() {
  const navigate = useNavigate();

  const [chairpersons, setChairpersons] = useState([]);
  const [viceChairpersons, setViceChairpersons] = useState([]);
  const [councilors, setCouncilors] = useState([]);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);
  const [candidateName, setCandidateName] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [position, setPosition] = useState('');

  const positions = [
    'Chairperson',
    'Vice Chairperson',
    'Councilor',
  ];

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  // Fetch candidates from backend
  const fetchCandidates = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/manage-candidates/");
      const data = await res.json();
      setChairpersons(data.chairpersons || []);
      setViceChairpersons(data.vice_chairpersons || []);
      setCouncilors(data.councilors || []);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Add candidate handler
  const handleAddCandidate = async () => {
    if (!firstName || !lastName || !position) {
      alert("Please fill in First Name, Last Name, and Position.");
      return;
    }

    const fullName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@up.edu.ph`;

    try {
      const response = await fetch("http://localhost:8000/api/manage-candidates/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          name: fullName,
          position: position,
          student_number: studentNumber
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert("Candidate added successfully!");
        setFirstName("");
        setLastName("");
        setStudentNumber("");
        setPosition("");
        fetchCandidates(); // Refresh list
      } else {
        alert(data.error || "Failed to add candidate.");
      }

    } catch (error) {
      console.error("Add candidate error:", error);
      alert("An error occurred while adding candidate.");
    }
  };

  const handleRemove = (candidateID) => {
    // TODO: Implement backend delete
    setIsSubmitted(false);
    alert(`Remove candidate ${candidateID} functionality not yet implemented.`);
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

      {isSubmitted && (
        <>
          <div className="overlay" onClick={() => setIsSubmitted(false)}></div>
          <div className="submission-message">
            <p>Remove {candidateName} from the list of candidates?</p>
            <div>
              <button onClick={() => handleRemove(candidateName)}>YES</button>
              <button onClick={() => setIsSubmitted(false)}>NO</button>
            </div>
          </div>
        </>
      )}

      {submissionConfirmed && (
        <>
          <div className="overlay" onClick={() => setSubmissionConfirmed(false)}></div>
          <div className="submission-message">
            <p>Your ballot has been submitted successfully!</p>
            <p>Thank you for voting.</p>
            <div>
              <button onClick={() => navigate('/vote-receipt-page')}>View Voting Receipt</button>
              <button onClick={() => navigate('/')}>Logout</button>
            </div>
          </div>
        </>
      )}

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
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="" disabled>Position</option>
                {positions.map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="manage-candidates-buttons">
            <button className="add-candidate-button" onClick={handleAddCandidate}>Add Candidate</button>
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
                onRemove={() => {
                  setIsSubmitted(true);
                  setCandidateName(candidate.name);
                }}
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
                onRemove={() => {
                  setIsSubmitted(true);
                  setCandidateName(candidate.name);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
