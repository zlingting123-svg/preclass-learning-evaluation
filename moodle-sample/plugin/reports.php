<?php
require_once(__DIR__.'/../../config.php');
require_once(__DIR__.'/lib.php');
$courseid=required_param('courseid',PARAM_INT);
$course=local_preclass_sample_course($courseid);
$context=context_course::instance($courseid);
require_capability('local/preclass_sample:viewprofiles',$context);
$PAGE->set_url('/local/preclass_sample/reports.php',['courseid'=>$courseid]);
$records=$DB->get_records_sql('SELECT p.*, u.firstname, u.lastname, u.idnumber FROM {local_preclass_profile} p JOIN {user} u ON u.id=p.userid WHERE p.courseid=:course ORDER BY p.userid',['course'=>$courseid]);
function sample_readable_answers($raw) {
    $payload=json_decode($raw,true);$values=$payload['answers']??[];$out=[];
    foreach(\local_preclass_sample\profile_schema::questions() as $q){
        if($q['type']===null){continue;}$value=$values[$q['id']]??null;
        if($q['type']==='matrix_scale'){
            foreach($q['rows'] as $row){$out[$q['number'].'. '.$row['label']]=isset($value[$row['id']])?(string)$value[$row['id']]:'';}
        }else if($q['type']==='multiple_choice'){
            $choices=array_column($q['choices'],'label','id');
            $labels=array_map(fn($id)=>$choices[$id]??'',is_array($value)?$value:[]);
            $extra=$payload['other'][$q['id']]??'';if($extra!==''){$labels[]='其他补充：'.$extra;}
            $out[$q['number'].'. '.$q['prompt']]=implode('；',$labels);
        }else{$out[$q['number'].'. '.$q['prompt']]=is_string($value)?$value:'';}
    }return $out;
}
if (optional_param('download',0,PARAM_BOOL)) {
    require_sesskey();
    header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="profile-drafts.csv"');
    header('Cache-Control: no-store'); echo "\xEF\xBB\xBF";
    $out=fopen('php://output','w');
    $columns=array_keys(sample_readable_answers('{}'));
    fputcsv($out,['模拟学号','姓名','草稿版本','保存时间',...$columns],',','"','');
    foreach($records as $row) {
        $cells=[$row->idnumber,fullname($row),$row->version,userdate($row->timemodified),...array_values(sample_readable_answers($row->answers))];
        foreach($cells as &$cell) { $cell=(string)$cell; if(preg_match('/^[\s\x00-\x1f]*[=+@-]/u',$cell)){$cell="'".$cell;} } unset($cell);
        fputcsv($out,$cells,',','"','');
    }
    fclose($out); exit;
}
local_preclass_sample_header('本班画像草稿 · '.format_string($course->fullname),$course);
echo html_writer::link(new moodle_url('/local/preclass_sample/index.php'),'← 返回任务中心');
echo '<p>当前只显示本课程保存的画像草稿，共'.count($records).'份。未填写与未确认题目不能按0分处理。本样板仅展示原始草稿，不生成能力评分或总体分析。</p>';
echo html_writer::link(new moodle_url($PAGE->url,['download'=>1,'sesskey'=>sesskey()]),'导出本班画像CSV',['class'=>'btn btn-secondary']);
echo '<div class="pcs-table-wrap"><table class="pcs-table"><thead><tr><th>模拟学号</th><th>姓名</th><th>保存时间</th><th>画像草稿</th></tr></thead><tbody>';
foreach($records as $row) {
    echo '<tr><td>'.s($row->idnumber).'</td><td>'.s(fullname($row)).'</td><td>'.s(userdate($row->timemodified)).'</td><td><details><summary>查看已保存内容</summary><dl>';
    foreach(sample_readable_answers($row->answers) as $label=>$value){echo '<dt>'.s($label).'</dt><dd>'.($value!==''?s($value):'未填写').'</dd>';}
    echo '</dl></details></td></tr>';
}
echo '</tbody></table></div>';
echo $OUTPUT->footer();
