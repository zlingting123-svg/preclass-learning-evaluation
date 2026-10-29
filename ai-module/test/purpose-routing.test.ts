import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../src/config.js';
import {Scheduler} from '../src/scheduler.js';
import {MockProvider} from '../src/mock.js';
import type {Deployment} from '../src/contracts.js';
test('功能池隔离，学生排队不阻塞空闲教师池，未配置用途立即失败',async()=>{
 const config=readConfig('config/mock.example.json');
 const deployments:Deployment[]=[{id:'student',accountId:'student',quotaGroup:'student',purposes:['student_qa'],maxConcurrency:1,provider:new MockProvider('ok',0)},{id:'teacher',accountId:'teacher',quotaGroup:'teacher',purposes:['teacher_qa'],maxConcurrency:1,provider:new MockProvider('ok',0)}];
 const scheduler=new Scheduler(deployments,config.policy),signal=AbortSignal.timeout(2000);
 const first=await scheduler.take('s1',signal),queued=scheduler.take('s2',signal);
 const teacher=await scheduler.take('t1',signal,'teacher_qa');assert.equal(teacher.deployment.id,'teacher');await teacher.release();await first.release();const second=await queued;assert.equal(second.deployment.id,'student');await second.release();
 assert.throws(()=>scheduler.take('x',signal,'questionnaire_generate'),/PURPOSE_NOT_CONFIGURED/);
});
