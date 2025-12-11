import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const ProcessRedemptionPage = () => {
    const { token } = useAuth();
    const [txId, setTxId] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('');
        setError('');
        
        try {
            // Send request to mark as processed
            const response = await axios.patch(
                `${API_BASE_URL}/transactions/${txId}/processed`, 
                { processed: true }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setStatus(`✅ Success! Redeemed ${response.data.amount} points for user ${response.data.utorid}.`);
            setTxId('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to process. Check ID.');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '400px' }}>
            <h2>Process Redemption (Cashier)</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {status && <p style={{ color: 'green', fontWeight: 'bold' }}>{status}</p>}
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                    type="number" 
                    placeholder="Transaction ID (from User)" 
                    required 
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)} 
                />
                <button type="submit" style={{ padding: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}>
                    Confirm Redemption
                </button>
            </form>
        </div>
    );
};

export default ProcessRedemptionPage;