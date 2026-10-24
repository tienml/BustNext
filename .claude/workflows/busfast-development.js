export const meta = {
  name: 'busfast-development',
  description: 'Multi-agent workflow: Leader coordinates Content, Coder, Tester, UI/UX for BusFast app',
  phases: [
    { title: 'Planning', detail: 'Content ideation and concept approval' },
    { title: 'Development', detail: 'Coding features' },
    { title: 'Testing', detail: 'Code review and quality assurance' },
    { title: 'UX Review', detail: 'User experience evaluation' },
    { title: 'Integration', detail: 'Final integration and deployment' }
  ]
}

/**
 * BusFast Development Workflow
 *
 * Agent Structure:
 * - Leader: Main orchestrator, receives user requests, delegates tasks
 * - Content: Ideation with subagents, proposes concepts, gets approval before forwarding to Coder
 * - Coder: Implements features, notifies Tester when complete
 * - Tester: Reviews code with subagents, coordinates with Coder on fixes, notifies Leader when approved
 * - UI/UX: Tests user experience with subagents after Tester approval, reports to Leader
 */

const LEADER_PROMPT = `You are the Leader agent for BusFast mobile app development.

Your responsibilities:
1. Receive and analyze user requests
2. Delegate tasks to appropriate agents (Content, Coder, Tester, UI/UX)
3. Receive results from agents and coordinate the workflow
4. Make final decisions on feature approval
5. Communicate status back to the user

Current project context:
- Backend: PHP Laravel 11 + PostgreSQL 16 + Redis 7
- Frontend: React Native Expo + TypeScript
- Core features: GTFS data management, realtime tracking, traffic incidents, detours

Workflow pattern:
1. User request → Analyze → Delegate to Content for ideation
2. Content returns concept → Review → Approve → Forward to Coder
3. Coder completes → Tester reviews → Coordinate fixes if needed
4. Tester approves → UI/UX evaluates → Final approval
5. Report completion to user

Task: ${args?.task || 'Coordinate BusFast development workflow'}
`

const CONTENT_PROMPT = `You are the Content agent for BusFast mobile app.

Your responsibilities:
1. Receive feature requests from Leader
2. Coordinate with subagents to brainstorm and ideate
3. Discuss mobile Android app concepts internally
4. Propose polished concepts to Leader for approval
5. After approval, forward detailed specs to Coder

Mobile app context:
- Target: Android users in Hanoi
- Features: Route search, stop search, realtime tracking, detours, ticket purchase
- Integrations: MoMo, GreenSM payment
- UI reference: Green bus theme, map-centric interface

Process:
1. Analyze feature request
2. Spawn subagents to explore different approaches
3. Consolidate ideas into cohesive proposal
4. Send to Leader with clear recommendation
5. Wait for Leader approval before proceeding

Task: ${args?.contentTask || 'Ideate and propose feature concepts'}
`

const CODER_PROMPT = `You are the Coder agent for BusFast app.

Your responsibilities:
1. Receive approved specs from Leader
2. Implement features following best practices
3. Write clean, tested, documented code
4. Notify Tester when each feature is complete
5. Respond to Tester feedback and fix issues

Tech stack:
- Backend: Laravel 11, PostgreSQL 16, Redis 7
- Frontend: React Native Expo, TypeScript, TanStack Query
- Testing: PHPUnit, Jest, React Testing Library

Code quality standards:
- Follow PSR-12 (PHP) and Airbnb style (TypeScript)
- Write unit tests for business logic
- Document complex functions
- Use type safety (PHP type hints, TypeScript strict)
- Handle errors gracefully

Process:
1. Review specs from Leader
2. Implement feature incrementally
3. Run tests and verify
4. Notify Tester with feature location
5. Address Tester feedback iteratively

Task: ${args?.coderTask || 'Implement approved features'}
`

const TESTER_PROMPT = `You are the Tester agent for BusFast app.

Your responsibilities:
1. Receive completion notices from Coder
2. Coordinate with subagents to review code thoroughly
3. Check correctness, security, performance, maintainability
4. Report issues back to Coder with clear reproduction steps
5. Iterate with Coder until both agree code is ready
6. Notify Leader when feature is approved

Review dimensions:
- Correctness: Does it meet specs? Edge cases handled?
- Security: Input validation, SQL injection, XSS prevention
- Performance: Efficient queries, no N+1, proper indexes
- Maintainability: Clear code, tests, documentation
- GTFS compliance: Times >24h, service calendars, version isolation

Process:
1. Receive feature notification from Coder
2. Spawn subagents for different review dimensions
3. Consolidate findings
4. If issues found: Report to Coder with details
5. If issues fixed: Re-review
6. If approved: Notify Leader

Task: ${args?.testerTask || 'Review and validate code quality'}
`

const UIUX_PROMPT = `You are the UI/UX agent for BusFast mobile app.

Your responsibilities:
1. Receive approval from Leader after Tester completes
2. Coordinate with subagents to test user experience
3. Evaluate usability, accessibility, visual design, performance
4. Report issues back to Leader
5. Provide recommendations for improvement

Evaluation criteria:
- Usability: Intuitive navigation, clear labels, consistent patterns
- Accessibility: Touch targets ≥44px, color contrast, screen reader support
- Visual design: Matches brand (green bus theme), responsive layout
- Performance: Fast load, smooth animations, offline support
- Mobile best practices: Native patterns, gesture support

Process:
1. Receive feature from Leader
2. Spawn subagents for different UX dimensions
3. Test on various scenarios (network issues, edge cases)
4. Consolidate feedback
5. Report to Leader with severity ratings

Task: ${args?.uiuxTask || 'Evaluate user experience and accessibility'}
`

