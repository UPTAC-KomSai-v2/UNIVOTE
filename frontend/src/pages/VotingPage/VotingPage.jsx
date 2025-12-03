import React, { useState, useEffect} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Card from "../../components/Card/Card";
import CandidateCard from "../../components/CandidateCard/CandidateCard";
import "./VotingPage.css";
import backArrow from '../../assets/back-button-white.png'

export default function VotingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const position = params.get('position') || 'Chairperson';

  const candidateChoices = {
    'Chairperson': 1,
    'Vice Chairperson': 1,
    'Councilors': 7
  };

  const [voterID, setVoterID] = useState('');
  const [candidateNumChoice, setCandidateNumChoice] = useState(candidateChoices[position]);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]); //THIS IS WHERE SELECTED CANDIDATES ARE STORED
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [candidateType, setCandidateType] = useState(position);
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);
  
  const multiple = candidateNumChoice > 1;


  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
  // GET voter data
    fetch(`http://localhost:8000/api/voting-page/?position=${candidateType}`)
      .then(res => res.json())
      .then(data => {
        setVoterID(data.voter_id);
        setCandidates(data.candidates);

      });
  }, [candidateType]);

  const handleSelect = (candidateID) => {
    if (multiple) {
      if (selectedCandidates.includes(candidateID)) {
        setSelectedCandidates(selectedCandidates.filter(id => id !== candidateID));
      } else {
        if (selectedCandidates.length < candidateNumChoice) {
          setSelectedCandidates([...selectedCandidates, candidateID]);
        } else {
          alert(`You can only select up to ${candidateNumChoice} candidates.`);
        }
      }
    } else {
      setSelectedCandidates([candidateID]);
    }
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

          Voter ID: {voterID}

          <div className="candidateButtons">
            <button onClick={() => {
              setCandidateType('Chairperson')
              setCandidateNumChoice(candidateChoices['Chairperson'])
            }} disabled={candidateType === 'Chairperson'}>
              Chairperson
            </button>
            <button onClick={() => {
              setCandidateType('Vice Chairperson')
              setCandidateNumChoice(candidateChoices['Vice Chairperson'])
            }} disabled={candidateType === 'Vice Chairperson'}>
              Vice Chairperson
            </button>
            <button onClick={() => {
                setCandidateType('Councilors')
                setCandidateNumChoice(candidateChoices['Councilors'])}
              } 
              disabled={candidateType === 'Councilors'}>
              Councilors
            </button>
            <button className="submit-button" onClick={() => setIsSubmitted(true)}>
              SUBMIT
            </button>

          </div>

        </Card>

        {
          isSubmitted && (
            <>
              <div className="overlay" onClick={() => setIsSubmitted(false)}></div>
              <div className="submission-message">
                <p>  
                  Have you finished voting?
                </p>
                <p>
                  Tap Yes to submit.
                </p>
                <div>
                  <button onClick={() => setSubmissionConfirmed(true)}>YES</button>
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
              <div className="candidate-list-card-title">2025 Student Council Elections</div>
              <div className="candidate-list-card-type">{candidateType}</div>
              <div className="candidate-list-card-number">(Choose only {candidateNumChoice})</div>
          </div>
        <strong>
          List of Candidates
        </strong>
          <div className="candidate-list">
              {candidates.map((candidate) => (
                  <CandidateCard
                      key={candidate.id}
                      image={candidate.image}
                      studentName={candidate.name}
                      studentNumber={candidate.student_number}
                      studentAlias={candidate.alias}
                      studentParty={candidate.party}
                      studentPosition={candidate.position}
                      studentDescription={candidate.description}

                      onView={() => navigate(`/view-candidate/${candidate.id}`)}
                      multiple={multiple}
                      isSelected={selectedCandidates.includes(candidate.id)}
                      onSelect={() => handleSelect(candidate.id)}
                  />
              ))}
          </div>
        </div>

    </div>
  );
}
