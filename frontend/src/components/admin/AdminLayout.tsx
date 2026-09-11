import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Vote,
  Award,
  Users,
  MapPin,
  UserCheck,
  BarChart3,
  ShieldAlert,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { authService } from '../../services/api';
import toast from 'react-hot-toast';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fecha sidebar ao trocar de rota (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Fecha sidebar ao pressionar Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Bloqueia scroll do body quando sidebar está aberta no mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // continua mesmo com erro
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.success('Sessão encerrada');
      navigate('/admin/login');
    }
  };

  const navLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/eleicoes', label: 'Eleições', icon: Vote },
    { to: '/admin/cargos', label: 'Cargos', icon: Award },
    { to: '/admin/candidatos', label: 'Candidatos', icon: Users },
    { to: '/admin/estados', label: 'Estados / UFs', icon: MapPin },
    { to: '/admin/votantes', label: 'Votantes', icon: UserCheck },
    { to: '/admin/resultados', label: 'Resultados', icon: BarChart3 },
    { to: '/admin/auditoria', label: 'Auditoria & Logs', icon: ShieldAlert },
  ];

  return (
    <div className="admin-layout">
      {/* Overlay mobile — fecha ao clicar fora da sidebar */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="admin-sidebar-logo">
          <div className="admin-sidebar-logo-icon">
            <Vote size={20} color="white" />
          </div>
          <div className="admin-sidebar-logo-text">
            <div className="admin-sidebar-logo-title">URNA ELETRÔNICA</div>
            <div className="admin-sidebar-logo-sub">Painel Administrativo NGV</div>
          </div>
          {/* Botão fechar sidebar no mobile */}
          <button
            className="admin-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="admin-nav">
          <div className="admin-nav-section">GERENCIAMENTO</div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Rodapé da sidebar */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--color-admin-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <a
            href="/votar"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-nav-item"
            style={{ borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}
          >
            <ExternalLink size={16} />
            <span>Abrir Urna Pública</span>
          </a>

          <button
            onClick={handleLogout}
            className="admin-nav-item"
            style={{
              color: '#ef4444',
              borderRadius: '6px',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="admin-main">
        <header className="admin-topbar">
          {/* Botão hambúrguer — visível apenas em mobile */}
          <button
            className="admin-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>

          <div className="admin-page-title">Sistema Eleitoral — NGV</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-admin-muted)' }} className="admin-user-label">
              Logado como: <strong style={{ color: 'white' }}>{user.name || user.email || 'Admin'}</strong>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </header>

        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
};
