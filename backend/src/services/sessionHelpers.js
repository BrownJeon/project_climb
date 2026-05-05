/**
 * 통합 세션 엔드포인트(POST /api/sessions)와 단독 컨트롤러가 공유하는 검증·차감 헬퍼.
 */
const { GymPass, ArRoute } = require('../models');

function ApiError(status, message) {
  const e = new Error(message);
  e.statusCode = status;
  return e;
}

/**
 * 이용권 입력 정합성 (정확히 하나만 truthy)
 *  - gym_pass_id: number|undefined
 *  - used_day_pass: boolean|undefined
 *  required=true이면 둘 다 비어있을 때도 400
 */
function validatePassXor(gymPassId, usedDayPass, { required = false } = {}) {
  const hasGym = gymPassId !== undefined && gymPassId !== null && gymPassId !== '';
  const hasDay = usedDayPass === true || usedDayPass === 'true';
  if (hasGym && hasDay) throw ApiError(400, '이용권 종류는 한 가지만 선택');
  if (required && !hasGym && !hasDay) throw ApiError(400, '이용권을 선택하세요');
  return { hasGym, hasDay };
}

/** 본인 소유·암장 일치·만료/유효기간 검증. 통과 시 pass 인스턴스 반환 */
async function loadAndValidatePass(gymPassId, gymId, visitedAt, userId, t) {
  const pass = await GymPass.findByPk(gymPassId, { transaction: t });
  if (!pass) throw ApiError(404, '이용권 없음');
  if (Number(pass.user_id) !== Number(userId)) throw ApiError(403, '이용권 권한 없음');
  if (Number(pass.gym_id) !== Number(gymId)) throw ApiError(400, '다른 암장의 이용권은 사용할 수 없습니다.');
  if (pass.pass_type === 'count') {
    if (pass.remaining_count <= 0) throw ApiError(400, '이용권 잔여 횟수가 없습니다.');
    if (pass.end_date) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const ed = new Date(pass.end_date); ed.setHours(0, 0, 0, 0);
      if (ed < today) throw ApiError(400, '이용권이 만료되었습니다.');
    }
  } else if (pass.pass_type === 'period') {
    const v = new Date(visitedAt);
    if (new Date(pass.start_date) > v || new Date(pass.end_date) < v) {
      throw ApiError(400, '정기권 유효 기간 외입니다.');
    }
  }
  return pass;
}

async function decrementCountPassIfNeeded(pass, t) {
  if (pass && pass.pass_type === 'count') {
    pass.remaining_count = pass.remaining_count - 1;
    await pass.save({ transaction: t });
  }
}

async function validateArRouteOwnership(arRouteId, userId, gymId, t) {
  const ar = await ArRoute.findByPk(arRouteId, { transaction: t });
  if (!ar) throw ApiError(400, '연결할 영상이 존재하지 않습니다.');
  if (Number(ar.user_id) !== Number(userId)) throw ApiError(403, '본인 영상이 아닙니다.');
  return ar;
}

function validateAttemptsRow(row, idx) {
  const idCount = [row.problem_id, row.new_problem, row.custom_level || row.custom_color]
    .filter((v) => v !== undefined && v !== null && v !== '').length;
  // problem_id|new_problem|custom_* 중 정확히 1
  // 단, custom은 level+color 둘 다 있어도 1개 그룹으로 취급 (loose check)
  if (idCount === 0) throw ApiError(400, `attempts[${idx}] 문제 식별자가 없습니다.`);
  if (row.attempts !== undefined && (Number(row.attempts) < 1 || !Number.isInteger(Number(row.attempts)))) {
    throw ApiError(400, `attempts[${idx}].attempts는 1 이상의 정수여야 합니다.`);
  }
}

module.exports = {
  ApiError,
  validatePassXor,
  loadAndValidatePass,
  decrementCountPassIfNeeded,
  validateArRouteOwnership,
  validateAttemptsRow,
};
