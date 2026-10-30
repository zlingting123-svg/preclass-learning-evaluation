import type {
  Assignment,
  ClassInfo,
  DimensionScore,
  ID,
  Question,
  RubricDimension,
  RubricInfo,
  ScoreReport,
  ScoreValue,
  Submission,
  TeacherReview,
  User,
} from '@shared/contracts'

/** 演示账号（仅 mock 模式存在，生产环境禁用）。 */
export interface MockUser extends User {
  password: string
  /** 登录成功但后续请求即返回 401，用于演示“会话过期→重新登录”。 */
  alwaysExpired?: boolean
}

export const DEMO_PASSWORD = 'demo123'

export const mockUsers: MockUser[] = [
  { id: 'u_stu_demo', displayName: '演示学生', role: 'student', password: DEMO_PASSWORD },
  { id: 'u_tch_demo', displayName: '演示教师', role: 'teacher', password: DEMO_PASSWORD },
  { id: 'u_exp_demo', displayName: '过期演示（登录后立即失效）', role: 'student', password: DEMO_PASSWORD, alwaysExpired: true },
]

// 时间工具：相对当前时间生成 ISO 字符串，保证“截止/未截止”演示正确。
const now = Date.now()
const hours = (h: number): string => new Date(now + h * 3600_000).toISOString()
const daysAgo = (d: number): string => new Date(now - d * 86400_000).toISOString()

export const mockClasses: ClassInfo[] = [
  { id: 'cls_1', name: '示例班级·一班（演示）', teacherId: 'u_tch_demo', memberCount: 5, joinCode: 'DEMO-CLASS-1' },
  { id: 'cls_2', name: '示例班级·二班（演示）', teacherId: 'u_tch_demo', memberCount: 3, joinCode: 'DEMO-CLASS-2' },
  { id: 'cls_3', name: '空示例班级（演示）', teacherId: 'u_tch_demo', memberCount: 0, joinCode: 'DEMO-CLASS-3' },
]

/** 学生加入的班级（演示）。 */
export const studentClassIds: ID[] = ['cls_1', 'cls_2']

function dimension(id: string, name: string, description: string, maxScore: number): RubricDimension {
  return { id, name, description, maxScore }
}

export const mockRubrics: RubricInfo[] = [
  {
    id: 'rub_demo',
    name: '通用文字问答评价（演示）',
    version: '1.0.0',
    dimensions: [
      dimension('d_a', '内容完整性（演示维度A）', '是否覆盖题目要求的关键点（演示说明）', 20),
      dimension('d_b', '表达清晰度（演示维度B）', '表达是否通顺、结构是否清楚（演示说明）', 20),
      dimension('d_c', '思考深度（演示维度C）', '是否有自己的分析与思考（演示说明）', 20),
    ],
    aggregationDescription: '总分由后台按已配置规则计算，前端不自行推断权重（演示说明）',
  },
  {
    id: 'rub_demo_2',
    name: '简明问答评价（演示）',
    version: '1.0.0',
    dimensions: [
      dimension('d_x', '回答要点（演示维度A）', '是否命中回答要点（演示说明）', 10),
      dimension('d_y', '表述规范（演示维度B）', '用语是否规范（演示说明）', 10),
    ],
    aggregationDescription: '二值维度用于演示条形图；总分由后台计算（演示说明）',
  },
]

function question(id: string, prompt: string, maxLength: number): Question {
  return { id, prompt, maxLength }
}

