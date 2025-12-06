import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/Card/Card";
import CandidateCard from "../../../components/CandidateCard/CandidateCard";
import "./ManageCandidates.css";
import backArrow from '../../../assets/back-button-white.png';
import api from "../../../api";

export default function ManageCandidates() {
  const navigate = useNavigate();

  const [chairpersons, setChairpersons] = useState([]);
  const [viceChairpersons, setViceChairpersons] = useState([]);
  const [councilors, setCouncilors] = useState([]);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [position, setPosition] = useState('');
  const [alias, setAlias] = useState('');
  const [party, setParty] = useState('');
  const [description, setDescription] = useState('');

  const positions = ['Chairperson', 'Vice Chairperson', 'Councilor'];

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  // Fetch candidates from backend
  const fetchCandidates = async () => {
    try {
      const { data } = await api.get("/api/manage-candidates/");
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
      const { data } = await api.post("/api/manage-candidates/", {
        email: email,
        name: fullName,
        position: position,
        student_number: studentNumber,
        alias: alias,
        party: party,
        description: description
      });

      alert("Candidate added successfully!");
      setFirstName("");
      setLastName("");
      setStudentNumber("");
      setPosition("");
      setAlias("");
      setParty("");
      setDescription("");
      fetchCandidates(); // Refresh list
    } catch (error) {
      console.error("Add candidate error:", error);
      alert(error.response?.data?.error || "An error occurred while adding candidate.");
    }
  };

  // Remove candidate handler
  const handleRemove = async () => {
    if (!candidateToRemove) return;

    try {
      await api.delete(`/api/manage-candidates/${candidateToRemove.id}/`);
      alert(`Candidate ${candidateToRemove.name} removed successfully!`);

      const { id, position } = candidateToRemove;
      if (position === "Chairperson") {
        setChairpersons(chairpersons.filter(c => c.id !== id));
      } else if (position === "Vice Chairperson") {
        setViceChairpersons(viceChairpersons.filter(c => c.id !== id));
      } else if (position === "Councilor") {
        setCouncilors(councilors.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error("Remove candidate error:", error);
      alert(error.response?.data?.error || "An error occurred while removing the candidate.");
    } finally {
      setIsSubmitted(false);
      setCandidateToRemove(null);
    }
  };

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
        </div>

      </Card>

      {isSubmitted && candidateToRemove && (
        <>
          <div className="overlay" onClick={() => setIsSubmitted(false)}></div>
          <div className="submission-message">
            <p>Remove {candidateToRemove.name} from the list of candidates?</p>
            <div>
              <button onClick={handleRemove}>YES</button>
              <button onClick={() => setIsSubmitted(false)}>NO</button>
            </div>
          </div>
        </>
      )}

      <div className="admin-dashboard-candidate-list-container">

        <div className="-admin-dashboard-candidate-list-card-content">
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
              <input 
                type="text" 
                placeholder="Alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </div>

            <div className="bottom-row">
              <input 
                type="text" 
                placeholder="Student Number"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
              />
              <input 
                type="text" 
                placeholder="Party"
                value={party}
                onChange={(e) => setParty(e.target.value)}
              />
              <input 
                type="text" 
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="select-position">
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

          <div className="admin-dashboard-candidate-list">
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
                  setCandidateToRemove(candidate);
                  setIsSubmitted(true);
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
                  setCandidateToRemove(candidate);
                  setIsSubmitted(true);
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
                  setCandidateToRemove(candidate);
                  setIsSubmitted(true);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
