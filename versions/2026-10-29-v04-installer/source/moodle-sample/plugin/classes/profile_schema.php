<?php
namespace local_preclass_sample;
defined('MOODLE_INTERNAL') || die();

/** Source-faithful, partial, ungraded response validation. GPL-3.0-or-later. */
final class profile_schema {
    public static function questions(): array {
        return json_decode(file_get_contents(__DIR__.'/../data/questions.json'), true, 512, JSON_THROW_ON_ERROR)['questions'];
    }
    public static function normalise(array $answers): array {
        $questions = array_column(self::questions(), null, 'id');
        $result = [];
        foreach ($answers as $id => $value) {
            $q = $questions[$id] ?? null;
            if (!$q || $q['type'] === null) { throw new \InvalidArgumentException('Unconfigured question'); }
            if ($q['type'] === 'text') {
                if (!is_string($value) || mb_strlen($value) > 4000) { throw new \InvalidArgumentException('Invalid text'); }
                $result[$id] = $value;
            } else if ($q['type'] === 'matrix_scale') {
                if (!is_array($value)) { throw new \InvalidArgumentException('Invalid matrix'); }
                $rows = array_column($q['rows'], 'id');
                $result[$id] = [];
                foreach ($value as $row => $score) {
                    if ($score === '') { continue; }
                    if (!in_array($row, $rows, true) || !is_scalar($score) || !preg_match('/^[1-5]$/', (string)$score)) {
                        throw new \InvalidArgumentException('Invalid matrix cell');
                    }
                    $result[$id][$row] = (int)$score;
                }
            } else if ($q['type'] === 'multiple_choice') {
                if (!is_array($value)) { throw new \InvalidArgumentException('Invalid choices'); }
                $allowed = array_column($q['choices'], 'id');
                if (count($value) !== count(array_unique($value, SORT_REGULAR))) { throw new \InvalidArgumentException('Duplicate choice'); }
                foreach ($value as $choice) {
                    if (!is_string($choice) || !in_array($choice, $allowed, true)) { throw new \InvalidArgumentException('Invalid choice'); }
                }
                $result[$id] = array_values($value);
            }
        }
        return $result;
    }
}
