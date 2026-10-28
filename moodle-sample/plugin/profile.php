<?php
require_once(__DIR__.'/../../config.php');
require_once(__DIR__.'/lib.php');
use local_preclass_sample\profile_schema;
$courseid = required_param('courseid', PARAM_INT);
$course = local_preclass_sample_course($courseid);
$context = context_course::instance($courseid);
require_capability('local/preclass_sample:fillprofile', $context);
$PAGE->set_url('/local/preclass_sample/profile.php', ['courseid'=>$courseid]);
$record = $DB->get_record('local_preclass_profile', ['courseid'=>$courseid,'userid'=>$USER->id]);
$error = null;
$conflict = false;
$raw = $_POST['answers'] ?? [];
$other = $_POST['other'] ?? [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_sesskey();
    try {
        if (!is_array($raw) || !is_array($other)) { throw new InvalidArgumentException(); }
        $answers = profile_schema::normalise($raw);
        $extras = [];
        foreach ($other as $key=>$value) {
            if (!in_array($key, ['profile-14','profile-16'], true) || !is_string($value) || mb_strlen($value)>1000) {
                throw new InvalidArgumentException();
            }
            $extras[$key] = $value;
        }
        $factory = \core\lock\lock_config::get_lock_factory('local_preclass_sample');
        $lock = $factory->get_lock('profile:'.$courseid.':'.$USER->id, 5);
        if (!$lock) { throw new moodle_exception('locktimeout'); }
        try {
            $tx = $DB->start_delegated_transaction();
            $current = $DB->get_record('local_preclass_profile', ['courseid'=>$courseid,'userid'=>$USER->id]);
            $expected = required_param('expectedversion', PARAM_INT);
            if (($current->version ?? 0) != $expected) {
                $error = get_string('conflict', 'local_preclass_sample');
                $conflict = true;
            } else {
                $updated = (object)['courseid'=>$courseid,'userid'=>$USER->id,
                    'answers'=>json_encode(['answers'=>$answers,'other'=>$extras], JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
                    'version'=>$expected+1,'timemodified'=>time()];
                if ($current) { $updated->id=$current->id; $DB->update_record('local_preclass_profile',$updated); }
                else { $updated->timecreated=time(); $DB->insert_record('local_preclass_profile',$updated); }
            }
            $tx->allow_commit();
        } finally { $lock->release(); }
        if (!$error) { redirect($PAGE->url, '画像草稿已保存。', null, \core\output\notification::NOTIFY_SUCCESS); }
    } catch (InvalidArgumentException $e) { $error = get_string('invalidanswer', 'local_preclass_sample'); }
}
$stored = $record ? json_decode($record->answers, true) : ['answers'=>[],'other'=>[]];
$values = $conflict ? $answers : $stored['answers'];
$extrasdisplay = $conflict ? $extras : ($stored['other'] ?? []);
// Retain valid edits when another submitted field is invalid; never echo unvalidated nested input.
if ($error && !$conflict && is_array($raw)) {
    foreach ($raw as $id=>$value) {
        try { $values = array_replace($values, profile_schema::normalise([$id=>$value])); }
        catch (InvalidArgumentException $e) { /* Keep the stored value for this invalid field. */ }
    }
    if (is_array($other)) {
        foreach (['profile-14','profile-16'] as $id) {
            if (isset($other[$id]) && is_string($other[$id]) && mb_strlen($other[$id])<=1000) { $extrasdisplay[$id]=$other[$id]; }
        }
    }
}
$other = $extrasdisplay;
if ($error) { http_response_code($conflict ? 409 : 400); }
local_preclass_sample_header('课前学生画像', $course);
echo '<p class="pcs-lead">从自己的经验出发，记录你的兴趣与学习基础。可以分次填写，保存后再回来继续。</p>';
echo '<details class="pcs-explainer"><summary>填写说明：7题可选填，11题待确认</summary><p>保留18题原文；仅7题已明确题型，可选填保存。其余11题等待教师确认。量表只显示1—5，锚点尚未确定；本页不生成能力分或成绩。正式提交尚未开放；本草稿不计入4次作业。</p></details>';
if ($error) {
    echo '<div class="pcs-error" role="alert"><strong>'.s($error).'</strong><p>本次没有保存。请保留本页输入，检查后再操作。</p>';
    if ($conflict) { echo html_writer::link($PAGE->url, '在新标签页查看已保存草稿', ['target'=>'_blank','rel'=>'noopener','class'=>'pcs-button pcs-button-secondary']); }
    echo '</div>';
}
$questions=profile_schema::questions();
$filled=0;
foreach($questions as $q) {
    $v=$values[$q['id']]??null;
    if($q['type']!==null && ((is_array($v)?count($v)>0:(is_string($v)&&trim($v)!=='')) || trim($other[$q['id']]??'')!=='')) { $filled++; }
}
echo '<form id="pcs-profile-form" method="post" data-unsaved="'.($error?'true':'false').'" action="'.s($PAGE->url->out(false)).'">';
echo '<input type="hidden" name="sesskey" value="'.s(sesskey()).'">';
echo '<input type="hidden" name="expectedversion" value="'.(int)($conflict ? $expected : ($record->version??0)).'">';
echo '<div class="pcs-form-layout"><aside class="pcs-form-sidebar"><div class="pcs-progress-panel"><strong>我的填写进度</strong><p data-progress-text>已填写 '.$filled.' / 7 题</p><progress data-progress value="'.$filled.'" max="7" aria-label="已填写题数"></progress><small>仅表示填写情况，不代表成绩。量表可分次补充。</small></div><details class="pcs-question-nav" open><summary>题目导航</summary><nav aria-label="画像题目导航">';
foreach($questions as $q) {
    echo '<a href="#question-'.s($q['id']).'" data-nav-question="'.s($q['id']).'" class="'.($q['type']===null?'pcs-nav-pending':'').'" aria-label="第'.$q['number'].'题：'.s($q['prompt']).($q['type']===null?'，待确认':'').'">'.$q['number'].'</a>';
}
echo '</nav><p class="pcs-muted">绿色：已有填写<br>灰色：题型待确认</p></details></aside><div class="pcs-form-content">';
$section = '';
foreach ($questions as $q) {
    $qid=$q['id']; $value=$values[$qid]??null;
    if ($q['section'] !== $section) { $section=$q['section']; echo '<h3 class="pcs-section">'.s($section).'</h3>'; }
    echo '<fieldset id="question-'.s($qid).'" data-question="'.s($qid).'" data-editable="'.($q['type']===null?'false':'true').'" class="pcs-question '.($q['type']===null?'pcs-pending':'').'"><legend><span class="pcs-question-number">'.(int)$q['number'].'</span>'.s($q['prompt']).'</legend>';
    if ($q['type']===null) {
        echo '<details><summary>题型待确认，暂不采集 · 查看原始选项</summary><ul>';
        foreach ($q['sourceLines'] as $line) { echo '<li>'.s(ltrim($line, '- ')).'</li>'; }
        echo '</ul></details>';
    } else if ($q['type']==='text') {
        echo '<label for="'.s($qid).'">选填文本</label><textarea maxlength="4000" id="'.s($qid).'" name="answers['.s($qid).']" placeholder="在这里写下你的回答">'.s(is_string($value)?$value:'').'</textarea><small class="pcs-muted">最多4000字</small>';
    } else if ($q['type']==='matrix_scale') {
        echo '<p class="pcs-muted">各项可选填，未填写的项目不会按0分处理。</p><div class="pcs-matrix">';
        foreach ($q['rows'] as $row) {
            $key=$qid.'-'.$row['id'];
            echo '<label for="'.s($key).'">'.s($row['label']).'<select id="'.s($key).'" name="answers['.s($qid).']['.s($row['id']).']"><option value="">未填写</option>';
            for ($n=1;$n<=5;$n++) { echo '<option value="'.$n.'"'.((string)($value[$row['id']]??'')===(string)$n?' selected':'').'>'.$n.'</option>'; }
            echo '</select></label>';
        }
        echo '</div>';
    } else {
        echo '<p class="pcs-muted">可选择多项，也可以暂时留空。</p><div class="pcs-choices">';
        foreach ($q['choices'] as $choice) {
            $checked=is_array($value)&&in_array($choice['id'],$value,true);
            echo '<label><input type="checkbox" name="answers['.s($qid).'][]" value="'.s($choice['id']).'"'.($checked?' checked':'').'><span>'.s($choice['label']).'</span></label>';
        }
        echo '</div>';
        if (in_array($qid,['profile-14','profile-16'],true)) {
            echo '<label class="pcs-other">其他补充（选填）<input maxlength="1000" name="other['.s($qid).']" value="'.s($other[$qid]??'').'"></label>';
        }
    }
    echo '</fieldset>';
}
echo '</div></div><div class="pcs-savebar"><div><strong data-save-state role="status">'.($error?'本页修改尚未保存':($record?'已保存草稿':'尚未保存草稿')).'</strong><small>'.($record?'上次保存：'.s(userdate($record->timemodified,'%m月%d日 %H:%M')):'可以先填写一部分，随时保存。').'</small></div><button type="submit" class="pcs-button">保存画像草稿'.local_preclass_sample_icon('check').'</button></div></form>';
local_preclass_sample_footer();
