const { Op } = require('sequelize');
const {
  TrainingGoal, TrainingSession, TrainingSessionItem,
  TrainingPromptTemplate, TrainingAnalysis,
  ClimbLog, ClimbLogProblem, Problem, Gym,
} = require('../models');
const trainingAnalyzer = require('../services/trainingAnalyzer');

// ─────────────────── 목표 ───────────────────
async function listGoals(req, res, next) {
  try {
    const status = req.query.status;
    const where = { user_id: req.user.id };
    if (status === 'in_progress' || status === 'done' || status === 'archived') where.status = status;
    const goals = await TrainingGoal.findAll({ where, order: [['created_at', 'DESC']] });
    return res.json({ success: true, data: { goals }, message: null });
  } catch (e) { next(e); }
}

async function createGoal(req, res, next) {
  try {
    const { title, description, category, metric_label, current_metric_label, target_value, current_value, target_date, progress_percent } = req.body;
    if (!title || !category) {
      return res.status(400).json({ success: false, message: 'title과 category 필수', data: null });
    }
    const goal = await TrainingGoal.create({
      user_id: req.user.id,
      title, description, category, metric_label, current_metric_label,
      target_value, current_value, target_date,
      progress_percent: progress_percent || 0,
    });
    return res.status(201).json({ success: true, data: goal, message: '목표가 등록되었습니다.' });
  } catch (e) { next(e); }
}

async function updateGoal(req, res, next) {
  try {
    const goal = await TrainingGoal.findByPk(req.params.id);
    if (!goal) return res.status(404).json({ success: false, message: '목표 없음', data: null });
    if (Number(goal.user_id) !== Number(req.user.id))
      return res.status(403).json({ success: false, message: '권한 없음', data: null });

    const updatable = ['title','description','category','metric_label','current_metric_label','target_value','current_value','target_date','status','progress_percent'];
    const updates = {};
    for (const k of updatable) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await goal.update(updates);
    return res.json({ success: true, data: goal, message: '목표가 수정되었습니다.' });
  } catch (e) { next(e); }
}

async function deleteGoal(req, res, next) {
  try {
    const goal = await TrainingGoal.findByPk(req.params.id);
    if (!goal) return res.status(404).json({ success: false, message: '목표 없음', data: null });
    if (Number(goal.user_id) !== Number(req.user.id))
      return res.status(403).json({ success: false, message: '권한 없음', data: null });
    await goal.destroy();
    return res.json({ success: true, data: null, message: '삭제되었습니다.' });
  } catch (e) { next(e); }
}

