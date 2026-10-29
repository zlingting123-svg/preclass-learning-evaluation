<?php
// Local sample branding via public site settings and language customisations. GPL-3.0-or-later.
define('CLI_SCRIPT', true);
$sample = dirname(__DIR__);
require $sample.'/work/moodle/config.php';
if ($CFG->wwwroot !== 'http://127.0.0.1:8873') { throw new RuntimeException('Local sample only'); }
$strings = <<<'LANG'
<?php
$string['loginwelcometitle'] = '欢迎使用学习平台';
$string['poweredbymoodle'] = '学习平台 · 本地教学样板';
$string['moodlelogo'] = '学习平台';
LANG;
$instructions = '<div class="pcs-login-kicker">环境评价与管理</div><h1 class="pcs-login-heading">学习平台</h1><p class="pcs-login-copy">从课前的一次思考开始，<br>让每一堂课都有充分的准备。</p><div class="pcs-login-steps"><div><strong>01</strong>记录兴趣与学习基础</div><div><strong>02</strong>保存草稿，完成文字作答</div><div><strong>03</strong>带着问题，进入课堂</div></div><p class="pcs-login-note">本地样板 · 仅使用模拟师生账号与答卷</p>';
$hash = hash('sha256', $strings.$instructions.file_get_contents($sample.'/plugin/branding.css'));
$changed = get_config('local_preclass_sample', 'brandinghash') !== $hash;
foreach (['zh_cn_local','en_local'] as $lang) {
    $dir = $CFG->dataroot.'/lang/'.$lang;
    if (!is_dir($dir)) { mkdir($dir,0700,true); }
    $path = $dir.'/moodle.php';
    if (!file_exists($path) || file_get_contents($path)!==$strings) { file_put_contents($path,$strings); $changed=true; }
}
foreach (['fullname','shortname'] as $field) {
    if ($DB->get_field('course',$field,['id'=>SITEID]) !== '学习平台') {
        $DB->set_field('course',$field,'学习平台',['id'=>SITEID]); $changed=true;
    }
}
$settings = [
    'auth_instructions'=>$instructions,
    'additionalhtmlhead'=>'<link rel="stylesheet" href="'.$CFG->wwwroot.'/local/preclass_sample/branding.css?v='.substr($hash,0,12).'">',
    'showservicesandsupportcontent'=>0,
];
foreach ($settings as $name=>$value) {
    if ((string)get_config('core',$name)!==(string)$value) { set_config($name,$value); $changed=true; }
}
if ($changed) {
    set_config('brandinghash',$hash,'local_preclass_sample');
    purge_all_caches();
}
echo "学习平台：站点品牌与登录页已同步。\n";
