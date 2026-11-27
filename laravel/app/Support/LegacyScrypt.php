<?php

namespace App\Support;

final class LegacyScrypt
{
    private const N = 16384;

    public static function isLegacyHash(string $storedHash): bool
    {
        return preg_match('/^[a-f0-9]{16,64}:[a-f0-9]{128}$/i', trim($storedHash)) === 1;
    }

    public static function verify(string $password, string $storedHash): bool
    {
        $clean = trim($storedHash);
        if (!self::isLegacyHash($clean)) {
            return false;
        }

        [$salt, $expectedHex] = explode(':', $clean, 2);

        if (function_exists('ini_set')) {
            @ini_set('max_execution_time', '30');
        }

        $b = hash_pbkdf2('sha256', $password, $salt, 1, 1024, true);
        if (!is_string($b) || strlen($b) !== 1024) {
            return false;
        }

        $outBin = PHP_INT_SIZE >= 8
            ? self::roMix64($b)
            : self::roMix32($b);

        $derived = hash_pbkdf2('sha256', $password, $outBin, 1, 64, true);
        if (!is_string($derived) || strlen($derived) !== 64) {
            return false;
        }

        return hash_equals(strtolower($expectedHex), bin2hex($derived));
    }

    private static function roMix64(string $b): string
    {
        $n = self::N;
        $x = array_values(unpack('V*', $b));
        $curBin = $b;
        $v = new \SplFixedArray($n);

        for ($i = 0; $i < $n; $i++) {
            $v[$i] = $curBin;
            $x = self::blockMix64($x);
            $curBin = pack('V*', ...$x);
        }

        for ($i = 0; $i < $n; $i++) {
            $j = $x[240] & 16383;
            $curBin = $curBin ^ $v[$j];
            $x = array_values(unpack('V*', $curBin));
            $x = self::blockMix64($x);
            $curBin = pack('V*', ...$x);
        }

        return $curBin;
    }

    /**
     * @param array<int, int> $x
     * @return array<int, int>
     */
    private static function blockMix64(array $x): array
    {
        $t0 = $x[240];
        $t1 = $x[241];
        $t2 = $x[242];
        $t3 = $x[243];
        $t4 = $x[244];
        $t5 = $x[245];
        $t6 = $x[246];
        $t7 = $x[247];
        $t8 = $x[248];
        $t9 = $x[249];
        $t10 = $x[250];
        $t11 = $x[251];
        $t12 = $x[252];
        $t13 = $x[253];
        $t14 = $x[254];
        $t15 = $x[255];

        $out = array_fill(0, 256, 0);

        for ($c = 0; $c < 16; $c++) {
            $base = $c << 4;
            $t0 ^= $x[$base];
            $t1 ^= $x[$base + 1];
            $t2 ^= $x[$base + 2];
            $t3 ^= $x[$base + 3];
            $t4 ^= $x[$base + 4];
            $t5 ^= $x[$base + 5];
            $t6 ^= $x[$base + 6];
            $t7 ^= $x[$base + 7];
            $t8 ^= $x[$base + 8];
            $t9 ^= $x[$base + 9];
            $t10 ^= $x[$base + 10];
            $t11 ^= $x[$base + 11];
            $t12 ^= $x[$base + 12];
            $t13 ^= $x[$base + 13];
            $t14 ^= $x[$base + 14];
            $t15 ^= $x[$base + 15];

            $x0 = $t0;
            $x1 = $t1;
            $x2 = $t2;
            $x3 = $t3;
            $x4 = $t4;
            $x5 = $t5;
            $x6 = $t6;
            $x7 = $t7;
            $x8 = $t8;
            $x9 = $t9;
            $x10 = $t10;
            $x11 = $t11;
            $x12 = $t12;
            $x13 = $t13;
            $x14 = $t14;
            $x15 = $t15;

            for ($round = 0; $round < 4; $round++) {
                $s = ($x0 + $x12) & 0xffffffff;
                $x4 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x4 + $x0) & 0xffffffff;
                $x8 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x8 + $x4) & 0xffffffff;
                $x12 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x12 + $x8) & 0xffffffff;
                $x0 ^= (($s << 18) & 0xffffffff) | ($s >> 14);