// ─────────────────── 세션 (자동 합성 포함) ───────────────────
async function listSessions(req, res, next) {
  try {
    const userId = req.user.id;
    const from = req.query.from || new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const categoryFilter = req.query.category;

    const direct = await TrainingSession.findAll({
      where: {
        user_id: userId,
        session_date: { [Op.between]: [from, to] },
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      include: [
        { model: TrainingSessionItem, as: 'items' },
        { model: Gym, as: 'gym', attributes: ['id', 'name'] },
      ],
      order: [['session_date', 'DESC']],
    });

    const directJson = direct.map((s) => ({
      id: s.id,
      session_date: s.session_date,
      category: s.category,
      gym_id: s.gym_id,
      gym_name: s.gym?.name,
      duration_minutes: s.duration_minutes,
      memo: s.memo,
      items: s.items?.map((i) => i.toJSON()) || [],
    }));

    // climb_logs → bouldering 자동 합성 (read-time)
    let synthetic = [];
    if (!categoryFilter || categoryFilter === 'bouldering') {
      const climb = await ClimbLog.findAll({
        where: { user_id: userId, visited_at: { [Op.between]: [from, to] } },
        include: [
          { model: Gym, as: 'gym', attributes: ['id', 'name'] },
          {
            model: ClimbLogProblem, as: 'problems',
            include: [{ model: Problem, as: 'problem', attributes: ['color', 'level'], required: false }],
          },
        ],
      });
      synthetic = climb.map((cl) => ({
        id: null,
        synthetic_from_climb_log_id: cl.id,
        session_date: cl.visited_at,
        category: 'bouldering',
        gym_id: cl.gym_id,
        gym_name: cl.gym?.name,
        duration_minutes: cl.duration_minutes ?? null,
        memo: cl.memo,
        problems: (cl.problems || []).map((p) => ({
          id: p.id,
          color: p.problem?.color || p.custom_color || null,
          level: p.problem?.level || p.custom_level || null,
          is_cleared: !!p.is_cleared,
          attempts: p.attempts,
        })),
        items: (cl.problems || []).map((p) => ({
          exercise_name: `볼더링 시도 (${p.problem?.color || p.custom_color || '?'}/${p.problem?.level || p.custom_level || '?'})`,
          sets: 1,
          reps_or_seconds: p.attempts,
          metric_unit: 'count',
          notes: p.is_cleared ? '완등' : '완등 실패',
        })),
      }));
    }

    const all = [...directJson, ...synthetic].sort((a, b) =>
      new Date(b.session_date) - new Date(a.session_date)
    );

    // 카테고리별 요약
    const summary = { by_category: {}, total: { count: 0, minutes: 0 } };
    for (const s of all) {
      const cat = s.category;
      summary.by_category[cat] = summary.by_category[cat] || { count: 0, minutes: 0 };
      summary.by_category[cat].count += 1;
      summary.by_category[cat].minutes += s.duration_minutes || 0;
      summary.total.count += 1;
      summary.total.minutes += s.duration_minutes || 0;
    }

    return res.json({ success: true, data: { sessions: all, summary }, message: null });
  } catch (e) { next(e); }
}

async function createSession(req, res, next) {
  try {
    const { session_date, category, gym_id, duration_minutes, memo, items = [] } = req.body;
    if (!session_date || !category) {
      return res.status(400).json({ success: false, message: 'session_date·category 필수', data: null });
    }
    const s = await TrainingSession.create({
      user_id: req.user.id,
      session_date, category, gym_id: gym_id || null,
      duration_minutes: duration_minutes || null,
      memo: memo || null,
    });
    if (items.length) {
      await TrainingSessionItem.bulkCreate(
        items.map((it, i) => ({
          session_id: s.id,
          exercise_name: it.exercise_name,
          sets: it.sets ?? null,
          reps_or_seconds: it.reps_or_seconds ?? null,
          metric_unit: it.metric_unit ?? null,
          weight_kg: it.weight_kg ?? null,
          notes: it.notes ?? null,
          sort_order: i,
        }))
      );
    }
    const created = await TrainingSession.findByPk(s.id, { include: [{ model: TrainingSessionItem, as: 'items' }] });
    return res.status(201).json({ success: true, data: created, message: '훈련 세션이 등록되었습니다.' });
  } catch (e) { next(e); }
}

async function updateSession(req, res, next) {
  try {
    const s = await TrainingSession.findByPk(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: '세션 없음', data: null });
    if (Number(s.user_id) !== Number(req.user.id))
      return res.status(403).json({ success: false, message: '권한 없음', data: null });

    const updatable = ['session_date', 'category', 'duration_minutes', 'memo'];
    const updates = {};
    for (const k of updatable) if (req.body[k] !== undefined) updates[k] = req.body[k];
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: '수정할 항목이 없습니다.', data: null });
    }
    await s.update(updates);
    return res.json({ success: true, data: s, message: '세션이 수정되었습니다.' });
  } catch (e) { next(e); }
}

async function deleteSession(req, res, next) {
  try {
    const s = await TrainingSession.findByPk(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: '세션 없음', data: null });
    if (Number(s.user_id) !== Number(req.user.id))
      return res.status(403).json({ success: false, message: '권한 없음', data: null });
    await s.destroy();
    return res.json({ success: true, data: null, message: '삭제되었습니다.' });
  } catch (e) { next(e); }
}

// ─────────────────── 분석 (2단계 CLI) ───────────────────
function formatAnalysisRow(saved) {
  return {
    id: saved.id,
    from: saved.period_from,
    to: saved.period_to,
    perspectives: saved.perspectives,
    engine: saved.engine,
    cli_version: saved.cli_version,
    template: saved.template_key
      ? { id: saved.template_id, key: saved.template_key, version: saved.template_version }
      : null,
    stages: {
      meta: { duration_ms: saved.stage1_duration_ms },
      analysis: { duration_ms: saved.stage2_duration_ms },
    },
    duration_ms: saved.duration_ms,
    result_markdown: saved.result_markdown,
    created_at: saved.created_at,
  };
}

