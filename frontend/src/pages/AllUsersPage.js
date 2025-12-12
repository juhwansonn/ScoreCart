// frontend/src/pages/AllUsersPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // <--- 1. Import useNavigate
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const AllUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');
    const { token } = useAuth();
    const navigate = useNavigate(); // <--- 2. Initialize the hook

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUsers(response.data.results);
            } catch (err) {
                setError('Failed to fetch users. Are you a manager?');
                console.error(err);
            }
        };

        if (token) {
            fetchUsers();
        }
    }, [token]);

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header Section with Button */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '20px' 
            }}>
                <h2>All Users</h2>
                
                {/* 3. The New Button */}
                <button 
                    onClick={() => navigate('/users/new')}
                    style={styles.createButton}
                >
                    + Create New User
                </button>
            </div>

            {error && <p style={{color: 'red'}}>{error}</p>}

            <ul style={styles.list}>
                {users.map((u) => (
                    <li key={u.id} style={styles.listItem}>
                        <div>
                            <strong>{u.name}</strong> 
                            <span style={{ color: '#666', marginLeft: '8px' }}>
                                (@{u.utorid})
                            </span>
                        </div>
                        <span style={styles.roleBadge(u.role)}>
                            {u.role}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// Simple styles to make it look nice
const styles = {
    createButton: {
        padding: '10px 15px',
        backgroundColor: '#28a745', // Green color
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
    },
    list: {
        listStyle: 'none',
        padding: 0,
    },
    listItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px',
        borderBottom: '1px solid #eee',
        backgroundColor: '#fff',
    },
    roleBadge: (role) => ({
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        textTransform: 'capitalize',
        backgroundColor: role === 'manager' || role === 'superuser' ? '#e2e3e5' : '#d1ecf1',
        color: role === 'manager' || role === 'superuser' ? '#383d41' : '#0c5460',
    })
};

export default AllUsersPage;