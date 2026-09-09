import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Urna pages
import { IdentificationPage } from './pages/urna/IdentificationPage';
import { VotingPage } from './pages/urna/VotingPage';
import { FinishedPage } from './pages/urna/FinishedPage';
import { AlreadyVotedPage } from './pages/urna/AlreadyVotedPage';
import { NoElectionPage } from './pages/urna/NoElectionPage';

// Admin pages
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminLayout } from './components/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { ElectionsPage } from './pages/admin/ElectionsPage';
import { ElectionDetailPage } from './pages/admin/ElectionDetailPage';
import { CandidatesPage } from './pages/admin/CandidatesPage';
import { VotersPage } from './pages/admin/VotersPage';
import { ResultsPage } from './pages/admin/ResultsPage';
import { AuditPage } from './pages/admin/AuditPage';
import { StatesPage } from './pages/admin/StatesPage';
import { PositionsPage } from './pages/admin/PositionsPage';

// Auth guard
import { RequireAuth } from './components/admin/RequireAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* ── Urna pública ── */}
          <Route path="/" element={<Navigate to="/votar" replace />} />
          <Route path="/votar" element={<IdentificationPage />} />
          <Route path="/votar/urna" element={<VotingPage />} />
          <Route path="/votar/concluido" element={<FinishedPage />} />
          <Route path="/votar/ja-votou" element={<AlreadyVotedPage />} />
          <Route path="/votar/sem-eleicao" element={<NoElectionPage />} />

          {/* ── Admin ── */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="eleicoes" element={<ElectionsPage />} />
            <Route path="eleicoes/:id" element={<ElectionDetailPage />} />
            <Route path="candidatos" element={<CandidatesPage />} />
            <Route path="estados" element={<StatesPage />} />
            <Route path="cargos" element={<PositionsPage />} />
            <Route path="votantes" element={<VotersPage />} />
            <Route path="resultados" element={<ResultsPage />} />
            <Route path="auditoria" element={<AuditPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/votar" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: '10px',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#4caf50', secondary: 'white' } },
          error: { iconTheme: { primary: '#ef5350', secondary: 'white' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
