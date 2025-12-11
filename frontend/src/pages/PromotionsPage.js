// frontend/src/pages/PromotionsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const PromotionsPage = () => {
    const [promotions, setPromotions] = useState([]);
    const [error, setError] = useState('');
    const { user, token } = useAuth();
    const navigate = useNavigate();

    const canCreate = user && (user.role === 'manager' || user.role === 'superuser');

    useEffect(() => {
        const fetchPromotions = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/promotions`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPromotions(response.data.results);
            } catch (err) {
                setError('Failed to fetch promotions.');
                console.error(err);
            }
        };
        fetchPromotions();
    }, [token]);

    return (
        <div style={{ padding: '20px' }}>
            <h2>Active Promotions</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            {canCreate && (
                <button onClick={() => navigate('/promotions/new')} style={{ marginBottom: '20px', padding: '10px' }}>
                    + Create New Promotion
                </button>
            )}

            <div style={{ display: 'grid', gap: '20px' }}>
                {promotions.map((promo) => (
                    <div key={promo.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', background: '#f9f9f9' }}>
                        <h3>{promo.name} <span style={{fontSize: '0.8em', color: '#666'}}>({promo.type})</span></h3>
                        <p>{promo.description}</p>
                        <p><strong>Valid until:</strong> {new Date(promo.endTime).toLocaleDateString()}</p>
                        
                        {/* Display optional fields if they exist */}
                        {promo.minSpending > 0 && <p>Min Spending: ${promo.minSpending}</p>}
                        {promo.rate > 0 && <p>Bonus Rate: {promo.rate}x</p>}
                        {promo.points > 0 && <p>Bonus Points: +{promo.points}</p>}
                    </div>
                ))}
                {promotions.length === 0 && <p>No active promotions found.</p>}
            </div>
        </div>
    );
};

export default PromotionsPage;