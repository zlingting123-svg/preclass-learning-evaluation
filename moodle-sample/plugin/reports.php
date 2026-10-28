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
local_preclass_sample_header('本班画像草稿', $course);
echo '<div class="pcs-report-heading"><div><p class="pcs-lead">了解学生的起点，为课堂讨论做好准备。</p><p class="pcs-muted">本班已有 <strong>'.count($records).'</strong> 份保存的草稿。未填写与未确认题目不按0分处理。</p></div>'.html_writer::link(new moodle_url($PAGE->url,['download'=>1,'sesskey'=>sesskey()]),'导出本班画像CSV',['class'=>'pcs-button pcs-button-secondary']).'</div>';
echo '<div class="pcs-toolbar" data-report-tools hidden><label>查找学生<input type="search" data-report-search placeholder="输入学号或姓名"></label><button type="button" class="pcs-button pcs-button-secondary" data-expand-reports>展开全部答卷</button><span class="pcs-muted" data-report-count role="status"></span></div>';
echo '<div class="pcs-table-wrap"><table class="pcs-table"><caption class="visually-hidden">本班已保存的画像草稿</caption><thead><tr><th scope="col">学生</th><th scope="col">最近保存</th><th scope="col">画像草稿</th></tr></thead><tbody>';
foreach($records as $row) {
    echo '<tr data-report-row data-search="'.s($row->idnumber.' '.fullname($row)).'"><td data-label="学生"><strong>'.s(fullname($row)).'</strong><span class="pcs-student-number">学号 '.s($row->idnumber).'</span></td><td data-label="最近保存">'.s(userdate($row->timemodified,'%m月%d日 %H:%M')).'</td><td data-label="画像草稿"><details data-answer-detail><summary>查看已保存内容<span class="visually-hidden">：'.s(fullname($row)).'</span></summary><dl>';
    foreach(sample_readable_answers($row->answers) as $label=>$value){echo '<dt>'.s($label).'</dt><dd>'.($value!==''?s($value):'<span class="pcs-muted">未填写</span>').'</dd>';}
    echo '</dl></details></td></tr>';
}
echo '</tbody></table></div><div class="pcs-empty" data-report-empty '.($records?'hidden':'').'><h3>'.($records?'没有找到匹配的学生':'本班还没有画像草稿').'</h3><p>'.($records?'检查学号、姓名，或清空搜索后重试。':'学生保存画像后，会显示在这里。').'</p></div><p class="pcs-muted pcs-footnote">导出包含本班全部已保存草稿，不受搜索筛选影响。用表格软件导入CSV时，请将学号列设为文本，以保留前导零。</p>';
local_preclass_sample_footer();
