<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showLogin(): View
    {
        return view('auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'max:150'],
            'password' => ['required', 'string'],
        ]);

        $identifier = trim($credentials['email']);
        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [strtolower($identifier)])
            ->orWhereRaw('LOWER(name) = ?', [strtolower($identifier)])
            ->first();

        if (!$user || empty($user->password)) {
            return back()->withErrors([
                'email' => 'Invalid email/username or password.',
            ])->onlyInput('email');
        }

        $storedHash = (string) $user->password;
        if (!str_starts_with($storedHash, '$')) {
            return back()->withErrors([
                'email' => 'This migrated account password must be set for Laravel. Use Forgot Password or complete /setup first.',
            ])->onlyInput('email');
        }

        $passwordMatches = false;
        try {
            $passwordMatches = Hash::check($credentials['password'], $storedHash);
        } catch (\Throwable) {
            $passwordMatches = false;
        }

        if (!$passwordMatches) {
            return back()->withErrors([
                'email' => 'Invalid email/username or password.',
            ])->onlyInput('email');
        }

        if (!$user->is_active) {
            return back()->withErrors([
                'email' => 'This account is currently disabled. Contact the Super Admin.',
            ])->onlyInput('email');
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();
        $request->session()->put('last_activity_ts', time());

        return redirect()->intended(route('dashboard'));
    }

    public function showForgotPassword(): View
    {
        return view('auth.forgot_password');
    }

    public function sendRecoveryCode(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
            'channel' => ['required', 'in:email,sms'],
        ]);

        if ($data['channel'] === 'email' && empty(config('mail.mailers.smtp.host'))) {
            return back()->withErrors(['channel' => 'Email delivery (SMTP) is not configured in environment settings.'])->withInput();
        }
        $smsGateway = env('SMS_GATEWAY_URL');
        if ($data['channel'] === 'sms' && empty($smsGateway)) {
            return back()->withErrors(['channel' => 'SMS delivery gateway is not configured in environment settings.'])->withInput();
        }

        $user = $this->findByEmailOrPhone($data['identifier']);
        if (!$user || !$user->is_active) {
            return back()
                ->with('code_sent', true)
                ->with('status', 'If an active account matches that email or mobile number, a 6-digit verification code has been sent.')
                ->withInput();
        }

        $code = (string) random_int(100000, 999999);
        $user->forceFill([
            'reset_token' => Hash::make($code),
            'reset_expires' => now()->addMinutes(10),
        ])->save();

        $shopName = Setting::getValue('shop_name', 'Youth IT POS');
        if ($data['channel'] === 'email') {
            Mail::raw(
                "Hello {$user->name},\n\nYour 6-digit password recovery code is: {$code}\n\nThis code expires in 10 minutes.",
                function ($msg) use ($user, $shopName) {
                    $msg->to($user->email)->subject("{$shopName} — Password Recovery Code");
                }
            );
        } else {
            $fallbackShopPhone = in_array($user->role, ['super_admin', 'admin'], true)
                ? Setting::getValue('shop_phone', '')
                : '';
            $targetPhone = trim((string) ($user->phone ?: $fallbackShopPhone));
            if ($targetPhone === '') {
                return back()->withErrors(['identifier' => 'No mobile number is registered for this account.'])->withInput();
            }
            $senderId = trim((string) env('SMS_SENDER_ID', ''));
            $clientId = trim((string) env('SMS_CLIENT_ID', ''));
            $smsUsername = trim((string) env('SMS_USERNAME', ''));
            $smsSecretKey = trim((string) env('SMS_SECRET_KEY', ''));
            $payload = [
                'to' => $targetPhone,
                'number' => ltrim($targetPhone, '+'),
                'MobileNumbers' => ltrim($targetPhone, '+'),
                'MobileNumber' => ltrim($targetPhone, '+'),
                'api_key' => (string) env('SMS_API_KEY', ''),
                'ApiKey' => (string) env('SMS_API_KEY', ''),
                'Apikey' => (string) env('SMS_API_KEY', ''),
                'type' => 'text',
                'TransactionType' => 'T',
                'message' => "{$shopName} recovery code: {$code} (valid 10 min).",
                'Message' => "{$shopName} recovery code: {$code} (valid 10 min).",
            ];
            if ($clientId !== '') {
                $payload['ClientId'] = $clientId;
                $payload['client_id'] = $clientId;
                if ($smsUsername === '') {
                    $payload['UserName'] = $clientId;
                }
            }
            if ($smsUsername !== '') {
                $payload['UserName'] = $smsUsername;
                $payload['username'] = $smsUsername;
            }
            if ($smsSecretKey !== '') {
                $payload['secretkey'] = $smsSecretKey;
                $payload['api_secret'] = $smsSecretKey;
            }
            if ($senderId !== '') {
                $payload['senderid'] = $senderId;
                $payload['sender_id'] = $senderId;
                $payload['SenderId'] = $senderId;
                $payload['SenderName'] = $senderId;
            }
            $smsResp = Http::asForm()->post($smsGateway, $payload);
            if ($smsResp->status() === 415 || $smsResp->status() === 405) {
                $smsResp = Http::get($smsGateway, $payload);
            }
            if ($smsResp->status() === 415 || $smsResp->status() === 405) {
                $smsResp = Http::withToken((string) env('SMS_API_KEY', ''))->post($smsGateway, $payload);
            }
            $smsJson = $smsResp->json();
            if (!$smsResp->successful() || (is_array($smsJson) && (!empty($smsJson['error_message']) || !empty($smsJson['error']) || ($smsJson['ok'] ?? true) === false))) {
                $reason = is_array($smsJson) ? ($smsJson['error_message'] ?? $smsJson['error'] ?? 'SMS gateway error.') : ('HTTP ' . $smsResp->status());
                return back()->withErrors(['identifier' => "SMS delivery failed: {$reason}"])->withInput();
            }
        }

        $request->session()->put([
            'recovery_step' => 'verify',
            'recovery_identifier' => $data['identifier'],
        ]);
        $request->session()->forget(['recovery_proof', 'recovery_user_id', 'recovery_proof_expires']);

        return back()
            ->with('status', "A 6-digit verification code has been sent via {$data['channel']}.")
            ->withInput();
    }

    public function verifyRecoveryCode(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
            'code' => ['required', 'digits:6'],
        ]);

        $user = $this->findByEmailOrPhone($data['identifier']);
        if (
            !$user ||
            !$user->is_active ||
            empty($user->reset_token) ||
            !$user->reset_expires ||
            now()->greaterThan($user->reset_expires) ||
            !Hash::check($data['code'], (string) $user->reset_token)
        ) {
            return back()
                ->withErrors(['code' => 'Invalid or expired verification code. Please check and try again.'])
                ->withInput();
        }

        $proof = bin2hex(random_bytes(32));
        $request->session()->put([
            'recovery_step' => 'reset',
            'recovery_identifier' => $data['identifier'],
            'recovery_proof' => hash('sha256', $proof),
            'recovery_user_id' => $user->id,
            'recovery_proof_expires' => time() + 600,
        ]);

        return back()
            ->with('status', 'Verification code matched! Please enter your new password.')
            ->withInput();
    }

    public function recoverPassword(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'digits:6'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = $this->findByEmailOrPhone($data['identifier']);
        $sessionProof = $request->session()->get('recovery_proof');
        $sessionUserId = (int) $request->session()->get('recovery_user_id', 0);
        $sessionExpires = (int) $request->session()->get('recovery_proof_expires', 0);
        $hasValidProof = $user && $sessionProof && $sessionUserId === (int) $user->id && time() <= $sessionExpires;

        $hasValidCode =
            $user &&
            !empty($data['code']) &&
            !empty($user->reset_token) &&
            $user->reset_expires &&
            !now()->greaterThan($user->reset_expires) &&
            Hash::check((string) $data['code'], (string) $user->reset_token);

        if (!$user || !$user->is_active || (!$hasValidProof && !$hasValidCode)) {
            return back()
                ->withErrors(['code' => 'Verification required before setting a new password.'])
                ->withInput();
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'reset_token' => null,
            'reset_expires' => null,
        ])->save();

        $request->session()->forget(['recovery_step', 'recovery_identifier', 'recovery_proof', 'recovery_user_id', 'recovery_proof_expires']);

        return redirect()->route('login')->with('status', 'Verification code confirmed and password updated. Please sign in.');
    }

    private function findByEmailOrPhone(string $rawIdentifier): ?User
    {
        $clean = strtolower(trim($rawIdentifier));
        $digits = preg_replace('/\D+/', '', $rawIdentifier);
        $tail = fn (string $d) => strlen($d) >= 8 ? substr($d, -10) : $d;

        $byText = User::query()
            ->whereRaw('LOWER(email) = ?', [$clean])
            ->orWhereRaw('LOWER(name) = ?', [$clean])
            ->first();
        if ($byText) {
            return $byText;
        }
        if (strlen($digits) >= 6) {
            foreach (User::query()->get() as $u) {
                $uDigits = preg_replace('/\D+/', '', (string) $u->phone);
                if (strlen($uDigits) >= 6 && $tail($uDigits) === $tail($digits)) {
                    return $u;
                }
            }
        }

        return null;
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