export const mockAssignments: Assignment[] = [
  {
    id: 'asg_published_scored',
    classId: 'cls_1',
    title: '课前问答·已配置评价（演示）',
    instructions: '请认真阅读题目后作答。本作业已配置评价体系，提交后系统会给出各维度得分与评语（均为演示数据）。',
    questions: [question('q1', '请结合自己的理解，谈谈“课前预习”的重要性，并举例说明。（演示题目）', 2000)],
    state: 'published',
    deadlineAt: hours(48),
    rubricId: 'rub_demo',
    rubricVersion: '1.0.0',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    version: 3,
  },
  {
    id: 'asg_published_norubric',
    classId: 'cls_1',
    title: '课前问答·待配置评价体系（演示）',
    instructions: '本作业尚未配置评价体系，提交后评分状态为“待配置评价体系”。',
    questions: [question('q2', '请写出你今天最想弄懂的一个问题。（演示题目）', 500)],
    state: 'published',
    deadlineAt: null,
    rubricId: null,
    rubricVersion: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    version: 2,
  },
  {
    id: 'asg_published_queued',
    classId: 'cls_1',
    title: '课前问答·评分排队中（演示）',
    instructions: '提交后评分任务进入排队状态（演示：不会自动变为完成）。',
    questions: [question('q3', '请描述一个你最近学过的概念，并说明你的理解。（演示题目）', 1000)],
    state: 'published',
    deadlineAt: hours(24),
    rubricId: 'rub_demo',
    rubricVersion: '1.0.0',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    version: 2,
  },
  {
    id: 'asg_published_failed',
    classId: 'cls_1',
    title: '课前问答·评分失败（演示）',
    instructions: '提交后评分任务会失败，用于演示失败状态与教师重试。',
    questions: [question('q4', '请列举你在这节课之前已经知道的三个知识点。（演示题目）', 1000)],
    state: 'published',
    deadlineAt: hours(24),
    rubricId: 'rub_demo',
    rubricVersion: '1.0.0',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    version: 2,
  },
  {
    id: 'asg_published_review',
    classId: 'cls_1',
    title: '课前问答·需要教师复核（演示）',
    instructions: '提交后系统初评标记为“需要教师复核”，用于演示待复核状态。',
    questions: [question('q5', '请用一两句话概括你对这节课主题的疑问。（演示题目）', 800)],
    state: 'published',
    deadlineAt: hours(24),
    rubricId: 'rub_demo',
    rubricVersion: '1.0.0',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    version: 2,
  },
  {
    id: 'asg_closed',
    classId: 'cls_1',
    title: '课前问答·已截止（演示）',
    instructions: '本作业已截止，只能查看，不能提交。',
    questions: [question('q6', '（已截止示例）请回顾本单元内容作答。（演示题目）', 500)],
    state: 'closed',
    deadlineAt: hours(-1),
    rubricId: 'rub_demo',
    rubricVersion: '1.0.0',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(3),
    version: 4,
  },
  {
    id: 'asg_draft',
    classId: 'cls_1',
    title: '课前问答·草稿（演示）',
    instructions: '这是教师尚未发布的草稿，学生不可见。',
    questions: [question('q7', '（草稿题目）请……（演示题目）', 500)],
    state: 'draft',
    deadlineAt: null,
    rubricId: null,
    rubricVersion: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    version: 1,
  },
  {
    id: 'asg_published_bar',
    classId: 'cls_2',
    title: '课前问答·二维度评价（演示）',
    instructions: '本作业使用二维度评价体系，报告用条形图展示（演示数据）。',
    questions: [question('q8', '请简要回答下列问题。（演示题目）', 500)],
    state: 'published',
    deadlineAt: hours(72),
    rubricId: 'rub_demo_2',
    rubricVersion: '1.0.0',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    version: 3,
  },
]

function dimensionScore(dimensionId: string, name: string, score: number, maxScore: number, rationale: string): DimensionScore {
  return { dimensionId, name, score, maxScore, rationale }
}

function scoreValue(
  dimensions: DimensionScore[],
  totalScore: number | null,
  totalMaxScore: number | null,
  feedback: string,
): ScoreValue {
  return { dimensions, totalScore, totalMaxScore, feedback }
}

function report(
  id: string,
  submissionId: string,
  rubricId: string,
  rubricVersion: string,
  systemScores: ScoreValue | null,
  reviews: TeacherReview[] = [],
  version = 1,
): ScoreReport {
  const latestReview = reviews.length ? reviews[reviews.length - 1] : null
  return {
    id,
    submissionId,
    rubricId,
    rubricVersion,
    method: 'ai',
    modelProvider: 'demo-model-provider',
    modelVersion: 'demo-1',
    generatedAt: hours(-1),
    systemScores,
    reviews,
    latestReview,
    version,
  }
}

