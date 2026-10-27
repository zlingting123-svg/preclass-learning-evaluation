<?php
define('CLI_SCRIPT',true);
require dirname(__DIR__).'/work/moodle/config.php';
$rows=array_values($DB->get_records_sql('SELECT assignment,userid,status,latest FROM {assign_submission}'));
$submitted=array_filter($rows,fn($r)=>$r->status==='submitted');
$student=$DB->get_record('user',['username'=>'001001']);
$state=['moodle'=>$CFG->release,'submittedAnswers'=>count($submitted),'numericGrades'=>$DB->count_records('assign_grades'),
    'profileDrafts'=>$DB->count_records('local_preclass_profile'),'leadingZeroStudentNumber'=>$student->idnumber,
    'studentAccountCount'=>$DB->count_records('user',['username'=>'001001']),
    'sameAccountEnrolmentCount'=>$DB->count_records_sql('SELECT COUNT(1) FROM {user_enrolments} WHERE userid=:id',['id'=>$student->id])];
if(count($submitted)<1||$state['numericGrades']!==0||$state['profileDrafts']<2||$student->idnumber!=='001001'||$state['sameAccountEnrolmentCount']!==2){
    throw new RuntimeException('Database acceptance check failed');
}
echo json_encode($state,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
