from pathlib import Path
import shutil
r=Path(__file__).resolve().parent;p=r/'backend/questionnaires.js';s=p.read_text(encoding='utf-8');s="import {validateMatrixAnswer,flattenMatrixSurvey} from './matrix.js';\n"+s
s=s.replace('z.enum(["text", "single", "multiple"])','z.enum(["text", "single", "multiple", "matrix"])')
at='        required: z.boolean(),';assert at in s;s=s.replace(at,at+'\n        rows: z.array(z.object({id:z.string().min(1).max(100),title:z.string().trim().min(1).max(1000)}).strict()).max(50).optional(),',1)
at='    for (const q of v.questions)';idx=s.index(at);s=s[:idx]+'''    for(const q of v.questions){if(q.type==='matrix'&&(!q.rows?.length||new Set(q.rows.map(r=>r.id)).size!==q.rows.length))c.addIssue({code:'custom',message:'矩阵须包含不重复的评分项目'});if(q.type!=='matrix'&&q.rows?.length)c.addIssue({code:'custom',message:'非矩阵题不能保存评分行'})}
'''+s[idx:]
s=s.replace('z.array(z.string().max(300)).max(50)', 'z.array(z.string().max(300)).max(50),z.record(z.string().max(100),z.string().max(300))')
s=s.replace('for(const q of survey.questions){const v=b.answers[q.id];if(v===undefined)continue;',"for(const q of survey.questions){const v=b.answers[q.id];if(q.type==='matrix'){validateMatrixAnswer(q,v,false);continue}if(v===undefined)continue;")
at='''                const v = answers[q.id];
                ensure(!q.required''';assert at in s;s=s.replace(at,'''                const v = answers[q.id];
                if(q.type==='matrix'){validateMatrixAnswer(q,v,true);continue}
                ensure(!q.required''',1)
at='        return { survey: s, response: r };';assert at in s;s=s.replace(at,"        const flat=flattenMatrixSurvey(s,[r]);return {survey:{...s,questions:flat.questions},response:flat.responses[0]};",1)
s=s.replace('        const done = responses.filter((r) => r.submittedAt);','        const flat=flattenMatrixSurvey(s,responses.filter((r)=>r.submittedAt));\n        const done=flat.responses;')
s=s.replace('questions: s.questions.map((q) => ({','questions: flat.questions.map((q) => ({',1)
p.write_text(s,encoding='utf-8')
p=r/'backend/questionnaire-routes.js';s=p.read_text(encoding='utf-8');s="import {surveyImportRoutes} from './import-route.js';\n"+s;s=s.replace('export function questionnaireRoutes(app, core, ok) {','export function questionnaireRoutes(app, core, ok) {\n    surveyImportRoutes(app,core);',1);p.write_text(s,encoding='utf-8')
for name in ['matrix.js','survey-import.js','import-route.js']:shutil.copy2(r/name,r/'backend'/name)
print('Matrix validation, stats/detail adapters and stateless import route prepared')
