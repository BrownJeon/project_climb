import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="empty">
      <h2>페이지를 찾을 수 없습니다</h2>
      <Link to="/" className="btn btn-primary">홈으로</Link>
    </div>
  );
}
