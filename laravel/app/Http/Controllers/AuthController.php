<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
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

        if (!$user || !Hash::check($credentials['password'], (string) $user->password)) {
            return back()->withErrors([
                'email' => 'Invalid email/username or password.',
            ])->onlyInput('email');
        }

        if (!$user->is_active) {
            return back()->withErrors([
                'email' => 'This account is currently disabled. Contact an administrator.',
            ])->onlyInput('email');
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function showForgotPassword(): View
    {
        return view('auth.forgot_password');
    }

    public function recoverPassword(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'string', 'max:40'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $identifier = strtolower(trim($data['identifier']));
        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$identifier])
            ->orWhereRaw('LOWER(name) = ?', [$identifier])
            ->first();

        if (!$user || !$user->is_active) {
            return back()->withErrors(['identifier' => 'No active account found for that email or username.'])->withInput();
        }

        $digits = fn (?string $val) => preg_replace('/\D+/', '', (string) $val);
        $tail = fn (string $d) => strlen($d) >= 8 ? substr($d, -10) : $d;

        $inputPhone = $digits($data['phone']);
        $userPhone = $digits($user->phone);
        $shopPhone = $digits(Setting::getValue('shop_phone', '01674297522'));

        $matched = (strlen($userPhone) >= 6 && $tail($userPhone) === $tail($inputPhone))
            || ($user->role === 'admin' && strlen($shopPhone) >= 6 && $tail($shopPhone) === $tail($inputPhone));

        if (!$matched) {
            return back()->withErrors(['phone' => 'Phone verification failed for this account.'])->withInput();
        }

        $user->update(['password' => Hash::make($data['password'])]);

        return redirect()->route('login')->with('status', 'Password reset successfully. Please sign in.');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
