// frontend/src/pages/CreateEventPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const CreateEventPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        name: '', description: '', location: '',
        startTime: '', endTime: '', capacity: 0, points: 0
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Backend expects numbers for capacity and points
            const payload = {
                ...formData,
                capacity: parseInt(formData.capacity),
                points: parseInt(formData.points), 
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString()
            };

            await axios.post(`${API_BASE_URL}/events`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Redirect back to the events list
            navigate('/events');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create event');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '500px' }}>
            <h2>Create New Event</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input name="name" placeholder="Event Name" required onChange={handleChange} />
                <textarea name="description" placeholder="Description" required onChange={handleChange} />
                <input name="location" placeholder="Location" required onChange={handleChange} />
                
                <label>Start Time:</label>
                <input name="startTime" type="datetime-local" required onChange={handleChange} />
                
                <label>End Time:</label>
                <input name="endTime" type="datetime-local" required onChange={handleChange} />
                
                <input name="capacity" type="number" placeholder="Capacity" required onChange={handleChange} />
                <input name="points" type="number" placeholder="Points Cost" required onChange={handleChange} />
                
                <button type="submit" style={{ marginTop: '10px', padding: '10px' }}>Create Event</button>
            </form>
        </div>
    );
};

export default CreateEventPage;