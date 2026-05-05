import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

/**
 * Layout — handoff 패턴
 *  - TopBar는 각 페이지가 자체 렌더 (54px sticky)
 *  - BottomNav는 글로벌 fixed (5슬롯, FAB)
 *  - 페이지 콘텐츠는 BottomNav 높이만큼 padding-bottom
 */
export default function Layout() {
  return (
    <div className="app-frame">
      <main className="page">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
