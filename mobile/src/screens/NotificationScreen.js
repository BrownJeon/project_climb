import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import useAuthStore from '../store/authStore';
import { listPasses, createPass, usePass, deletePass } from '../api/passes';
import { listGyms } from '../api/gyms';

const PRIMARY = '#2D6A4F';

const FILTER_TABS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '유효' },
  { key: 'expired', label: '만료' },
];

// ─── 이용권 카드 ───────────────────────────────────────────
function PassCard({ pass, onUse, onDelete }) {
  const expired = pass.is_expired || !pass.is_active;

  const renderBadge = () => {
    if (expired) {
      return <View style={styles.badgeExpired}><Text style={styles.badgeExpiredText}>만료됨</Text></View>;
    }
    if (pass.pass_type === 'period') {
      const d = pass.days_remaining;
      const color = d <= 3 ? '#E53935' : d <= 7 ? '#FF9800' : PRIMARY;
      return (
        <View style={[styles.badgeDday, { backgroundColor: color }]}>
          <Text style={styles.badgeDdayText}>{d === 0 ? 'D-day' : d > 0 ? `D-${d}` : `만료`}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.passCard, expired && styles.passCardExpired]}>
      <View style={styles.passCardTop}>
        <View style={styles.passCardLeft}>
          <Text style={[styles.passGymName, expired && styles.textFaded]}>{pass.gym_name}</Text>
          <Text style={[styles.passLabel, expired && styles.textFaded]}>
            {pass.label || (pass.pass_type === 'period' ? '정기권' : '횟수권')}
          </Text>
        </View>
        {renderBadge()}
      </View>

      {pass.pass_type === 'period' ? (
        <Text style={[styles.passDetail, expired && styles.textFaded]}>
          {pass.start_date} ~ {pass.end_date}
        </Text>
      ) : (
        <View style={styles.countRow}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.max(0, (pass.remaining_count / pass.total_count) * 100)}%`,
                  backgroundColor: expired ? '#CCC' : PRIMARY,
                },
              ]}
            />
          </View>
          <Text style={[styles.countText, expired && styles.textFaded]}>
            {pass.remaining_count}/{pass.total_count}회
          </Text>
        </View>
      )}

      <View style={styles.passActions}>
        {pass.pass_type === 'count' && !expired && (
          <TouchableOpacity style={styles.useBtn} onPress={() => onUse(pass)}>
            <Text style={styles.useBtnText}>1회 사용</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deletePassBtn} onPress={() => onDelete(pass.id)}>
          <Text style={styles.deletePassText}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 이용권 등록 모달 ──────────────────────────────────────
function AddPassModal({ visible, onClose, onSaved }) {
  const [gyms, setGyms] = useState([]);
  const [gymSearch, setGymSearch] = useState('');
  const [selectedGym, setSelectedGym] = useState(null);
  const [passType, setPassType] = useState('period');
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalCount, setTotalCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('gym');

  useEffect(() => {
    if (!visible) return;
    setStep('gym');
    setSelectedGym(null);
    setGymSearch('');
    setPassType('period');
    setLabel('');
    setStartDate('');
    setEndDate('');
    setTotalCount('');
    listGyms().then((res) => setGyms(res.data || [])).catch(() => {});
  }, [visible]);

  const filteredGyms = gyms.filter((g) =>
    g.name.includes(gymSearch) || (g.address || '').includes(gymSearch)
  );

  const handleSave = async () => {
    if (!selectedGym) return Alert.alert('알림', '암장을 선택해주세요.');
    if (passType === 'period' && (!startDate || !endDate)) {
      return Alert.alert('알림', '시작일과 만료일을 입력해주세요.');
    }
    if (passType === 'count' && (!totalCount || isNaN(Number(totalCount)) || Number(totalCount) < 1)) {
      return Alert.alert('알림', '유효한 횟수를 입력해주세요.');
    }

    setSaving(true);
    try {
      const body = {
        gym_id: selectedGym.id,
        pass_type: passType,
        label: label.trim() || undefined,
        ...(passType === 'period'
          ? { start_date: startDate, end_date: endDate }
          : { total_count: Number(totalCount) }),
      };
      const res = await createPass(body);
      onSaved(res.data);
      onClose();
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>이용권 등록</Text>
            <View style={{ width: 40 }} />
          </View>

          {step === 'gym' ? (
            <>
              <TextInput
                style={styles.gymSearchInput}
                placeholder="암장 이름 또는 지역 검색"
                value={gymSearch}
                onChangeText={setGymSearch}
                placeholderTextColor="#AAA"
              />
              <FlatList
                data={filteredGyms}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gymPickerItem}
                    onPress={() => { setSelectedGym(item); setStep('detail'); }}
                  >
                    <Text style={styles.gymPickerName}>{item.name}</Text>
                    <Text style={styles.gymPickerAddr} numberOfLines={1}>{item.address}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.gymPickerEmpty}>등록된 암장이 없어요</Text>
                }
                style={{ maxHeight: 340 }}
              />
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* 선택된 암장 */}
              <TouchableOpacity style={styles.selectedGymRow} onPress={() => setStep('gym')}>
                <Text style={styles.selectedGymName}>{selectedGym.name}</Text>
                <Text style={styles.changeText}>변경</Text>
              </TouchableOpacity>

              {/* 이용권 종류 */}
              <Text style={styles.inputLabel}>이용권 종류</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, passType === 'period' && styles.typeBtnActive]}
                  onPress={() => setPassType('period')}
                >
                  <Text style={[styles.typeBtnText, passType === 'period' && styles.typeBtnTextActive]}>
                    정기권
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, passType === 'count' && styles.typeBtnActive]}
                  onPress={() => setPassType('count')}
                >
                  <Text style={[styles.typeBtnText, passType === 'count' && styles.typeBtnTextActive]}>
                    횟수권
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 별칭 */}
              <Text style={styles.inputLabel}>별칭 (선택)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="예: 월정기권, 10회권"
                value={label}
                onChangeText={setLabel}
                placeholderTextColor="#AAA"
              />

              {passType === 'period' ? (
                <>
                  <Text style={styles.inputLabel}>시작일</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholderTextColor="#AAA"
                  />
                  <Text style={styles.inputLabel}>만료일</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholderTextColor="#AAA"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>총 횟수</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="예: 10"
                    value={totalCount}
                    onChangeText={setTotalCount}
                    keyboardType="number-pad"
                    placeholderTextColor="#AAA"
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.saveBtnText}>등록</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── 메인 화면 ─────────────────────────────────────────────
export default function GymPassScreen() {
  const { isGuest } = useAuthStore();
  const [filter, setFilter] = useState('all');
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchPasses = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await listPasses('all');
      setPasses(res.data?.passes || []);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => { fetchPasses(); }, []);

  const filtered = passes.filter((p) => {
    if (filter === 'active') return !p.is_expired && p.is_active;
    if (filter === 'expired') return p.is_expired || !p.is_active;
    return true;
  });

  const handleUse = (pass) => {
    Alert.alert(
      '이용권 사용',
      `${pass.gym_name} 이용권을 1회 사용하시겠어요?\n(잔여: ${pass.remaining_count}회)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '사용',
          onPress: async () => {
            // 낙관적 업데이트
            setPasses((prev) => prev.map((p) =>
              p.id === pass.id
                ? { ...p, remaining_count: p.remaining_count - 1, is_expired: p.remaining_count - 1 <= 0 }
                : p
            ));
            try {
              await usePass(pass.id);
            } catch (e) {
              Alert.alert('오류', e.message);
              // 롤백
              setPasses((prev) => prev.map((p) =>
                p.id === pass.id
                  ? { ...p, remaining_count: pass.remaining_count, is_expired: pass.is_expired }
                  : p
              ));
            }
          },
        },
      ]
    );
  };

  const handleDelete = (id) => {
    Alert.alert('이용권 삭제', '이 이용권을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePass(id);
            setPasses((prev) => prev.filter((p) => p.id !== id));
          } catch (e) {
            Alert.alert('오류', e.message);
          }
        },
      },
    ]);
  };

  const handleSaved = (newPass) => {
    setPasses((prev) => [newPass, ...prev]);
  };

  if (isGuest) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>이용권</Text>
        </View>
        <View style={styles.guestContainer}>
          <Text style={styles.guestIcon}>🎫</Text>
          <Text style={styles.guestTitle}>로그인이 필요해요</Text>
          <Text style={styles.guestDesc}>로그인하면 암장 이용권을 등록하고 관리할 수 있어요</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>이용권</Text>
      </View>

      {/* 필터 탭 */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <PassCard pass={item} onUse={handleUse} onDelete={handleDelete} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyText}>
                {filter === 'all' ? '등록된 이용권이 없어요' : `${filter === 'active' ? '유효한' : '만료된'} 이용권이 없어요`}
              </Text>
              {filter === 'all' && (
                <Text style={styles.emptySubText}>+ 버튼으로 이용권을 등록해보세요</Text>
              )}
            </View>
          }
          contentContainerStyle={filtered.length === 0 ? styles.emptyList : { paddingBottom: 100 }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddPassModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY },

  // 필터 탭
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  filterTabActive: { borderBottomColor: PRIMARY },
  filterTabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  filterTabTextActive: { color: PRIMARY, fontWeight: '700' },

  // 이용권 카드
  passCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  passCardExpired: { backgroundColor: '#FAFAFA', opacity: 0.75 },
  passCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  passCardLeft: { flex: 1, marginRight: 10 },
  passGymName: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 3 },
  passLabel: { fontSize: 13, color: '#666' },
  textFaded: { color: '#AAA' },

  // D-day 배지
  badgeDday: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeDdayText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  badgeExpired: {
    backgroundColor: '#E0E0E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeExpiredText: { color: '#999', fontSize: 13, fontWeight: '600' },

  // 정기권 기간
  passDetail: { fontSize: 13, color: '#666', marginBottom: 10 },

  // 횟수권 프로그레스
  countRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  progressBarBg: {
    flex: 1, height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginRight: 10, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  countText: { fontSize: 13, fontWeight: '600', color: '#444', minWidth: 50, textAlign: 'right' },

  // 액션 버튼
  passActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10 },
  useBtn: { backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  useBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  deletePassBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  deletePassText: { fontSize: 13, color: '#999' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#FFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },

  // 비회원
  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  guestIcon: { fontSize: 56, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  guestDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

  // 빈 목록
  emptyList: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#444', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#888' },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 34, maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  modalCancel: { fontSize: 15, color: '#888' },

  gymSearchInput: {
    backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: '#333', marginBottom: 8,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  gymPickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  gymPickerName: { fontSize: 14, fontWeight: '600', color: '#222', marginBottom: 2 },
  gymPickerAddr: { fontSize: 12, color: '#888' },
  gymPickerEmpty: { textAlign: 'center', color: '#999', padding: 20 },

  selectedGymRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, marginBottom: 14,
  },
  selectedGymName: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  changeText: { fontSize: 13, color: '#888' },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#FFF',
  },
  typeBtnActive: { borderColor: PRIMARY, backgroundColor: '#E8F5E9' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: '#AAA' },
  typeBtnTextActive: { color: PRIMARY },

  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 4 },
  textInput: {
    backgroundColor: '#F8F8F8', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', marginBottom: 12,
  },

  saveBtn: {
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 16, marginBottom: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
