import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import useAuthStore from '../store/authStore';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest);

  // ────────────────────────────────────────
  // 구글 로그인
  // ────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert('설정 오류', '.env에 EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID를 설정해주세요.');
      return;
    }

    setLoading(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'theroute' });
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=openid%20email%20profile`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success') return;

      const fragment = result.url.split('#')[1];
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      if (!accessToken) throw new Error('구글 토큰 발급 실패');

      await login('google', accessToken);
    } catch (err) {
      Alert.alert('로그인 실패', err.message || '구글 로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────
  // 비회원 로그인
  // ────────────────────────────────────────
  const handleGuestLogin = async () => {
    await loginAsGuest();
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>더 루트</Text>
        <Text style={styles.tagline}>클라이머를 위한 AR 루트 공유 플랫폼</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, styles.googleBtn]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.googleBtnText}>Google로 로그인</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.guestBtn]}
          onPress={handleGuestLogin}
          disabled={loading}
        >
          <Text style={styles.guestBtnText}>비회원으로 둘러보기</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2D6A4F" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'space-between', paddingVertical: 80 },
  hero: { alignItems: 'center', gap: 12 },
  logo: { fontSize: 42, fontWeight: '800', color: '#2D6A4F' },
  tagline: { fontSize: 15, color: '#666', textAlign: 'center' },
  buttons: { paddingHorizontal: 32, gap: 14 },
  btn: { height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: '#333' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { fontSize: 13, color: '#aaa' },
  guestBtn: { backgroundColor: '#f5f5f5' },
  guestBtnText: { fontSize: 15, fontWeight: '500', color: '#666' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
});
