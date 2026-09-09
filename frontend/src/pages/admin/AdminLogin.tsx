import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import { ShieldCheck, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@urna.ngv');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Informe email e senha');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success(`Bem-vindo, ${data.user.name || 'Admin'}!`);
      navigate('/admin/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Falha na autenticação. Verifique suas credenciais.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e293b 100%)',
        padding: '1rem',
      }}
    >
      <div
        className="animate-fade-in-up"
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '2rem 1.5rem 1.5rem',
            textAlign: 'center',
            background: 'linear-gradient(180deg, rgba(21,101,192,0.15) 0%, transparent 100%)',
            borderBottom: '1px solid #334155',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #1e3d5e, #1565c0)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 8px 16px rgba(21,101,192,0.3)',
            }}
          >
            <ShieldCheck size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', letterSpacing: '0.04em' }}>
            PAINEL DO TRIBUNAL ELEITORAL
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
            Acesso restrito a administradores e mesários NGV
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
              Email Institucional
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase' }}>
              Senha de Acesso
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '6px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.75rem',
              color: '#93c5fd',
            }}
          >
            💡 <strong>Credenciais Padrão:</strong> admin@urna.local / admin123
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #1e3d5e, #1565c0)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.85rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(21,101,192,0.3)',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'AUTENTICANDO...' : 'ACESSAR PAINEL ➔'}
          </button>
        </form>
      </div>
    </div>
  );
};
