import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const { user, logout, currentRole, allAvailableRoles, switchRole, ROLE_RANKS } = useAuth();
    const navigate = useNavigate();

    if (!user) {
        return null;
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Determine permissions based on the CURRENT ACTIVE ROLE
    const activeRole = (currentRole || user.role || '').toLowerCase();
    const isManagerView = ROLE_RANKS[activeRole] >= ROLE_RANKS['manager'];
    const isCashierView = ROLE_RANKS[activeRole] >= ROLE_RANKS['cashier'];
    
    // Check for multiple roles to decide if the dropdown should appear
    const showRoleSwitch = allAvailableRoles.length > 1;

    // Helper for title casing roles in the UI
    const toTitleCase = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    return (
        <nav style={styles.nav}>
            <div style={styles.container}>
                <div style={styles.brand}>
                    <Link to="/profile" style={styles.brandLink}>CSSU Rewards</Link>
                </div>

                <div style={styles.links}>
                    {/* Common Links (Regular View) */}
                    <Link to="/profile" style={styles.link}>Profile</Link>
                    <Link to="/events" style={styles.link}>Events</Link>
                    <Link to="/promotions" style={styles.link}>Promotions</Link>
                    <Link to="/transactions" style={styles.link}>History</Link>
                    <Link to="/transfer" style={styles.link}>Transfer</Link>
                    <Link to="/redeem" style={styles.link}>Redeem</Link>

                    {/* Cashier Links (Conditional on Active Role) */}
                    {isCashierView && (
                        <div style={styles.separator}>
                            <span style={{ color: '#aaa' }}>|</span>
                            <Link to="/cashier" style={styles.link}>Charge</Link> 
                            <Link to="/redeem/process" style={styles.link}>Process</Link>
                        </div>
                    )}

                    {/* Manager Links (Conditional on Active Role) */}
                    {isManagerView && (
                        <div style={styles.separator}>
                            <span style={{ color: '#aaa' }}>|</span>
                            <Link to="/users" style={styles.link}>Users</Link>
                            <Link to="/manager/transactions" style={styles.link}>Global Tx</Link>
                        </div>
                    )}
                </div>

                <div style={styles.auth}>
                    {/* Role Switching Dropdown */}
                    {showRoleSwitch && (
                        <div style={styles.roleSwitch}>
                            <label htmlFor="role-select" style={{ marginRight: '5px', color: '#ccc' }}>View as:</label>
                            <select 
                                id="role-select"
                                value={activeRole} 
                                onChange={(e) => switchRole(e.target.value)}
                                style={styles.select}
                            >
                                {allAvailableRoles
                                    .sort((a, b) => ROLE_RANKS[b] - ROLE_RANKS[a]) // Sort descending (superuser first)
                                    .map(role => (
                                        <option key={role} value={role}>
                                            {toTitleCase(role)}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    <span style={{ marginRight: '15px', fontWeight: 'bold' }}>
                        @{user.utorid}
                    </span>
                    <button onClick={handleLogout} style={styles.button}>
                        Logout
                    </button>
                </div>
            </div>
        </nav>
    );
};

const styles = {
    nav: {
        backgroundColor: '#333',
        color: '#fff',
        padding: '10px 20px',
        marginBottom: '20px',
    },
    container: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    brand: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
    },
    brandLink: {
        color: '#fff',
        textDecoration: 'none',
    },
    links: {
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
    },
    link: {
        color: '#ccc',
        textDecoration: 'none',
        fontSize: '0.95rem',
    },
    separator: {
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
    },
    auth: {
        display: 'flex',
        alignItems: 'center',
    },
    button: {
        padding: '5px 10px',
        cursor: 'pointer',
        backgroundColor: '#d9534f',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
    },
    roleSwitch: {
        display: 'flex',
        alignItems: 'center',
        marginRight: '20px',
    },
    select: {
        padding: '4px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#555',
        color: 'white',
        cursor: 'pointer',
    }
};

export default Navbar;