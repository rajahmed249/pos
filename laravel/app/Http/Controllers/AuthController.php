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

        if (!$user || empty($user->password) || !Hash::check($credentials['password'], (string) $user->password)) {
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
            $payload = [
                'to' => $targetPhone,
                'number' => ltrim($targetPhone, '+'),
                'api_key' => (string) env('SMS_API_KEY', ''),
                'type' => 'text',
                'message' => "{$shopName} recovery code: {$code} (valid 10 min).",
            ];
            if ($senderId !== '') {
                $payload['senderid'] = $senderId;
                $payload['sender_id'] = $senderId;
                $payload['SenderId'] = $senderId;
            }
            $smsResp = Http::withToken((string) env('SMS_API_KEY', ''))->post($smsGateway, $payload);
            $smsJson = $smsResp->json();
            if (!$smsResp->successful() || (is_array($smsJson) && (!empty($smsJson['error_message']) || !empty($smsJson['error']) || ($smsJson['ok'] ?? true) === false))) {
                $reason = is_array($smsJson) ? ($smsJson['error_message'] ?? $smsJson['error'] ?? 'SMS gateway error.') : 'SMS gateway error.';
                return back()->withErrors(['identifier' => "SMS delivery failed: {$reason}"])->withInput();
            }
        }

        return back()
            ->with('code_sent', true)
            ->with('status', "A 6-digit verification code has been sent via {$data['channel']}.")
            ->withInput();
    }

    public function recoverPassword(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
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
            return back()->withErrors(['code' => 'Invalid or expired verification code.'])->with('code_sent', true)->withInput();
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'reset_token' => null,
            'reset_expires' => null,
        ])->save();

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
