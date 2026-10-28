<?php
require_once(__DIR__.'/../../config.php');
require_once(__DIR__.'/lib.php');
require_login();
$PAGE->set_url('/local/preclass_sample/index.php');
$sampleids = json_decode(get_config('local_preclass_sample', 'courseids') ?: '[]', true);
$courses = enrol_get_my_courses('id,fullname,shortname,category', 'fullname');
if (is_siteadmin()) { $courses = $DB->get_records_list('course', 'id', $sampleids); }
$courses = array_filter($courses, fn($course) => in_array((int)$course->id, $sampleids, true));
$categories = []; $published = 0; $teaching = false;
foreach ($courses as $course) {
    if (has_capability('mod/assign:grade', context_course::instance($course->id))) { $teaching = true; }
    $categories[$course->category] = $DB->get_field('course_categories', 'name', ['id'=>$course->category]);
    foreach (get_fast_modinfo($course)->instances['assign'] ?? [] as $cm) { if ($cm->uservisible) { $published++; } }
}
local_preclass_sample_header('我的课前任务');
echo '<div class="pcs-intro"><div><p class="pcs-eyebrow">环境评价与管理</p><h3>课程概览</h3><p>'.($teaching ? '从下方选择课程，查看学生的作业与画像草稿。' : '从下方选择课程，继续填写画像或完成文字作业。').'</p></div><div class="pcs-stats"><div><strong>'.count($courses).'</strong><span>我的课程</span></div><div><strong>'.$published.'</strong><span>已发布作业</span></div></div></div>';
echo '<div class="pcs-toolbar" data-course-tools hidden><label>查找课程<input type="search" data-course-search placeholder="输入课程或班级名称"></label><label>教学批次<select data-course-category><option value="">全部批次</option>';
foreach ($categories as $id=>$name) { echo '<option value="'.(int)$id.'">'.s($name).'</option>'; }
echo '</select></label><span class="pcs-muted" data-course-count role="status"></span></div>';
echo '<div class="pcs-grid">';
foreach ($courses as $course) {
    $context = context_course::instance($course->id);
    $teacher = has_capability('mod/assign:grade', $context);
    echo '<section class="pcs-card" data-course-card data-name="'.s($course->fullname).'" data-category="'.(int)$course->category.'"><div class="pcs-card-heading"><span class="pcs-course-icon">'.local_preclass_sample_icon('book').'</span><span class="pcs-badge">'.($teacher ? '教师工作台' : '学生任务').'</span></div><h3>'.s($course->fullname).'</h3><p class="pcs-muted">'.s($categories[$course->category]).'</p>';
    $modinfo = get_fast_modinfo($course); $visible = 0;
    foreach ($modinfo->instances['assign'] ?? [] as $cm) {
        if (!$cm->uservisible) { continue; } $visible++;
        if ($teacher) {
            $count = $DB->count_records('assign_submission', ['assignment'=>$cm->instance, 'latest'=>1, 'status'=>'submitted']);
            $status = $count.' 份已提交'; $action = '查看答卷与反馈'; $tone = '';
        } else {
            $submission = $DB->get_record('assign_submission', ['assignment'=>$cm->instance, 'userid'=>$USER->id, 'latest'=>1]);
            $submitted = $submission && $submission->status === 'submitted';
            $draft = $submission && $submission->status === 'draft';
            $status = $submitted ? '已提交' : ($draft ? '草稿待提交' : '未开始');
            $action = $submitted ? '查看已提交答卷' : ($draft ? '继续文字作答' : '开始文字作答');
            $tone = $submitted ? ' pcs-badge-success' : ' pcs-badge-warm';
        }
        echo '<div class="pcs-task"><div class="pcs-task-title"><span class="pcs-badge'.$tone.'">'.s($status).'</span><h4>'.s($cm->name).'</h4></div><p class="pcs-muted">文字作业 · 评价体系待配置</p>'.html_writer::link(new moodle_url('/mod/assign/view.php', ['id'=>$cm->id]), s($action).local_preclass_sample_icon('arrow'), ['class'=>'pcs-button'.(!$teacher && $submitted ? ' pcs-button-secondary' : '')]).'</div>';
    }
    foreach ($modinfo->instances['page'] ?? [] as $resource) {
        if ($resource->uservisible) { echo '<div class="pcs-task"><h4>'.s($resource->name).'</h4>'.html_writer::link(new moodle_url('/mod/page/view.php',['id'=>$resource->id]),'阅读课程材料',['class'=>'pcs-button pcs-button-secondary']).'</div>'; }
    }
    if (!$visible) { echo '<div class="pcs-task pcs-task-empty"><h4>作业尚未发布</h4><p class="pcs-muted">'.($teacher ? '作业发布后将显示在这里。' : '当前可以先填写课前画像，作业发布后将显示在这里。').'</p></div>'; }
    echo '<div class="pcs-profile-entry">'.local_preclass_sample_icon('profile').'<div><strong>课前学生画像</strong>';
    if (has_capability('local/preclass_sample:fillprofile', $context)) {
        $draft = $DB->get_record('local_preclass_profile',['courseid'=>$course->id, 'userid'=>$USER->id], 'id,timemodified');
        echo '<p class="pcs-muted">'.($draft ? '草稿已保存 · '.s(userdate($draft->timemodified,'%m月%d日 %H:%M')) : '7题可选填 · 不计成绩').'</p>'.html_writer::link(new moodle_url('/local/preclass_sample/profile.php', ['courseid'=>$course->id]), $draft ? '继续填写画像' : '填写画像草稿');
    }
    if (has_capability('local/preclass_sample:viewprofiles', $context)) {
        $count = $DB->count_records('local_preclass_profile',['courseid'=>$course->id]);
        echo '<p class="pcs-muted">'.$count.' 份已保存草稿 · 不计成绩</p>'.html_writer::link(new moodle_url('/local/preclass_sample/reports.php', ['courseid'=>$course->id]), '查看本班画像与导出');
    }
    echo '</div></div><div class="pcs-card-footer"><span>每期计划4次作业</span>'.html_writer::link(new moodle_url('/course/view.php', ['id'=>$course->id]), '课程详情').'</div></section>';
}
echo '</div><div class="pcs-empty" data-course-empty '.($courses?'hidden':'').'><h3>暂无匹配的课程</h3><p>试试其他课程名称或教学批次；尚未选课时，请联系教师。</p><button type="button" class="pcs-button pcs-button-secondary" data-course-reset hidden>清除筛选</button></div>';
echo '<p class="pcs-muted pcs-footnote">正式教学仍仅配置第1次样板作业；额外测试练习不占每期4次作业计划，不计成绩。</p>';
local_preclass_sample_footer();
