<?php
defined('MOODLE_INTERNAL') || die();
$capabilities = [
    'local/preclass_sample:fillprofile' => [
        'captype'=>'write', 'contextlevel'=>CONTEXT_COURSE,
        'archetypes'=>['student'=>CAP_ALLOW],
    ],
    'local/preclass_sample:viewprofiles' => [
        'captype'=>'read', 'contextlevel'=>CONTEXT_COURSE, 'riskbitmask'=>RISK_PERSONAL,
        'archetypes'=>['teacher'=>CAP_ALLOW,'editingteacher'=>CAP_ALLOW,'manager'=>CAP_ALLOW],
    ],
];
