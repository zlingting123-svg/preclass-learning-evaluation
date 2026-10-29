<?php
defined('MOODLE_INTERNAL') || die();
function local_preclass_sample_extend_navigation(global_navigation $navigation) {
    if (isloggedin() && !isguestuser()) {
        $navigation->add('课前任务', new moodle_url('/local/preclass_sample/index.php'), navigation_node::TYPE_CUSTOM);
    }
}
function local_preclass_sample_course(int $id): stdClass {
    $course = get_course($id);
    require_login($course);
    return $course;
}
function local_preclass_sample_header(string $title, ?stdClass $course = null) {
    global $PAGE, $OUTPUT;
    $PAGE->set_secondary_navigation(false);
    $PAGE->set_show_course_index(false);
    $PAGE->set_context($course ? context_course::instance($course->id) : context_system::instance());
    $PAGE->set_title($title); $PAGE->set_heading('环境评价与管理 · 本地模拟样板');
    $PAGE->requires->css('/local/preclass_sample/styles.css');
    $PAGE->requires->js('/local/preclass_sample/ui.js');
    echo $OUTPUT->header();
    echo '<div class="pcs-app"><div class="pcs-brand">'.local_preclass_sample_icon('leaf').'<span>学习平台</span><span class="pcs-badge pcs-badge-muted">本地样板</span></div>';
    if ($course) { echo '<div class="pcs-breadcrumb">'.html_writer::link(new moodle_url('/local/preclass_sample/index.php'),'课前任务').' / '.s($course->fullname).'</div>'; }
    echo '<div class="pcs-page-title"><h1>'.s($title).'</h1></div>';
    echo '<p class="pcs-notice">模拟教学体验 · 所有师生与答卷均为模拟数据，画像不计成绩，正式评价体系待配置。</p>';
}
function local_preclass_sample_footer() {
    global $OUTPUT;
    echo '</div>'.$OUTPUT->footer();
}
function local_preclass_sample_icon(string $name): string {
    $paths = [
        'leaf'=>'<path d="M20 4c-1 9-3 15-10 15A6 6 0 0 1 4 13C4 6 11 4 20 4Z"/><path d="m4 21 10-10"/>',
        'arrow'=>'<path d="M5 12h14m-6-6 6 6-6 6"/>',
        'book'=>'<path d="M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
        'check'=>'<path d="m5 12 4 4L19 6"/>',
        'profile'=>'<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
    ];
    return '<svg class="pcs-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'.($paths[$name]??$paths['book']).'</svg>';
}
