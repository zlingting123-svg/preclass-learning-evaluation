<?php
// Standalone behavioral checks; no Moodle database required.
define('MOODLE_INTERNAL', true);
require __DIR__ . '/../plugin/classes/profile_schema.php';
use local_preclass_sample\profile_schema;
$checks = [];
function check($name, $condition) {
    global $checks;
    if (!$condition) { throw new RuntimeException('FAIL: ' . $name); }
    $checks[] = $name;
}
function rejects($name, $fn) {
    try { $fn(); } catch (InvalidArgumentException $e) { check($name, true); return; }
    check($name, false);
}
$questions = profile_schema::questions();
check('18 source questions retained', count($questions) === 18);
check('only seven confirmed types accept responses', count(array_filter($questions, fn($q) => $q['type'] !== null)) === 7);
$saved = profile_schema::normalise(['profile-02'=>'环境工程', 'profile-07'=>['r1'=>'2','r2'=>'5'], 'profile-09'=>['c1','c2']]);
check('matrix saved as self-report values, not grade', $saved['profile-07']['r2'] === 5 && !isset($saved['score']));
check('partial draft permitted', profile_schema::normalise([]) === []);
rejects('unconfirmed question cannot silently acquire a type', fn() => profile_schema::normalise(['profile-01'=>'大一']));
rejects('out-of-range matrix value refused', fn() => profile_schema::normalise(['profile-07'=>['r1'=>6]]));
rejects('unknown matrix row refused', fn() => profile_schema::normalise(['profile-07'=>['r999'=>3]]));
rejects('unknown option refused', fn() => profile_schema::normalise(['profile-09'=>['admin']]));
rejects('duplicate multiselect refused', fn() => profile_schema::normalise(['profile-09'=>['c1','c1']]));
rejects('text size bounded', fn() => profile_schema::normalise(['profile-18'=>str_repeat('x', 4001)]));
check('leading zero identity is not part of questionnaire payload', !isset($saved['studentNumber']));
echo json_encode(['passed'=>count($checks),'failed'=>0,'checks'=>$checks], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
