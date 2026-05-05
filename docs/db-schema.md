# TheRoute DB 스키마 설계

**엔진:** MariaDB | **ORM:** Sequelize

---

## 테이블 목록

### users (사용자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 사용자 ID |
| sns_provider | ENUM('google','kakao') | SNS 제공자 |
| sns_id | VARCHAR(255) | SNS 고유 ID |
| email | VARCHAR(255) | 이메일 |
| nickname | VARCHAR(50) | 닉네임 |
| profile_image | VARCHAR(500) | 프로필 이미지 URL |
| bio | TEXT | 자기소개 |
| max_level | VARCHAR(20) | 최고 등반 레벨 |
| main_gym_id | BIGINT FK | 주 암장 ID |
| created_at | DATETIME | 가입일 |

### gyms (클라이밍장)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 암장 ID |
| name | VARCHAR(100) | 암장명 |
| address | VARCHAR(255) | 주소 |
| lat | DECIMAL(10,7) | 위도 |
| lng | DECIMAL(10,7) | 경도 |
| phone | VARCHAR(20) | 전화번호 |
| hours | TEXT | 영업시간 (JSON) |
| price_info | TEXT | 가격 정보 |
| created_at | DATETIME | 등록일 |

### problems (클라이밍 문제)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 문제 ID |
| gym_id | BIGINT FK | 암장 ID |
| level | VARCHAR(20) | 난이도 |
| color | VARCHAR(30) | 홀드 색상 |
| section | VARCHAR(50) | 구역 |
| created_at | DATETIME | 등록일 |

### ar_routes (AR 공략 영상)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 공략 ID |
| user_id | BIGINT FK | 작성자 ID |
| problem_id | BIGINT FK | 문제 ID |
| title | VARCHAR(200) | 제목 |
| description | TEXT | 설명 |
| video_url | VARCHAR(500) | 원본 영상 URL |
| ar_data | JSON | AR 오버레이 데이터 |
| like_count | INT | 좋아요 수 |
| view_count | INT | 조회수 |
| created_at | DATETIME | 작성일 |

### follows (팔로우 관계)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| follower_id | BIGINT FK | 팔로워 ID |
| following_id | BIGINT FK | 팔로잉 ID |
| created_at | DATETIME | 팔로우 일시 |

### likes (좋아요)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | BIGINT FK | 사용자 ID |
| ar_route_id | BIGINT FK | 공략 ID |
| created_at | DATETIME | 좋아요 일시 |

### comments (댓글)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK | 댓글 ID |
| ar_route_id | BIGINT FK | 공략 ID |
| user_id | BIGINT FK | 작성자 ID |
| content | TEXT | 댓글 내용 |
| created_at | DATETIME | 작성일 |

### bookmarks (스크랩)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | BIGINT FK | 사용자 ID |
| ar_route_id | BIGINT FK | 공략 ID |
| created_at | DATETIME | 스크랩 일시 |
