import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import useAuthStore from '../store/authStore';
import { getLogDates, getLogsByDate, createClimbLog, deleteClimbLog } from '../api/climbLogs';
import { listGyms } from '../api/gyms';

const PRIMARY = '#2D6A4F';
const today = new Date().toISOString().slice(0, 10);

// ─── 기록 카드 ────────────────────────────────────────────
function DayLogCard({ log, onDelete }) {
  return (
    <View style={styles.logCard}>
      <View style={styles.logCardHeader}>
        <View>
          <Text style={styles.logGymName}>{log.gym_name}</Text>
          {log.gym_address ? (
            <Text style={styles.logGymAddr} numberOfLines={1}>{log.gym_address}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => onDelete(log.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>삭제</Text>
        </TouchableOpacity>
      </View>

      {log.problems.length > 0 && (
        <View style={styles.problemTagRow}>
          {log.problems.map((p, idx) => (
            <View
              key={idx}
              style={[styles.problemTag, p.is_cleared ? styles.problemTagCleared : styles.problemTagFailed]}
            >
              <Text style={styles.problemTagText}>
                {p.level || '?'}{p.color ? ` ${p.color}` : ''}{p.is_cleared ? ' ✓' : ' ✗'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {log.memo ? <Text style={styles.logMemo}>📝 {log.memo}</Text> : null}
    </View>
  );
}

// ─── 문제 입력 행 ──────────────────────────────────────────
function ProblemRow({ problem, onChange, onRemove }) {
  return (
    <View style={styles.problemRow}>
      <TextInput
        style={[styles.problemInput, { flex: 2 }]}
        placeholder="난이도 (V3, 빨강…)"
        value={problem.custom_level}
        onChangeText={(v) => onChange({ ...problem, custom_level: v })}
        placeholderTextColor="#AAA"
      />
      <TextInput
        style={[styles.problemInput, { flex: 2, marginLeft: 6 }]}
        placeholder="색상 (선택)"
        value={problem.custom_color}
        onChangeText={(v) => onChange({ ...problem, custom_color: v })}
        placeholderTextColor="#AAA"
      />
      <TouchableOpacity
        style={[styles.clearedToggle, problem.is_cleared && styles.clearedToggleOn]}
        onPress={() => onChange({ ...problem, is_cleared: !problem.is_cleared })}
      >
        <Text style={styles.clearedToggleText}>{problem.is_cleared ? '완등' : '실패'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRemove} style={styles.removeProblemBtn}>
        <Text style={styles.removeProblemText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── 기록 추가 모달 ────────────────────────────────────────
function AddLogModal({ visible, defaultDate, onClose, onSaved }) {
  const [gyms, setGyms] = useState([]);
  const [selectedGym, setSelectedGym] = useState(null);
  const [gymSearch, setGymSearch] = useState('');
  const [visitedAt, setVisitedAt] = useState(defaultDate || today);
  const [memo, setMemo] = useState('');
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('gym'); // 'gym' | 'detail'

  useEffect(() => {
    if (!visible) return;
    setStep('gym');
    setSelectedGym(null);
    setGymSearch('');
    setVisitedAt(defaultDate || today);
    setMemo('');
    setProblems([]);
    listGyms().then((res) => setGyms(res.data || [])).catch(() => {});
  }, [visible, defaultDate]);

  const filteredGyms = gyms.filter((g) =>
    g.name.includes(gymSearch) || (g.address || '').includes(gymSearch)
  );

  const addProblem = () =>
    setProblems((prev) => [...prev, { custom_level: '', custom_color: '', is_cleared: true }]);

  const handleSave = async () => {
    if (!selectedGym) return Alert.alert('알림', '암장을 선택해주세요.');
    if (!visitedAt) return Alert.alert('알림', '날짜를 입력해주세요.');
    setSaving(true);
    try {
      const body = {
        gym_id: selectedGym.id,
        visited_at: visitedAt,
        memo: memo.trim() || undefined,
        problems: problems.filter((p) => p.custom_level.trim()),
      };
      const res = await createClimbLog(body);
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
            <Text style={styles.modalTitle}>기록 추가</Text>
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
                style={{ maxHeight: 320 }}
              />
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* 선택된 암장 */}
              <TouchableOpacity style={styles.selectedGymRow} onPress={() => setStep('gym')}>
                <Text style={styles.selectedGymName}>{selectedGym.name}</Text>
                <Text style={styles.changeText}>변경</Text>
              </TouchableOpacity>

              {/* 날짜 */}
              <Text style={styles.inputLabel}>방문 날짜</Text>
              <TextInput
                style={styles.textInput}
                value={visitedAt}
                onChangeText={setVisitedAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#AAA"
              />

              {/* 메모 */}
              <Text style={styles.inputLabel}>메모 (선택)</Text>
              <TextInput
                style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
                value={memo}
                onChangeText={setMemo}
                placeholder="오늘 클라이밍 기록을 남겨보세요"
                multiline
                placeholderTextColor="#AAA"
              />

              {/* 문제 */}
              <View style={styles.problemsHeader}>
                <Text style={styles.inputLabel}>푼 문제</Text>
                <TouchableOpacity onPress={addProblem} style={styles.addProblemBtn}>
                  <Text style={styles.addProblemText}>+ 추가</Text>
                </TouchableOpacity>
              </View>
              {problems.map((p, idx) => (
                <ProblemRow
                  key={idx}
                  problem={p}
                  onChange={(updated) =>
                    setProblems((prev) => prev.map((x, i) => (i === idx ? updated : x)))
                  }
                  onRemove={() => setProblems((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>저장</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── 메인 화면 ─────────────────────────────────────────────
export default function ClimbLogScreen() {
  const { isGuest } = useAuthStore();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [markedDates, setMarkedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayLogs, setDayLogs] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // 월별 방문 날짜 dot 로드
  const loadMarkedDates = useCallback(async (year, month) => {
    if (isGuest) return;
    setDatesLoading(true);
    try {
      const res = await getLogDates(year, month);
      const dates = res.data?.dates || [];
      const marks = {};
      dates.forEach((d) => {
        marks[d] = { marked: true, dotColor: PRIMARY };
      });
      setMarkedDates(marks);
    } catch (e) {
      // 네트워크 오류는 조용히 처리
    } finally {
      setDatesLoading(false);
    }
  }, [isGuest]);

  // 날짜별 기록 상세 로드
  const loadDayLogs = useCallback(async (date) => {
    if (isGuest) return;
    setLogsLoading(true);
    try {
      const res = await getLogsByDate(date);
      setDayLogs(res.data?.logs || []);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setLogsLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    loadMarkedDates(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  useEffect(() => {
    loadDayLogs(selectedDate);
  }, [selectedDate]);

  const handleMonthChange = (month) => {
    setCurrentYear(month.year);
    setCurrentMonth(month.month);
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const handleDelete = (id) => {
    Alert.alert('기록 삭제', '이 기록을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClimbLog(id);
            setDayLogs((prev) => prev.filter((l) => l.id !== id));
            // 남은 기록이 없으면 dot 제거
            setDayLogs((prev) => {
              if (prev.length === 0) {
                setMarkedDates((m) => {
                  const updated = { ...m };
                  delete updated[selectedDate];
                  return updated;
                });
              }
              return prev;
            });
          } catch (e) {
            Alert.alert('오류', e.message);
          }
        },
      },
    ]);
  };

  const handleSaved = (newLog) => {
    // dot 마커 추가
    setMarkedDates((prev) => ({
      ...prev,
      [newLog.visited_at]: { marked: true, dotColor: PRIMARY },
    }));
    // 선택된 날짜와 같으면 목록에 추가
    if (newLog.visited_at === selectedDate) {
      setDayLogs((prev) => [newLog, ...prev]);
    }
  };

  const calendarMarked = {
    ...markedDates,
    [selectedDate]: {
      selected: true,
      selectedColor: PRIMARY,
      marked: !!markedDates[selectedDate],
      dotColor: '#FFF',
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록</Text>
        {datesLoading && <ActivityIndicator size="small" color={PRIMARY} />}
      </View>

      {isGuest ? (
        <View style={styles.guestContainer}>
          <Text style={styles.guestIcon}>📅</Text>
          <Text style={styles.guestTitle}>로그인이 필요해요</Text>
          <Text style={styles.guestDesc}>로그인하면 암장 방문 기록을 캘린더에서 관리할 수 있어요</Text>
        </View>
      ) : (
        <>
          <Calendar
            current={`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`}
            onDayPress={handleDayPress}
            onMonthChange={handleMonthChange}
            markedDates={calendarMarked}
            markingType="dot"
            theme={{
              selectedDayBackgroundColor: PRIMARY,
              todayTextColor: PRIMARY,
              arrowColor: PRIMARY,
              dotColor: PRIMARY,
              selectedDotColor: '#FFF',
              textMonthFontWeight: '700',
              textDayFontSize: 14,
            }}
            style={styles.calendar}
          />

          <View style={styles.daySection}>
            <Text style={styles.daySectionTitle}>
              {selectedDate} 기록
              {logsLoading && <ActivityIndicator size="small" color={PRIMARY} style={{ marginLeft: 8 }} />}
            </Text>
          </View>

          <FlatList
            data={dayLogs}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <DayLogCard log={item} onDelete={handleDelete} />
            )}
            ListEmptyComponent={
              !logsLoading && (
                <View style={styles.dayEmpty}>
                  <Text style={styles.dayEmptyText}>이 날의 기록이 없어요</Text>
                </View>
              )
            }
            contentContainerStyle={{ paddingBottom: 100 }}
          />

          {/* FAB */}
          <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>

          <AddLogModal
            visible={modalVisible}
            defaultDate={selectedDate}
            onClose={() => setModalVisible(false)}
            onSaved={handleSaved}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    backgroundColor: '#FFF',
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

  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  daySection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  daySectionTitle: { fontSize: 14, fontWeight: '600', color: '#555' },

  // 기록 카드
  logCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 12,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  logGymName: { fontSize: 15, fontWeight: '700', color: '#222' },
  logGymAddr: { fontSize: 12, color: '#888', marginTop: 2, maxWidth: 220 },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtnText: { fontSize: 12, color: '#E53935' },
  problemTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  problemTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  problemTagCleared: { backgroundColor: PRIMARY },
  problemTagFailed: { backgroundColor: '#EF9A9A' },
  problemTagText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  logMemo: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },

  dayEmpty: { padding: 30, alignItems: 'center' },
  dayEmptyText: { fontSize: 14, color: '#999' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#FFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },

  // 비회원
  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  guestIcon: { fontSize: 56, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  guestDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 34,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  modalCancel: { fontSize: 15, color: '#888' },

  // 암장 선택 단계
  gymSearchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  gymPickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  gymPickerName: { fontSize: 14, fontWeight: '600', color: '#222', marginBottom: 2 },
  gymPickerAddr: { fontSize: 12, color: '#888' },
  gymPickerEmpty: { textAlign: 'center', color: '#999', padding: 20 },

  // 기록 입력 단계
  selectedGymRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  selectedGymName: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  changeText: { fontSize: 13, color: '#888' },

  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 4 },
  textInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },

  problemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  addProblemBtn: { backgroundColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  addProblemText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  problemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  problemInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#333',
  },
  clearedToggle: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EF9A9A',
    marginLeft: 6,
  },
  clearedToggleOn: { backgroundColor: PRIMARY },
  clearedToggleText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  removeProblemBtn: { paddingHorizontal: 8, paddingVertical: 8, marginLeft: 4 },
  removeProblemText: { fontSize: 16, color: '#BBB' },

  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
