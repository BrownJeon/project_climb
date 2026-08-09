import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMe } from '../api/auth';

export default function OAuthCallbackPage() {
  const { authLogin } = useAuth();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const errorMsg = params.get('error');

    if (!token) {
      navigate(`/login?error=${encodeURIComponent(errorMsg || 'OAuth 인증에 실패했습니다.')}`, { replace: true });
      return;
    }

    // token만 먼저 저장 후 /auth/me로 사용자 정보 조회
    localStorage.setItem('theroute_token', token);
    getMe()
      .then((r) => {
        authLogin(token, r.data);
        navigate('/', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('theroute_token');
        navigate('/login?error=인증 처리 중 오류가 발생했습니다.', { replace: true });
      });
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>로그인 처리 중...</p>
    </div>
  );
}
