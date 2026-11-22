# Youth IT POS — Laravel সংস্করণ

পুরনো PHP সাইটের সব পেজ, URL, ডিজাইন (CSS/JS/Blade-এর মতো HTML লে-আউট) ও ডাটাবেজ কোয়েরি অপরিবর্তিত রেখে Laravel 13 প্রজেক্টের ভেতরে চলার মতো করে বানানো হয়েছে।

## কীভাবে কাজ করে
- `routes/web.php` + `app/Legacy/LegacyRouter.php` — পুরনো `.htaccess`-এর হুবহু URL নিয়ম (`/pos`, `/product/edit/5`, `/reports/customer-due` ইত্যাদি)।
- `app/Legacy/LegacyRunner.php` — `legacy/` ফোল্ডারের পেজ চালায়, Laravel সেশনের সাথে `$_SESSION` মেলায়, redirect/cookie/JSON header রেসপন্সে পরিণত করে।
- `legacy/` — ১১০টি পেজ ও `includes/` (header, sidebar, topbar, footer)। `header()`, `exit`, `session_*` শুধু Laravel-সামঞ্জস্য ফাংশনে বদলানো হয়েছে।
- `public/assets`, `public/uploads`, `public/style.css` — CSS, লোগো, প্রোডাক্ট/ইউজার ছবি।
- ডাটাবেজ কানেকশন এখন `.env` থেকে আসে।

## সেটআপ (হোস্টিং বা লোকাল)
প্রয়োজন: PHP 8.3+, Composer, MySQL।

1. প্রজেক্ট আপলোড করুন, তারপর টার্মিনালে:
   ```
   composer install --no-dev --optimize-autoloader
   ```
2. `.env` ফাইলে ডাটাবেজের ইউজার ও পাসওয়ার্ড বসান (ডাটাবেজের নাম `pos-youthit` দেওয়া আছে):
   ```
   DB_USERNAME=...
   DB_PASSWORD=...
   ```
3. ডাটা ইম্পোর্ট (দুইটির একটি):
   ```
   php artisan pos:import
   ```
   অথবা phpMyAdmin থেকে `pos-youthit` ডাটাবেজে `database/pos-youthit.sql` ইম্পোর্ট করুন।
   (আগের টেবিল মুছে নতুন করে ইম্পোর্ট: `php artisan pos:import --fresh`)
4. ডকুমেন্ট রুট `public/` ফোল্ডারে সেট করুন। না পারলে পুরো প্রজেক্ট `public_html`-এ রাখুন, রুটের `.htaccess` নিজে থেকে `public/`-এ পাঠাবে।
5. `storage/` ও `bootstrap/cache/` ফোল্ডারে লেখার অনুমতি (775) দিন।

লগইন আগের ইউজার/পাসওয়ার্ড দিয়েই হবে (ডাটাবেজ হুবহু এক)।

## গুরুত্বপূর্ণ পরিবর্তন
- **ডাটাবেজ ব্যাকআপ** এখন `storage/app/backups`-এ জমে (আগে সবার জন্য খোলা `backups/` ফোল্ডারে ছিল)। ডাউনলোড শুধু লগইন করা অ্যাডমিন পারবেন।
- **`/add-admin` বন্ধ**: এই পেজ লগইন ছাড়াই অ্যাডমিনের পাসওয়ার্ড `admin123` করে দিত। এটি আর চালু নেই।
- `check_permission`, `test-add-cart-simple`, `restore` (ফাঁকা ফাইল), `.sql`/`error_log` ফাইল সাইট থেকে বাদ।
- পুরনো `config.php` ও ৪টি ফাইলে লেখা DB পাসওয়ার্ড সরানো হয়েছে।
- PHP warning/notice পেজ ভাঙে না, `storage/logs/legacy-errors.log`-এ জমা হয়।
- ফর্মে CSRF টোকেন ছিল না, তাই `bootstrap/app.php`-এ CSRF যাচাই বন্ধ রাখা হয়েছে (পুরনো আচরণ)।
- সময়: PHP টাইমজোন UTC (পুরনো সাইটের মতোই)।
