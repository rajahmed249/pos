import type { PosStoreData } from './posStore.ts';
import type { SqlRow } from './sqlParser.ts';

function escapeSqlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\x1a/g, '\\Z');
  return `'${escaped}'`;
}

function sqlVal(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'object') return escapeSqlString(JSON.stringify(val));
  return escapeSqlString(String(val));
}

function toNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableId(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function toBoolInt(val: unknown, fallback = 1): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return val !== 0 ? 1 : 0;
  const s = String(val).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'no') return 0;
  return 1;
}

function toStr(val: unknown, fallback: string | null = null): string | null {
  if (val === null || val === undefined) return fallback;
  const s = String(val);
  return s === '' && fallback === null ? null : s;
}

function toDateStr(val: unknown, fallback: string | null = null): string | null {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (!s) return fallback;
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}

function toDateTimeStr(val: unknown, fallback: string | null = null): string | null {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (!s) return fallback;
  const normalized = s.replace('T', ' ').slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }
  const d = toDateStr(s, null);
  return d ? `${d} 00:00:00` : fallback;
}

function buildInsertBlock(
  table: string,
  columns: string[],
  rows: Array<Array<unknown>>
): string {
  if (rows.length === 0) {
    return `-- Table \`${table}\`: 0 rows\n`;
  }
  const colSql = columns.map((c) => `\`${c}\``).join(', ');
  const chunkSize = 200;
  const blocks: string[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const tuples = chunk.map((r) => `  (${r.map(sqlVal).join(', ')})`).join(',\n');
    blocks.push(`INSERT INTO \`${table}\` (${colSql}) VALUES\n${tuples};`);
  }
  return `${blocks.join('\n')}\n`;
}

