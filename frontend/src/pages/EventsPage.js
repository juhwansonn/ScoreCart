// frontend/src/pages/EventsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const EventsPage = () => {
    const [events, setEvents] = useState([]);
    const [error, setError] = useState('');
    const { user, token } = useAuth();
    const navigate = useNavigate();

    // Check if user is Manager or Superuser to show "Create" button
    const canCreate = user && (user.role === 'manager' || user.role === 'superuser');

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Fetch events (Backend handles filtering published vs all based on role)
                const response = await axios.get(`${API_BASE_URL}/events`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEvents(response.data.results);
            } catch (err) {
                setError('Failed to fetch events.');
                console.error(err);
            }
        };
        fetchEvents();
    }, [token]);

    return (
        <div style={{ padding: '20px' }}>
            <h2>Upcoming Events</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            {/* Create Button (Managers Only) */}
            {canCreate && (
                <button onClick={() => navigate('/events/new')} style={{ marginBottom: '20px', padding: '10px' }}>
                    + Create New Event
                </button>
            )}

            <div style={{ display: 'grid', gap: '20px' }}>
                {events.map((event) => (
                    <div key={event.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
                        <h3>{event.name}</h3>
                        <p><strong>Location:</strong> {event.location}</p>
                        <p><strong>Time:</strong> {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}</p>
                        <p>{event.description}</p>
                        <p><strong>Capacity:</strong> {event.numGuests} / {event.capacity}</p>
                    </div>
                ))}
                {events.length === 0 && <p>No events found.</p>}
            </div>
        </div>
    );
};

export default EventsPage;