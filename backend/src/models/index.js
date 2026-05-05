const { sequelize } = require('../config/database');
const User = require('./User');
const Gym = require('./Gym');
const Problem = require('./Problem');
const ArRoute = require('./ArRoute');
const Follow = require('./Follow');
const Like = require('./Like');
const Comment = require('./Comment');
const Bookmark = require('./Bookmark');
const ClimbLog = require('./ClimbLog');
const ClimbLogProblem = require('./ClimbLogProblem');
const GymPass = require('./GymPass');
const UserMainGym = require('./UserMainGym');
const TrainingGoal = require('./TrainingGoal');
const TrainingSession = require('./TrainingSession');
const TrainingSessionItem = require('./TrainingSessionItem');
const TrainingPromptTemplate = require('./TrainingPromptTemplate');
const TrainingAnalysis = require('./TrainingAnalysis');

// User - Gym (deprecated 단일 main_gym_id, 호환 유지)
User.belongsTo(Gym, { foreignKey: 'main_gym_id', as: 'mainGym' });
Gym.hasMany(User, { foreignKey: 'main_gym_id' });

// User - Gym (복수 주 암장, 신규)
User.belongsToMany(Gym, {
  through: UserMainGym,
  foreignKey: 'user_id',
  otherKey: 'gym_id',
  as: 'main_gyms',
});
Gym.belongsToMany(User, {
  through: UserMainGym,
  foreignKey: 'gym_id',
  otherKey: 'user_id',
  as: 'main_gym_users',
});

// User - 최고 레벨 기준 암장
User.belongsTo(Gym, { foreignKey: 'max_level_gym_id', as: 'max_level_gym' });

// Gym - Problem
Gym.hasMany(Problem, { foreignKey: 'gym_id', as: 'problems' });
Problem.belongsTo(Gym, { foreignKey: 'gym_id', as: 'gym' });

// Problem - ArRoute
Problem.hasMany(ArRoute, { foreignKey: 'problem_id', as: 'arRoutes' });
ArRoute.belongsTo(Problem, { foreignKey: 'problem_id', as: 'problem' });

// User - ArRoute
User.hasMany(ArRoute, { foreignKey: 'user_id', as: 'arRoutes' });
ArRoute.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// User - Follow (팔로우)
User.belongsToMany(User, {
  through: Follow,
  foreignKey: 'follower_id',
  otherKey: 'following_id',
  as: 'followings',
});
User.belongsToMany(User, {
  through: Follow,
  foreignKey: 'following_id',
  otherKey: 'follower_id',
  as: 'followers',
});

// User - ArRoute (좋아요)
User.belongsToMany(ArRoute, {
  through: Like,
  foreignKey: 'user_id',
  otherKey: 'ar_route_id',
  as: 'likedRoutes',
});
ArRoute.belongsToMany(User, {
  through: Like,
  foreignKey: 'ar_route_id',
  otherKey: 'user_id',
  as: 'likers',
});

// ArRoute - Comment
ArRoute.hasMany(Comment, { foreignKey: 'ar_route_id', as: 'comments' });
Comment.belongsTo(ArRoute, { foreignKey: 'ar_route_id' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// User - ArRoute (스크랩)
User.belongsToMany(ArRoute, {
  through: Bookmark,
  foreignKey: 'user_id',
  otherKey: 'ar_route_id',
  as: 'bookmarkedRoutes',
});
ArRoute.belongsToMany(User, {
  through: Bookmark,
  foreignKey: 'ar_route_id',
  otherKey: 'user_id',
  as: 'bookmarkers',
});

// ClimbLog - User, Gym
User.hasMany(ClimbLog, { foreignKey: 'user_id', as: 'climbLogs' });
ClimbLog.belongsTo(User, { foreignKey: 'user_id' });
Gym.hasMany(ClimbLog, { foreignKey: 'gym_id' });
ClimbLog.belongsTo(Gym, { foreignKey: 'gym_id', as: 'gym' });

// ClimbLog - ClimbLogProblem
ClimbLog.hasMany(ClimbLogProblem, { foreignKey: 'log_id', as: 'problems', onDelete: 'CASCADE' });
ClimbLogProblem.belongsTo(ClimbLog, { foreignKey: 'log_id' });
ClimbLogProblem.belongsTo(Problem, { foreignKey: 'problem_id', as: 'problem' });

// GymPass - User, Gym
User.hasMany(GymPass, { foreignKey: 'user_id', as: 'gymPasses' });
GymPass.belongsTo(User, { foreignKey: 'user_id' });
Gym.hasMany(GymPass, { foreignKey: 'gym_id' });
GymPass.belongsTo(Gym, { foreignKey: 'gym_id', as: 'gym' });

// ClimbLog - GymPass (이용권 사용)
ClimbLog.belongsTo(GymPass, { foreignKey: 'gym_pass_id', as: 'gym_pass' });

// ClimbLogProblem - ArRoute (영상 연결)
ClimbLogProblem.belongsTo(ArRoute, { foreignKey: 'ar_route_id', as: 'ar_route' });

// 훈련 도메인
User.hasMany(TrainingGoal, { foreignKey: 'user_id' });
TrainingGoal.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(TrainingSession, { foreignKey: 'user_id', as: 'trainingSessions' });
TrainingSession.belongsTo(User, { foreignKey: 'user_id' });
TrainingSession.belongsTo(Gym, { foreignKey: 'gym_id', as: 'gym' });

TrainingSession.hasMany(TrainingSessionItem, {
  foreignKey: 'session_id',
  as: 'items',
  onDelete: 'CASCADE',
});
TrainingSessionItem.belongsTo(TrainingSession, { foreignKey: 'session_id' });

User.hasMany(TrainingAnalysis, { foreignKey: 'user_id' });
TrainingAnalysis.belongsTo(User, { foreignKey: 'user_id' });
TrainingAnalysis.belongsTo(TrainingPromptTemplate, {
  foreignKey: 'template_id',
  as: 'template',
});

module.exports = {
  sequelize,
  User, Gym, Problem, ArRoute, Follow, Like, Comment, Bookmark,
  ClimbLog, ClimbLogProblem, GymPass,
  UserMainGym,
  TrainingGoal, TrainingSession, TrainingSessionItem,
  TrainingPromptTemplate, TrainingAnalysis,
};
