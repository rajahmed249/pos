# Youth IT POS — Pure Laravel 13 Architecture

Complete native Laravel 13 rebuild with zero `legacy/` wrappers, zero `index.php` URLs, pure `.blade` templates in `resources/views/**/*.blade` (registered via `View::addExtension('blade', 'blade')`), full Eloquent ORM models, Laravel migrations, seeders, and database-driven dynamic menus and layout settings.

## Setup Instructions (PHP 8.3+ / MySQL)

1. Install PHP & frontend dependencies:
   ```bash
   composer install --no-dev --optimize-autoloader
   npm install && npm run build
   ```
2. Configure environment:
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```
   Update `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `.env`.
3. Run migrations & seeders (automatically imports `database/sql/youthits_pos.sql` and creates dynamic `menus` + `settings`):
   ```bash
   php artisan migrate --seed
   ```
4. Configure web server document root to `/public` (Apache `.htaccess` automatically strips `index.php` and routes cleanly to `routes/web.php`).