                $s = ($x5 + $x1) & 0xffffffff;
                $x9 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x9 + $x5) & 0xffffffff;
                $x13 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x13 + $x9) & 0xffffffff;
                $x1 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x1 + $x13) & 0xffffffff;
                $x5 ^= (($s << 18) & 0xffffffff) | ($s >> 14);

                $s = ($x10 + $x6) & 0xffffffff;
                $x14 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x14 + $x10) & 0xffffffff;
                $x2 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x2 + $x14) & 0xffffffff;
                $x6 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x6 + $x2) & 0xffffffff;
                $x10 ^= (($s << 18) & 0xffffffff) | ($s >> 14);

                $s = ($x15 + $x11) & 0xffffffff;
                $x3 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x3 + $x15) & 0xffffffff;
                $x7 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x7 + $x3) & 0xffffffff;
                $x11 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x11 + $x7) & 0xffffffff;
                $x15 ^= (($s << 18) & 0xffffffff) | ($s >> 14);

                $s = ($x0 + $x3) & 0xffffffff;
                $x1 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x1 + $x0) & 0xffffffff;
                $x2 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x2 + $x1) & 0xffffffff;
                $x3 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x3 + $x2) & 0xffffffff;
                $x0 ^= (($s << 18) & 0xffffffff) | ($s >> 14);

                $s = ($x5 + $x4) & 0xffffffff;
                $x6 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x6 + $x5) & 0xffffffff;
                $x7 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x7 + $x6) & 0xffffffff;
                $x4 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x4 + $x7) & 0xffffffff;
                $x5 ^= (($s << 18) & 0xffffffff) | ($s >> 14);

                $s = ($x10 + $x9) & 0xffffffff;
                $x11 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x11 + $x10) & 0xffffffff;
                $x8 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x8 + $x11) & 0xffffffff;
                $x9 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x9 + $x8) & 0xffffffff;
                $x10 ^= (($s << 18) & 0xffffffff) | ($s >> 14);

                $s = ($x15 + $x14) & 0xffffffff;
                $x12 ^= (($s << 7) & 0xffffffff) | ($s >> 25);
                $s = ($x12 + $x15) & 0xffffffff;
                $x13 ^= (($s << 9) & 0xffffffff) | ($s >> 23);
                $s = ($x13 + $x12) & 0xffffffff;
                $x14 ^= (($s << 13) & 0xffffffff) | ($s >> 19);
                $s = ($x14 + $x13) & 0xffffffff;
                $x15 ^= (($s << 18) & 0xffffffff) | ($s >> 14);
            }

            $t0 = ($t0 + $x0) & 0xffffffff;
            $t1 = ($t1 + $x1) & 0xffffffff;
            $t2 = ($t2 + $x2) & 0xffffffff;
            $t3 = ($t3 + $x3) & 0xffffffff;
            $t4 = ($t4 + $x4) & 0xffffffff;
            $t5 = ($t5 + $x5) & 0xffffffff;
            $t6 = ($t6 + $x6) & 0xffffffff;
            $t7 = ($t7 + $x7) & 0xffffffff;
            $t8 = ($t8 + $x8) & 0xffffffff;
            $t9 = ($t9 + $x9) & 0xffffffff;
            $t10 = ($t10 + $x10) & 0xffffffff;
            $t11 = ($t11 + $x11) & 0xffffffff;
            $t12 = ($t12 + $x12) & 0xffffffff;
            $t13 = ($t13 + $x13) & 0xffffffff;
            $t14 = ($t14 + $x14) & 0xffffffff;
            $t15 = ($t15 + $x15) & 0xffffffff;

            $destBase = (($c & 1) === 0 ? ($c >> 1) : (8 + ($c >> 1))) << 4;
            $out[$destBase] = $t0;
            $out[$destBase + 1] = $t1;
            $out[$destBase + 2] = $t2;
            $out[$destBase + 3] = $t3;
            $out[$destBase + 4] = $t4;
            $out[$destBase + 5] = $t5;
            $out[$destBase + 6] = $t6;
            $out[$destBase + 7] = $t7;
            $out[$destBase + 8] = $t8;
            $out[$destBase + 9] = $t9;
            $out[$destBase + 10] = $t10;
            $out[$destBase + 11] = $t11;
            $out[$destBase + 12] = $t12;
            $out[$destBase + 13] = $t13;
            $out[$destBase + 14] = $t14;
            $out[$destBase + 15] = $t15;
        }

        return $out;
    }

    private static function roMix32(string $b): string
    {
        $n = self::N;
        $w = array_values(unpack('v*', $b));
        $curBin = $b;
        $v = new \SplFixedArray($n);

        for ($i = 0; $i < $n; $i++) {
            $v[$i] = $curBin;
            $w = self::blockMix32($w);
            $curBin = pack('v*', ...$w);
        }

        for ($i = 0; $i < $n; $i++) {
            $j = $w[480] & 16383;
            $curBin = $curBin ^ $v[$j];
            $w = array_values(unpack('v*', $curBin));
            $w = self::blockMix32($w);
            $curBin = pack('v*', ...$w);
        }

        return $curBin;
    }

    /**
     * 32-bit PHP safe fallback using 16-bit unsigned halves (lo, hi).
     *
     * @param array<int, int> $w
     * @return array<int, int>
     */
    private static function blockMix32(array $w): array
    {
        $tLo = [];
        $tHi = [];
        for ($k = 0; $k < 16; $k++) {
            $tLo[$k] = $w[480 + ($k << 1)];
            $tHi[$k] = $w[481 + ($k << 1)];
        }

        $out = array_fill(0, 512, 0);
        $rotlAdd = static function (int $aLo, int $aHi, int $bLo, int $bHi, int $shift): array {
            $loSum = $aLo + $bLo;
            $sLo = $loSum & 0xffff;
            $sHi = ($aHi + $bHi + ($loSum >> 16)) & 0xffff;
            if ($shift < 16) {
                $rLo = (($sLo << $shift) & 0xffff) | ($sHi >> (16 - $shift));
                $rHi = (($sHi << $shift) & 0xffff) | ($sLo >> (16 - $shift));
            } else {
                $s = $shift - 16;
                $rLo = (($sHi << $s) & 0xffff) | ($sLo >> (16 - $s));
                $rHi = (($sLo << $s) & 0xffff) | ($sHi >> (16 - $s));
            }

            return [$rLo, $rHi];
        };

        $pairs = [
            [0, 12, 4, 7], [4, 0, 8, 9], [8, 4, 12, 13], [12, 8, 0, 18],
            [5, 1, 9, 7], [9, 5, 13, 9], [13, 9, 1, 13], [1, 13, 5, 18],
            [10, 6, 14, 7], [14, 10, 2, 9], [2, 14, 6, 13], [6, 2, 10, 18],
            [15, 11, 3, 7], [3, 15, 7, 9], [7, 3, 11, 13], [11, 7, 15, 18],
            [0, 3, 1, 7], [1, 0, 2, 9], [2, 1, 3, 13], [3, 2, 0, 18],
            [5, 4, 6, 7], [6, 5, 7, 9], [7, 6, 4, 13], [4, 7, 5, 18],
            [10, 9, 11, 7], [11, 10, 8, 9], [8, 11, 9, 13], [9, 8, 10, 18],
            [15, 14, 12, 7], [12, 15, 13, 9], [13, 12, 14, 13], [14, 13, 15, 18],
        ];

        for ($c = 0; $c < 16; $c++) {
            $base = $c << 5;
            for ($k = 0; $k < 16; $k++) {
                $tLo[$k] ^= $w[$base + ($k << 1)];
                $tHi[$k] ^= $w[$base + ($k << 1) + 1];
            }

            $xLo = $tLo;
            $xHi = $tHi;

            for ($round = 0; $round < 4; $round++) {
                foreach ($pairs as [$a, $b, $d, $sh]) {
                    [$rLo, $rHi] = $rotlAdd($xLo[$a], $xHi[$a], $xLo[$b], $xHi[$b], $sh);
                    $xLo[$d] ^= $rLo;
                    $xHi[$d] ^= $rHi;
                }
            }

            $destBase = (($c & 1) === 0 ? ($c >> 1) : (8 + ($c >> 1))) << 5;
            for ($k = 0; $k < 16; $k++) {
                $loSum = $tLo[$k] + $xLo[$k];
                $tLo[$k] = $loSum & 0xffff;
                $tHi[$k] = ($tHi[$k] + $xHi[$k] + ($loSum >> 16)) & 0xffff;
                $out[$destBase + ($k << 1)] = $tLo[$k];
                $out[$destBase + ($k << 1) + 1] = $tHi[$k];
            }
        }

        return $out;
    }
}
