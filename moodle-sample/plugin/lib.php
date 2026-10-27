<?php
defined('MOODLE_INTERNAL') || die();
function local_preclass_sample_extend_navigation(global_navigation $navigation) {
    if (isloggedin() && !isguestuser()) {
        $navigation->add('课前学习样板', new moodle_url('/local/preclass_sample/index.php'), navigation_node::TYPE_CUSTOM);
    }
}
function local_preclass_sample_course(int $id): stdClass {
    $course = get_course($id);
    require_login($course);
    return $course;
}
function local_preclass_sample_header(string $title, ?stdClass $course = null) {
    global $PAGE, $OUTPUT;
    $PAGE->set_context($course ? context_course::instance($course->id) : context_system::instance());
    $PAGE->set_title($title); $PAGE->set_heading('环境评价与管理 · 本地模拟样板');
    $PAGE->requires->css('/local/preclass_sample/styles.css');
    echo $OUTPUT->header();
    echo html_writer::div('仅用于模拟教学流程。未接入正式评分模型；画像不计成绩；不是正式上线系统。', 'pcs-notice');
    echo $OUTPUT->heading($title, 2);
}
