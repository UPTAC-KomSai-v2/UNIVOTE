import { useNavigate } from 'react-router-dom';
import Card from "../../components/Card/Card";

import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    navigate('/login', { state: { role: role } });
  };

  return (
    <div className="landing-page">
      <Card title="UniVote" description="University-wide Student Council Election Management System">
        <div className="buttons">
            {/* Pass the specific role string for each button */}
            <button onClick={() => handleRoleSelect('Admin')}>Admin</button>
            <button onClick={() => handleRoleSelect('Candidate')}>Candidate</button>
            <button onClick={() => handleRoleSelect('Voter')}>Voter</button>
            <button onClick={() => handleRoleSelect('Auditor')}>Auditor</button>
        </div>
      </Card>
    </div>   
  );
}
