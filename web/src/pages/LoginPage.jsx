import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { login as apiLogin } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import OAuthButtons from '../components/OAuthButtons';

export default function LoginPage() {
  const { authLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await apiLogin(email, password);
      authLogin(r.data.token, r.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>🧗</div>
        <h1 style={s.title}>The Route</h1>
        <p style={s.sub}>클라이밍 기록 & 훈련 관리</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일" required autoComplete="email"
            style={s.input}
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호" required autoComplete="current-password"
            style={s.input}
          />
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={s.divider}>
          <span style={s.dividerLine} />
          <span style={s.dividerText}>또는</span>
          <span style={s.dividerLine} />
        </div>

        <OAuthButtons />

        <p style={s.foot}>
          계정이 없으신가요?{' '}
          <Link to="/signup" style={s.link}>회원가입</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: 'var(--bg)', padding: '0 16px',
  },
  card: {
    width: '100%', maxWidth: 380, padding: '36px 28px',
    background: 'var(--surface)', borderRadius: 'var(--r-lg)',
    border: '1px solid var(--line)', boxShadow: 'var(--shadow-2)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  logo: { fontSize: 40, marginBottom: 8 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--ink-1)' },
  sub: { margin: '4px 0 28px', fontSize: 13, color: 'var(--ink-3)' },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 14,
    border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)',
    background: 'var(--surface-2)', color: 'var(--ink-1)', outline: 'none',
    boxSizing: 'border-box',
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: 12.5 },
  btn: {
    width: '100%', padding: '13px', fontSize: 15, fontWeight: 700,
    border: 'none', borderRadius: 'var(--r-sm)',
    background: 'var(--primary)', color: '#fff', cursor: 'pointer',
    marginTop: 4,
  },
  divider: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', margin: '16px 0 8px' },
  dividerLine: { flex: 1, height: 1, background: 'var(--line)' },
  dividerText: { fontSize: 12, color: 'var(--ink-4)', whiteSpace: 'nowrap' },
  foot: { marginTop: 20, fontSize: 13, color: 'var(--ink-3)' },
  link: { color: 'var(--primary-ink)', fontWeight: 600, textDecoration: 'none' },
};
