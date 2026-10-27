<?php
require_once(__DIR__.'/../../config.php');
require_once(__DIR__.'/lib.php');
require_login();
$PAGE->set_url('/local/preclass_sample/index.php');
local_preclass_sample_header('我的课前任务');
$sampleids = json_decode(get_config('local_preclass_sample', 'courseids') ?: '[]', true);
$courses = enrol_get_my_courses('id,fullname,shortname,category', 'fullname');
if (is_siteadmin()) { $courses = $DB->get_records_list('course', 'id', $sampleids); }
echo html_writer::div('每期计划4次作业；本样板只发布第1次。所有师生与学号为模拟数据。', 'pcs-muted');
echo '<div class="pcs-grid">';
foreach ($courses as $course) {
    if (!in_array((int)$course->id, $sampleids, true)) { continue; }
    $context = context_course::instance($course->id);
    $teacher = has_capability('mod/assign:grade', $context);
    echo '<section class="pcs-card"><h3>'.s($course->fullname).'</h3>';
    $category = $DB->get_field('course_categories', 'name', ['id'=>$course->category]);
    echo html_writer::div(s($category).' · '.($teacher ? '教师工作台' : '学生任务'), 'pcs-muted');
    echo html_writer::link(new moodle_url('/course/view.php', ['id'=>$course->id]), '进入Moodle课程');
    $modinfo = get_fast_modinfo($course);
    foreach ($modinfo->instances['assign'] ?? [] as $cm) {
        if (!$cm->uservisible) { continue; }
        echo '<p><strong>第1次 · '.s($cm->name).'</strong></p>';
        echo html_writer::link(new moodle_url('/mod/assign/view.php', ['id'=>$cm->id]), $teacher ? '查看答卷与反馈' : '进入文字作答');
        echo '<p class="pcs-muted">评价体系待配置 · 无自动得分</p>';
    }
    echo '<p class="pcs-muted">第2—4次：教学计划，尚未发布。</p>';
    if (has_capability('local/preclass_sample:fillprofile', $context)) {
        echo html_writer::link(new moodle_url('/local/preclass_sample/profile.php', ['courseid'=>$course->id]), '课前画像 · 试填草稿');
    }
    if (has_capability('local/preclass_sample:viewprofiles', $context)) {
        echo html_writer::link(new moodle_url('/local/preclass_sample/reports.php', ['courseid'=>$course->id]), '本班画像与导出');
    }
    echo '</section>';
}
echo '</div>';
echo $OUTPUT->footer();
