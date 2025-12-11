import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import AllUsersPage from './pages/AllUsersPage'; 
import ProtectedRoute from './components/ProtectedRoute'; 
import EventsPage from './pages/EventsPage';
import CreateEventPage from './pages/CreateEventPage';
import PromotionsPage from './pages/PromotionsPage';
import CreatePromotionPage from './pages/CreatePromotionPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<LoginPage />} />
        {/* Add a /reset-password route here */}

        {/* Protected Routes (Authenticated) */}
        <Route element={<ProtectedRoute requiredRole="regular" />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
        </Route>

        {/* Manager-only Routes */}
        <Route element={<ProtectedRoute requiredRole="manager" />}>
        <Route path="/events/new" element={<CreateEventPage />} />
        <Route path="/promotions/new" element={<CreatePromotionPage />} />
        </Route>

        {/* Cashier Routes */}
        <Route element={<ProtectedRoute requiredRole="cashier" />}>
          {/* Add Cashier pages here */}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<div>404 Not Found</div>} />
        <Route path="/unauthorized" element={<div>403 Unauthorized</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;