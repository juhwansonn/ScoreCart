import React, { useState, useEffect } from 'react';

import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/config';

const LoginPage = () => {
  const [utorid, setUtorid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { login, token } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate('/profile');
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/tokens`, {
        utorid,
        password,
      });

      const { token } = response.data;
      
      // Fetch the role immediately after successful login
      const userResponse = await axios.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      const userRole = userResponse.data.role; // Get the user's role

      // 1. Call the login function from AuthContext to save token
      login(token, userRole); 

      // 2. Redirect to a home page or profile page
      navigate('/profile'); 

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Login failed. Check UTORid and password.');
    }
  };

  return (
    <div className="login-container">
      <h2>Loyalty Program Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="UTORid"
          value={utorid}
          onChange={(e) => setUtorid(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Log In</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>
        <button onClick={() => navigate('/reset-password')}>
            Forgot Password?
        </button>
      </p>
    </div>
  );
};

export default LoginPage;