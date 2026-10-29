<?php
// Explicitly synthetic fixtures only. GPL-3.0-or-later.
define('CLI_SCRIPT', true);
$sample = dirname(__DIR__);
require $sample.'/work/moodle/config.php';
require_once($CFG->dirroot.'/user/lib.php');
require_once($CFG->dirroot.'/course/lib.php');
require_once($CFG->dirroot.'/course/modlib.php');
require_once($CFG->dirroot.'/group/lib.php');
require_once($CFG->libdir.'/enrollib.php');
if ($CFG->wwwroot !== 'http://127.0.0.1:8873') { throw new RuntimeException('Local sample only'); }
\core\session\manager::set_user(get_admin());
set_config('noemailever', 1);
set_config('timezone', 'Asia/Shanghai');
set_config('forcetimezone', 'Asia/Shanghai');
set_config('lang', is_dir($CFG->dataroot.'/lang/zh_cn') ? 'zh_cn' : 'en');
set_config('enableblogs', 0); set_config('messaging', 0);
set_config('enablerssfeeds', 0); set_config('enablebadges', 0);
$rows=[]; $file=fopen($sample.'/fixtures/roster.csv','r'); $headers=fgetcsv($file,0,',','"','');
while(($row=fgetcsv($file,0,',','"',''))!==false){$rows[]=array_combine($headers,$row);} fclose($file);
$seen=[];
foreach($rows as $row){
    if(!preg_match('/^[0-9]{6}$/',$row['studentNumber'])||isset($seen[$row['studentNumber']])||!in_array($row['classCode'],['A','B'],true)){
        throw new RuntimeException('Synthetic roster invalid');
    }
    $seen[$row['studentNumber']]=true;
}
$plan=['mock'=>true,'sha256'=>hash_file('sha256',$sample.'/fixtures/roster.csv'),'newOrExistingStudents'=>count($rows),'rows'=>$rows];
file_put_contents($sample.'/work/import-preview.json',json_encode($plan,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
if(hash_file('sha256',$sample.'/fixtures/roster.csv')!==$plan['sha256']){throw new RuntimeException('Roster changed after preview');}
$private=$sample.'/work/private';
$accountsFile=$private.'/demo-accounts.json';
$accounts=file_exists($accountsFile)?json_decode(file_get_contents($accountsFile),true):[];
function sample_user($username,$display,$role,$number=''){
    global $DB,$CFG,$accounts;
    $user=$DB->get_record('user',['username'=>$username,'mnethostid'=>$CFG->mnet_localhost_id]);
    if($user && $user->description!=='LOCAL_PRECLASS_SYNTHETIC'){throw new RuntimeException('Existing non-sample username refused');}
    if(!$user){
        $password='P!'.bin2hex(random_bytes(12)).'9a';
        $id=user_create_user((object)['username'=>$username,'password'=>$password,'auth'=>'manual','confirmed'=>1,
            'mnethostid'=>$CFG->mnet_localhost_id,'firstname'=>$display,'lastname'=>'（模拟）',
            'email'=>$username.'@example.invalid','lang'=>get_config('core','lang'),'timezone'=>'Asia/Shanghai',
            'idnumber'=>$number,'description'=>'LOCAL_PRECLASS_SYNTHETIC','descriptionformat'=>FORMAT_PLAIN],true,false);
        $user=$DB->get_record('user',['id'=>$id], '*', MUST_EXIST);
        $accounts[$username]=['username'=>$username,'password'=>$password,'displayName'=>$display,'role'=>$role,'studentNumber'=>$number];
    }
    return $user;
}
$teachers=['A'=>sample_user('teacher_a','样板教师A','teacher'),'B'=>sample_user('teacher_b','样板教师B','teacher')];
$students=[];foreach($rows as $row){$students[$row['studentNumber']]=sample_user($row['studentNumber'],$row['displayName'],'student',$row['studentNumber']);}
file_put_contents($accountsFile,json_encode($accounts,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));chmod($accountsFile,0600);
function sample_category($idnumber,$name){
    global $DB;
    $record=$DB->get_record('course_categories',['idnumber'=>$idnumber]);
    return $record?\core_course_category::get($record->id):\core_course_category::create(['name'=>$name,'idnumber'=>$idnumber,'parent'=>0]);
}
$autumn=sample_category('pcs-sample:autumn-2026','2026秋季 · 跨至2027年1月（模拟批次）');
$spring=sample_category('pcs-sample:spring-2027','2027春季（跨期复用对照）');
$manual=enrol_get_plugin('manual');
$teacherRole=$DB->get_field('role','id',['shortname'=>'editingteacher'],MUST_EXIST);
$studentRole=$DB->get_field('role','id',['shortname'=>'student'],MUST_EXIST);
function sample_course($code,$name,$category,$teacher){
    global $DB,$manual,$teacherRole;
    $course=$DB->get_record('course',['idnumber'=>'pcs-sample:'.$code]);
    if(!$course){$course=create_course((object)['fullname'=>$name,'shortname'=>'PCS-'.$code,'idnumber'=>'pcs-sample:'.$code,
        'category'=>$category->id,'format'=>'topics','numsections'=>1,'visible'=>1,'groupmode'=>SEPARATEGROUPS,
        'groupmodeforce'=>1,'enablecompletion'=>0,'summary'=>'本地模拟教学；每期计划4次作业。真实日期、分班和人数未配置。','summaryformat'=>FORMAT_HTML]);}
    $instances=enrol_get_instances($course->id,false);$instance=null;
    foreach($instances as $i){if($i->enrol==='manual'){$instance=$i;break;}}
    if(!$instance){$instanceid=$manual->add_default_instance($course);$instance=$DB->get_record('enrol',['id'=>$instanceid]);}
    $manual->enrol_user($instance,$teacher->id,$teacherRole);
    assign_capability('moodle/site:accessallgroups',CAP_PROHIBIT,$teacherRole,context_course::instance($course->id)->id,true);
    return [$course,$instance];
}
[$courseA,$enrolA]=sample_course('AUTUMN-A','环境评价与管理 · 模拟A班',$autumn,$teachers['A']);
[$courseB,$enrolB]=sample_course('AUTUMN-B','环境评价与管理 · 模拟B班',$autumn,$teachers['B']);
[$courseS,$enrolS]=sample_course('SPRING-A','环境评价与管理 · 跨期账号复用对照',$spring,$teachers['A']);
foreach($rows as $row){
    $course=$row['classCode']==='A'?$courseA:$courseB;$instance=$row['classCode']==='A'?$enrolA:$enrolB;
    $manual->enrol_user($instance,$students[$row['studentNumber']]->id,$studentRole);
    $group=$DB->get_record('groups',['courseid'=>$course->id,'idnumber'=>'pcs-sample:'.$row['classCode']]);
    $groupid=$group?$group->id:groups_create_group((object)['courseid'=>$course->id,'name'=>'模拟'.$row['classCode'].'班','idnumber'=>'pcs-sample:'.$row['classCode']]);
    groups_add_member($groupid,$students[$row['studentNumber']]->id);groups_add_member($groupid,$teachers[$row['classCode']]->id);
}
$manual->enrol_user($enrolS,$students['001001']->id,$studentRole);
$cms=[];
foreach(['A'=>$courseA,'B'=>$courseB] as $code=>$course){
    $existing=$DB->get_record('assign',['course'=>$course->id,'name'=>'第1次课前问答 · 三同时（样板）']);
    if($existing){$cm=get_coursemodule_from_instance('assign',$existing->id,$course->id,false,MUST_EXIST);$cms[$code]=$cm->id;continue;}
    $data=(object)['modulename'=>'assign','module'=>$DB->get_field('modules','id',['name'=>'assign']),
        'section'=>1,'name'=>'第1次课前问答 · 三同时（样板）','intro'=>'<p>“三同时”竣工验收表中都有哪些内容？</p><p>题目来自用户提供材料。当前待配置正式评价体系；本样板只保存文字答案和教师反馈，不生成数字成绩。</p>',
        'introformat'=>FORMAT_HTML,'visible'=>1,'groupmode'=>SEPARATEGROUPS,'groupingid'=>0,'grade'=>0,
        'submissiondrafts'=>1,'requiresubmissionstatement'=>0,'sendnotifications'=>0,'sendlatenotifications'=>0,
        'duedate'=>0,'cutoffdate'=>0,'gradingduedate'=>0,'allowsubmissionsfromdate'=>0,
        'teamsubmission'=>0,'requireallteammemberssubmit'=>0,'blindmarking'=>0,'markingworkflow'=>0,'markingallocation'=>0,
        'assignsubmission_onlinetext_enabled'=>1,'assignsubmission_file_enabled'=>0,
        'assignfeedback_comments_enabled'=>1,'assignfeedback_editpdf_enabled'=>0,'attemptreopenmethod'=>'none','maxattempts'=>1];
    $info=add_moduleinfo($data,$course);$cms[$code]=$info->coursemodule;
}
$courseids=[(int)$courseA->id,(int)$courseB->id,(int)$courseS->id];
set_config('courseids',json_encode($courseids),'local_preclass_sample');
$manifest=['sourceBranch'=>'backend/oss-foundations','sourceCommit'=>'4e15d02','sourceContract'=>'0.2.0','mock'=>true,
    'courses'=>['A'=>$courseA->id,'B'=>$courseB->id,'crossTerm'=>$courseS->id],
    'assignments'=>$cms,'teachers'=>array_map(fn($u)=>(int)$u->id,$teachers),
    'students'=>array_map(fn($u)=>(int)$u->id,$students),'rosterFingerprint'=>$plan['sha256']];
file_put_contents($sample.'/work/sample.json',json_encode($manifest,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
echo json_encode(['mock'=>true,'teachers'=>2,'students'=>4,'classCourses'=>2,'crossTermCourse'=>1,'assignments'=>count($cms),'credentials'=>'work/private/demo-accounts.json'],JSON_UNESCAPED_UNICODE).PHP_EOL;
