import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const ManageEventPage = () => {
    const { id } = useParams();
    const { token } = useAuth(); 
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');


    const [formData, setFormData] = useState({});
    const [newOrganizerUtorid, setNewOrganizerUtorid] = useState('');
    const [pointsAmount, setPointsAmount] = useState('');


    const fetchEvent = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/events/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvent(res.data);
            setFormData({
                name: res.data.name,
                description: res.data.description,
                location: res.data.location,
                startTime: res.data.startTime.slice(0, 16), 
                endTime: res.data.endTime.slice(0, 16),
                capacity: res.data.capacity,
                points: res.data.pointsRemain + res.data.pointsAwarded
            });
            setLoading(false);
        } catch (err) {
            setError("Failed to load event. You may not have permission.");
            setLoading(false);
        }
    }, [id, token]);

    useEffect(() => {
        fetchEvent();
    }, [fetchEvent]);


    const handleUpdate = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        try {
            const payload = {
                ...formData,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString(),
                capacity: parseInt(formData.capacity),
            };
            
            await axios.patch(`${API_BASE_URL}/events/${id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccess("Event updated successfully!");
            fetchEvent();
        } catch (err) {
            setError(err.response?.data?.error || "Update failed");
        }
    };

    const addOrganizer = async () => {
        try {
            await axios.post(`${API_BASE_URL}/events/${id}/organizers`, 
                { utorid: newOrganizerUtorid },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewOrganizerUtorid('');
            fetchEvent();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to add organizer");
        }
    };

    const removeOrganizer = async (userId) => {
        if (!window.confirm("Remove this organizer?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/events/${id}/organizers/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchEvent();
        } catch (err) {
            alert("Failed to remove organizer");
        }
    };

    const removeGuest = async (userId) => {
        if (!window.confirm("Remove this guest?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/events/${id}/guests/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchEvent();
        } catch (err) {
            alert("Failed to remove guest");
        }
    };

    const awardPoints = async (targetUtorid = null) => {
        const amount = parseInt(pointsAmount);
        if (!amount || amount <= 0) return alert("Enter a valid amount");
        
        const confirmMsg = targetUtorid 
            ? `Award ${amount} points to ${targetUtorid}?` 
            : `Award ${amount} points to ALL ${event.guests.length} guests? (Total: ${amount * event.guests.length})`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const payload = {
                type: 'event',
                amount: amount,
                remark: `Reward for attending ${event.name}`
            };
            if (targetUtorid) payload.utorid = targetUtorid;

            await axios.post(`${API_BASE_URL}/events/${id}/transactions`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            alert("Points awarded!");
            setPointsAmount('');
            fetchEvent();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to award points");
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!event) return <div>Event not found</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
            <button onClick={() => navigate('/events')} style={{ marginBottom: '20px' }}>← Back to Events</button>
            
            <h1>Manage Event: {event.name}</h1>
            
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
            {success && <div style={{ color: 'green', marginBottom: '10px' }}>{success}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                {/* --- LEFT COLUMN: EDIT DETAILS --- */}
                <div>
                    <h3>Edit Details</h3>
                    <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Name" />
                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Description" rows="3" />
                        <input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Location" />
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label>Start</label>
                                <input type="datetime-local" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} style={{ width: '100%' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>End</label>
                                <input type="datetime-local" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} style={{ width: '100%' }} />
                            </div>
                        </div>

                        <input type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} placeholder="Capacity" />
                        
                        <button type="submit" style={{ backgroundColor: '#007bff', color: 'white', padding: '10px', border: 'none' }}>Save Changes</button>
                    </form>

                    {/* --- ORGANIZERS SECTION --- */}
                    <h3 style={{ marginTop: '30px' }}>Organizers</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {event.organizers?.map(org => (
                            <li key={org.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #eee' }}>
                                <span>{org.name} <small>@{org.utorid}</small></span>
                                <button onClick={() => removeOrganizer(org.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                            </li>
                        ))}
                    </ul>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <input 
                            placeholder="Add Organizer UTORid" 
                            value={newOrganizerUtorid} 
                            onChange={(e) => setNewOrganizerUtorid(e.target.value)} 
                        />
                        <button onClick={addOrganizer}>Add</button>
                    </div>
                </div>

                {/* --- RIGHT COLUMN: GUESTS & POINTS --- */}
                <div>
                    <h3>Guest Management</h3>
                    <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h4>Award Points</h4>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>Points Remaining in Budget: <strong>{event.pointsRemain}</strong></p>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <input 
                                type="number" 
                                placeholder="Amount" 
                                value={pointsAmount}
                                onChange={(e) => setPointsAmount(e.target.value)}
                                style={{ width: '100px' }}
                            />
                            <button onClick={() => awardPoints(null)} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 10px' }}>
                                Award All Guests
                            </button>
                        </div>
                    </div>

                    <h4>Guest List ({event.guests?.length || 0})</h4>
                    <ul style={{ listStyle: 'none', padding: 0, maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee' }}>
                        {event.guests?.map(guest => (
                            <li key={guest.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                                <div>
                                    <strong>{guest.name}</strong> <br/>
                                    <small>@{guest.utorid}</small>
                                </div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button onClick={() => awardPoints(guest.utorid)} style={{ fontSize: '0.8rem', backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '3px' }}>
                                        Reward
                                    </button>
                                    <button onClick={() => removeGuest(guest.id)} style={{ fontSize: '0.8rem', backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '3px' }}>
                                        Remove
                                    </button>
                                </div>
                            </li>
                        ))}
                        {event.guests?.length === 0 && <li style={{ padding: '10px' }}>No guests yet.</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ManageEventPage;