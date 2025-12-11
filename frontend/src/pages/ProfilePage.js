import React, { useEffect, useState } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/config';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // We need to fetch 'me' again to ensure we have the latest points/promotions
        // The token is automatically handled if you set it in axios defaults, 
        // otherwise we grab it from localStorage or context.
        const token = localStorage.getItem('jwt_token');
        const response = await axios.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfileData(response.data);
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) return <div>Loading profile...</div>;
  if (!profileData) return <div>Error loading user data.</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome, {profileData.name}</h1>
      
      <div className="user-info card">
        <h3>My Stats</h3>
        <p><strong>UTORid:</strong> {profileData.utorid}</p>
        <p><strong>Role:</strong> {profileData.role}</p>
        <p><strong>Points Balance:</strong> {profileData.points}</p>
        <p><strong>Status:</strong> {profileData.verified ? "Verified ✅" : "Unverified ❌"}</p>
      </div>

      <div className="promotions-section">
        <h3>🎉 Available Promotions</h3>
        {profileData.promotions && profileData.promotions.length > 0 ? (
          <ul>
            {profileData.promotions.map(promo => (
              <li key={promo.id} style={{ border: '1px solid #ccc', margin: '10px 0', padding: '10px' }}>
                <strong>{promo.name}</strong>
                <p>{promo.description}</p>
                <small>Earn {promo.points ? `${promo.points} pts` : `${promo.rate * 100}% bonus`}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>No active promotions available right now.</p>
        )}
      </div>

      <button onClick={logout} style={{ marginTop: '20px', background: 'red', color: 'white' }}>
        Logout
      </button>
      <div style={{ textAlign: 'center', margin: '30px 0' }}>
        <h3>My Member QR Code</h3>
        <div style={{ background: 'white', padding: '16px', display: 'inline-block', border: '1px solid #ccc' }}>
            {/* The QR code contains the UtorID */}
            <QRCode value={user.utorid} size={150} />
        </div>
        <p style={{ fontSize: '0.9em', color: '#666' }}>Show this to a cashier to earn points</p>
      </div>
    </div>

    
  );
};

export default ProfilePage;