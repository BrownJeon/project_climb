import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Alert,
} from 'react-native';
import useAuthStore from '../store/authStore';
import { getFeed, getPopularFeed } from '../api/feed';
import { toggleLike, toggleBookmark } from '../api/routes';

const PRIMARY = '#2D6A4F';
const PLACEHOLDER_IMG = 'https://via.placeholder.com/400x300/2D6A4F/FFFFFF?text=Route';

function RouteCard({ item, isGuest, onLike, onBookmark }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: item.thumbnail_url || PLACEHOLDER_IMG }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.cardBody}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(item.author_name || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.authorName}>{item.author_name || '알 수 없음'}</Text>
            <Text style={styles.gymName}>{item.gym_name || ''}</Text>
          </View>
        </View>

        <Text style={styles.routeTitle} numberOfLines={2}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.routeDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.tagRow}>
          {item.grade ? <View style={styles.tag}><Text style={styles.tagText}>{item.grade}</Text></View> : null}
          {item.color ? <View style={[styles.tag, styles.tagOutline]}><Text style={styles.tagOutlineText}>{item.color}</Text></View> : null}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => !isGuest && onLike(item.id)}
            disabled={isGuest}
          >
            <Text style={[styles.actionIcon, item.is_liked && styles.liked]}>♥</Text>
            <Text style={styles.actionCount}>{item.like_count || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>{item.comment_count || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnRight]}
            onPress={() => !isGuest && onBookmark(item.id)}
            disabled={isGuest}
          >
            <Text style={[styles.actionIcon, item.is_bookmarked && styles.bookmarked]}>🔖</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { isGuest } = useAuthStore();
  const [routes, setRoutes] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFeed = useCallback(async (pageNum = 1, replace = false) => {
    try {
      const res = isGuest
        ? await getPopularFeed(pageNum)
        : await getFeed(pageNum);

      const list = res.data?.routes || res.data || [];
      const total = res.data?.total ?? list.length;

      setRoutes((prev) => replace ? list : [...prev, ...list]);
      setHasMore((replace ? list.length : routes.length + list.length) < total);
      setPage(pageNum);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [isGuest, routes.length]);

  useEffect(() => {
    fetchFeed(1, true);
  }, [isGuest]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFeed(1, true);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchFeed(page + 1, false);
  };

  const handleLike = async (id) => {
    try {
      await toggleLike(id);
      setRoutes((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, is_liked: !r.is_liked, like_count: r.like_count + (r.is_liked ? -1 : 1) }
            : r
        )
      );
    } catch (e) {
      Alert.alert('오류', e.message);
    }
  };

  const handleBookmark = async (id) => {
    try {
      await toggleBookmark(id);
      setRoutes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, is_bookmarked: !r.is_bookmarked } : r
        )
      );
    } catch (e) {
      Alert.alert('오류', e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isGuest ? '인기 루트' : '내 피드'}
        </Text>
        {isGuest && (
          <Text style={styles.headerSub}>로그인하면 팔로우 피드를 볼 수 있어요</Text>
        )}
      </View>

      <FlatList
        data={routes}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <RouteCard
            item={item}
            isGuest={isGuest}
            onLike={handleLike}
            onBookmark={handleBookmark}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={PRIMARY} /> : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧗</Text>
            <Text style={styles.emptyText}>아직 게시물이 없어요</Text>
            <Text style={styles.emptySubText}>다른 클라이머를 팔로우해보세요</Text>
          </View>
        }
        contentContainerStyle={routes.length === 0 && styles.emptyContainer}
      />
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
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },

  card: {
    backgroundColor: '#FFFFFF',
    marginVertical: 6,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  thumbnail: { width: '100%', height: 200 },
  cardBody: { padding: 12 },

  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  authorName: { fontSize: 14, fontWeight: '600', color: '#333' },
  gymName: { fontSize: 12, color: '#888' },

  routeTitle: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 4 },
  routeDesc: { fontSize: 13, color: '#666', marginBottom: 8, lineHeight: 18 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: { backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  tagText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  tagOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: PRIMARY },
  tagOutlineText: { color: PRIMARY, fontSize: 11, fontWeight: '600' },

  actionRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  actionBtnRight: { marginLeft: 'auto', marginRight: 0 },
  actionIcon: { fontSize: 18, marginRight: 4, color: '#999' },
  actionCount: { fontSize: 13, color: '#666' },
  liked: { color: '#E53935' },
  bookmarked: { color: PRIMARY },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyContainer: { flex: 1 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#444', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#888' },
});
