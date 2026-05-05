import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/tokens.css';
import './styles/app.css';

import Layout from './components/Layout';
import { SessionAddModalProvider } from './contexts/SessionAddModalContext';

import FeedPage from './pages/FeedPage';
import RouteDetailPage from './pages/RouteDetailPage';
import GymListPage from './pages/GymListPage';
import GymDetailPage from './pages/GymDetailPage';
import CalendarPage from './pages/CalendarPage';
import LogDetailPage from './pages/LogDetailPage';
import TrainingPage from './pages/TrainingPage';
import MyPage from './pages/MyPage';
import NotFoundPage from './pages/NotFoundPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionAddModalProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/routes/new" element={<Navigate to="/" replace />} />
            <Route path="/routes/:id" element={<RouteDetailPage />} />
            <Route path="/gyms" element={<GymListPage />} />
            <Route path="/gyms/:id" element={<GymDetailPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/logs/:id" element={<LogDetailPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/me" element={<MyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </SessionAddModalProvider>
    </BrowserRouter>
  </React.StrictMode>
);
