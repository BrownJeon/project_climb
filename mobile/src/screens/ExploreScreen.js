import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert,
} from 'react-native';
import { listGyms, getGymProblems } from '../api/gyms';

const PRIMARY = '#2D6A4F';

function GymCard({ gym, onPress }) {
  return (
    <TouchableOpacity style={styles.gymCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.gymIconBox}>
        <Text style={styles.gymIcon}>🧗</Text>
      </View>
      <View style={styles.gymInfo}>
        <Text style={styles.gymName} numberOfLines={1}>{gym.name}</Text>
        <Text style={styles.gymAddress} numberOfLines={1}>{gym.address || '주소 정보 없음'}</Text>
        <View style={styles.gymMeta}>
          {gym.phone && <Text style={styles.gymMetaText}>📞 {gym.phone}</Text>}
          {gym.price_info && <Text style={styles.gymMetaText}>💰 {gym.price_info}</Text>}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function ProblemList({ gym, onClose }) {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGymProblems(gym.id)
      .then((res) => setProblems(res.data || []))
      .catch((e) => Alert.alert('오류', e.message))
      .finally(() => setLoading(false));
  }, [gym.id]);

  const DIFFICULTY_COLORS = {
    '초급': '#4CAF50',
    '중급': '#FF9800',
    '고급': '#F44336',
    '상급': '#9C27B0',
  };

  return (
    <View style={styles.detailContainer}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ 목록</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle} numberOfLines={1}>{gym.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.gymDetailInfo}>
        <Text style={styles.gymDetailAddress}>📍 {gym.address || '주소 정보 없음'}</Text>
        {gym.hours && <Text style={styles.gymDetailRow}>🕐 {gym.hours}</Text>}
        {gym.price_info && <Text style={styles.gymDetailRow}>💰 {gym.price_info}</Text>}
        {gym.description && <Text style={styles.gymDetailDesc}>{gym.description}</Text>}
      </View>

      <Text style={styles.sectionLabel}>등록된 문제 ({problems.length})</Text>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
      ) : problems.length === 0 ? (
        <View style={styles.emptySmall}>
          <Text style={styles.emptySmallText}>아직 등록된 문제가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={problems}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.problemCard}>
              <View style={[
                styles.difficultyBadge,
                { backgroundColor: DIFFICULTY_COLORS[item.difficulty] || PRIMARY },
              ]}>
                <Text style={styles.difficultyText}>{item.difficulty || '-'}</Text>
              </View>
              <View style={styles.problemInfo}>
                <Text style={styles.problemName}>{item.name || `문제 #${item.id}`}</Text>
                {item.setter && <Text style={styles.problemSetter}>세터: {item.setter}</Text>}
                {item.description && (
                  <Text style={styles.problemDesc} numberOfLines={2}>{item.description}</Text>
                )}
              </View>
              <View style={styles.problemStats}>
                <Text style={styles.problemStat}>💬 {item.route_count || 0}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

export default function ExploreScreen() {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGym, setSelectedGym] = useState(null);

  const fetchGyms = useCallback(async (query = '') => {
    try {
      const params = query ? { search: query } : {};
      const res = await listGyms(params);
      setGyms(res.data || []);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGyms();
  }, []);

  const handleSearch = () => {
    setLoading(true);
    fetchGyms(search.trim());
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setSearch('');
    fetchGyms('');
  };

  if (selectedGym) {
    return <ProblemList gym={selectedGym} onClose={() => setSelectedGym(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>암장 탐색</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="암장 이름 또는 지역 검색"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor="#AAA"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>검색</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={gyms}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <GymCard gym={item} onPress={() => setSelectedGym(item)} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyText}>등록된 암장이 없어요</Text>
              <Text style={styles.emptySubText}>검색어를 바꿔보거나 나중에 다시 확인해주세요</Text>
            </View>
          }
          contentContainerStyle={gyms.length === 0 && styles.emptyContainer}
        />
      )}
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
  headerTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY, marginBottom: 10 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#E0E0E0',
  },
  searchBtn: {
    backgroundColor: PRIMARY, paddingHorizontal: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  gymCard: {
    backgroundColor: '#FFF', marginHorizontal: 12, marginVertical: 5,
    borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  gymIconBox: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  gymIcon: { fontSize: 24 },
  gymInfo: { flex: 1 },
  gymName: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 3 },
  gymAddress: { fontSize: 12, color: '#888', marginBottom: 4 },
  gymMeta: { flexDirection: 'row', gap: 8 },
  gymMetaText: { fontSize: 11, color: '#666' },
  chevron: { fontSize: 22, color: '#CCC', fontWeight: '300' },

  // Detail view
  detailContainer: { flex: 1, backgroundColor: '#F5F5F5' },
  detailHeader: {
    backgroundColor: '#FFF', paddingTop: 48, paddingBottom: 12,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  backBtn: { width: 60 },
  backBtnText: { fontSize: 16, color: PRIMARY, fontWeight: '600' },
  detailTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#222', textAlign: 'center' },

  gymDetailInfo: {
    backgroundColor: '#FFF', padding: 16, margin: 12, borderRadius: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3,
  },
  gymDetailAddress: { fontSize: 14, color: '#444', marginBottom: 6 },
  gymDetailRow: { fontSize: 13, color: '#666', marginBottom: 4 },
  gymDetailDesc: { fontSize: 13, color: '#666', marginTop: 8, lineHeight: 20 },

  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#555', marginHorizontal: 16, marginBottom: 6 },

  problemCard: {
    backgroundColor: '#FFF', marginHorizontal: 12, marginVertical: 4,
    borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'flex-start',
  },
  difficultyBadge: {
    width: 48, height: 48, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  difficultyText: { color: '#FFF', fontWeight: '700', fontSize: 11 },
  problemInfo: { flex: 1 },
  problemName: { fontSize: 14, fontWeight: '600', color: '#222', marginBottom: 2 },
  problemSetter: { fontSize: 12, color: '#888', marginBottom: 2 },
  problemDesc: { fontSize: 12, color: '#666', lineHeight: 17 },
  problemStats: { alignItems: 'flex-end' },
  problemStat: { fontSize: 12, color: '#999' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyContainer: { flex: 1 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#444', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 40 },

  emptySmall: { padding: 20, alignItems: 'center' },
  emptySmallText: { fontSize: 14, color: '#999' },
});
