import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const TransactionsPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [filterType, setFilterType] = useState(''); 
    const [sortOrder, setSortOrder] = useState('newest'); 
    const [error, setError] = useState('');
    const { token } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/users/me/transactions`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        type: filterType || undefined, 
                        orderBy: sortOrder
                    }
                });
                setTransactions(response.data.results);
            } catch (err) {
                setError('Failed to fetch transactions.');
            }
        };
        fetchTransactions();
    }, [token, filterType, sortOrder]); 

    return (
        <div style={{ padding: '20px' }}>
            <h2>My Transactions</h2>
            
            <button onClick={() => navigate('/transfer')} style={{ marginBottom: '20px' }}>
                Transfer Points
            </button>

            {/* --- FILTERS & SORTING BAR --- */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', display: 'flex', gap: '20px' }}>
                <div>
                    <label><strong>Filter by Type: </strong></label>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="purchase">Purchase</option>
                        <option value="redemption">Redemption</option>
                        <option value="transfer">Transfer</option>
                        <option value="event">Event</option>
                    </select>
                </div>
                <div>
                    <label><strong>Sort By: </strong></label>
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="amount_high">Highest Amount</option>
                        <option value="amount_low">Lowest Amount</option>
                    </select>
                </div>
            </div>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#eee' }}>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((tx) => {
                        // "Nice" Display Logic
                        let details = tx.remark || '-';
                        let typeLabel = tx.type;
                        let typeColor = '#333';

                        if (tx.type === 'transfer') {
                            // Use the data we added in the backend
                            if (tx.amount < 0) {
                                typeLabel = "Sent";
                                typeColor = '#d9534f'; // Red
                                details = `To: @${tx.relatedUserUtorid || 'Unknown'}`;
                            } else {
                                typeLabel = "Received";
                                typeColor = '#28a745'; // Green
                                details = `From: @${tx.relatedUserUtorid || 'Unknown'}`;
                            }
                        } else if (tx.type === 'purchase') {
                            typeColor = '#007bff'; // Blue
                        } else if (tx.type === 'redemption') {
                            typeColor = '#fd7e14'; // Orange
                        }

                        return (
                            <tr key={tx.id}>
                                <td style={{ padding: '10px' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                                <td style={{ padding: '10px', color: typeColor, fontWeight: 'bold', textTransform: 'capitalize' }}>
                                    {typeLabel}
                                </td>
                                <td style={{ padding: '10px' }}>{details}</td>
                                <td style={{ padding: '10px', textAlign: 'right', color: tx.amount >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {transactions.length === 0 && <p style={{marginTop: '20px', textAlign:'center'}}>No transactions found.</p>}
        </div>
    );
};

export default TransactionsPage;