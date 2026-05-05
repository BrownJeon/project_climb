const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const c = require('../controllers/trainingController');

const router = Router();

// 목표
router.get('/goals', optionalAuth, c.listGoals);
router.post('/goals', optionalAuth, c.createGoal);
router.patch('/goals/:id', optionalAuth, c.updateGoal);
router.delete('/goals/:id', optionalAuth, c.deleteGoal);

// 훈련 세션 (자동 합성 포함)
router.get('/sessions', optionalAuth, c.listSessions);
router.post('/sessions', optionalAuth, c.createSession);          // 호환용 (deprecated)
router.patch('/sessions/:id', optionalAuth, c.updateSession);
router.delete('/sessions/:id', optionalAuth, c.deleteSession);

// 분석 (Claude CLI 2단계)
router.post('/analyze', optionalAuth, c.analyze);
router.get('/analyses', optionalAuth, c.listAnalyses);
router.get('/analyses/:id', optionalAuth, c.getAnalysis);
router.delete('/analyses/:id', optionalAuth, c.deleteAnalysis);

// 메타 프롬프트 템플릿 조회 (운영자 보조)
router.get('/prompt-templates', optionalAuth, c.listTemplates);

module.exports = router;
