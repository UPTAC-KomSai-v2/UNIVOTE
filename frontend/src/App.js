import React, { useEffect, useState } from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import LoginPage from './pages/LoginPage/LoginPage';
import Placeholder from './pages/Placeholder/Placeholder';
import axios from 'axios';
import LandingPage from './pages/LandingPage/LandingPage';

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/hello/')
      .then(response => setMessage(response.data.message))
      .catch(error => console.error(error));
  }, []);  

  return(
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<Placeholder />} />
        
      </Routes>
    </Router>
  );
}

export default App;

