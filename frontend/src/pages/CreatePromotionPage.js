// frontend/src/pages/CreatePromotionPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const CreatePromotionPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        name: '', 
        description: '', 
        type: 'automatic', // Default to automatic
        startTime: '', 
        endTime: '', 
        minSpending: '',
        rate: '',
        points: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Prepare the payload
            const payload = {
                name: formData.name,
                description: formData.description,
                type: formData.type,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString(),
                // Convert to number only if user typed something, otherwise null
                minSpending: formData.minSpending ? parseFloat(formData.minSpending) : null,
                rate: formData.rate ? parseFloat(formData.rate) : null,
                points: formData.points ? parseInt(formData.points) : null,
            };

            await axios.post(`${API_BASE_URL}/promotions`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            navigate('/promotions');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create promotion');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '500px' }}>
            <h2>Create New Promotion</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input name="name" placeholder="Promotion Name" required onChange={handleChange} />
                <textarea name="description" placeholder="Description" required onChange={handleChange} />
                
                <label>Type:</label>
                <select name="type" value={formData.type} onChange={handleChange}>
                    <option value="automatic">Automatic</option>
                    <option value="one-time">One-Time Code</option>
                </select>

                <label>Start Time:</label>
                <input name="startTime" type="datetime-local" required onChange={handleChange} />
                
                <label>End Time:</label>
                <input name="endTime" type="datetime-local" required onChange={handleChange} />
                
                <h3>Rewards (Optional)</h3>
                <input name="minSpending" type="number" step="0.01" placeholder="Min Spending ($)" onChange={handleChange} />
                <input name="rate" type="number" step="0.1" placeholder="Multiplier Rate (e.g. 1.5)" onChange={handleChange} />
                <input name="points" type="number" placeholder="Flat Bonus Points" onChange={handleChange} />
                
                <button type="submit" style={{ marginTop: '10px', padding: '10px' }}>Create Promotion</button>
            </form>
        </div>
    );
};

export default CreatePromotionPage;