# BusFast Multi-Agent Workflow

## Tổng quan

Workflow này tổ chức 5 nhóm agent để phát triển BusFast app:

```
User Request
     ↓
  Leader (điều phối)
     ↓
  Content (ý tưởng) → Leader phê duyệt
     ↓
  Coder (code) → Tester (review) ← (lặp lại nếu có lỗi)
     ↓
  UI/UX (trải nghiệm) → Leader tổng hợp
     ↓
  Hoàn thành
```

## Các Agent

### 1. Leader Agent
**Vai trò**: Điều phối toàn bộ workflow
- Nhận yêu cầu từ user
- Phân công task cho các agent
- Phê duyệt concept từ Content
- Nhận kết quả từ Tester và UI/UX
- Báo cáo cuối cùng cho user

### 2. Content Agent
**Vai trò**: Lên ý tưởng và thiết kế concept
- Phối hợp với subagents để brainstorm
- Thảo luận các approach khác nhau
- Đề xuất concept cho Leader
- Chờ approval trước khi forward cho Coder
- Output: concept, approach, requirements, mockups

### 3. Coder Agent
**Vai trò**: Implement features
- Nhận spec đã được approve từ Leader
- Code theo best practices
- Viết tests
- Notify Tester khi hoàn thành
- Fix issues theo feedback từ Tester
- Output: files modified, tests added, implementation summary

### 4. Tester Agent
**Vai trò**: Review code quality
- Nhận code từ Coder
- Phối hợp subagents review nhiều khía cạnh:
  - Correctness (đúng spec, edge cases)
  - Security (SQL injection, XSS, validation)
  - Performance (N+1 queries, indexes)
  - Maintainability (code quality, tests)
  - GTFS compliance (times >24h, service calendar)
- Report issues cho Coder với reproduction steps
- Lặp lại cho đến khi approve
- Notify Leader khi approved
- Output: approved status, issues list, summary

### 5. UI/UX Agent
**Vai trò**: Đánh giá trải nghiệm người dùng
- Nhận từ Leader sau khi Tester approve
- Phối hợp subagents test các khía cạnh:
  - Usability (dễ dùng, navigation rõ ràng)
  - Accessibility (touch target ≥44px, color contrast)
  - Visual design (brand consistency, responsive)
  - Performance (load time, animations)
- Report issues và recommendations cho Leader
- Output: rating, recommendations, critical issues

## Cách sử dụng

### Chạy workflow

```bash
# Từ Kiro CLI
/workflow busfast-development

# Với custom args
/workflow busfast-development --args '{"task": "Implement realtime bus tracking"}'
```

### Phases

Workflow có 5 phases:

1. **Planning**: Content ideation và Leader approval
2. **Development**: Coder implementation
3. **Testing**: Tester review và iterative fixes
4. **UX Review**: UI/UX evaluation
5. **Integration**: Leader final integration

### Output Schema

```json
{
  "status": "completed",
  "workflow": "busfast-development",
  "results": {
    "planning": {
      "concept": "...",
      "approach": "...",
      "requirements": [...]
    },
    "development": {
      "filesModified": [...],
      "testsAdded": [...],
      "summary": "..."
    },
    "testing": {
      "approved": true,
      "issues": [],
      "summary": "..."
    },
    "uxReview": {
      "overallRating": 8,
      "recommendations": [...]
    },
    "final": {
      "status": "success",
      "summary": "...",
      "deploymentReady": true
    }
  }
}
```

## Ví dụ Use Cases

### Use Case 1: Feature mới - Realtime Bus Tracking

```javascript
// Leader nhận request
"Implement realtime bus tracking on map"

// Content ideates
- Approach: WebSocket với Laravel Reverb
- UI: Map markers cập nhật realtime
- Data: vehicle_positions table với lat/lng/timestamp

// Leader approves → Coder codes
- Backend: VehiclePositionController, Reverb events
- Frontend: useVehiclePositions hook, MapMarker component
- Tests: Unit + integration tests

// Tester reviews
- ✓ WebSocket connection handling
- ✓ Position update frequency
- ✗ Issue: No offline fallback → Coder fixes

// UI/UX evaluates
- Rating: 8/10
- Recommendation: Add loading state, error boundary

// Leader integrates
- Status: Success, deployment ready
```

### Use Case 2: Bug Fix - Calendar Exception Logic

```javascript
// Leader nhận request
"Fix: Calendar exceptions not working for Tết holidays"

// Content analyzes
- Problem: calendar_dates.txt exception_type not handled
- Approach: Update ServiceDateResolver logic

// Coder fixes
- File: ServiceDateResolver.php
- Tests: Add test case for exception_type = 2 (removed)

// Tester verifies
- ✓ Exception logic correct
- ✓ Tests pass
- ✓ Edge cases handled

// UI/UX checks
- N/A for backend logic fix

// Leader confirms
- Status: Success, ready to merge
```

## Quy tắc Workflow

### Content → Leader Approval
- Content **KHÔNG được** gửi trực tiếp cho Coder
- Phải chờ Leader approve trước
- Nếu Leader request changes, Content revises và gửi lại

### Coder → Tester Iteration
- Coder notify Tester mỗi khi feature done
- Tester review và report issues
- Coder fix và notify lại
- Lặp tối đa 3 iterations
- Nếu vẫn fail → escalate lên Leader

### Tester → UI/UX Handoff
- Tester **PHẢI approve** trước khi UI/UX test
- UI/UX không review code quality, chỉ user experience
- UI/UX issues report về Leader, không về Coder

### Leader Responsibilities
- Phê duyệt mọi concept trước khi code
- Quyết định final khi có conflict giữa agents
- Escalation point cho các vấn đề không resolve được
- Báo cáo status cho user

## Tech Stack Context

Các agent cần hiểu context này:

### Backend
- PHP 8.3 + Laravel 11
- PostgreSQL 16 (GTFS data)
- Redis 7 (cache, queues)
- Laravel Reverb (WebSocket)

### Frontend
- React Native 0.76.7
- Expo 52
- TypeScript (strict mode)
- TanStack Query v5
- react-native-maps

### Testing
- PHPUnit (backend)
- Jest + React Testing Library (frontend)
- Pest (optional Laravel testing)

### Infrastructure
- Docker Compose (dev)
- WSL2 Ubuntu (Windows dev environment)

## Monitoring Progress

```bash
# Xem workflow đang chạy
/workflows

# Stop workflow nếu cần
# TaskStop với workflow ID
```

## Troubleshooting

### Workflow bị stuck ở Planning
→ Kiểm tra Content agent có trả về đúng schema không

### Tester và Coder loop mãi không approve
→ Sau 3 iterations sẽ auto-fail, escalate lên Leader

### UI/UX report critical issues
→ Leader quyết định: fix ngay hoặc track trong backlog

## Next Steps

Sau khi workflow hoàn thành:

1. Review output từ Leader agent
2. Merge code nếu deployment ready
3. Update documentation
4. Plan iteration tiếp theo
