import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, Alert, ScrollView,
} from 'react-native';
import useAuthStore from '../store/authStore';
import { getProfile, getMyRoutes, getMyBookmarks, getMyLikes } from '../api/users';

const PRIMARY = '#2D6A4F';
const PLACEHOLDER_IMG = 'https://via.placeholder.com/400x300/2D6A4F/FFFFFF?text=Route';

const TABS = [
  { key: 'routes', label: '내 루트' },
  { key: 'bookmarks', label: '북마크' },
  { key: 'likes', label: '좋아요' },
];

function RouteGrid({ items, loading }) {
  if (loading) {
    return <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />;
  }
  if (items.length === 0) {
    return (
      <View style={styles.tabEmpty}>
        <Text style={styles.tabEmptyText}>아직 게시물이 없어요</Text>
      </View>
    );
  }
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.id} style={styles.gridItem}>
          <Image
            source={{ uri: item.thumbnail_url || PLACEHOLDER_IMG }}
            style={styles.gridThumb}
            resizeMode="cover"
          />
          <View style={styles.gridOverlay}>
            <Text style={styles.gridStat}>♥ {item.like_count || 0}</Text>
          </View>
          {item.grade ? (
            <View style={styles.gridBadge}>
              <Text style={styles.gridBadgeText}>{item.grade}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function MyPageScreen() {
  const { user, isGuest, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('routes');
  const [tabData, setTabData] = useState({ routes: [], bookmarks: [], likes: [] });
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (isGuest || !user?.id) {
      setProfileLoading(false);
      return;
    }
    getProfile(user.id)
      .then((res) => setProfile(res.data))
      .catch((e) => Alert.alert('오류', e.message))
      .finally(() => setProfileLoading(false));
  }, [user, isGuest]);

  const fetchTabData = useCallback(async (tab) => {
    if (isGuest) return;
    if (tabData[tab].length > 0) return;
    setTabLoading(true);
    try {
      let res;
      if (tab === 'routes') res = await getMyRoutes();
      else if (tab === 'bookmarks') res = await getMyBookmarks();
      else res = await getMyLikes();
      const list = res.data?.routes || res.data || [];
      setTabData((prev) => ({ ...prev, [tab]: list }));
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setTabLoading(false);
    }
  }, [isGuest, tabData]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: logout },
    ]);
  };

  if (profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (isGuest) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>마이페이지</Text>
        </View>
        <View style={styles.guestContainer}>
          <Text style={styles.guestIcon}>🧗</Text>
          <Text style={styles.guestTitle}>로그인이 필요해요</Text>
          <Text style={styles.guestDesc}>로그인하면 내 루트, 북마크, 좋아요를 관리할 수 있어요</Text>
          <TouchableOpacity style={styles.guestBtn} onPress={logout}>
            <Text style={styles.guestBtnText}>로그인 화면으로</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayProfile = profile || user || {};
  const initials = (displayProfile.name || displayProfile.nickname || '?')[0]?.toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>마이페이지</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView stickyHeaderIndices={[1]}>
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            {displayProfile.profile_image ? (
              <Image source={{ uri: displayProfile.profile_image }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {displayProfile.name || displayProfile.nickname || '클라이머'}
              </Text>
              {displayProfile.bio ? (
                <Text style={styles.profileBio} numberOfLines={2}>{displayProfile.bio}</Text>
              ) : null}
              {displayProfile.max_level ? (
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>최고 레벨: {displayProfile.max_level}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{displayProfile.route_count || 0}</Text>
              <Text style={styles.statLabel}>루트</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{displayProfile.follower_count || 0}</Text>
              <Text style={styles.statLabel}>팔로워</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{displayProfile.following_count || 0}</Text>
              <Text style={styles.statLabel}>팔로잉</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabHeader}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <RouteGrid items={tabData[activeTab]} loading={tabLoading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY },
  logoutText: { fontSize: 13, color: '#999', paddingBottom: 2 },

  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  guestIcon: { fontSize: 56, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  guestDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  guestBtn: { backgroundColor: PRIMARY, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12 },
  guestBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  profileCard: {
    backgroundColor: '#FFF', margin: 12, borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  profileTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  profileImage: { width: 72, height: 72, borderRadius: 36, marginRight: 14 },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  profileAvatarText: { color: '#FFF', fontSize: 30, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 4 },
  profileBio: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 6 },
  levelBadge: {
    alignSelf: 'flex-start', backgroundColor: '#E8F5E9',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  levelText: { fontSize: 11, color: PRIMARY, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#222' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E0E0E0' },

  tabHeader: {
    flexDirection: 'row', backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: PRIMARY },
  tabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  tabTextActive: { color: PRIMARY, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  gridItem: { width: '33.33%', aspectRatio: 1, padding: 2, position: 'relative' },
  gridThumb: { width: '100%', height: '100%', borderRadius: 4 },
  gridOverlay: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
  },
  gridStat: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  gridBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: PRIMARY, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
  },
  gridBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  tabEmpty: { padding: 40, alignItems: 'center' },
  tabEmptyText: { fontSize: 14, color: '#999' },
});
