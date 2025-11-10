import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import AgentBuilder from './pages/AgentBuilder';
import AgentDetail from './pages/AgentDetail';
import TestAgent from './pages/TestAgent';
import PhoneNumbers from './pages/PhoneNumbers';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

function App() {
  const AppRoutes = () => {
    const location = useLocation();
    const state = location.state;

    return (
      <>
        {/* Render the underlying page using the background location when present */}
        <Routes location={state?.backgroundLocation || location}>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected app */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="agent/new" element={<AgentBuilder />} />
          <Route path="agent/:id" element={<AgentDetail />} />
          <Route path="agent/:id/test" element={<TestAgent />} />
          <Route path="agent/:id/edit" element={<AgentBuilder />} />
          <Route path="phone-numbers" element={<PhoneNumbers />} />
          </Route>

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* When a background location exists, render modal routes on top */}
        {state?.backgroundLocation && (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        )}
      </>
    );
  };

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#f8fff6]">
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1f2937',
                color: '#fff',
              },
            }}
          />
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;


