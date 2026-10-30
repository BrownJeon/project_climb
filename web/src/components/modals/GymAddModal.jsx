import { useState } from 'react';
import { Btn } from '../atoms';
import MapPicker from '../MapPicker';
import { gymsApi } from '../../api/gyms';
import useBackHandler from '../../native/useBackHandler';

export default function GymAddModal({ gym, onClose, onSaved }) {
  useBackHandler(true, onClose);
  const isEdit = !!gym;
  const [brand, setBrand] = useState(gym?.brand || '');
  const [branch, setBranch] = useState(gym?.branch || '');
  const [address, setAddress] = useState(gym?.address || '');
  const [lat, setLat] = useState(gym?.lat != null ? Number(gym.lat) : null);
  const [lng, setLng] = useState(gym?.lng != null ? Number(gym.lng) : null);
  const [hours, setHours] = useState(gym?.hours || '');
  const [priceInfo, setPriceInfo] = useState(gym?.price_info || '');
  const [phone, setPhone] = useState(gym?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = !!brand.trim();

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const body = {
        brand: brand.trim(),
        branch: branch.trim() || null,
        address: address.trim() || null,
        lat: lat ?? null,
        lng: lng ?? null,
        hours: hours.trim() || null,
        price_info: priceInfo.trim() || null,
        phone: phone.trim() || null,
      };
      const res = isEdit
        ? await gymsApi.update(gym.id, body)
        : await gymsApi.create(body);
      onSaved?.(res.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || '저장 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 300,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w)', maxHeight: '90%',
          borderRadius: '24px 24px 0 0', overflow: 'auto',
          display: 'flex', flexDirection: 'column',
          animation: 'sheetUp 280ms cubic-bezier(.32,.72,0,1)',
        }}
      >
        <div style={{
          padding: '12px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', borderBottom: '1px solid var(--line)',
          position: 'sticky', top: 0, zIndex: 2,
        }}>
          <button
            onClick={submit} disabled={!canSubmit || submitting}
            style={{ fontSize: 14, fontWeight: 700, color: canSubmit ? 'var(--primary)' : 'var(--ink-4)' }}
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{isEdit ? '암장 수정' : '새 암장 등록'}</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && (
          <div style={{ padding: '10px 16px', background: 'var(--danger)', color: '#fff', fontSize: 12 }}>{error}</div>
        )}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="암장명 (브랜드)" required>
            <input
              value={brand} onChange={(e) => setBrand(e.target.value)}
              placeholder="예: 더클라임"
              style={inputStyle}
            />
          </Field>
          <Field label="지점">
            <input
              value={branch} onChange={(e) => setBranch(e.target.value)}
              placeholder="예: 강남점"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
              지점이 같은 브랜드의 이용권은 모든 지점에서 사용됩니다.
            </div>
          </Field>
          <Field label="위치 검색">
            <MapPicker
              value={{ address, lat, lng }}
              defaultQuery={[brand.trim(), branch.trim()].filter(Boolean).join(' ')}
              onChange={(p) => {
                if (p.address !== undefined) setAddress(p.address || '');
                if (p.lat != null) setLat(p.lat);
                if (p.lng != null) setLng(p.lng);
                if (p.phone !== undefined && p.phone) setPhone(p.phone);
                if (p.hours !== undefined && p.hours) setHours(p.hours);
                if (p.price_info !== undefined && p.price_info) setPriceInfo(p.price_info);
              }}
            />
            {address && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                📍 {address}
                {lat != null && lng != null && (
                  <span className="tabnum" style={{ marginLeft: 6, color: 'var(--ink-4)' }}>
                    ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})
                  </span>
                )}
              </div>
            )}
          </Field>
          <Field label="영업시간">
            <input
              value={hours} onChange={(e) => setHours(e.target.value)}
              placeholder="예: 평일 10:00-23:00 / 주말 10:00-22:00"
              style={inputStyle}
            />
          </Field>
          <Field label="가격 정보">
            <input
              value={priceInfo} onChange={(e) => setPriceInfo(e.target.value)}
              placeholder="예: 일일 20,000원 / 정기권 150,000원"
              style={inputStyle}
            />
          </Field>
          <Field label="전화번호">
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="예: 02-1234-5678"
              style={inputStyle}
            />
          </Field>

          <div style={{ marginTop: 6 }}>
            <Btn full disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? '저장 중...' : (isEdit ? '저장' : '등록')}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--ink-1)', outline: 'none',
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
