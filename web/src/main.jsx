import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/tokens.css';
import './styles/app.css';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { SessionAddModalProvider } from './contexts/SessionAddModalContext';
import { VideoUploadProvider } from './contexts/VideoUploadContext';
import VideoUploadToast from './components/VideoUploadToast';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import FeedPage from './pages/FeedPage';
import RouteDetailPage from './pages/RouteDetailPage';
import GymListPage from './pages/GymListPage';
import GymDetailPage from './pages/GymDetailPage';
import CalendarPage from './pages/CalendarPage';
import CalendarDetailPage from './pages/CalendarDetailPage';
import LogDetailPage from './pages/LogDetailPage';
import TrainingPage from './pages/TrainingPage';
import MyPage from './pages/MyPage';
import RecordsPage from './pages/RecordsPage';
import GrowthPage from './pages/GrowthPage';
import RoutinePage from './pages/RoutinePage';
import NotFoundPage from './pages/NotFoundPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/signup"         element={<SignupPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={
              <VideoUploadProvider>
                <SessionAddModalProvider>
                  <VideoUploadToast />
                  <Layout />
                </SessionAddModalProvider>
              </VideoUploadProvider>
            }>
              <Route path="/" element={<FeedPage />} />
              <Route path="/routes/new" element={<Navigate to="/" replace />} />
              <Route path="/routes/:id" element={<RouteDetailPage />} />
              <Route path="/gyms" element={<GymListPage />} />
              <Route path="/gyms/:id" element={<GymDetailPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/calendar/:date" element={<CalendarDetailPage />} />
              <Route path="/logs/:id" element={<LogDetailPage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/growth" element={<GrowthPage />} />
              <Route path="/routine" element={<RoutinePage />} />
              <Route path="/training" element={<TrainingPage />} />
              <Route path="/me" element={<MyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
