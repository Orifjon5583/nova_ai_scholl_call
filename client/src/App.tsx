import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Calls from './pages/Calls';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="crm" element={<CRM />} />
          <Route path="crm/new" element={<CRM filter="Yangi" />} />
          <Route path="crm/waiting" element={<CRM filter="Kutilmoqda" />} />
          <Route path="crm/quality" element={<CRM filter="Sifatli" />} />
          <Route path="crm/bad" element={<CRM filter="Sifatsiz" />} />
          <Route path="crm/pipeline" element={<CRM isKanban={true} />} />
          
          <Route path="calls" element={<Calls />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="operators" element={<Settings />} /> {/* Placeholder for operators */}
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
