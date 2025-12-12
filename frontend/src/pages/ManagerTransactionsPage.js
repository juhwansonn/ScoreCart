import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const ManagerTransactionsPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { token } = useAuth();

    // Filters
    const [filterType, setFilterType] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');

    // 1. FIX: Wrap function in useCallback so it's stable
    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            setError(''); // Clear previous errors on new fetch
            
            const res = await axios.get(`${API_BASE_URL}/transactions`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { type: filterType, orderBy: sortOrder }
            });
            
            if (Array.isArray(res.data)) {
                setTransactions(res.data);
            } else if (res.data.results) {
                setTransactions(res.data.results);
            } else {
                setTransactions([]);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load global transactions.");
        } finally {
            setLoading(false);
        }
    }, [token, filterType, sortOrder]); // Re-create only if these change

    // 2. FIX: Add function to dependency array
    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    // Action: Flag Transaction as Suspicious
    const toggleSuspicious = async (txId, currentStatus) => {
        if (!window.confirm(`Mark transaction as ${!currentStatus ? 'Suspicious' : 'Safe'}?`)) return;
        try {
            await axios.patch(`${API_BASE_URL}/transactions/${txId}/suspicious`, 
                { suspicious: !currentStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchTransactions(); 
        } catch (err) {
            alert("Failed to update transaction.");
        }
    };

    // Action: Issue Adjustment
    const handleAdjustment = async (txId, userUtorid) => {
        const amountStr = prompt(`Enter adjustment amount for User ${userUtorid} (e.g. -50 to deduct, 50 to add):`);
        if (!amountStr) return;
        
        const amount = parseInt(amountStr);
        if (isNaN(amount)) {
            alert("Invalid number.");
            return;
        }

        try {
            // NOTE: Ensure your backend supports this structure or adapt as needed
            await axios.post(`${API_BASE_URL}/transactions`, 
                { 
                    type: 'adjustment',
                    amount: amount,
                    relatedId: txId, // Using relatedId as per schema
                    utorid: userUtorid, // Explicitly linking to the user
                    remark: `Adjustment for Tx #${txId}`
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("Adjustment transaction created.");
            fetchTransactions();
        } catch (err) {
            console.error(err);
            alert("Failed to create adjustment.");
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Global Transaction History</h1>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f1f1f1', borderRadius: '5px' }}>
                <select onChange={(e) => setFilterType(e.target.value)} value={filterType}>
                    <option value="">All Types</option>
                    <option value="purchase">Purchase</option>
                    <option value="redemption">Redemption</option>
                    <option value="adjustment">Adjustment</option>
                </select>
                <select onChange={(e) => setSortOrder(e.target.value)} value={sortOrder}>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="amount_high">Highest Amount</option>
                </select>
                <button onClick={fetchTransactions} style={{ marginLeft: 'auto' }}>Refresh</button>
            </div>

            {/* 3. FIX: Display the error so the variable is "used" */}
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

            {loading ? <p>Loading...</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>Date</th>
                            <th style={{ padding: '10px' }}>User</th>
                            <th style={{ padding: '10px' }}>Type</th>
                            <th style={{ padding: '10px' }}>Amount</th>
                            <th style={{ padding: '10px' }}>Status</th>
                            <th style={{ padding: '10px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(tx => (
                            <tr key={tx.id} style={{ borderBottom: '1px solid #eee', backgroundColor: tx.suspicious ? '#ffe6e6' : 'transparent' }}>
                                <td style={{ padding: '10px' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                                <td style={{ padding: '10px' }}>{tx.utorid || 'Unknown'}</td>
                                <td style={{ padding: '10px' }}>{tx.type}</td>
                                <td style={{ padding: '10px', color: tx.amount >= 0 ? 'green' : 'red' }}>
                                    {tx.amount}
                                </td>
                                <td style={{ padding: '10px' }}>
                                    {tx.suspicious && <span style={{ color: 'red', fontWeight: 'bold' }}>⚠️ SUSPICIOUS</span>}
                                </td>
                                <td style={{ padding: '10px' }}>
                                    <button 
                                        onClick={() => toggleSuspicious(tx.id, tx.suspicious)}
                                        style={{ marginRight: '5px', fontSize: '0.8rem', cursor: 'pointer' }}
                                    >
                                        {tx.suspicious ? 'Mark Safe' : 'Flag'}
                                    </button>
                                    <button 
                                        onClick={() => handleAdjustment(tx.id, tx.utorid)}
                                        style={{ fontSize: '0.8rem', cursor: 'pointer' }}
                                    >
                                        Adjust
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ManagerTransactionsPage;