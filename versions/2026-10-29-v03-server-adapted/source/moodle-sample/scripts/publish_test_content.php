<?php
// Synthetic local test content only. GPL-3.0-or-later.
define('CLI_SCRIPT', true);
$sample=dirname(__DIR__);
require $sample.'/work/moodle/config.php';
require_once($CFG->dirroot.'/course/modlib.php');
if($CFG->wwwroot!=='http://127.0.0.1:8873'){throw new RuntimeException('Local sample only');}
\core\session\manager::set_user(get_admin());
$manifest=json_decode(file_get_contents($sample.'/work/sample.json'),true);
$items=[
 ['page','测试导读 · 如何完成一次课前学习','<h3>测试课程使用说明</h3><p>以下是虚构教学练习，只用于体验平台，不代表正式教学题目或评价标准。预计10—15分钟。</p><ol><li>阅读本页并打开测试练习一。</li><li>输入文字，保存草稿，退出后再进入检查是否保留。</li><li>补充答案后点击提交作业，确认状态由草稿变为已提交。</li><li>使用本班模拟教师账号查看答卷并填写文字反馈。</li></ol><p>保存草稿不等于正式提交；提交后本样板不提供学生自行重开，建议使用另一道测试练习或另一模拟学生继续测试。所有练习不计分、没有截止时间，请勿填写真实个人信息。</p><h3>虚构材料</h3><p>某校园拟调整食堂周边的垃圾收集点。模拟观察发现：午间垃圾较多、分类标识不清，部分行人反映气味影响通行。以上均为虚构情境，没有现场检测或调查数据。</p>'],
 ['assign','测试练习一 · 校园环境观察','<p><strong>虚构情境练习，不计分。</strong>建议5分钟，约100—200字，无最低字数限制。</p><p>阅读课程中的测试导读，回答：</p><ol><li>你想优先了解哪两个问题？</li><li>为了解这些问题，你会收集哪些资料？</li><li>提出一项可以先试行的改善建议，并说明如何观察其效果。</li></ol><p>可用“问题—资料—建议”组织答案。此题用于测试草稿保存、提交和教师反馈，不设标准答案。</p>'],
 ['assign','测试练习二 · 证据与观点','<p><strong>虚构情境练习，不计分。</strong>建议5分钟，约100—200字，无最低字数限制。</p><p>有人说：“只要把垃圾收集点移远，所有问题就能解决。”请回答：</p><ol><li>这句话中有哪些还需要证据支持的判断？</li><li>你会听取哪些相关人员的意见？</li><li>如果暂时没有足够信息，你会怎样表述自己的结论？</li></ol><p>无需查询法律法规或填写真实地点。允许分次保存；正式提交后由教师查看并反馈。</p>']
];
$result=[];
foreach(['A','B'] as $code){
 $course=$DB->get_record('course',['id'=>$manifest['courses'][$code]],'*',MUST_EXIST);
 if($course->idnumber!=='pcs-sample:AUTUMN-'.$code){throw new RuntimeException('Synthetic course required');}
 foreach($items as $index=>[$type,$name,$content]){
  $key='pcs-test-content:'.$code.':'.$index;
  $existing=$DB->get_record('course_modules',['course'=>$course->id,'idnumber'=>$key]);
  if($existing){$result[$code][$type.'-'.$index]=(int)$existing->id;continue;}
  if($type==='page'){
   $data=(object)['modulename'=>'page','module'=>$DB->get_field('modules','id',['name'=>'page']), 'section'=>1,'name'=>$name,'intro'=>'模拟课程材料与测试步骤','introformat'=>FORMAT_HTML,'content'=>$content,'contentformat'=>FORMAT_HTML,'display'=>0,'displayoptions'=>serialize([]),'printintro'=>0,'printlastmodified'=>0,'visible'=>1,'groupmode'=>0];
  }else{
   $data=(object)['modulename'=>'assign','module'=>$DB->get_field('modules','id',['name'=>'assign']),'section'=>1,'name'=>$name,'intro'=>$content,
        'introformat'=>FORMAT_HTML,'visible'=>1,'groupmode'=>SEPARATEGROUPS,'groupingid'=>0,'grade'=>0,
        'submissiondrafts'=>1,'requiresubmissionstatement'=>0,'sendnotifications'=>0,'sendlatenotifications'=>0,
        'duedate'=>0,'cutoffdate'=>0,'gradingduedate'=>0,'allowsubmissionsfromdate'=>0,
        'teamsubmission'=>0,'requireallteammemberssubmit'=>0,'blindmarking'=>0,'markingworkflow'=>0,'markingallocation'=>0,
        'assignsubmission_onlinetext_enabled'=>1,'assignsubmission_file_enabled'=>0,
        'assignfeedback_comments_enabled'=>1,'assignfeedback_editpdf_enabled'=>0,'attemptreopenmethod'=>'none','maxattempts'=>1];
  }
  $data->cmidnumber=$key;
  $info=add_moduleinfo($data,$course);
  $result[$code][$type.'-'.$index]=(int)$info->coursemodule;
 }
 rebuild_course_cache($course->id,true);
}
file_put_contents($sample.'/work/test-content.json',json_encode($result,JSON_PRETTY_PRINT));
echo json_encode(['mock'=>true,'modules'=>$result],JSON_UNESCAPED_UNICODE).PHP_EOL;
