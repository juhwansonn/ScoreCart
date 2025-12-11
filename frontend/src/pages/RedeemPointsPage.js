import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const RedeemPointsPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [error, setError] = useState('');
    const [successId, setSuccessId] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const payload = {
                type: 'redemption',
                amount: parseInt(amount),
                remark: remark
            };

            const response = await axios.post(`${API_BASE_URL}/users/me/transactions`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // On success, show the Transaction ID so they can tell the cashier
            setSuccessId(response.data.id);
            setAmount('');
            setRemark('');
        } catch (err) {
            setError(err.response?.data?.error || 'Redemption request failed.');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '400px' }}>
            <h2>Redeem Points</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            {successId ? (
                <div style={{ padding: '20px', border: '2px solid green', borderRadius: '8px', textAlign: 'center' }}>
                    <h3 style={{ color: 'green' }}>Request Created!</h3>
                    <p>Tell the cashier your Redemption ID:</p>
                    <h1 style={{ fontSize: '48px', margin: '10px 0' }}>{successId}</h1>
                    <button onClick={() => navigate('/transactions')}>View in History</button>
                    <br /><br />
                    <button onClick={() => setSuccessId(null)}>Make Another Request</button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input 
                        type="number" 
                        placeholder="Points to Redeem" 
                        required 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)} 
                    />
                    <input 
                        placeholder="Description (e.g. Coffee)" 
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)} 
                    />
                    <button type="submit" style={{ padding: '10px', backgroundColor: '#ff9800', color: 'white', border: 'none' }}>
                        Request Redemption
                    </button>
                </form>
            )}
        </div>
    );
};

export default RedeemPointsPage;