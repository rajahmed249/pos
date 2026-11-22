<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class UserController extends Controller
{
    public function index(): View
    {
        $users = User::query()->orderBy('id')->get();
        $activeUser = Auth::user();

        return view('users.index', compact('users', 'activeUser'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'in:admin,manager,staff'],
            'phone' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = true;

        User::query()->create($data);

        return back()->with('success', 'User account created.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', 'in:admin,manager,staff'],
            'phone' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'min:6'],
            'profile_image' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'remove_avatar' => ['nullable', 'boolean'],
        ]);

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if ($request->hasFile('profile_image')) {
            $data['profile_image'] = $this->storeAvatarFile($request, $user->id);
        } elseif ($request->boolean('remove_avatar')) {
            $data['profile_image'] = null;
        } else {
            unset($data['profile_image']);
        }
        unset($data['remove_avatar']);

        $user->update($data);

        return back()->with('success', "Updated user {$user->name}.");
    }

    public function updateMyProfile(Request $request): RedirectResponse
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (!$user) {
            return redirect()->route('login');
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:255'],
            'profile_image' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'remove_avatar' => ['nullable', 'boolean'],
        ]);

        if ($request->hasFile('profile_image')) {
            $data['profile_image'] = $this->storeAvatarFile($request, $user->id);
        } elseif ($request->boolean('remove_avatar')) {
            $data['profile_image'] = null;
        } else {
            unset($data['profile_image']);
        }
        unset($data['remove_avatar']);

        $user->update($data);

        return back()->with('success', 'Your account profile and photo have been saved.');
    }

    public function updateMyPassword(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        if (!$user || !Hash::check($data['current_password'], (string) $user->password)) {
            return back()->withErrors(['current_password' => 'Current password is incorrect.']);
        }

        $user->update(['password' => Hash::make($data['new_password'])]);

        return back()->with('success', 'Your account password has been updated.');
    }

    public function toggle(User $user): RedirectResponse
    {
        $user->update(['is_active' => !$user->is_active]);

        return back()->with('success', 'User status updated.');
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->id === 1 || $user->id === Auth::id()) {
            return back()->withErrors(['user' => 'Primary administrator or currently signed-in account cannot be deleted.']);
        }

        $user->delete();

        return back()->with('success', 'User account removed.');
    }

    private function storeAvatarFile(Request $request, int $userId): string
    {
        $dir = public_path('uploads/avatars');
        if (!File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        $file = $request->file('profile_image');
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        if ($ext === 'jpeg') {
            $ext = 'jpg';
        }
        $filename = "user-{$userId}-" . time() . ".{$ext}";
        $file->move($dir, $filename);

        return 'uploads/avatars/' . $filename;
    }
}
