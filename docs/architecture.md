# TheRoute 아키텍처 설계

## 전체 구조

```
[React Native App]
       ↓ HTTPS
[Express API Server]
       ↓
[MariaDB on NAS] + [Media Storage]
```

## API 엔드포인트 계획 (MVP)

### 인증
- `POST /api/auth/sns` - SNS 로그인
- `POST /api/auth/refresh` - 토큰 갱신

### 사용자
- `GET /api/users/:id` - 프로필 조회
- `PUT /api/users/me` - 내 프로필 수정
- `POST /api/users/:id/follow` - 팔로우
- `DELETE /api/users/:id/follow` - 언팔로우

### 클라이밍장
- `GET /api/gyms` - 암장 목록 (위치 기반)
- `GET /api/gyms/:id` - 암장 상세
- `GET /api/gyms/:id/problems` - 암장 문제 목록

### AR 공략
- `GET /api/routes` - 공략 목록 (피드)
- `POST /api/routes` - 공략 등록
- `GET /api/routes/:id` - 공략 상세
- `POST /api/routes/:id/like` - 좋아요
- `POST /api/routes/:id/bookmark` - 스크랩
- `POST /api/routes/:id/comments` - 댓글 작성

### 피드
- `GET /api/feed` - 팔로우 피드

## 응답 포맷

```json
{
  "success": true,
  "data": { ... },
  "message": "성공"
}
```

## AR 데이터 구조 (ar_data JSON)

```json
{
  "version": "1.0",
  "duration": 30,
  "frames": [
    {
      "time": 1.2,
      "type": "hand",
      "position": { "x": 0.3, "y": 0.5 },
      "order": 1,
      "color": "#FF0000"
    }
  ]
}
```
