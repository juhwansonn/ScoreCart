import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const AllUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');
    const { token, user: currentUser } = useAuth();
    const navigate = useNavigate();

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // 1. DEFINE fetchUsers WITH useCallback
    // This makes it accessible everywhere in the component, but stable so it doesn't cause loops
    const fetchUsers = useCallback(async () => {
        try {
            // Updated to use API_BASE_URL and pass the page param
            const res = await axios.get(`${API_BASE_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page: page, limit: 10 } // sending pagination to backend
            });
            
            // Assuming backend returns { users: [], totalPages: 5 }
            // Adjust this if your backend just returns an array
            if (res.data.users) {
                setUsers(res.data.users);
                setTotalPages(res.data.totalPages);
            } else {
                // Fallback if backend just returns an array
                setUsers(res.data);
            }
            
        } catch (err) {
            console.error(err);
            setError("Failed to fetch users");
        }
    }, [token, page]); // Dependencies: recreate this function if token or page changes

    // 2. CALL IT IN useEffect
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]); // Safe to put here now!

    // Role Management Logic
    const handleRoleUpdate = async (userId, newRole) => {
        if (!window.confirm(`Are you sure you want to promote this user to ${newRole}?`)) return;
        try {
            await axios.patch(`${API_BASE_URL}/users/${userId}`, 
                { role: newRole }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("User updated successfully!");
            
            // 3. NOW THIS WORKS (It can "see" the function)
            fetchUsers(); 
        } catch (err) {
            alert(err.response?.data?.error || "Update failed");
        }
    };

    // Helper: Can I edit this person?
    const canPromote = (targetRole) => {
        if (!currentUser) return false; // Safety check
        if (currentUser.role === 'superuser') return true;
        if (currentUser.role === 'manager' && targetRole === 'cashier') return true;
        return false;
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>All Users</h2>
                <button 
                    onClick={() => navigate('/users/new')}
                    style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                    + Create New User
                </button>
            </div>

            {error && <p style={{color: 'red'}}>{error}</p>}

            <ul style={{ listStyle: 'none', padding: 0 }}>
                {users.map((u) => (
                    <li key={u.id || u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
                        <div>
                            <strong>{u.name}</strong> 
                            <span style={{ color: '#666', marginLeft: '8px' }}>@{u.utorid}</span>
                            <br/>
                            <span style={{ fontSize: '0.85em', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e2e3e5', marginTop: '5px', display: 'inline-block' }}>
                                {u.role}
                            </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '5px' }}>
                            {/* Actions based on role */}
                            {u.role === 'regular' && canPromote('cashier') && (
                                <button onClick={() => handleRoleUpdate(u.id || u._id, 'cashier')} style={styles.actionBtn}>
                                    Make Cashier
                                </button>
                            )}
                            {u.role !== 'manager' && currentUser.role === 'superuser' && (
                                <button onClick={() => handleRoleUpdate(u.id || u._id, 'manager')} style={styles.actionBtn}>
                                    Make Manager
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}
        </div>
    );
};

const styles = {
    actionBtn: {
        padding: '5px 10px',
        fontSize: '0.8rem',
        cursor: 'pointer',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '3px'
    }
};

export default AllUsersPage;