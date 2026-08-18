import { useEffect, useRef, useState } from 'react';
import { Btn, ColorBadge } from '../atoms';
import { I } from '../atoms/Icons';
import { COLOR_KEYS, COLORS } from '../../utils/colors';
import { usersApi } from '../../api/users';
import { gymsApi } from '../../api/gyms';
import { useAuth } from '../../contexts/AuthContext';
import { VIDEO_QUALITY_PRESETS, getVideoQualityKey, setVideoQualityKey } from '../../utils/videoQuality';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

export default function ProfileEditModal({ user, onClose, onSaved }) {
  const { authLogout } = useAuth();
  const [nickname, setNickname] = useState(user.nickname || '');
  const [bio, setBio] = useState(user.bio || '');
  const [climbingStartedAt, setClimbingStartedAt] = useState(user.climbing_started_at || '');
  const [maxLevelColor, setMaxLevelColor] = useState(user.max_level_color || '');
  const [maxLevelGrade, setMaxLevelGrade] = useState(user.max_level_grade || '');
  const [mainGyms, setMainGyms] = useState(user.main_gyms || []);
  const [allGyms, setAllGyms] = useState([]);
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState(user.profile_image || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showGymPicker, setShowGymPicker] = useState(false);
  const [videoQuality, setVideoQualityState] = useState(getVideoQualityKey);
  const fileRef = useRef(null);

  useEffect(() => {
    gymsApi.list({ limit: 200 }).then((r) => setAllGyms(r.data?.gyms || [])).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (profilePreview && profilePreview.startsWith('blob:')) URL.revokeObjectURL(profilePreview);
  }, [profilePreview]);

  function toggleMainGym(gym) {
    setMainGyms((prev) => prev.find((g) => g.id === gym.id)
      ? prev.filter((g) => g.id !== gym.id)
      : [...prev, { id: gym.id, name: gym.name }]);
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('이미지는 5MB 이하만 업로드할 수 있습니다.');
      return;
    }
    setError(null);
    setProfileFile(f);
    if (profilePreview && profilePreview.startsWith('blob:')) URL.revokeObjectURL(profilePreview);
    setProfilePreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (submitting || !nickname.trim()) return;
    setError(null); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('nickname', nickname.trim());
      fd.append('bio', bio || '');
      fd.append('climbing_started_at', climbingStartedAt || '');
      fd.append('max_level_color', maxLevelColor || '');
      fd.append('max_level_grade', maxLevelGrade || '');
      fd.append('main_gym_ids', JSON.stringify(mainGyms.map((g) => g.id)));
      if (profileFile) fd.append('profile_image', profileFile);
      const res = await usersApi.updateMe(fd);
      onSaved?.(res.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || '저장 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div style={headerStyle}>
          <button onClick={submit} disabled={!nickname.trim() || submitting}
            style={{ fontSize: 14, fontWeight: 700, color: nickname.trim() ? 'var(--primary)' : 'var(--ink-4)' }}>
            {submitting ? '저장 중...' : '저장'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>프로필 편집</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="프로필 사진">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: profilePreview
                  ? `url("${profilePreview}") center/cover`
                  : 'linear-gradient(135deg, var(--primary), oklch(58% 0.18 28))',
                color: '#fff', fontSize: 26, fontWeight: 800,
                display: 'grid', placeItems: 'center',
                border: '1px solid var(--line)',
                overflow: 'hidden',
              }}>
                {!profilePreview && (nickname?.[0] || '나')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={pickFile}
                  style={{ display: 'none' }}
                />
                <Btn variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  사진 변경
                </Btn>
                {(profileFile || profilePreview) && (
                  <button type="button" onClick={() => {
                    if (profilePreview && profilePreview.startsWith('blob:')) URL.revokeObjectURL(profilePreview);
                    setProfileFile(null);
                    setProfilePreview('');
                    if (fileRef.current) fileRef.current.value = '';
                  }} style={{
                    fontSize: 11, color: 'var(--ink-3)', background: 'transparent', padding: 4,
                  }}>제거</button>
                )}
              </div>
            </div>
          </Field>

          <Field label="닉네임" required>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="자기소개">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="간단한 자기소개"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          <Field label="클라이밍 시작일">
            <input type="date" value={climbingStartedAt || ''}
              onChange={(e) => setClimbingStartedAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)} style={inputStyle} />
          </Field>

          <Field label="최고 레벨">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>색상</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLOR_KEYS.map((k) => (
                  <button key={k} type="button" onClick={() => setMaxLevelColor(k === maxLevelColor ? '' : k)}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: COLORS[k].dot,
                      border: maxLevelColor === k ? '2.5px solid var(--ink-1)' : '1.5px solid var(--line-2)',
                      cursor: 'pointer',
                    }} title={COLORS[k].label} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>V등급 (선택)</div>
              <select value={maxLevelGrade} onChange={(e) => setMaxLevelGrade(e.target.value)} style={inputStyle}>
                <option value="">선택 안함</option>
                {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              {(maxLevelColor || maxLevelGrade) && (
                <div style={{ marginTop: 4 }}>
                  <ColorBadge color={maxLevelColor} level={maxLevelGrade} size="sm" />
                </div>
              )}
            </div>
          </Field>

          <Field label="주 암장 (복수 선택)">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {mainGyms.map((g) => (
                <span key={g.id} style={chipStyle}>
                  {g.name}
                  <button type="button" onClick={() => setMainGyms((prev) => prev.filter((x) => x.id !== g.id))}
                    style={{ marginLeft: 4, color: 'var(--ink-3)' }}>×</button>
                </span>
              ))}
              {mainGyms.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>선택된 암장 없음</span>
              )}
            </div>
            <Btn variant="ghost" size="sm" icon={I.plus(13)} onClick={() => setShowGymPicker(true)}>
              암장 추가
            </Btn>
            {showGymPicker && (
              <div style={{
                marginTop: 8, maxHeight: 240, overflow: 'auto',
                border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                background: 'var(--surface)',
              }}>
                {allGyms.map((g) => {
                  const selected = !!mainGyms.find((x) => x.id === g.id);
                  return (
                    <button key={g.id} type="button" onClick={() => toggleMainGym(g)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 12px', fontSize: 13,
                        color: selected ? 'var(--primary)' : 'var(--ink-1)',
                        fontWeight: selected ? 700 : 500,
                        borderBottom: '1px solid var(--line)',
                        background: 'transparent',
                      }}>
                      {selected ? '✓ ' : ''}{g.name}
                    </button>
                  );
                })}
                <div style={{ padding: 6, textAlign: 'center' }}>
                  <Btn variant="ghost" size="sm" onClick={() => setShowGymPicker(false)}>닫기</Btn>
                </div>
              </div>
            )}
          </Field>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>영상 업로드 화질</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  {VIDEO_QUALITY_PRESETS.find((p) => p.key === videoQuality)?.desc || ''}
                </div>
              </div>
              <select
                value={videoQuality}
                onChange={(e) => {
                  setVideoQualityKey(e.target.value);
                  setVideoQualityState(e.target.value);
                }}
                style={{
                  padding: '7px 10px', fontSize: 13, borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)', background: 'var(--surface-2)',
                  color: 'var(--ink-1)',
                }}
              >
                {VIDEO_QUALITY_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { if (confirm('로그아웃 하시겠습니까?')) { authLogout(); onClose(); } }}
              style={{
                width: '100%', padding: '11px', marginTop: 28,
                fontSize: 14, fontWeight: 600, color: 'var(--danger)',
                border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)',
                background: 'var(--surface)', cursor: 'pointer',
              }}>
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300,
};
const sheetStyle = {
  background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w)', maxHeight: '90%',
  borderRadius: '24px 24px 0 0', overflow: 'auto',
  display: 'flex', flexDirection: 'column',
  animation: 'sheetUp 280ms cubic-bezier(.32,.72,0,1)',
};
const headerStyle = {
  padding: '12px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'var(--surface)', borderBottom: '1px solid var(--line)',
  position: 'sticky', top: 0, zIndex: 2,
};
const errorStyle = { padding: '10px 16px', background: 'var(--danger)', color: '#fff', fontSize: 12 };
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--ink-1)', outline: 'none',
};
const chipStyle = {
  display: 'inline-flex', alignItems: 'center',
  fontSize: 12, padding: '5px 10px', borderRadius: 'var(--r-pill)',
  background: 'var(--primary-soft)', color: 'var(--ink-1)',
  border: '1px solid var(--primary-line)', fontWeight: 600,
};

function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