export function generateMysqlDumpSql(store: PosStoreData): string {
  const nowDt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const todayDt = nowDt.slice(0, 10);

  const validCustomerIds = new Set(store.customers.map((c) => Number(c.id)));
  const validSupplierIds = new Set(store.suppliers.map((s) => Number(s.id)));
  const validProductIds = new Set(store.products.map((p) => Number(p.id)));
  const validCategoryIds = new Set(store.categories.map((c) => Number(c.id)));
  const validBrandIds = new Set(store.brands.map((b) => Number(b.id)));
  const validUnitIds = new Set(store.units.map((u) => Number(u.id)));
  const validWarrantyIds = new Set(store.warranties.map((w) => Number(w.id)));
  const validBankIds = new Set(store.bank_accounts.map((a) => Number(a.id)));
  const validSaleIds = new Set(store.sales.map((s) => Number(s.id)));
  const validPurchaseIds = new Set(store.purchases.map((p) => Number(p.id)));
  const validEstimateIds = new Set(store.estimates.map((e) => Number(e.id)));
  const validOwnerIds = new Set((store.owners ?? []).map((o) => Number(o.id)));

  const warrantyMap = new Map<number, string>();
  for (const w of store.warranties ?? []) {
    const label = String(w.duration || w.name || '').trim();
    if (label) warrantyMap.set(Number(w.id), label);
  }
  const productNameMap = new Map<number, string>();
  for (const p of store.products ?? []) {
    const name = String(p.name || '').trim();
    if (name) productNameMap.set(Number(p.id), name);
  }

  const fkOrNull = (val: unknown, validSet: Set<number>): number | null => {
    const id = toNullableId(val);
    return id !== null && validSet.has(id) ? id : null;
  };

  const schemaSql = `-- ============================================================
-- Youth IT POS — Complete MySQL 8 / MariaDB Database Export
-- Generated: ${nowDt} UTC
-- Compatible with cPanel phpMyAdmin, MySQL CLI & Laravel 13
-- ============================================================

SET NAMES utf8mb4;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`email\` varchar(255) NOT NULL,
  \`password\` varchar(255) NOT NULL,
  \`remember_token\` varchar(100) DEFAULT NULL,
  \`role\` enum('super_admin','admin','manager','staff') NOT NULL DEFAULT 'staff',
  \`phone\` varchar(20) DEFAULT NULL,
  \`address\` text,
  \`profile_image\` varchar(255) DEFAULT NULL,
  \`image\` varchar(255) DEFAULT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`reset_token\` varchar(100) DEFAULT NULL,
  \`reset_expires\` datetime DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_email_unique\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
  \`email\` varchar(255) NOT NULL,
  \`token\` varchar(255) NOT NULL,
  \`created_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`sessions\` (
  \`id\` varchar(255) NOT NULL,
  \`user_id\` bigint unsigned DEFAULT NULL,
  \`ip_address\` varchar(45) DEFAULT NULL,
  \`user_agent\` text,
  \`payload\` longtext NOT NULL,
  \`last_activity\` int NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`sessions_user_id_index\` (\`user_id\`),
  KEY \`sessions_last_activity_index\` (\`last_activity\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`settings\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`key_name\` varchar(100) NOT NULL,
  \`value\` text,
  \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`settings_key_name_unique\` (\`key_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`menus\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`parent_id\` bigint unsigned DEFAULT NULL,
  \`title\` varchar(120) NOT NULL,
  \`group_label\` varchar(80) DEFAULT NULL,
  \`route_name\` varchar(120) DEFAULT NULL,
  \`url\` varchar(255) DEFAULT NULL,
  \`icon\` varchar(60) NOT NULL DEFAULT 'circle',
  \`sort_order\` int unsigned NOT NULL DEFAULT '0',
  \`roles\` json DEFAULT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`menus_parent_id_foreign\` (\`parent_id\`),
  CONSTRAINT \`menus_parent_id_foreign\` FOREIGN KEY (\`parent_id\`) REFERENCES \`menus\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`categories\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) NOT NULL,
  \`description\` text,
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`brands\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) NOT NULL,
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`units\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(50) NOT NULL,
  \`description\` text,
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`warranties\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) NOT NULL,
  \`duration\` varchar(50) DEFAULT NULL,
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`products\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`sku\` varchar(100) DEFAULT NULL,
  \`category_id\` bigint unsigned DEFAULT NULL,
  \`brand_id\` bigint unsigned DEFAULT NULL,
  \`warranty_id\` bigint unsigned DEFAULT NULL,
  \`unit_id\` bigint unsigned DEFAULT NULL,
  \`purchase_price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`selling_price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`warranty_months\` int NOT NULL DEFAULT '0',
  \`quantity\` int NOT NULL DEFAULT '0',
  \`stock_quantity\` int NOT NULL DEFAULT '0',
  \`alert_quantity\` int NOT NULL DEFAULT '5',
  \`description\` text,
  \`barcode\` varchar(100) DEFAULT NULL,
  \`image\` varchar(255) DEFAULT NULL,
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`warranty\` varchar(100) DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`products_sku_index\` (\`sku\`),
  KEY \`products_barcode_index\` (\`barcode\`),
  KEY \`products_category_id_foreign\` (\`category_id\`),
  KEY \`products_brand_id_foreign\` (\`brand_id\`),
  KEY \`products_warranty_id_foreign\` (\`warranty_id\`),
  KEY \`products_unit_id_foreign\` (\`unit_id\`),
  CONSTRAINT \`products_category_id_foreign\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`products_brand_id_foreign\` FOREIGN KEY (\`brand_id\`) REFERENCES \`brands\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`products_warranty_id_foreign\` FOREIGN KEY (\`warranty_id\`) REFERENCES \`warranties\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`products_unit_id_foreign\` FOREIGN KEY (\`unit_id\`) REFERENCES \`units\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`stock_movements\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`product_id\` bigint unsigned NOT NULL,
  \`old_quantity\` int NOT NULL DEFAULT '0',
  \`new_quantity\` int NOT NULL DEFAULT '0',
  \`difference\` int NOT NULL DEFAULT '0',
  \`reason\` text,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` datetime NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`stock_movements_product_id_foreign\` (\`product_id\`),
  CONSTRAINT \`stock_movements_product_id_foreign\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`customers\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`email\` varchar(255) DEFAULT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`address\` text,
  \`city\` varchar(50) DEFAULT NULL,
  \`state\` varchar(50) DEFAULT NULL,
  \`zip_code\` varchar(20) DEFAULT NULL,
  \`opening_balance\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`points\` decimal(10,2) NOT NULL DEFAULT '0.00',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`customers_phone_index\` (\`phone\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`suppliers\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`email\` varchar(255) DEFAULT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`address\` text,
  \`city\` varchar(50) DEFAULT NULL,
  \`state\` varchar(50) DEFAULT NULL,
  \`zip_code\` varchar(20) DEFAULT NULL,
  \`opening_balance\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`suppliers_phone_index\` (\`phone\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`employees\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`employee_id\` varchar(50) DEFAULT NULL,
  \`name\` varchar(255) NOT NULL,
  \`email\` varchar(255) DEFAULT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`address\` text,
  \`designation\` varchar(100) DEFAULT NULL,
  \`department\` varchar(100) DEFAULT NULL,
  \`joining_date\` date DEFAULT NULL,
  \`salary\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`owners\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`email\` varchar(255) DEFAULT NULL,
  \`address\` text,
  \`share_percent\` decimal(5,2) NOT NULL DEFAULT '0.00',
  \`invested\` decimal(15,2) NOT NULL DEFAULT '0.00',
  \`withdrawn\` decimal(15,2) NOT NULL DEFAULT '0.00',
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`owner_transactions\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`owner_id\` bigint unsigned NOT NULL,
  \`type\` enum('invest','withdraw') NOT NULL DEFAULT 'invest',
  \`amount\` decimal(15,2) NOT NULL DEFAULT '0.00',
  \`note\` text,
  \`transaction_date\` date NOT NULL,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`owner_transactions_owner_id_foreign\` (\`owner_id\`),
  CONSTRAINT \`owner_transactions_owner_id_foreign\` FOREIGN KEY (\`owner_id\`) REFERENCES \`owners\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`bank_accounts\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`bank_name\` varchar(255) NOT NULL,
  \`account_name\` varchar(255) NOT NULL,
  \`branch\` varchar(255) DEFAULT NULL,
  \`opening_balance\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`balance\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`bank_transactions\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`bank_account_id\` bigint unsigned NOT NULL,
  \`type\` enum('deposit','withdraw') NOT NULL DEFAULT 'deposit',
  \`amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`description\` text,
  \`transaction_date\` date NOT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`bank_transactions_bank_account_id_foreign\` (\`bank_account_id\`),
  CONSTRAINT \`bank_transactions_bank_account_id_foreign\` FOREIGN KEY (\`bank_account_id\`) REFERENCES \`bank_accounts\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`cash_transactions\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`type\` enum('in','out') NOT NULL DEFAULT 'in',
  \`amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`description\` text,
  \`transaction_date\` date NOT NULL,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`expense_categories\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) NOT NULL,
  \`description\` text,
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`expenses\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`category\` varchar(100) NOT NULL,
  \`description\` text,
  \`amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`expense_date\` date NOT NULL,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`sales\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`invoice_no\` varchar(50) NOT NULL,
  \`customer_id\` bigint unsigned DEFAULT NULL,
  \`customer_name\` varchar(255) DEFAULT NULL,
  \`date\` date NOT NULL,
  \`discount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`receivable\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`paid\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`due\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`purchase_cost\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`profit\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`status\` enum('pending','completed','cancelled') NOT NULL DEFAULT 'completed',
  \`sale_date\` datetime DEFAULT NULL,
  \`subtotal\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`account_id\` bigint unsigned DEFAULT NULL,
  \`account_name\` varchar(100) DEFAULT NULL,
  \`payment_status\` varchar(20) NOT NULL DEFAULT 'paid',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`sales_invoice_no_unique\` (\`invoice_no\`),
  KEY \`sales_date_index\` (\`date\`),
  KEY \`sales_customer_id_foreign\` (\`customer_id\`),
  KEY \`sales_account_id_foreign\` (\`account_id\`),
  CONSTRAINT \`sales_customer_id_foreign\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`sales_account_id_foreign\` FOREIGN KEY (\`account_id\`) REFERENCES \`bank_accounts\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`sale_items\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`product_id\` bigint unsigned DEFAULT NULL,
  \`sale_id\` bigint unsigned NOT NULL,
  \`product_name\` varchar(255) NOT NULL,
  \`category_name\` varchar(100) DEFAULT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  \`price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`total\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`purchase_cost\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`serial_no\` varchar(100) DEFAULT NULL,
  \`warranty\` varchar(100) DEFAULT NULL,
  \`buying_price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`warranty_id\` bigint unsigned DEFAULT NULL,
  \`warranty_name\` varchar(100) DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`sale_items_product_id_foreign\` (\`product_id\`),
  KEY \`sale_items_sale_id_foreign\` (\`sale_id\`),
  KEY \`sale_items_warranty_id_foreign\` (\`warranty_id\`),
  CONSTRAINT \`sale_items_product_id_foreign\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`sale_items_sale_id_foreign\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`sale_items_warranty_id_foreign\` FOREIGN KEY (\`warranty_id\`) REFERENCES \`warranties\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`payments\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`sale_id\` bigint unsigned DEFAULT NULL,
  \`customer_id\` bigint unsigned DEFAULT NULL,
  \`amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`payment_date\` datetime NOT NULL,
  \`payment_method\` varchar(50) NOT NULL DEFAULT 'cash',
  \`reference_no\` varchar(100) DEFAULT NULL,
  \`note\` text,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`payments_sale_id_foreign\` (\`sale_id\`),
  KEY \`payments_customer_id_foreign\` (\`customer_id\`),
  CONSTRAINT \`payments_sale_id_foreign\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`payments_customer_id_foreign\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`estimates\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`estimate_no\` varchar(50) NOT NULL,
  \`customer_id\` bigint unsigned DEFAULT NULL,
  \`customer_name\` varchar(255) DEFAULT NULL,
  \`customer_phone\` varchar(20) DEFAULT NULL,
  \`customer_email\` varchar(255) DEFAULT NULL,
  \`customer_address\` text,
  \`subtotal\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`discount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`discount_type\` enum('fixed','percentage') NOT NULL DEFAULT 'fixed',
  \`tax\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`tax_rate\` decimal(5,2) NOT NULL DEFAULT '0.00',
  \`total\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`status\` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
  \`valid_until\` date DEFAULT NULL,
  \`notes\` text,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`estimates_estimate_no_unique\` (\`estimate_no\`),
  KEY \`estimates_customer_id_foreign\` (\`customer_id\`),
  CONSTRAINT \`estimates_customer_id_foreign\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`estimate_items\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`estimate_id\` bigint unsigned NOT NULL,
  \`product_id\` bigint unsigned NOT NULL,
  \`product_name\` varchar(255) DEFAULT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  \`price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`total\` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (\`id\`),
  KEY \`estimate_items_estimate_id_foreign\` (\`estimate_id\`),
  KEY \`estimate_items_product_id_foreign\` (\`product_id\`),
  CONSTRAINT \`estimate_items_estimate_id_foreign\` FOREIGN KEY (\`estimate_id\`) REFERENCES \`estimates\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`estimate_items_product_id_foreign\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`returns\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`sale_id\` bigint unsigned NOT NULL,
  \`invoice_no\` varchar(50) DEFAULT NULL,
  \`customer_id\` bigint unsigned DEFAULT NULL,
  \`product_id\` bigint unsigned DEFAULT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  \`price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`total_amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`reason\` text,
  \`return_date\` date NOT NULL,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`returns_sale_id_foreign\` (\`sale_id\`),
  KEY \`returns_customer_id_foreign\` (\`customer_id\`),
  KEY \`returns_product_id_foreign\` (\`product_id\`),
  CONSTRAINT \`returns_sale_id_foreign\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`returns_customer_id_foreign\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`returns_product_id_foreign\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`damages\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`product_id\` bigint unsigned NOT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  \`reason\` text,
  \`loss_amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`damage_date\` date NOT NULL,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`damages_product_id_foreign\` (\`product_id\`),
  CONSTRAINT \`damages_product_id_foreign\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`purchases\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`invoice_no\` varchar(50) NOT NULL,
  \`supplier_id\` bigint unsigned DEFAULT NULL,
  \`purchase_date\` datetime NOT NULL,
  \`total_amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`paid_amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`due_amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`discount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`payment_method\` varchar(50) NOT NULL DEFAULT 'cash',
  \`note\` text,
  \`status\` tinyint(1) NOT NULL DEFAULT '1',
  \`user_id\` bigint unsigned NOT NULL DEFAULT '1',
  \`subtotal\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`total\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`paid\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`due\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`purchases_invoice_no_index\` (\`invoice_no\`),
  KEY \`purchases_supplier_id_foreign\` (\`supplier_id\`),
  CONSTRAINT \`purchases_supplier_id_foreign\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`purchase_items\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`purchase_id\` bigint unsigned NOT NULL,
  \`product_id\` bigint unsigned NOT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  \`price\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`warranty_months\` int NOT NULL DEFAULT '0',
  \`total\` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (\`id\`),
  KEY \`purchase_items_purchase_id_foreign\` (\`purchase_id\`),
  KEY \`purchase_items_product_id_foreign\` (\`product_id\`),
  CONSTRAINT \`purchase_items_purchase_id_foreign\` FOREIGN KEY (\`purchase_id\`) REFERENCES \`purchases\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`purchase_items_product_id_foreign\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`supplier_payments\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`purchase_id\` bigint unsigned DEFAULT NULL,
  \`supplier_id\` bigint unsigned DEFAULT NULL,
  \`amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
  \`payment_date\` datetime NOT NULL,
  \`payment_method\` varchar(50) NOT NULL DEFAULT 'cash',
  \`reference_no\` varchar(100) DEFAULT NULL,
  \`note\` text,
  \`created_by\` bigint unsigned DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`supplier_payments_purchase_id_foreign\` (\`purchase_id\`),
  KEY \`supplier_payments_supplier_id_foreign\` (\`supplier_id\`),
  CONSTRAINT \`supplier_payments_purchase_id_foreign\` FOREIGN KEY (\`purchase_id\`) REFERENCES \`purchases\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`supplier_payments_supplier_id_foreign\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  const settingEntries = Object.entries(store.settings ?? {});
  const settingsBlock = buildInsertBlock(
    'settings',
    ['id', 'key_name', 'value', 'updated_at'],
    settingEntries.map(([key, value], idx) => [idx + 1, key, String(value ?? ''), nowDt])
  );

  const menusBlock = buildInsertBlock(
    'menus',
    ['id', 'parent_id', 'title', 'group_label', 'route_name', 'url', 'icon', 'sort_order', 'roles', 'is_active', 'created_at', 'updated_at'],
    (store.menus ?? []).map((m) => [
      m.id,
      m.parent_id ?? null,
      m.title,
      m.group_label ?? null,
      m.route_key ?? null,
      m.url ?? null,
      m.icon || 'circle',
      toNum(m.sort_order, 0),
      JSON.stringify(Array.isArray(m.roles) ? m.roles : []),
      m.is_active ? 1 : 0,
      nowDt,
      nowDt,
    ])
  );

  const validRoles = new Set(['super_admin', 'admin', 'manager', 'staff']);
  const usersBlock = buildInsertBlock(
    'users',
    ['id', 'name', 'email', 'password', 'remember_token', 'role', 'phone', 'address', 'profile_image', 'image', 'is_active', 'reset_token', 'reset_expires', 'created_at', 'updated_at'],
    (store.users ?? []).map((u) => [
      u.id,
      u.name,
      u.email,
      u.password_hash ?? '',
      null,
      validRoles.has(u.role) ? u.role : 'staff',
      toStr(u.phone, null),
      toStr(u.address, null),
      toStr(u.profile_image, null),
      toStr(u.profile_image, null),
      u.is_active ? 1 : 0,
      null,
      null,
      toDateTimeStr(u.created_at, nowDt),
      nowDt,
    ])
  );

  const categoriesBlock = buildInsertBlock(
    'categories',
    ['id', 'name', 'description', 'status', 'created_at'],
    (store.categories ?? []).map((c: SqlRow) => [
      toNum(c.id),
      toStr(c.name, 'Category'),
      toStr(c.description, null),
      toBoolInt(c.status, 1),
      toDateTimeStr(c.created_at, nowDt),
    ])
  );

  const brandsBlock = buildInsertBlock(
    'brands',
    ['id', 'name', 'status', 'created_at'],
    (store.brands ?? []).map((b: SqlRow) => [
      toNum(b.id),
      toStr(b.name, 'Brand'),
      toBoolInt(b.status, 1),
      toDateTimeStr(b.created_at, nowDt),
    ])
  );

  const unitsBlock = buildInsertBlock(
    'units',
    ['id', 'name', 'description', 'status', 'created_at'],
    (store.units ?? []).map((u: SqlRow) => [
      toNum(u.id),
      toStr(u.name, 'Unit'),
      toStr(u.description, null),
      toBoolInt(u.status, 1),
      toDateTimeStr(u.created_at, nowDt),
    ])
  );

  const warrantiesBlock = buildInsertBlock(
    'warranties',
    ['id', 'name', 'duration', 'status', 'created_at'],
    (store.warranties ?? []).map((w: SqlRow) => [
      toNum(w.id),
      toStr(w.name, 'Warranty'),
      toStr(w.duration, null),
      toBoolInt(w.status, 1),
      toDateTimeStr(w.created_at, nowDt),
    ])
  );

  const productsBlock = buildInsertBlock(
    'products',
    ['id', 'name', 'sku', 'category_id', 'brand_id', 'warranty_id', 'unit_id', 'purchase_price', 'selling_price', 'warranty_months', 'quantity', 'stock_quantity', 'alert_quantity', 'description', 'barcode', 'image', 'status', 'warranty', 'created_at'],
    (store.products ?? []).map((p: SqlRow) => {
      const qty = Math.trunc(toNum(p.stock_quantity ?? p.quantity, 0));
      const wId = fkOrNull(p.warranty_id, validWarrantyIds);
      const wMonths = Math.trunc(toNum(p.warranty_months, 0));
      const explicitWarranty = toStr(p.warranty, null);
      const mappedWarranty = wId !== null ? warrantyMap.get(wId) : null;
      const resolvedWarranty =
        (explicitWarranty && explicitWarranty.trim() !== '' ? explicitWarranty.trim() : '') ||
        (mappedWarranty && String(mappedWarranty).trim() !== '' ? String(mappedWarranty).trim() : '') ||
        (wMonths > 0 ? `${wMonths} Months` : 'No Warranty');
      return [
        toNum(p.id),
        toStr(p.name, 'Product'),
        toStr(p.sku, null),
        fkOrNull(p.category_id, validCategoryIds),
        fkOrNull(p.brand_id, validBrandIds),
        wId,
        fkOrNull(p.unit_id, validUnitIds),
        toNum(p.purchase_price, 0),
        toNum(p.selling_price, 0),
        wMonths,
        qty,
        qty,
        Math.trunc(toNum(p.alert_quantity, 5)),
        toStr(p.description, null),
        toStr(p.barcode, null),
        toStr(p.image, null),
        toBoolInt(p.status, 1),
        resolvedWarranty,
        toDateTimeStr(p.created_at, nowDt),
      ];
    })
  );

  const stockMovementsBlock = buildInsertBlock(
    'stock_movements',
    ['id', 'product_id', 'old_quantity', 'new_quantity', 'difference', 'reason', 'created_by', 'created_at'],
    (store.stock_movements ?? [])
      .filter((m: SqlRow) => fkOrNull(m.product_id, validProductIds) !== null)
      .map((m: SqlRow) => [
        toNum(m.id),
        toNum(m.product_id),
        Math.trunc(toNum(m.old_quantity, 0)),
        Math.trunc(toNum(m.new_quantity, 0)),
        Math.trunc(toNum(m.difference, 0)),
        toStr(m.reason, null),
        toNullableId(m.created_by),
        toDateTimeStr(m.created_at, nowDt),
      ])
  );

  const customersBlock = buildInsertBlock(
    'customers',
    ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip_code', 'opening_balance', 'status', 'points', 'created_at'],
    (store.customers ?? []).map((c: SqlRow) => [
      toNum(c.id),
      toStr(c.name, 'Customer'),
      toStr(c.email, null),
      toStr(c.phone, null),
      toStr(c.address, null),
      toStr(c.city, null),
      toStr(c.state, null),
      toStr(c.zip_code, null),
      toNum(c.opening_balance, 0),
      toBoolInt(c.status, 1),
      toNum(c.points, 0),
      toDateTimeStr(c.created_at, nowDt),
    ])
  );

  const suppliersBlock = buildInsertBlock(
    'suppliers',
    ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip_code', 'opening_balance', 'status', 'created_at'],
    (store.suppliers ?? []).map((s: SqlRow) => [
      toNum(s.id),
      toStr(s.name, 'Supplier'),
      toStr(s.email, null),
      toStr(s.phone, null),
      toStr(s.address, null),
      toStr(s.city, null),
      toStr(s.state, null),
      toStr(s.zip_code, null),
      toNum(s.opening_balance, 0),
      toBoolInt(s.status, 1),
      toDateTimeStr(s.created_at, nowDt),
    ])
  );

  const employeesBlock = buildInsertBlock(
    'employees',
    ['id', 'employee_id', 'name', 'email', 'phone', 'address', 'designation', 'department', 'joining_date', 'salary', 'status', 'created_at'],
    (store.employees ?? []).map((e: SqlRow) => [
      toNum(e.id),
      toStr(e.employee_id, null),
      toStr(e.name, 'Employee'),
      toStr(e.email, null),
      toStr(e.phone, null),
      toStr(e.address, null),
      toStr(e.designation, null),
      toStr(e.department, null),
      toDateStr(e.joining_date, null),
      toNum(e.salary, 0),
      toBoolInt(e.status, 1),
      toDateTimeStr(e.created_at, nowDt),
    ])
  );

  const ownersBlock = buildInsertBlock(
    'owners',
    ['id', 'name', 'phone', 'email', 'address', 'share_percent', 'invested', 'withdrawn', 'is_active', 'created_at'],
    (store.owners ?? []).map((o: SqlRow) => [
      toNum(o.id),
      toStr(o.name, 'Owner'),
      toStr(o.phone, null),
      toStr(o.email, null),
      toStr(o.address, null),
      toNum(o.share_percent, 0),
      toNum(o.invested, 0),
      toNum(o.withdrawn, 0),
      toBoolInt(o.is_active ?? o.status, 1),
      toDateTimeStr(o.created_at, nowDt),
    ])
  );

  const ownerTransactionsBlock = buildInsertBlock(
    'owner_transactions',
    ['id', 'owner_id', 'type', 'amount', 'note', 'transaction_date', 'created_by', 'created_at'],
    (store.owner_transactions ?? [])
      .filter((t: SqlRow) => fkOrNull(t.owner_id, validOwnerIds) !== null)
      .map((t: SqlRow) => [
        toNum(t.id),
        toNum(t.owner_id),
        String(t.type ?? '') === 'withdraw' ? 'withdraw' : 'invest',
        toNum(t.amount, 0),
        toStr(t.note, null),
        toDateStr(t.transaction_date ?? t.created_at, todayDt),
        toNullableId(t.created_by),
        toDateTimeStr(t.created_at, nowDt),
      ])
  );

  const bankAccountsBlock = buildInsertBlock(
    'bank_accounts',
    ['id', 'bank_name', 'account_name', 'branch', 'opening_balance', 'balance', 'created_at'],
    (store.bank_accounts ?? []).map((a: SqlRow) => [
      toNum(a.id),
      toStr(a.bank_name, 'Bank'),
      toStr(a.account_name, 'Account'),
      toStr(a.branch, null),
      toNum(a.opening_balance, 0),
      toNum(a.balance, 0),
      toDateTimeStr(a.created_at, nowDt),
    ])
  );

  const bankTransactionsBlock = buildInsertBlock(
    'bank_transactions',
    ['id', 'bank_account_id', 'type', 'amount', 'description', 'transaction_date', 'created_at'],
    (store.bank_transactions ?? [])
      .filter((t: SqlRow) => fkOrNull(t.bank_account_id, validBankIds) !== null)
      .map((t: SqlRow) => [
        toNum(t.id),
        toNum(t.bank_account_id),
        String(t.type ?? '') === 'withdraw' ? 'withdraw' : 'deposit',
        toNum(t.amount, 0),
        toStr(t.description, null),
        toDateStr(t.transaction_date ?? t.created_at, todayDt),
        toDateTimeStr(t.created_at, nowDt),
      ])
  );

  const cashTransactionsBlock = buildInsertBlock(
    'cash_transactions',
    ['id', 'type', 'amount', 'description', 'transaction_date', 'created_by', 'created_at'],
    (store.cash_transactions ?? []).map((t: SqlRow) => [
      toNum(t.id),
      String(t.type ?? '') === 'out' ? 'out' : 'in',
      toNum(t.amount, 0),
      toStr(t.description, null),
      toDateStr(t.transaction_date ?? t.created_at, todayDt),
      toNullableId(t.created_by),
      toDateTimeStr(t.created_at, nowDt),
    ])
  );

  const expenseCategoriesBlock = buildInsertBlock(
    'expense_categories',
    ['id', 'name', 'description', 'status', 'created_at'],
    (store.expense_categories ?? []).map((c: SqlRow) => [
      toNum(c.id),
      toStr(c.name, 'General'),
      toStr(c.description, null),
      toBoolInt(c.status, 1),
      toDateTimeStr(c.created_at, nowDt),
    ])
  );

  const expensesBlock = buildInsertBlock(
    'expenses',
    ['id', 'category', 'description', 'amount', 'expense_date', 'created_by', 'created_at'],
    (store.expenses ?? []).map((e: SqlRow) => [
      toNum(e.id),
      toStr(e.category, 'General'),
      toStr(e.description, null),
      toNum(e.amount, 0),
      toDateStr(e.expense_date ?? e.created_at, todayDt),
      toNullableId(e.created_by),
      toDateTimeStr(e.created_at, nowDt),
    ])
  );

  const validSaleStatuses = new Set(['pending', 'completed', 'cancelled']);
  const salesBlock = buildInsertBlock(
    'sales',
    ['id', 'invoice_no', 'customer_id', 'customer_name', 'date', 'discount', 'receivable', 'paid', 'due', 'purchase_cost', 'profit', 'status', 'sale_date', 'subtotal', 'account_id', 'account_name', 'payment_status', 'created_at'],
    (store.sales ?? []).map((s: SqlRow) => {
      const status = String(s.status ?? 'completed').toLowerCase();
      const receivable = toNum(s.receivable, 0);
      const purchaseCost = toNum(s.purchase_cost, 0);
      const rawProfit = toNum(s.profit, 0);
      const computedProfit = rawProfit !== 0 ? rawProfit : (purchaseCost > 0 ? Math.round((receivable - purchaseCost) * 100) / 100 : 0);
      return [
        toNum(s.id),
        toStr(s.invoice_no, `INV-${s.id}`),
        fkOrNull(s.customer_id, validCustomerIds),
        toStr(s.customer_name, 'Walk-in Customer'),
        toDateStr(s.date ?? s.sale_date ?? s.created_at, todayDt),
        toNum(s.discount, 0),
        receivable,
        toNum(s.paid, 0),
        toNum(s.due, 0),
        purchaseCost,
        computedProfit,
        validSaleStatuses.has(status) ? status : 'completed',
        toDateTimeStr(s.sale_date ?? s.date ?? s.created_at, null),
        toNum(s.subtotal ?? s.receivable, 0),
        fkOrNull(s.account_id, validBankIds),
        toStr(s.account_name, null),
        toStr(s.payment_status, 'paid'),
        toDateTimeStr(s.created_at, nowDt),
      ];
    })
  );

  const saleItemsBlock = buildInsertBlock(
    'sale_items',
    ['id', 'product_id', 'sale_id', 'product_name', 'category_name', 'quantity', 'price', 'total', 'purchase_cost', 'serial_no', 'warranty', 'buying_price', 'warranty_id', 'warranty_name'],
    (store.sale_items ?? [])
      .filter((it: SqlRow) => fkOrNull(it.sale_id, validSaleIds) !== null)
      .map((it: SqlRow) => {
        const pid = fkOrNull(it.product_id, validProductIds);
        const pName = toStr(it.product_name, null) ?? (pid !== null ? productNameMap.get(pid) ?? 'Product' : 'Product');
        return [
          toNum(it.id),
          pid,
          toNum(it.sale_id),
          pName,
          toStr(it.category_name, null),
          Math.trunc(toNum(it.quantity, 1)),
          toNum(it.price, 0),
          toNum(it.total, 0),
          toNum(it.purchase_cost, 0),
          toStr(it.serial_no, null),
          toStr(it.warranty, null),
          toNum(it.buying_price ?? it.purchase_cost, 0),
          fkOrNull(it.warranty_id, validWarrantyIds),
          toStr(it.warranty_name, null),
        ];
      })
  );

  const paymentsBlock = buildInsertBlock(
    'payments',
    ['id', 'sale_id', 'customer_id', 'amount', 'payment_date', 'payment_method', 'reference_no', 'note', 'created_by', 'created_at'],
    (store.payments ?? []).map((p: SqlRow) => [
      toNum(p.id),
      fkOrNull(p.sale_id, validSaleIds),
      fkOrNull(p.customer_id, validCustomerIds),
      toNum(p.amount, 0),
      toDateTimeStr(p.payment_date ?? p.created_at, nowDt),
      toStr(p.payment_method, 'cash'),
      toStr(p.reference_no, null),
      toStr(p.note, null),
      toNullableId(p.created_by),
      toDateTimeStr(p.created_at, nowDt),
    ])
  );

  const validEstimateStatuses = new Set(['pending', 'approved', 'rejected', 'expired']);
  const estimatesBlock = buildInsertBlock(
    'estimates',
    ['id', 'estimate_no', 'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'subtotal', 'discount', 'discount_type', 'tax', 'tax_rate', 'total', 'status', 'valid_until', 'notes', 'created_by', 'created_at', 'updated_at'],
    (store.estimates ?? []).map((e: SqlRow) => {
      const st = String(e.status ?? 'pending').toLowerCase();
      return [
        toNum(e.id),
        toStr(e.estimate_no, `EST-${e.id}`),
        fkOrNull(e.customer_id, validCustomerIds),
        toStr(e.customer_name, null),
        toStr(e.customer_phone, null),
        toStr(e.customer_email, null),
        toStr(e.customer_address, null),
        toNum(e.subtotal, 0),
        toNum(e.discount, 0),
        String(e.discount_type ?? '') === 'percentage' ? 'percentage' : 'fixed',
        toNum(e.tax, 0),
        toNum(e.tax_rate, 0),
        toNum(e.total, 0),
        validEstimateStatuses.has(st) ? st : 'pending',
        toDateStr(e.valid_until, null),
        toStr(e.notes, null),
        toNullableId(e.created_by),
        toDateTimeStr(e.created_at, nowDt),
        toDateTimeStr(e.updated_at ?? e.created_at, nowDt),
      ];
    })
  );

  const estimateItemsBlock = buildInsertBlock(
    'estimate_items',
    ['id', 'estimate_id', 'product_id', 'product_name', 'quantity', 'price', 'total'],
    (store.estimate_items ?? [])
      .filter((it: SqlRow) => fkOrNull(it.estimate_id, validEstimateIds) !== null && fkOrNull(it.product_id, validProductIds) !== null)
      .map((it: SqlRow) => [
        toNum(it.id),
        toNum(it.estimate_id),
        toNum(it.product_id),
        toStr(it.product_name, null),
        Math.trunc(toNum(it.quantity, 1)),
        toNum(it.price, 0),
        toNum(it.total, 0),
      ])
  );

  const returnsBlock = buildInsertBlock(
    'returns',
    ['id', 'sale_id', 'invoice_no', 'customer_id', 'product_id', 'quantity', 'price', 'total_amount', 'reason', 'return_date', 'created_by', 'created_at'],
    (store.returns ?? [])
      .filter((r: SqlRow) => fkOrNull(r.sale_id, validSaleIds) !== null)
      .map((r: SqlRow) => [
        toNum(r.id),
        toNum(r.sale_id),
        toStr(r.invoice_no, null),
        fkOrNull(r.customer_id, validCustomerIds),
        fkOrNull(r.product_id, validProductIds),
        Math.trunc(toNum(r.quantity, 1)),
        toNum(r.price, 0),
        toNum(r.total_amount, 0),
        toStr(r.reason, null),
        toDateStr(r.return_date ?? r.created_at, todayDt),
        toNullableId(r.created_by),
        toDateTimeStr(r.created_at, nowDt),
      ])
  );

  const damagesBlock = buildInsertBlock(
    'damages',
    ['id', 'product_id', 'quantity', 'reason', 'loss_amount', 'damage_date', 'created_by', 'created_at'],
    (store.damages ?? [])
      .filter((d: SqlRow) => fkOrNull(d.product_id, validProductIds) !== null)
      .map((d: SqlRow) => [
        toNum(d.id),
        toNum(d.product_id),
        Math.trunc(toNum(d.quantity, 1)),
        toStr(d.reason, null),
        toNum(d.loss_amount, 0),
        toDateStr(d.damage_date ?? d.created_at, todayDt),
        toNullableId(d.created_by),
        toDateTimeStr(d.created_at, nowDt),
      ])
  );

  const purchasesBlock = buildInsertBlock(
    'purchases',
    ['id', 'invoice_no', 'supplier_id', 'purchase_date', 'total_amount', 'paid_amount', 'due_amount', 'discount', 'payment_method', 'note', 'status', 'user_id', 'subtotal', 'total', 'paid', 'due', 'created_at'],
    (store.purchases ?? []).map((p: SqlRow) => [
      toNum(p.id),
      toStr(p.invoice_no, `PUR-${p.id}`),
      fkOrNull(p.supplier_id, validSupplierIds),
      toDateTimeStr(p.purchase_date ?? p.created_at, nowDt),
      toNum(p.total_amount ?? p.total, 0),
      toNum(p.paid_amount ?? p.paid, 0),
      toNum(p.due_amount ?? p.due, 0),
      toNum(p.discount, 0),
      toStr(p.payment_method, 'cash'),
      toStr(p.note, null),
      toBoolInt(p.status, 1),
      toNum(p.user_id, 1),
      toNum(p.subtotal ?? p.total_amount ?? p.total, 0),
      toNum(p.total ?? p.total_amount, 0),
      toNum(p.paid ?? p.paid_amount, 0),
      toNum(p.due ?? p.due_amount, 0),
      toDateTimeStr(p.created_at, nowDt),
    ])
  );

  const purchaseItemsBlock = buildInsertBlock(
    'purchase_items',
    ['id', 'purchase_id', 'product_id', 'quantity', 'price', 'warranty_months', 'total'],
    (store.purchase_items ?? [])
      .filter((pi: SqlRow) => fkOrNull(pi.purchase_id, validPurchaseIds) !== null && fkOrNull(pi.product_id, validProductIds) !== null)
      .map((pi: SqlRow) => [
        toNum(pi.id),
        toNum(pi.purchase_id),
        toNum(pi.product_id),
        Math.trunc(toNum(pi.quantity, 1)),
        toNum(pi.price, 0),
        Math.trunc(toNum(pi.warranty_months, 0)),
        toNum(pi.total, 0),
      ])
  );

  const supplierPaymentsBlock = buildInsertBlock(
    'supplier_payments',
    ['id', 'purchase_id', 'supplier_id', 'amount', 'payment_date', 'payment_method', 'reference_no', 'note', 'created_by', 'created_at'],
    (store.supplier_payments ?? []).map((sp: SqlRow) => [
      toNum(sp.id),
      fkOrNull(sp.purchase_id, validPurchaseIds),
      fkOrNull(sp.supplier_id, validSupplierIds),
      toNum(sp.amount, 0),
      toDateTimeStr(sp.payment_date ?? sp.created_at, nowDt),
      toStr(sp.payment_method, 'cash'),
      toStr(sp.reference_no, null),
      toStr(sp.note, null),
      toNullableId(sp.created_by),
      toDateTimeStr(sp.created_at, nowDt),
    ])
  );

  return [
    schemaSql,
    '-- ============================================================',
    '-- Table Data Inserts',
    '-- ============================================================',
    '',
    settingsBlock,
    menusBlock,
    usersBlock,
    categoriesBlock,
    brandsBlock,
    unitsBlock,
    warrantiesBlock,
    productsBlock,
    stockMovementsBlock,
    customersBlock,
    suppliersBlock,
    employeesBlock,
    ownersBlock,
    ownerTransactionsBlock,
    bankAccountsBlock,
    bankTransactionsBlock,
    cashTransactionsBlock,
    expenseCategoriesBlock,
    expensesBlock,
    salesBlock,
    saleItemsBlock,
    paymentsBlock,
    estimatesBlock,
    estimateItemsBlock,
    returnsBlock,
    damagesBlock,
    purchasesBlock,
    purchaseItemsBlock,
    supplierPaymentsBlock,
    'SET FOREIGN_KEY_CHECKS = 1;',
    '',
  ].join('\n');
}
