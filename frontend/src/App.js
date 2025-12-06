import React, { useEffect, useState } from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import LoginPage from './pages/LoginPage/LoginPage';
import Placeholder from './pages/Placeholder/Placeholder';
import LandingPage from './pages/LandingPage/LandingPage';
import VoterDashboard from './pages/VoterDashboard/VoterDashboard';
import VotingPage from './pages/VotingPage/VotingPage';
import CandidateDashboard from './pages/CandidateDashboard/CandidateDashboard';
import ManageProfile from './pages/CandidateDashboard/ManageProfile/ManageProfile';
import VoteReceipt from './pages/VotingPage/VoteReceipt/VoteReceipt';
import ViewCandidate from './pages/VotingPage/ViewCandidate/ViewCandidate';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import ManageCandidates from './pages/AdminDashboard/ManageCandidates/ManageCandidates';
import PreviousResults from './pages/AdminDashboard/ViewPreviousResults/PreviousResults';
import AuditorDashboard from './pages/AuditorDashboard/AuditorDashboard';
import RequireAuth from './components/RequireAuth';

function App() {
  // const [message, setMessage] = useState('');

  // useEffect(() => {
  //   axios.get('http://127.0.0.1:8000/api/hello/')
  //     .then(response => setMessage(response.data.message))
  //     .catch(error => console.error(error));
  // }, []);  

  return(
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* VOTER Routes */}
        <Route element={<RequireAuth allowedRoles={['Voter']} />}>
          <Route path="/voter-dashboard" element={<VoterDashboard />} />
          <Route path="/voting-page" element={<VotingPage />} />
          <Route path="/vote-receipt-page" element={<VoteReceipt />} />
          <Route path="/view-candidate/:id" element={<ViewCandidate />} />
        </Route>

        {/* CANDIDATE Routes */}
        <Route element={<RequireAuth allowedRoles={['Candidate']} />}>
          <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
          <Route path="/manage-profile-page" element={<ManageProfile />} />
        </Route>

        {/* ADMIN Routes */}
        <Route element={<RequireAuth allowedRoles={['Admin']} />}>
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/manage-candidates" element={<ManageCandidates />} />
          <Route path="/view-previous-results" element={<PreviousResults />} />
        </Route>

        {/* AUDITOR Routes */}
        <Route element={<RequireAuth allowedRoles={['Auditor']} />}>
          <Route path="/auditor-dashboard" element={<AuditorDashboard />} />
        </Route>

        {/* Catch all for 404 */}
        <Route path="*" element={<Placeholder />} />  

      </Routes>
    </Router>
  );
}

export default App;

