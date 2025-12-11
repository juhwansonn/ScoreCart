// frontend/src/pages/TransactionsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const TransactionsPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [error, setError] = useState('');
    const { token } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/users/me/transactions`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTransactions(response.data.results);
            } catch (err) {
                setError('Failed to fetch transactions.');
                console.error(err);
            }
        };
        fetchTransactions();
    }, [token]);

    return (
        <div style={{ padding: '20px' }}>
            <h2>My Transactions</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            <button onClick={() => navigate('/transfer')} style={{ marginBottom: '20px', marginRight: '10px' }}>
                Transfer Points
            </button>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((tx) => (
                        <tr key={tx.id}>
                            <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                            <td style={{ textTransform: 'capitalize' }}>{tx.type}</td>
                            <td style={{ color: tx.amount >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </td>
                            <td>{tx.remark || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {transactions.length === 0 && <p>No transactions found.</p>}
        </div>
    );
};

export default TransactionsPage;