// Main workflow execution
async function main() {
  const results = {
    planning: null,
    development: null,
    testing: null,
    uxReview: null,
    final: null
  }

  try {
    // Phase 1: Content Planning
    phase('Planning')
    const contentResult = await agent(CONTENT_PROMPT, {
      label: 'content-ideation',
      phase: 'Planning',
      schema: {
        type: 'object',
        properties: {
          concept: { type: 'string', description: 'Feature concept description' },
          approach: { type: 'string', description: 'Recommended technical approach' },
          mockups: { type: 'array', items: { type: 'string' }, description: 'UI mockup descriptions' },
          requirements: { type: 'array', items: { type: 'string' }, description: 'Functional requirements' }
        },
        required: ['concept', 'approach', 'requirements']
      }
    })
    results.planning = contentResult

    // Leader reviews and approves
    const leaderApproval = await agent(
      `${LEADER_PROMPT}\n\nContent proposal:\n${JSON.stringify(contentResult, null, 2)}\n\nReview and decide: approve, request changes, or reject.`,
      {
        label: 'leader-approval',
        phase: 'Planning',
        schema: {
          type: 'object',
          properties: {
            decision: { type: 'string', enum: ['approved', 'changes_requested', 'rejected'] },
            feedback: { type: 'string', description: 'Feedback for Content agent' },
            codingSpecs: { type: 'string', description: 'Detailed specs for Coder (if approved)' }
          },
          required: ['decision']
        }
      }
    )

    if (leaderApproval.decision !== 'approved') {
      return {
        status: 'planning_failed',
        reason: leaderApproval.feedback,
        results
      }
    }

    // Phase 2: Development
    phase('Development')
    const codingTask = leaderApproval.codingSpecs || JSON.stringify(contentResult)
    const coderResult = await agent(
      `${CODER_PROMPT}\n\nImplement this feature:\n${codingTask}`,
      {
        label: 'coder-implementation',
        phase: 'Development',
        schema: {
          type: 'object',
          properties: {
            filesModified: { type: 'array', items: { type: 'string' } },
            testsAdded: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string', description: 'Implementation summary' },
            notesToTester: { type: 'string', description: 'Testing instructions' }
          },
          required: ['filesModified', 'summary']
        }
      }
    )
    results.development = coderResult

    // Phase 3: Testing (iterative)
    phase('Testing')
    let testApproved = false
    let testIteration = 0
    const maxTestIterations = 3

    while (!testApproved && testIteration < maxTestIterations) {
      testIteration++

      const testerResult = await agent(
        `${TESTER_PROMPT}\n\nReview this implementation:\n${JSON.stringify(coderResult, null, 2)}`,
        {
          label: `tester-review-${testIteration}`,
          phase: 'Testing',
          schema: {
            type: 'object',
            properties: {
              approved: { type: 'boolean' },
              issues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
                    category: { type: 'string' },
                    description: { type: 'string' },
                    location: { type: 'string' },
                    reproduction: { type: 'string' }
                  }
                }
              },
              summary: { type: 'string' }
            },
            required: ['approved', 'issues', 'summary']
          }
        }
      )

      if (testerResult.approved) {
        testApproved = true
        results.testing = testerResult
      } else {
        // Coder fixes issues
        const fixResult = await agent(
          `${CODER_PROMPT}\n\nFix these issues:\n${JSON.stringify(testerResult.issues, null, 2)}`,
          {
            label: `coder-fixes-${testIteration}`,
            phase: 'Testing',
            schema: {
              type: 'object',
              properties: {
                fixedIssues: { type: 'array', items: { type: 'string' } },
                filesModified: { type: 'array', items: { type: 'string' } },
                summary: { type: 'string' }
              },
              required: ['fixedIssues', 'summary']
            }
          }
        )

        // Update coderResult for next iteration
        coderResult.filesModified = [
          ...new Set([...coderResult.filesModified, ...fixResult.filesModified])
        ]
        coderResult.summary += `\n\nIteration ${testIteration} fixes: ${fixResult.summary}`
      }
    }

    if (!testApproved) {
      return {
        status: 'testing_failed',
        reason: `Failed to pass testing after ${maxTestIterations} iterations`,
        results
      }
    }

    // Phase 4: UX Review
    phase('UX Review')
    const uxResult = await agent(
      `${UIUX_PROMPT}\n\nEvaluate this feature:\n${JSON.stringify(results, null, 2)}`,
      {
        label: 'uiux-evaluation',
        phase: 'UX Review',
        schema: {
          type: 'object',
          properties: {
            overallRating: { type: 'number', minimum: 1, maximum: 10 },
            usability: { type: 'object' },
            accessibility: { type: 'object' },
            visualDesign: { type: 'object' },
            performance: { type: 'object' },
            recommendations: { type: 'array', items: { type: 'string' } },
            criticalIssues: { type: 'array', items: { type: 'string' } }
          },
          required: ['overallRating', 'recommendations']
        }
      }
    )
    results.uxReview = uxResult

    // Phase 5: Final Leader Integration
    phase('Integration')
    const finalResult = await agent(
      `${LEADER_PROMPT}\n\nIntegrate and finalize:\n${JSON.stringify(results, null, 2)}`,
      {
        label: 'leader-integration',
        phase: 'Integration',
        schema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['success', 'needs_work', 'failed'] },
            summary: { type: 'string' },
            nextSteps: { type: 'array', items: { type: 'string' } },
            deploymentReady: { type: 'boolean' }
          },
          required: ['status', 'summary']
        }
      }
    )
    results.final = finalResult

    return {
      status: 'completed',
      workflow: 'busfast-development',
      results,
      summary: finalResult.summary
    }

  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      results
    }
  }
}

// Execute workflow
return await main()
