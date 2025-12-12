import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const CreateUserPage = () => {
    const [formData, setFormData] = useState({
        utorid: '',
        name: '',
        email: ''
    });
    const [successMsg, setSuccessMsg] = useState('');
    const [error, setError] = useState('');
    const { token } = useAuth();


    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        try {
            const response = await axios.post(
                `${API_BASE_URL}/users`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // The API returns a resetToken. In a real app, this is emailed.
            // For this project, we display it so you can copy it.
            setSuccessMsg(`User created! Copy this Token to set their password: ${response.data.resetToken}`);
            setFormData({ utorid: '', name: '', email: '' }); // Clear form
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to create user.');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '500px' }}>
            <h2>Create New User</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                    name="utorid"
                    placeholder="UTORid (e.g. user123)"
                    value={formData.utorid}
                    onChange={handleChange}
                    required
                />
                <input
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                />
                <input
                    name="email"
                    type="email"
                    placeholder="Email (@mail.utoronto.ca)"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
                <button type="submit" style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none' }}>
                    Create User
                </button>
            </form>

            {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            
            {/* IMPORTANT: Display the token so you can set the password later */}
            {successMsg && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb' }}>
                    <p style={{ wordBreak: 'break-all' }}><strong>{successMsg}</strong></p>
                </div>
            )}
        </div>
    );
};

export default CreateUserPage;