async function analyze(req, res, next) {
  const wantStream = (req.headers.accept || '').includes('text/event-stream');
  const { from, to, perspectives = [], extra_prompt, template_key } = req.body || {};
  if (!from || !to) {
    return res.status(400).json({ success: false, message: 'from/to 필수', data: null });
  }

  // 일일 호출 한도
  const limit = parseInt(process.env.TRAINING_ANALYZE_DAILY_LIMIT || '50', 10);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayCount = await TrainingAnalysis.count({
    where: { user_id: req.user.id, created_at: { [Op.gte]: startOfDay } },
  });
  if (todayCount >= limit) {
    return res.status(429).json({ success: false, message: '오늘 분석 호출 한도를 초과했습니다.', data: null });
  }

  try {
    const r = await trainingAnalyzer.analyze({
      user: req.user, range: { from, to }, perspectives,
      extraPrompt: extra_prompt, templateKey: template_key,
      stream: wantStream,
    });

    if (!wantStream) {
      const total = (r.stage1Ms || 0) + (r.stage2Ms || 0);
      const saved = await TrainingAnalysis.create({
        user_id: req.user.id,
        period_from: from, period_to: to,
        perspectives,
        engine: 'claude-cli',
        template_id: r.template.id,
        template_key: r.template.key,
        template_version: r.template.version,
        meta_prompt_text: r.metaPrompt,
        generated_prompt_text: r.generatedPrompt,
        result_markdown: r.result,
        stage1_duration_ms: r.stage1Ms,
        stage2_duration_ms: r.stage2Ms,
        duration_ms: total,
      });
      return res.json({ success: true, data: formatAnalysisRow(saved), message: null });
    }

    // SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: meta-ready\ndata: ${JSON.stringify({ stage1_ms: r.stage1Ms, template: { key: r.template.key, version: r.template.version } })}\n\n`);

    let acc = '';
    try {
      for await (const chunk of r.stream) {
        acc += chunk;
        res.write(`event: chunk\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
    } catch (streamErr) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: streamErr.message })}\n\n`);
      res.end();
      return;
    }

    const stage2Ms = Date.now() - r.stage2StartedAt;
    const saved = await TrainingAnalysis.create({
      user_id: req.user.id,
      period_from: from, period_to: to,
      perspectives,
      engine: 'claude-cli',
      template_id: r.template.id,
      template_key: r.template.key,
      template_version: r.template.version,
      meta_prompt_text: r.metaPrompt,
      generated_prompt_text: r.generatedPrompt,
      result_markdown: acc,
      stage1_duration_ms: r.stage1Ms,
      stage2_duration_ms: stage2Ms,
      duration_ms: r.stage1Ms + stage2Ms,
    });
    res.write(`event: done\ndata: ${JSON.stringify({ id: saved.id, stage2_ms: stage2Ms })}\n\n`);
    res.end();
  } catch (err) {
    if (err.statusCode === 503) {
      return res.status(503).json({ success: false, message: err.message === 'NO_ACTIVE_TEMPLATE' ? '활성 메타 템플릿이 없습니다.' : err.message, data: null });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.detail || err.message, data: null });
    }
    if (err.code === 'ENOENT') {
      return res.status(503).json({ success: false, message: 'Claude CLI를 사용할 수 없습니다.', data: null });
    }
    next(err);
  }
}

async function listAnalyses(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const rows = await TrainingAnalysis.findAll({
      where: { user_id: req.user.id },
      attributes: ['id', 'period_from', 'period_to', 'perspectives', 'duration_ms', 'created_at',
                   'template_key', 'template_version'],
      order: [['created_at', 'DESC']],
      limit,
    });
    const analyses = rows.map((r) => ({
      id: r.id, from: r.period_from, to: r.period_to,
      perspectives: r.perspectives,
      duration_ms: r.duration_ms,
      created_at: r.created_at,
      template: r.template_key ? { key: r.template_key, version: r.template_version } : null,
    }));
    return res.json({ success: true, data: { analyses }, message: null });
  } catch (e) { next(e); }
}

async function getAnalysis(req, res, next) {
  try {
    const row = await TrainingAnalysis.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: '분석 없음', data: null });
    if (Number(row.user_id) !== Number(req.user.id))
      return res.status(403).json({ success: false, message: '권한 없음', data: null });
    const data = formatAnalysisRow(row);
    if (req.query.include === 'raw') {
      data.meta_prompt_text = row.meta_prompt_text;
      data.generated_prompt_text = row.generated_prompt_text;
    }
    return res.json({ success: true, data, message: null });
  } catch (e) { next(e); }
}

async function deleteAnalysis(req, res, next) {
  try {
    const row = await TrainingAnalysis.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: '분석 없음', data: null });
    if (Number(row.user_id) !== Number(req.user.id))
      return res.status(403).json({ success: false, message: '권한 없음', data: null });
    await row.destroy();
    return res.json({ success: true, data: null, message: '삭제되었습니다.' });
  } catch (e) { next(e); }
}

// ─────────────────── 메타 템플릿 (운영자 보조) ───────────────────
async function listTemplates(req, res, next) {
  try {
    const includeBody = req.query.include === 'body';
    const attrs = ['id', 'key', 'name', 'description', 'version', 'is_active', 'updated_at'];
    if (includeBody) attrs.push('meta_prompt_text');
    const templates = await TrainingPromptTemplate.findAll({
      attributes: attrs,
      order: [['updated_at', 'DESC']],
    });
    return res.json({ success: true, data: { templates }, message: null });
  } catch (e) { next(e); }
}

module.exports = {
  listGoals, createGoal, updateGoal, deleteGoal,
  listSessions, createSession, updateSession, deleteSession,
  analyze, listAnalyses, getAnalysis, deleteAnalysis,
  listTemplates,
};