export const mockSubmissions: Submission[] = [
  // 一班·已配置评价：不同评分状态的答卷，供教师查看与复核。
  {
    id: 'sub_1',
    assignmentId: 'asg_published_scored',
    studentId: 's_zhang',
    studentName: '张三（演示）',
    state: 'submitted',
    scoringStatus: 'scored',
    answers: [{ questionId: 'q1', text: '我认为预习能帮助我带着问题进入课堂，比如提前读课文后我更容易跟上老师讲解。（演示作答）' }],
    version: 2,
    updatedAt: hours(-2),
    submittedAt: hours(-3),
    failureMessage: null,
  },
  {
    id: 'sub_2',
    assignmentId: 'asg_published_scored',
    studentId: 's_li',
    studentName: '李四（演示）',
    state: 'submitted',
    scoringStatus: 'needs_review',
    answers: [{ questionId: 'q1', text: '预习可以让我先了解大概内容，上课时不会完全陌生。（演示作答）' }],
    version: 2,
    updatedAt: hours(-2),
    submittedAt: hours(-3),
    failureMessage: null,
  },
  {
    id: 'sub_3',
    assignmentId: 'asg_published_scored',
    studentId: 's_wang',
    studentName: '王五（演示）',
    state: 'submitted',
    scoringStatus: 'scored',
    answers: [{ questionId: 'q1', text: '（演示作答）预习有助于在课堂上提出有针对性的问题。' }],
    version: 1,
    updatedAt: hours(-1),
    submittedAt: hours(-1),
    failureMessage: null,
  },
  {
    id: 'sub_4',
    assignmentId: 'asg_published_scored',
    studentId: 's_zhao',
    studentName: '赵六（演示）',
    state: 'submitted',
    scoringStatus: 'failed',
    answers: [{ questionId: 'q1', text: '（演示作答）评分任务失败的重试示例。' }],
    version: 1,
    updatedAt: hours(-1),
    submittedAt: hours(-1),
    failureMessage: '评分服务在多次重试后仍失败（演示信息）',
  },
  {
    id: 'sub_5',
    assignmentId: 'asg_published_scored',
    studentId: 's_sun',
    studentName: '孙七（演示）',
    state: 'draft',
    scoringStatus: 'not_requested',
    answers: [{ questionId: 'q1', text: '（演示草稿，尚未提交）' }],
    version: 3,
    updatedAt: hours(-1),
    submittedAt: null,
    failureMessage: null,
  },
  // 一班·待配置评价体系
  {
    id: 'sub_6',
    assignmentId: 'asg_published_norubric',
    studentId: 's_zhang',
    studentName: '张三（演示）',
    state: 'submitted',
    scoringStatus: 'awaiting_rubric',
    answers: [{ questionId: 'q2', text: '我最想弄懂的问题是如何高效复习。（演示作答）' }],
    version: 1,
    updatedAt: hours(-2),
    submittedAt: hours(-2),
    failureMessage: null,
  },
  // 一班·评分排队中
  {
    id: 'sub_7',
    assignmentId: 'asg_published_queued',
    studentId: 's_li',
    studentName: '李四（演示）',
    state: 'submitted',
    scoringStatus: 'queued',
    answers: [{ questionId: 'q3', text: '（演示作答）排队等待评分中。' }],
    version: 1,
    updatedAt: hours(-1),
    submittedAt: hours(-1),
    failureMessage: null,
  },
]

export const mockReports: ScoreReport[] = [
  report(
    'rep_1',
    'sub_1',
    'rub_demo',
    '1.0.0',
    scoreValue(
      [
        dimensionScore('d_a', '内容完整性（演示维度A）', 18, 20, '覆盖了题目要求，并举例说明（演示评语）'),
        dimensionScore('d_b', '表达清晰度（演示维度B）', 16, 20, '表达通顺，结构清楚（演示评语）'),
        dimensionScore('d_c', '思考深度（演示维度C）', 15, 20, '有自己的分析（演示评语）'),
      ],
      49,
      60,
      '整体回答较好，可以进一步深化思考（演示评语）。',
    ),
    [
      {
        id: 'rev_1',
        teacherId: 'u_tch_demo',
        reviewedAt: hours(-1),
        scores: scoreValue(
          [
            dimensionScore('d_a', '内容完整性（演示维度A）', 19, 20, '教师复核：内容更完整（演示）'),
            dimensionScore('d_b', '表达清晰度（演示维度B）', 17, 20, '教师复核：表达清晰（演示）'),
            dimensionScore('d_c', '思考深度（演示维度C）', 16, 20, '教师复核：有独立思考（演示）'),
          ],
          52,
          60,
          '教师复核后的评语（演示）。',
        ),
        reason: '系统初评偏保守，人工上调（演示理由）',
      },
    ],
    2,
  ),
  report(
    'rep_2',
    'sub_2',
    'rub_demo',
    '1.0.0',
    scoreValue(
      [
        dimensionScore('d_a', '内容完整性（演示维度A）', 14, 20, '回答较简略（演示评语）'),
        dimensionScore('d_b', '表达清晰度（演示维度B）', 15, 20, '表达清楚（演示评语）'),
        dimensionScore('d_c', '思考深度（演示维度C）', 10, 20, '思考较浅（演示评语）'),
      ],
      39,
      60,
      '需要教师复核确认（演示评语）。',
    ),
    [],
    1,
  ),
  report(
    'rep_3',
    'sub_3',
    'rub_demo',
    '1.0.0',
    scoreValue(
      [
        dimensionScore('d_a', '内容完整性（演示维度A）', 17, 20, '要点覆盖较好（演示评语）'),
        dimensionScore('d_b', '表达清晰度（演示维度B）', 17, 20, '表达清楚（演示评语）'),
        dimensionScore('d_c', '思考深度（演示维度C）', 16, 20, '有一定思考（演示评语）'),
      ],
      50,
      60,
      '整体较好（演示评语）。',
    ),
    [],
    1,
  ),
]
