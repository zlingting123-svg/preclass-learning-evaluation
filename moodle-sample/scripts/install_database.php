<?php
// Keep generated passwords out of OS process arguments and public logs.
$work=dirname(__DIR__).'/work';
$credentials=json_decode(file_get_contents($work.'/private/credentials.json'),true,512,JSON_THROW_ON_ERROR);
$argv=[__FILE__,'--lang=en','--adminuser='.$credentials['admin']['username'],
    '--adminpass='.$credentials['admin']['password'],'--adminemail=sample@example.invalid',
    '--fullname=环境评价与管理 · 本地模拟样板','--shortname=课前学习样板','--agree-license'];
$_SERVER['argv']=$argv;$_SERVER['argc']=count($argv);
require $work.'/moodle/admin/cli/install_database.php';
