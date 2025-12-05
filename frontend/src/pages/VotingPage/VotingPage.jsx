import React, { useState, useEffect} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Card from "../../components/Card/Card";
import CandidateCard from "../../components/CandidateCard/CandidateCard";
import "./VotingPage.css";
import backArrow from '../../assets/back-button-white.png'
import logout from '../../assets/logout.png'

export default function VotingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const position = params.get('position') || 'Chairperson';

  const candidateChoices = {
    'Chairperson': 1,
    'Vice Chairperson': 1,
    'Councilor': 7
  };

  const [voterID, setVoterID] = useState('');
  const [candidateNumChoice, setCandidateNumChoice] = useState(candidateChoices[position]);
  const [candidates, setCandidates] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [candidateType, setCandidateType] = useState(position);
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);
  const [votingComplete, setVotingComplete] = useState(false);
  const [abstainedPositions, setAbstainedPositions] = useState([]);

  const [selectedCandidates, setSelectedCandidates] = useState(() => {
    const saved = sessionStorage.getItem("currentVotes");
    return saved ? JSON.parse(saved) : [];
  });
  
  const multiple = candidateNumChoice > 1;

  useEffect(() => {
    sessionStorage.setItem("currentVotes", JSON.stringify(selectedCandidates));
  }, [selectedCandidates]);

  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    document.body.classList.remove("login-bg"); // optional
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  useEffect(() => {
    fetch(`http://localhost:8000/api/voting-page/?position=${candidateType}`)
      .then(res => res.json())
      .then(data => {
        setVoterID(data.voter_id);
        setCandidates(data.candidates);
        
        if (data.max_votes) {
            setCandidateNumChoice(data.max_votes);
        }
      });
  }, [candidateType]);

  const handleSelect = (candidateID) => {
    if (abstainedPositions.includes(candidateType)) {
      alert(`You have abstained from voting for ${candidateType}. Remove abstention to vote.`);
      return;
    }
    
    // 1. If it's a multiple choice position (Councilors)
    if (multiple) {
      if (selectedCandidates.includes(candidateID)) {
        setSelectedCandidates(selectedCandidates.filter(id => id !== candidateID));
      } else {
        if (selectedCandidates.length < candidateNumChoice) { // Note: This check logic needs to count only current position candidates
            // Ideally, you filter selectedCandidates to count only those in the current list
            const currentPositionCount = selectedCandidates.filter(id => candidates.some(c => c.id === id)).length;
            
            if (currentPositionCount < candidateNumChoice) {
                setSelectedCandidates([...selectedCandidates, candidateID]);
            } else {
                alert(`You can only select up to ${candidateNumChoice} candidates.`);
            }
        }
      }
    } 
    else {
      const currentPageCandidateIDs = candidates.map(c => c.id);
      
      const otherVotes = selectedCandidates.filter(id => !currentPageCandidateIDs.includes(id));
      
      setSelectedCandidates([...otherVotes, candidateID]);
    }
  }

  const handleAbstain = () => {
    if (!abstainedPositions.includes(candidateType)) {
      setAbstainedPositions([...abstainedPositions, candidateType]);
      setSelectedCandidates(selectedCandidates.filter(id => {
        const candidate = candidates.find(c => c.id === id);
        return candidate && candidate.position !== candidateType;
      }));
      alert(`You have chosen to abstain from voting for ${candidateType}.`);
    }
  }

  const handleRemoveAbstain = () => {
    setAbstainedPositions(abstainedPositions.filter(pos => pos !== candidateType));
    alert(`Abstention removed for ${candidateType}. You can now vote.`);
  }

  const handleLogoutClick = () => {
    if (!votingComplete) {
      alert("Please complete your voting before logging out. Click SUBMIT to finish voting.");
    } else {
      setLogoutConfirmed(true);
    }
  }

  const getCookie = (name) => {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  };

  const submitBallot = async () => {
    // Check if user has made any choices (voted or abstained)
    const hasVoted = selectedCandidates.length > 0;
    const hasAbstained = abstainedPositions.length > 0;
    
    if (!hasVoted && !hasAbstained) {
        alert("Please vote for at least one position or choose to abstain.");
        setIsSubmitted(false);
        return;
    }

    try {
        const response = await fetch("http://localhost:8000/api/voting-page/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              candidates: selectedCandidates.length > 0 ? selectedCandidates : [],
              abstained_positions: abstainedPositions
            }) 
        });

        // Check for success
        if (response.ok) {
            setIsSubmitted(false); 
            setVotingComplete(true);
            setSubmissionConfirmed(true); 
            sessionStorage.removeItem("currentVotes");
        } else {
            const errorData = await response.json();
            
            // Check if error is "already voted"
            if (errorData.error && errorData.error.includes('You have already cast your votes!')) {
                alert(errorData.error + "\n\nYou can now logout.");
                setVotingComplete(true); // Allow logout
            } else {
                alert(errorData.error || "Error submitting votes.");
            }
            setIsSubmitted(false);
        }
    } catch (error) {
        console.error("Network error:", error);
        alert("Network error. Please try again.");
        setIsSubmitted(false);
    }
  };
  
  return (
    <div className="voting-page">
      
        <img 
          src={logout} 
          alt="Logout" 
          className="logout-button" 
          onClick={handleLogoutClick} 
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
                  <button onClick={() => {
                      sessionStorage.removeItem("currentVotes"); // Clear votes on logout
                      navigate('/');
                  }}>YES</button>
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
                setCandidateType('Councilor')
                setCandidateNumChoice(candidateChoices['Councilor'])}
              } 
              disabled={candidateType === 'Councilor'}>
              Councilors
            </button>
            
            {!abstainedPositions.includes(candidateType) ? (
              <button className="abstain-button" onClick={handleAbstain}>
                ABSTAIN FROM {candidateType.toUpperCase()}
              </button>
            ) : (
              <button className="remove-abstain-button" onClick={handleRemoveAbstain}>
                REMOVE ABSTENTION
              </button>
            )}
            
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
                <p>Have you finished voting?</p>
                <p>Tap Yes to submit.</p>
                <div>
                  {/* CHANGE THIS LINE: Call the function instead of just setting state */}
                  <button onClick={submitBallot}>YES</button> 
                  
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
              {abstainedPositions.includes(candidateType) ? (
                <div className="candidate-list-card-number" style={{color: '#ff6b6b'}}>
                  (ABSTAINED - Not voting for this position)
                </div>
              ) : (
                <div className="candidate-list-card-number">(Choose only {candidateNumChoice})</div>
              )}
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