// frontend/src/pages/TransferPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const TransferPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    // Changed state name to be clear it's a string ID
    const [targetUtorid, setTargetUtorid] = useState(''); 
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                targetUtorid: targetUtorid, // Send the string ID
                amount: parseInt(amount),
                remark: remark
            };

            // Use the new endpoint
            await axios.post(`${API_BASE_URL}/transactions/transfer`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            navigate('/transactions');
        } catch (err) {
            setError(err.response?.data?.error || 'Transfer failed.');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '400px' }}>
            <h2>Transfer Points</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                    type="text" 
                    placeholder="Recipient UTORid (e.g. admin2)" 
                    required 
                    onChange={(e) => setTargetUtorid(e.target.value)} 
                />
                <input 
                    type="number" 
                    placeholder="Amount" 
                    required 
                    onChange={(e) => setAmount(e.target.value)} 
                />
                <input 
                    placeholder="Remark (Optional)" 
                    onChange={(e) => setRemark(e.target.value)} 
                />
                <button type="submit" style={{ padding: '10px' }}>Send Points</button>
            </form>
        </div>
    );
};

export default TransferPage;