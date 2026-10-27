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
        if (!$error) { redirect($PAGE->url, '草稿已保存到Moodle数据库。', null, \core\output\notification::NOTIFY_SUCCESS); }
    } catch (InvalidArgumentException $e) { $error = get_string('invalidanswer', 'local_preclass_sample'); }
}
$stored = $record ? json_decode($record->answers, true) : ['answers'=>[],'other'=>[]];
$values = $conflict ? $answers : $stored['answers'];
$other = $conflict ? $extras : ($stored['other'] ?? []);
if ($error) { http_response_code($conflict ? 409 : 400); }
local_preclass_sample_header('课前学生画像 · 草稿', $course);
echo html_writer::link(new moodle_url('/local/preclass_sample/index.php'), '← 返回任务中心');
echo '<p>保留18题原文；仅7题已明确题型，可选填保存。其余11题等待教师确认。量表只显示1—5，锚点尚未确定；本页不生成能力分或成绩。</p>';
if ($error) { echo $OUTPUT->notification(s($error), 'error'); }
echo '<p class="pcs-muted">当前服务器草稿版本：'.(int)($record->version??0).'。正式提交尚未开放；本草稿不计入4次作业。</p>';
echo '<form method="post" action="'.s($PAGE->url->out(false)).'">';
echo '<input type="hidden" name="sesskey" value="'.s(sesskey()).'">';
echo '<input type="hidden" name="expectedversion" value="'.(int)($conflict ? $expected : ($record->version??0)).'">';
$section = '';
foreach (profile_schema::questions() as $q) {
    $qid=$q['id']; $value=$values[$qid]??null;
    if ($q['section'] !== $section) { $section=$q['section']; echo '<h3 class="pcs-section">'.s($section).'</h3>'; }
    echo '<fieldset class="pcs-question '.($q['type']===null?'pcs-pending':'').'"><legend>'.(int)$q['number'].'. '.s($q['prompt']).'</legend>';
    if ($q['type']===null) {
        echo '<p class="pcs-muted">题型待确认，暂不采集；以下保留原始选项。</p><ul>';
        foreach ($q['sourceLines'] as $line) { echo '<li>'.s($line).'</li>'; }
        echo '</ul>';
    } else if ($q['type']==='text') {
        echo '<label for="'.s($qid).'">选填文本</label><textarea maxlength="4000" id="'.s($qid).'" name="answers['.s($qid).']">'.s(is_string($value)?$value:'').'</textarea>';
    } else if ($q['type']==='matrix_scale') {
        foreach ($q['rows'] as $row) {
            $key=$qid.'-'.$row['id'];
            echo '<label for="'.s($key).'">'.s($row['label']).'<select id="'.s($key).'" name="answers['.s($qid).']['.s($row['id']).']"><option value="">未填写</option>';
            for ($n=1;$n<=5;$n++) { echo '<option value="'.$n.'"'.((string)($value[$row['id']]??'')===(string)$n?' selected':'').'>'.$n.'</option>'; }
            echo '</select></label>';
        }
    } else {
        foreach ($q['choices'] as $choice) {
            $checked=is_array($value)&&in_array($choice['id'],$value,true);
            echo '<label><input type="checkbox" name="answers['.s($qid).'][]" value="'.s($choice['id']).'"'.($checked?' checked':'').'>'.s($choice['label']).'</label>';
        }
        if (in_array($qid,['profile-14','profile-16'],true)) {
            echo '<label>其他补充（选填）<input class="form-control" maxlength="1000" name="other['.s($qid).']" value="'.s($other[$qid]??'').'"></label>';
        }
    }
    echo '</fieldset>';
}
echo '<div class="pcs-actions"><button type="submit" class="btn btn-primary">保存画像草稿</button></div></form>';
echo $OUTPUT->footer();
