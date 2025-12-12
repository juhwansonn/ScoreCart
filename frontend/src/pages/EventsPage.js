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

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const LIMIT = 5;

    // Check if user is Manager or Superuser to show "Create" button
    const canCreate = user && (user.role === 'manager' || user.role === 'superuser');

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Fetch events (Backend handles filtering published vs all based on role)
                const response = await axios.get(`${API_BASE_URL}/events`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { 
                        page: page,
                        limit: LIMIT   
                    }
                });
                setEvents(response.data.results);

                // Calculate total pages based on total count from backend
                const totalCount = response.data.count;
                setTotalPages(Math.ceil(totalCount / LIMIT));

            } catch (err) {
                setError('Failed to fetch events.');
                console.error(err);
            }
        };
        fetchEvents();
    }, [token, page]);

    const handleRSVP = async (eventId) => {
        try {
            await axios.post(`${API_BASE_URL}/events/${eventId}/guests/me`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Success! You are on the guest list.");
            // Reload page to update numbers
            window.location.reload();
        } catch (err) {
            alert(err.response?.data?.error || "RSVP Failed");
        }
    };

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
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <h3>{event.name}</h3>
                            <button 
                                onClick={() => handleRSVP(event.id)}
                                style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                            >
                                RSVP / Join
                            </button>
                        </div>
                        <p><strong>Location:</strong> {event.location}</p>
                        <p><strong>Time:</strong> {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}</p>
                        <p>{event.description}</p>
                        <p><strong>Capacity:</strong> {event.numGuests} / {event.capacity}</p>
                    </div>
                ))}
                {events.length === 0 && <p>No events found.</p>}
            </div>

            {/* --- Pagination Controls --- */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                <button 
                    disabled={page <= 1} 
                    onClick={() => setPage(p => p - 1)}
                    style={{ padding: '8px 16px', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
                >
                    Previous
                </button>
                
                <span style={{ fontWeight: 'bold' }}>
                    Page {page} of {totalPages || 1}
                </span>
                
                <button 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => p + 1)}
                    style={{ padding: '8px 16px', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default EventsPage;