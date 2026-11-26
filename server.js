// server.ts
import "dotenv/config";
import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";
import express from "express";
import JSZip from "jszip";
import nodemailer from "nodemailer";

// server/posStore.ts
import fs from "node:fs";
import path from "node:path";
var DEFAULT_MENUS = [
  { id: 1, parent_id: null, title: "Dashboard", group_label: "Main", route_key: "dashboard", url: "/dashboard", icon: "layout-dashboard", sort_order: 1, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 2, parent_id: null, title: "Owners", group_label: "Main", route_key: "owners", url: "/owners", icon: "user-check", sort_order: 2, roles: ["admin", "manager"], is_active: true },
  { id: 3, parent_id: null, title: "Bank Accounts", group_label: "Main", route_key: "accounts", url: "/accounts", icon: "landmark", sort_order: 3, roles: ["admin", "manager"], is_active: true },
  { id: 4, parent_id: null, title: "Cash Book", group_label: "Main", route_key: "cashbook", url: "/cashbook", icon: "book-open", sort_order: 4, roles: ["admin", "manager"], is_active: true },
  { id: 5, parent_id: null, title: "POS", group_label: "Main", route_key: "pos", url: "/pos", icon: "shopping-cart", sort_order: 5, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 6, parent_id: null, title: "Sales", group_label: "Main", route_key: "sales", url: "/sales", icon: "receipt", sort_order: 6, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 12, parent_id: null, title: "Products", group_label: "Main", route_key: "products", url: "/products", icon: "package", sort_order: 7, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 7, parent_id: null, title: "Returns", group_label: "Sales & Purchase", route_key: "returns", url: "/returns", icon: "rotate-ccw", sort_order: 8, roles: ["admin", "manager"], is_active: true },
  { id: 8, parent_id: null, title: "Estimate", group_label: "Sales & Purchase", route_key: "estimates", url: "/estimates", icon: "file-text", sort_order: 9, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 9, parent_id: null, title: "Purchase", group_label: "Sales & Purchase", route_key: "purchases", url: "/purchases", icon: "truck", sort_order: 10, roles: ["admin", "manager"], is_active: true },
  { id: 10, parent_id: null, title: "Stock", group_label: "Sales & Purchase", route_key: "stock", url: "/stock", icon: "boxes", sort_order: 11, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 11, parent_id: null, title: "Damages", group_label: "Sales & Purchase", route_key: "damages", url: "/damages", icon: "alert-triangle", sort_order: 12, roles: ["admin", "manager"], is_active: true },
  { id: 13, parent_id: null, title: "Add Product", group_label: "Product Information", route_key: "add-product", url: "/add-product", icon: "plus-circle", sort_order: 13, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 14, parent_id: null, title: "Categories", group_label: "Product Information", route_key: "categories", url: "/categories", icon: "folder-tree", sort_order: 14, roles: ["admin", "manager"], is_active: true },
  { id: 15, parent_id: null, title: "Brand", group_label: "Product Information", route_key: "brands", url: "/brands", icon: "tag", sort_order: 15, roles: ["admin", "manager"], is_active: true },
  { id: 16, parent_id: null, title: "Unit", group_label: "Product Information", route_key: "units", url: "/units", icon: "ruler", sort_order: 16, roles: ["admin", "manager"], is_active: true },
  { id: 17, parent_id: null, title: "Expenses", group_label: "Expenses & Payment", route_key: "expenses", url: "/expenses", icon: "wallet", sort_order: 17, roles: ["admin", "manager"], is_active: true },
  { id: 18, parent_id: null, title: "Payments", group_label: "Expenses & Payment", route_key: "payments", url: "/payments", icon: "credit-card", sort_order: 18, roles: ["admin", "manager"], is_active: true },
  { id: 19, parent_id: null, title: "Customers", group_label: "Peoples", route_key: "customers", url: "/customers", icon: "users", sort_order: 19, roles: ["admin", "manager", "staff"], is_active: true },
  { id: 20, parent_id: null, title: "Suppliers", group_label: "Peoples", route_key: "suppliers", url: "/suppliers", icon: "building-2", sort_order: 20, roles: ["admin", "manager"], is_active: true },
  { id: 21, parent_id: null, title: "Employee & Salary", group_label: "Peoples", route_key: "employees", url: "/employees", icon: "badge-dollar-sign", sort_order: 21, roles: ["admin", "manager"], is_active: true },
  { id: 22, parent_id: null, title: "Reports", group_label: "Reports", route_key: "reports", url: "/reports", icon: "bar-chart-3", sort_order: 22, roles: ["admin", "manager"], is_active: true },
  { id: 23, parent_id: null, title: "Shop Settings", group_label: "Settings & Customize", route_key: "settings", url: "/settings", icon: "sliders", sort_order: 23, roles: ["admin"], is_active: true },
  { id: 24, parent_id: null, title: "User Management", group_label: "Settings & Customize", route_key: "users", url: "/users", icon: "user-cog", sort_order: 24, roles: ["admin"], is_active: true },
  { id: 25, parent_id: null, title: "Backup & Restore", group_label: "Settings & Customize", route_key: "backup", url: "/backup", icon: "database-backup", sort_order: 25, roles: ["admin"], is_active: true }
];
var STORE_PATH = path.resolve(process.cwd(), "data/pos-store.json");
var cachedStore = null;
function buildInitialStore() {
  const settingsMap = {
    shop_name: "YOUTH IT POS",
    shop_address: "Shop No.04, (Ground Floor), 820, Makkha Tower, West Shewrapara, Mirpur, Dhaka-1216",
    shop_phone: "01674297522",
    shop_email: "info@youthit.com.bd",
    shop_website: "www.youthit.com.bd",
    shop_logo: "/assets/images/logo.jpg",
    shop_favicon: "/assets/images/favicon.png",
    shop_qr: "/assets/images/shop_qr.png",
    currency: "\u09F3",
    tax_rate: "0",
    invoice_footer: "Goods once sold cannot be returned unless defective under warranty.",
    sidebar_theme: "slate",
    primary_color: "emerald",
    layout_mode: "comfortable"
  };
  return {
    settings: settingsMap,
    menus: DEFAULT_MENUS,
    users: [
      {
        id: 1,
        name: "RAJ AHMED",
        email: "rajahmed249@gmail.com",
        role: "super_admin",
        phone: "+8801674297522",
        address: "Dhaka, Bangladesh",
        is_active: true,
        profile_image: "/assets/aistudio/Raj_Ahmed_02078811.jpg",
        created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
      }
    ],
    categories: [],
    brands: [],
    units: [],
    warranties: [],
    products: [],
    stock_movements: [],
    customers: [],
    suppliers: [],
    owners: [],
    employees: [],
    bank_accounts: [],
    bank_transactions: [],
    cash_transactions: [],
    expense_categories: [],
    expenses: [],
    sales: [],
    sale_items: [],
    payments: [],
    purchases: [],
    purchase_items: [],
    supplier_payments: [],
    estimates: [],
    estimate_items: [],
    returns: [],
    damages: []
  };
}
function getStore() {
  if (cachedStore) {
    return cachedStore;
  }
  if (fs.existsSync(STORE_PATH)) {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const loaded = JSON.parse(raw);
    if (!Array.isArray(loaded.owners)) loaded.owners = [];
    if (!Array.isArray(loaded.employees)) loaded.employees = [];
    if (!Array.isArray(loaded.cash_transactions)) loaded.cash_transactions = [];
    if (!loaded.settings.shop_qr || loaded.settings.shop_qr.includes("uploads/")) {
      loaded.settings.shop_qr = "/assets/images/shop_qr.png";
    }
    let menusChanged = false;
    if (!Array.isArray(loaded.menus) || loaded.menus.length === 0) {
      loaded.menus = DEFAULT_MENUS;
      menusChanged = true;
    } else {
      const hasAddProduct = loaded.menus.some((m) => m.route_key === "add-product");
      const productsMenu = loaded.menus.find((m) => m.route_key === "products");
      const prodGroup = loaded.menus.filter((m) => m.group_label === "Product Information").sort((a, b) => a.sort_order - b.sort_order).map((m) => m.route_key);
      const expectedStart = ["add-product", "categories", "brands", "units"];
      const needsProductReorder = !hasAddProduct || !productsMenu || productsMenu.group_label !== "Main" || expectedStart.some((key, idx) => prodGroup[idx] !== key);
      if (needsProductReorder) {
        const customMenus = loaded.menus.filter(
          (m) => !DEFAULT_MENUS.some((d) => d.route_key === m.route_key)
        );
        loaded.menus = [
          ...DEFAULT_MENUS,
          ...customMenus.map((m, idx) => ({
            ...m,
            sort_order: DEFAULT_MENUS.length + idx + 1
          }))
        ];
        menusChanged = true;
      }
    }
    cachedStore = loaded;
    if (menusChanged) {
      saveStore(cachedStore);
    }
    return cachedStore;
  }
  cachedStore = buildInitialStore();
  saveStore(cachedStore);
  return cachedStore;
}
function saveStore(store) {
  cachedStore = store;
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store), "utf8");
}
function nextId(rows) {
  let max = 0;
  for (const r of rows) {
    const val = Number(r.id ?? 0);
    if (val > max) {
      max = val;
    }
  }
  return max + 1;
}

// server/sqlExporter.ts
function escapeSqlString(value) {
  const escaped = value.replace(/\\/g, "\\\\").replace(/\0/g, "\\0").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\x1a/g, "\\Z");
  return `'${escaped}'`;
}
function sqlVal(val) {
  if (val === null || val === void 0) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "0";
  if (typeof val === "object") return escapeSqlString(JSON.stringify(val));
  return escapeSqlString(String(val));
}
function toNum(val, fallback = 0) {
  if (val === null || val === void 0 || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
function toNullableId(val) {
  if (val === null || val === void 0 || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
function toBoolInt(val, fallback = 1) {
  if (val === null || val === void 0 || val === "") return fallback;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return val !== 0 ? 1 : 0;
  const s = String(val).trim().toLowerCase();
  if (s === "false" || s === "0" || s === "no") return 0;
  return 1;
}
function toStr(val, fallback = null) {
  if (val === null || val === void 0) return fallback;
  const s = String(val);
  return s === "" && fallback === null ? null : s;
}
function toDateStr(val, fallback = null) {
  if (val === null || val === void 0) return fallback;
  const s = String(val).trim();
  if (!s) return fallback;
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}
function toDateTimeStr(val, fallback = null) {
  if (val === null || val === void 0) return fallback;
  const s = String(val).trim();
  if (!s) return fallback;
  const normalized = s.replace("T", " ").slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }
  const d = toDateStr(s, null);
  return d ? `${d} 00:00:00` : fallback;
}
function buildInsertBlock(table, columns, rows) {
  if (rows.length === 0) {
    return `-- Table \`${table}\`: 0 rows
`;
  }
  const colSql = columns.map((c) => `\`${c}\``).join(", ");
  const chunkSize = 200;
  const blocks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const tuples = chunk.map((r) => `  (${r.map(sqlVal).join(", ")})`).join(",\n");
    blocks.push(`INSERT INTO \`${table}\` (${colSql}) VALUES
${tuples};`);
  }
  return `${blocks.join("\n")}
`;
}
function generateMysqlDumpSql(store) {
  const nowDt = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
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
  const fkOrNull = (val, validSet) => {
    const id = toNullableId(val);
    return id !== null && validSet.has(id) ? id : null;
  };
  const schemaSql = `-- ============================================================
-- Youth IT POS \u2014 Complete MySQL 8 / MariaDB Database Export
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
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
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
    "settings",
    ["id", "key_name", "value", "updated_at"],
    settingEntries.map(([key, value], idx) => [idx + 1, key, String(value ?? ""), nowDt])
  );
  const menusBlock = buildInsertBlock(
    "menus",
    ["id", "parent_id", "title", "group_label", "route_name", "url", "icon", "sort_order", "roles", "is_active", "created_at", "updated_at"],
    (store.menus ?? []).map((m) => [
      m.id,
      m.parent_id ?? null,
      m.title,
      m.group_label ?? null,
      m.route_key ?? null,
      m.url ?? null,
      m.icon || "circle",
      toNum(m.sort_order, 0),
      JSON.stringify(Array.isArray(m.roles) ? m.roles : []),
      m.is_active ? 1 : 0,
      nowDt,
      nowDt
    ])
  );
  const validRoles = /* @__PURE__ */ new Set(["super_admin", "admin", "manager", "staff"]);
  const usersBlock = buildInsertBlock(
    "users",
    ["id", "name", "email", "password", "remember_token", "role", "phone", "address", "profile_image", "image", "is_active", "reset_token", "reset_expires", "created_at", "updated_at"],
    (store.users ?? []).map((u) => [
      u.id,
      u.name,
      u.email,
      u.password_hash ?? "",
      null,
      validRoles.has(u.role) ? u.role : "staff",
      toStr(u.phone, null),
      toStr(u.address, null),
      toStr(u.profile_image, null),
      toStr(u.profile_image, null),
      u.is_active ? 1 : 0,
      null,
      null,
      toDateTimeStr(u.created_at, nowDt),
      nowDt
    ])
  );
  const categoriesBlock = buildInsertBlock(
    "categories",
    ["id", "name", "description", "status", "created_at"],
    (store.categories ?? []).map((c) => [
      toNum(c.id),
      toStr(c.name, "Category"),
      toStr(c.description, null),
      toBoolInt(c.status, 1),
      toDateTimeStr(c.created_at, nowDt)
    ])
  );
  const brandsBlock = buildInsertBlock(
    "brands",
    ["id", "name", "status", "created_at"],
    (store.brands ?? []).map((b) => [
      toNum(b.id),
      toStr(b.name, "Brand"),
      toBoolInt(b.status, 1),
      toDateTimeStr(b.created_at, nowDt)
    ])
  );
  const unitsBlock = buildInsertBlock(
    "units",
    ["id", "name", "description", "status", "created_at"],
    (store.units ?? []).map((u) => [
      toNum(u.id),
      toStr(u.name, "Unit"),
      toStr(u.description, null),
      toBoolInt(u.status, 1),
      toDateTimeStr(u.created_at, nowDt)
    ])
  );
  const warrantiesBlock = buildInsertBlock(
    "warranties",
    ["id", "name", "duration", "status", "created_at"],
    (store.warranties ?? []).map((w) => [
      toNum(w.id),
      toStr(w.name, "Warranty"),
      toStr(w.duration, null),
      toBoolInt(w.status, 1),
      toDateTimeStr(w.created_at, nowDt)
    ])
  );
  const productsBlock = buildInsertBlock(
    "products",
    ["id", "name", "sku", "category_id", "brand_id", "warranty_id", "unit_id", "purchase_price", "selling_price", "warranty_months", "quantity", "stock_quantity", "alert_quantity", "description", "barcode", "image", "status", "warranty", "created_at"],
    (store.products ?? []).map((p) => {
      const qty = Math.trunc(toNum(p.stock_quantity ?? p.quantity, 0));
      return [
        toNum(p.id),
        toStr(p.name, "Product"),
        toStr(p.sku, null),
        fkOrNull(p.category_id, validCategoryIds),
        fkOrNull(p.brand_id, validBrandIds),
        fkOrNull(p.warranty_id, validWarrantyIds),
        fkOrNull(p.unit_id, validUnitIds),
        toNum(p.purchase_price, 0),
        toNum(p.selling_price, 0),
        Math.trunc(toNum(p.warranty_months, 0)),
        qty,
        qty,
        Math.trunc(toNum(p.alert_quantity, 5)),
        toStr(p.description, null),
        toStr(p.barcode, null),
        toStr(p.image, null),
        toBoolInt(p.status, 1),
        toStr(p.warranty, null),
        toDateTimeStr(p.created_at, nowDt)
      ];
    })
  );
  const stockMovementsBlock = buildInsertBlock(
    "stock_movements",
    ["id", "product_id", "old_quantity", "new_quantity", "difference", "reason", "created_by", "created_at"],
    (store.stock_movements ?? []).filter((m) => fkOrNull(m.product_id, validProductIds) !== null).map((m) => [
      toNum(m.id),
      toNum(m.product_id),
      Math.trunc(toNum(m.old_quantity, 0)),
      Math.trunc(toNum(m.new_quantity, 0)),
      Math.trunc(toNum(m.difference, 0)),
      toStr(m.reason, null),
      toNullableId(m.created_by),
      toDateTimeStr(m.created_at, nowDt)
    ])
  );
  const customersBlock = buildInsertBlock(
    "customers",
    ["id", "name", "email", "phone", "address", "city", "state", "zip_code", "opening_balance", "status", "points", "created_at"],
    (store.customers ?? []).map((c) => [
      toNum(c.id),
      toStr(c.name, "Customer"),
      toStr(c.email, null),
      toStr(c.phone, null),
      toStr(c.address, null),
      toStr(c.city, null),
      toStr(c.state, null),
      toStr(c.zip_code, null),
      toNum(c.opening_balance, 0),
      toBoolInt(c.status, 1),
      toNum(c.points, 0),
      toDateTimeStr(c.created_at, nowDt)
    ])
  );
  const suppliersBlock = buildInsertBlock(
    "suppliers",
    ["id", "name", "email", "phone", "address", "city", "state", "zip_code", "opening_balance", "status", "created_at"],
    (store.suppliers ?? []).map((s) => [
      toNum(s.id),
      toStr(s.name, "Supplier"),
      toStr(s.email, null),
      toStr(s.phone, null),
      toStr(s.address, null),
      toStr(s.city, null),
      toStr(s.state, null),
      toStr(s.zip_code, null),
      toNum(s.opening_balance, 0),
      toBoolInt(s.status, 1),
      toDateTimeStr(s.created_at, nowDt)
    ])
  );
  const employeesBlock = buildInsertBlock(
    "employees",
    ["id", "employee_id", "name", "email", "phone", "address", "designation", "department", "joining_date", "salary", "status", "created_at"],
    (store.employees ?? []).map((e) => [
      toNum(e.id),
      toStr(e.employee_id, null),
      toStr(e.name, "Employee"),
      toStr(e.email, null),
      toStr(e.phone, null),
      toStr(e.address, null),
      toStr(e.designation, null),
      toStr(e.department, null),
      toDateStr(e.joining_date, null),
      toNum(e.salary, 0),
      toBoolInt(e.status, 1),
      toDateTimeStr(e.created_at, nowDt)
    ])
  );
  const ownersBlock = buildInsertBlock(
    "owners",
    ["id", "name", "phone", "email", "address", "share_percent", "is_active", "created_at"],
    (store.owners ?? []).map((o) => [
      toNum(o.id),
      toStr(o.name, "Owner"),
      toStr(o.phone, null),
      toStr(o.email, null),
      toStr(o.address, null),
      toNum(o.share_percent, 0),
      toBoolInt(o.is_active ?? o.status, 1),
      toDateTimeStr(o.created_at, nowDt)
    ])
  );
  const bankAccountsBlock = buildInsertBlock(
    "bank_accounts",
    ["id", "bank_name", "account_name", "branch", "opening_balance", "balance", "created_at"],
    (store.bank_accounts ?? []).map((a) => [
      toNum(a.id),
      toStr(a.bank_name, "Bank"),
      toStr(a.account_name, "Account"),
      toStr(a.branch, null),
      toNum(a.opening_balance, 0),
      toNum(a.balance, 0),
      toDateTimeStr(a.created_at, nowDt)
    ])
  );
  const bankTransactionsBlock = buildInsertBlock(
    "bank_transactions",
    ["id", "bank_account_id", "type", "amount", "description", "transaction_date", "created_at"],
    (store.bank_transactions ?? []).filter((t) => fkOrNull(t.bank_account_id, validBankIds) !== null).map((t) => [
      toNum(t.id),
      toNum(t.bank_account_id),
      String(t.type ?? "") === "withdraw" ? "withdraw" : "deposit",
      toNum(t.amount, 0),
      toStr(t.description, null),
      toDateStr(t.transaction_date ?? t.created_at, todayDt),
      toDateTimeStr(t.created_at, nowDt)
    ])
  );
  const cashTransactionsBlock = buildInsertBlock(
    "cash_transactions",
    ["id", "type", "amount", "description", "transaction_date", "created_by", "created_at"],
    (store.cash_transactions ?? []).map((t) => [
      toNum(t.id),
      String(t.type ?? "") === "out" ? "out" : "in",
      toNum(t.amount, 0),
      toStr(t.description, null),
      toDateStr(t.transaction_date ?? t.created_at, todayDt),
      toNullableId(t.created_by),
      toDateTimeStr(t.created_at, nowDt)
    ])
  );
  const expenseCategoriesBlock = buildInsertBlock(
    "expense_categories",
    ["id", "name", "description", "status", "created_at"],
    (store.expense_categories ?? []).map((c) => [
      toNum(c.id),
      toStr(c.name, "General"),
      toStr(c.description, null),
      toBoolInt(c.status, 1),
      toDateTimeStr(c.created_at, nowDt)
    ])
  );
  const expensesBlock = buildInsertBlock(
    "expenses",
    ["id", "category", "description", "amount", "expense_date", "created_by", "created_at"],
    (store.expenses ?? []).map((e) => [
      toNum(e.id),
      toStr(e.category, "General"),
      toStr(e.description, null),
      toNum(e.amount, 0),
      toDateStr(e.expense_date ?? e.created_at, todayDt),
      toNullableId(e.created_by),
      toDateTimeStr(e.created_at, nowDt)
    ])
  );
  const validSaleStatuses = /* @__PURE__ */ new Set(["pending", "completed", "cancelled"]);
  const salesBlock = buildInsertBlock(
    "sales",
    ["id", "invoice_no", "customer_id", "customer_name", "date", "discount", "receivable", "paid", "due", "purchase_cost", "profit", "status", "sale_date", "subtotal", "account_id", "account_name", "payment_status", "created_at"],
    (store.sales ?? []).map((s) => {
      const status = String(s.status ?? "completed").toLowerCase();
      return [
        toNum(s.id),
        toStr(s.invoice_no, `INV-${s.id}`),
        fkOrNull(s.customer_id, validCustomerIds),
        toStr(s.customer_name, "Walk-in Customer"),
        toDateStr(s.date ?? s.sale_date ?? s.created_at, todayDt),
        toNum(s.discount, 0),
        toNum(s.receivable, 0),
        toNum(s.paid, 0),
        toNum(s.due, 0),
        toNum(s.purchase_cost, 0),
        toNum(s.profit, 0),
        validSaleStatuses.has(status) ? status : "completed",
        toDateTimeStr(s.sale_date ?? s.date ?? s.created_at, null),
        toNum(s.subtotal ?? s.receivable, 0),
        fkOrNull(s.account_id, validBankIds),
        toStr(s.account_name, null),
        toStr(s.payment_status, "paid"),
        toDateTimeStr(s.created_at, nowDt)
      ];
    })
  );
  const saleItemsBlock = buildInsertBlock(
    "sale_items",
    ["id", "product_id", "sale_id", "product_name", "category_name", "quantity", "price", "total", "purchase_cost", "serial_no", "warranty", "buying_price", "warranty_id", "warranty_name"],
    (store.sale_items ?? []).filter((it) => fkOrNull(it.sale_id, validSaleIds) !== null).map((it) => [
      toNum(it.id),
      fkOrNull(it.product_id, validProductIds),
      toNum(it.sale_id),
      toStr(it.product_name, "Product"),
      toStr(it.category_name, null),
      Math.trunc(toNum(it.quantity, 1)),
      toNum(it.price, 0),
      toNum(it.total, 0),
      toNum(it.purchase_cost, 0),
      toStr(it.serial_no, null),
      toStr(it.warranty, null),
      toNum(it.buying_price ?? it.purchase_cost, 0),
      fkOrNull(it.warranty_id, validWarrantyIds),
      toStr(it.warranty_name, null)
    ])
  );
  const paymentsBlock = buildInsertBlock(
    "payments",
    ["id", "sale_id", "customer_id", "amount", "payment_date", "payment_method", "reference_no", "note", "created_by", "created_at"],
    (store.payments ?? []).map((p) => [
      toNum(p.id),
      fkOrNull(p.sale_id, validSaleIds),
      fkOrNull(p.customer_id, validCustomerIds),
      toNum(p.amount, 0),
      toDateTimeStr(p.payment_date ?? p.created_at, nowDt),
      toStr(p.payment_method, "cash"),
      toStr(p.reference_no, null),
      toStr(p.note, null),
      toNullableId(p.created_by),
      toDateTimeStr(p.created_at, nowDt)
    ])
  );
  const validEstimateStatuses = /* @__PURE__ */ new Set(["pending", "approved", "rejected", "expired"]);
  const estimatesBlock = buildInsertBlock(
    "estimates",
    ["id", "estimate_no", "customer_id", "customer_name", "customer_phone", "customer_email", "customer_address", "subtotal", "discount", "discount_type", "tax", "tax_rate", "total", "status", "valid_until", "notes", "created_by", "created_at", "updated_at"],
    (store.estimates ?? []).map((e) => {
      const st = String(e.status ?? "pending").toLowerCase();
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
        String(e.discount_type ?? "") === "percentage" ? "percentage" : "fixed",
        toNum(e.tax, 0),
        toNum(e.tax_rate, 0),
        toNum(e.total, 0),
        validEstimateStatuses.has(st) ? st : "pending",
        toDateStr(e.valid_until, null),
        toStr(e.notes, null),
        toNullableId(e.created_by),
        toDateTimeStr(e.created_at, nowDt),
        toDateTimeStr(e.updated_at ?? e.created_at, nowDt)
      ];
    })
  );
  const estimateItemsBlock = buildInsertBlock(
    "estimate_items",
    ["id", "estimate_id", "product_id", "product_name", "quantity", "price", "total"],
    (store.estimate_items ?? []).filter((it) => fkOrNull(it.estimate_id, validEstimateIds) !== null && fkOrNull(it.product_id, validProductIds) !== null).map((it) => [
      toNum(it.id),
      toNum(it.estimate_id),
      toNum(it.product_id),
      toStr(it.product_name, null),
      Math.trunc(toNum(it.quantity, 1)),
      toNum(it.price, 0),
      toNum(it.total, 0)
    ])
  );
  const returnsBlock = buildInsertBlock(
    "returns",
    ["id", "sale_id", "invoice_no", "customer_id", "product_id", "quantity", "price", "total_amount", "reason", "return_date", "created_by", "created_at"],
    (store.returns ?? []).filter((r) => fkOrNull(r.sale_id, validSaleIds) !== null).map((r) => [
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
      toDateTimeStr(r.created_at, nowDt)
    ])
  );
  const damagesBlock = buildInsertBlock(
    "damages",
    ["id", "product_id", "quantity", "reason", "loss_amount", "damage_date", "created_by", "created_at"],
    (store.damages ?? []).filter((d) => fkOrNull(d.product_id, validProductIds) !== null).map((d) => [
      toNum(d.id),
      toNum(d.product_id),
      Math.trunc(toNum(d.quantity, 1)),
      toStr(d.reason, null),
      toNum(d.loss_amount, 0),
      toDateStr(d.damage_date ?? d.created_at, todayDt),
      toNullableId(d.created_by),
      toDateTimeStr(d.created_at, nowDt)
    ])
  );
  const purchasesBlock = buildInsertBlock(
    "purchases",
    ["id", "invoice_no", "supplier_id", "purchase_date", "total_amount", "paid_amount", "due_amount", "discount", "payment_method", "note", "status", "user_id", "subtotal", "total", "paid", "due", "created_at"],
    (store.purchases ?? []).map((p) => [
      toNum(p.id),
      toStr(p.invoice_no, `PUR-${p.id}`),
      fkOrNull(p.supplier_id, validSupplierIds),
      toDateTimeStr(p.purchase_date ?? p.created_at, nowDt),
      toNum(p.total_amount ?? p.total, 0),
      toNum(p.paid_amount ?? p.paid, 0),
      toNum(p.due_amount ?? p.due, 0),
      toNum(p.discount, 0),
      toStr(p.payment_method, "cash"),
      toStr(p.note, null),
      toBoolInt(p.status, 1),
      toNum(p.user_id, 1),
      toNum(p.subtotal ?? p.total_amount ?? p.total, 0),
      toNum(p.total ?? p.total_amount, 0),
      toNum(p.paid ?? p.paid_amount, 0),
      toNum(p.due ?? p.due_amount, 0),
      toDateTimeStr(p.created_at, nowDt)
    ])
  );
  const purchaseItemsBlock = buildInsertBlock(
    "purchase_items",
    ["id", "purchase_id", "product_id", "quantity", "price", "warranty_months", "total"],
    (store.purchase_items ?? []).filter((pi) => fkOrNull(pi.purchase_id, validPurchaseIds) !== null && fkOrNull(pi.product_id, validProductIds) !== null).map((pi) => [
      toNum(pi.id),
      toNum(pi.purchase_id),
      toNum(pi.product_id),
      Math.trunc(toNum(pi.quantity, 1)),
      toNum(pi.price, 0),
      Math.trunc(toNum(pi.warranty_months, 0)),
      toNum(pi.total, 0)
    ])
  );
  const supplierPaymentsBlock = buildInsertBlock(
    "supplier_payments",
    ["id", "purchase_id", "supplier_id", "amount", "payment_date", "payment_method", "reference_no", "note", "created_by", "created_at"],
    (store.supplier_payments ?? []).map((sp) => [
      toNum(sp.id),
      fkOrNull(sp.purchase_id, validPurchaseIds),
      fkOrNull(sp.supplier_id, validSupplierIds),
      toNum(sp.amount, 0),
      toDateTimeStr(sp.payment_date ?? sp.created_at, nowDt),
      toStr(sp.payment_method, "cash"),
      toStr(sp.reference_no, null),
      toStr(sp.note, null),
      toNullableId(sp.created_by),
      toDateTimeStr(sp.created_at, nowDt)
    ])
  );
  return [
    schemaSql,
    "-- ============================================================",
    "-- Table Data Inserts",
    "-- ============================================================",
    "",
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
    "SET FOREIGN_KEY_CHECKS = 1;",
    ""
  ].join("\n");
}

// server/sqlParser.ts
function parseValueToken(raw) {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === "NULL") {
    return null;
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const inner = trimmed.slice(1, -1);
    return inner.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "	").replace(/\\\\/g, "\\");
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : trimmed;
  }
  return trimmed;
}
function splitTuples(valuesPart) {
  const rows = [];
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let currentField = "";
  let currentRow = [];
  for (let i = 0; i < valuesPart.length; i++) {
    const ch = valuesPart[i];
    if (escapeNext) {
      currentField += ch;
      escapeNext = false;
      continue;
    }
    if (ch === "\\" && inString) {
      currentField += ch;
      escapeNext = true;
      continue;
    }
    if (ch === "'") {
      if (inString && valuesPart[i + 1] === "'") {
        currentField += "\\'";
        i++;
        continue;
      }
      inString = !inString;
      currentField += ch;
      continue;
    }
    if (!inString) {
      if (ch === "(") {
        if (depth === 0) {
          currentRow = [];
          currentField = "";
        } else {
          currentField += ch;
        }
        depth++;
        continue;
      }
      if (ch === ")") {
        depth--;
        if (depth === 0) {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentField = "";
        } else {
          currentField += ch;
        }
        continue;
      }
      if (ch === "," && depth === 1) {
        currentRow.push(currentField);
        currentField = "";
        continue;
      }
    }
    if (depth >= 1) {
      currentField += ch;
    }
  }
  return rows;
}
function extractCreateTableSchemas(content) {
  const schemas = {};
  const createRegex = /CREATE TABLE(?: IF NOT EXISTS)? `([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi;
  let match;
  while ((match = createRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const cols = [];
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      const colMatch = line.match(/^`([^`]+)`\s+/);
      if (colMatch) {
        cols.push(colMatch[1]);
      }
    }
    if (cols.length > 0) {
      schemas[tableName] = cols;
    }
  }
  return schemas;
}
function findStatementEnd(content, startIdx) {
  let inString = false;
  let escapeNext = false;
  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === "'") {
      if (inString && content[i + 1] === "'") {
        i++;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (!inString && ch === ";") {
      return i;
    }
  }
  const tail = content.slice(startIdx);
  const boundaryMatch = tail.match(/;\r?\n(?:\/\*!40000 ALTER TABLE|UNLOCK TABLES;|DROP TABLE IF EXISTS|CREATE TABLE|INSERT(?:\s+IGNORE)?\s+INTO)/);
  if (boundaryMatch && boundaryMatch.index !== void 0) {
    return startIdx + boundaryMatch.index;
  }
  return -1;
}
function parseMysqlDumpText(content) {
  const schemas = extractCreateTableSchemas(content);
  const tables = {};
  const incompleteTables = [];
  let truncated = false;
  const insertHeadRegex = /INSERT(?:\s+IGNORE)?\s+INTO `([a-zA-Z0-9_]+)`(?:\s*\(([^)]+)\))?\s+VALUES\s*/gi;
  let match;
  while ((match = insertHeadRegex.exec(content)) !== null) {
    const tableName = match[1];
    const explicitCols = match[2];
    const valuesStart = match.index + match[0].length;
    const stmtEnd = findStatementEnd(content, valuesStart);
    if (stmtEnd === -1) {
      truncated = true;
      incompleteTables.push(tableName);
      break;
    }
    insertHeadRegex.lastIndex = stmtEnd + 1;
    if (tableName.includes("backup")) {
      continue;
    }
    const columns = explicitCols ? explicitCols.split(",").map((c) => c.trim().replace(/^`|`$/g, "")) : schemas[tableName] ?? [];
    if (columns.length === 0) {
      continue;
    }
    const valuesPart = content.slice(valuesStart, stmtEnd);
    const tuples = splitTuples(valuesPart);
    if (!tables[tableName]) {
      tables[tableName] = [];
    }
    for (const tuple of tuples) {
      const row = {};
      for (let idx = 0; idx < columns.length; idx++) {
        row[columns[idx]] = idx < tuple.length ? parseValueToken(tuple[idx]) : null;
      }
      tables[tableName].push(row);
    }
  }
  return { tables, schemas, truncated, incompleteTables };
}

// server.ts
var PORT = Number(process.env.PORT || 3e3);
var IDLE_TIMEOUT_MS = 60 * 60 * 1e3;
var OTP_EXPIRY_MS = 10 * 60 * 1e3;
var OTP_COOLDOWN_MS = 45 * 1e3;
var OTP_HMAC_KEY = process.env.OTP_SECRET || crypto.randomBytes(32).toString("hex");
var SESSION_COOKIE_NAME = "youthit_pos_session";
var SESSIONS_FILE = path2.resolve(process.cwd(), "data/.sessions.json");
var REVOKED_SESSIONS_FILE = path2.resolve(process.cwd(), "data/.revoked-sessions.json");
var activeSessions = /* @__PURE__ */ new Map();
var revokedSessionJtis = /* @__PURE__ */ new Map();
function loadPersistedSessions() {
  try {
    if (fs2.existsSync(SESSIONS_FILE)) {
      const raw = fs2.readFileSync(SESSIONS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      const now = Date.now();
      for (const [tok, sess] of Object.entries(parsed)) {
        if (tok && sess && Number.isFinite(sess.userId) && Number.isFinite(sess.expiresAt) && sess.expiresAt > now) {
          activeSessions.set(tok, { userId: sess.userId, expiresAt: sess.expiresAt, lastSavedAt: now });
        }
      }
    }
  } catch {
  }
  try {
    if (fs2.existsSync(REVOKED_SESSIONS_FILE)) {
      const raw = fs2.readFileSync(REVOKED_SESSIONS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      const now = Date.now();
      for (const [jti, exp] of Object.entries(parsed)) {
        if (jti && Number.isFinite(exp) && exp > now) {
          revokedSessionJtis.set(jti, exp);
        }
      }
    }
  } catch {
  }
}
function savePersistedSessions() {
  try {
    const dir = path2.dirname(SESSIONS_FILE);
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    const now = Date.now();
    const out = {};
    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.expiresAt > now) {
        out[tok] = { userId: sess.userId, expiresAt: sess.expiresAt };
        sess.lastSavedAt = now;
      } else {
        activeSessions.delete(tok);
      }
    }
    fs2.writeFileSync(SESSIONS_FILE, JSON.stringify(out), "utf8");
  } catch {
  }
}
function saveRevokedSessions() {
  try {
    const dir = path2.dirname(REVOKED_SESSIONS_FILE);
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    const now = Date.now();
    const out = {};
    for (const [jti, exp] of revokedSessionJtis.entries()) {
      if (exp > now) {
        out[jti] = exp;
      } else {
        revokedSessionJtis.delete(jti);
      }
    }
    fs2.writeFileSync(REVOKED_SESSIONS_FILE, JSON.stringify(out), "utf8");
  } catch {
  }
}
loadPersistedSessions();
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}
function isSecureCookieRequest(req) {
  const proto = String(req.headers["x-forwarded-proto"] ?? "").toLowerCase();
  return req.secure || proto.includes("https");
}
function setSessionCookie(req, res, token, expiresAt) {
  const maxAgeSec = Math.max(60, Math.floor((expiresAt - Date.now()) / 1e3));
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAgeSec}`,
    isSecureCookieRequest(req) ? "SameSite=None; Secure" : "SameSite=Lax"
  ];
  res.setHeader("Set-Cookie", attrs.join("; "));
}
function clearSessionCookie(req, res) {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    isSecureCookieRequest(req) ? "SameSite=None; Secure" : "SameSite=Lax"
  ];
  res.setHeader("Set-Cookie", attrs.join("; "));
}
var recoveryCodes = /* @__PURE__ */ new Map();
function getPublicSettings(store) {
  return {
    shop_name: store.settings.shop_name || "YOUTH IT POS",
    shop_logo: store.settings.shop_logo || "/assets/images/logo.jpg",
    shop_favicon: store.settings.shop_favicon || "/assets/images/favicon.png",
    shop_website: store.settings.shop_website || "www.youthit.com.bd"
  };
}
function deriveUserSessionKey(user) {
  const baseSecret = process.env.SESSION_SECRET || "youthit-pos-stable-session-secret-v2";
  return crypto.createHash("sha256").update(`${baseSecret}:${user.id}:${user.email.toLowerCase()}:${user.password_hash ?? ""}`).digest();
}
function createSignedSessionToken(user, jti = crypto.randomBytes(12).toString("hex"), now = Date.now()) {
  const expiresAt = now + IDLE_TIMEOUT_MS;
  const payload = { uid: user.id, iat: now, exp: expiresAt, jti };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", deriveUserSessionKey(user)).update(encoded).digest("hex");
  return { token: `yt1.${encoded}.${sig}`, expiresAt, jti };
}
function parseSignedTokenJti(token) {
  if (!token.startsWith("yt1.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof decoded.jti === "string" && Number.isFinite(Number(decoded.exp))) {
      return { jti: decoded.jti, exp: Number(decoded.exp) };
    }
  } catch {
    return null;
  }
  return null;
}
function getValidSession(req, res) {
  const authHeader = String(req.headers.authorization ?? "");
  let token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    const cookies = parseCookies(req.headers.cookie);
    token = String(cookies[SESSION_COOKIE_NAME] ?? "").trim();
  }
  if (!token) return null;
  const store = getStore();
  const now = Date.now();
  if (token.startsWith("yt1.")) {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [, encoded, sigHex] = parts;
    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      const uid = Number(payload.uid);
      const iat = Number(payload.iat);
      const exp = Number(payload.exp);
      const jti = String(payload.jti ?? "");
      if (!Number.isFinite(uid) || !Number.isFinite(iat) || !Number.isFinite(exp) || !jti) {
        return null;
      }
      if (now > exp) return null;
      const revokedExp = revokedSessionJtis.get(jti);
      if (revokedExp && revokedExp > now) return null;
      const user2 = store.users.find((u) => u.id === uid);
      if (!user2 || !user2.is_active) return null;
      const expectedSig = crypto.createHmac("sha256", deriveUserSessionKey(user2)).update(encoded).digest();
      const providedSig = Buffer.from(sigHex, "hex");
      if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
        return null;
      }
      let activeToken = token;
      let activeExpiresAt = exp;
      if (now - iat >= 6e4) {
        const refreshed = createSignedSessionToken(user2, jti, now);
        activeToken = refreshed.token;
        activeExpiresAt = refreshed.expiresAt;
        if (res) {
          res.setHeader("X-Refreshed-Token", activeToken);
          setSessionCookie(req, res, activeToken, activeExpiresAt);
        }
      }
      return { token: activeToken, user: user2, expiresAt: activeExpiresAt };
    } catch {
      return null;
    }
  }
  const sess = activeSessions.get(token);
  if (!sess) return null;
  if (now > sess.expiresAt) {
    activeSessions.delete(token);
    savePersistedSessions();
    return null;
  }
  const user = store.users.find((u) => u.id === sess.userId);
  if (!user || !user.is_active) {
    activeSessions.delete(token);
    savePersistedSessions();
    return null;
  }
  const upgraded = createSignedSessionToken(user, void 0, now);
  activeSessions.delete(token);
  savePersistedSessions();
  if (res) {
    res.setHeader("X-Refreshed-Token", upgraded.token);
    setSessionCookie(req, res, upgraded.token, upgraded.expiresAt);
  }
  return { token: upgraded.token, user, expiresAt: upgraded.expiresAt };
}
function hasAnyRole(user, roles) {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return roles.includes(user.role);
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hashHex, "hex");
    return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}
function normalizePhoneDigits(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}
function sanitizeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    address: u.address,
    profile_image: u.profile_image || null,
    is_active: u.is_active,
    has_password: Boolean(u.password_hash),
    created_at: u.created_at
  };
}
function sanitizeSearch(q) {
  return String(q ?? "").trim().toLowerCase();
}
function matchesSearchTokens(fields, query) {
  if (!query) return true;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields.map((f) => String(f ?? "").toLowerCase()).join(" ");
  return tokens.every((t) => haystack.includes(t));
}
var EXCLUDED_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  "vendor",
  ".git",
  ".aistudio",
  "tmp",
  ".cache",
  ".vite"
]);
function isExcludedFileName(name) {
  if (name === ".DS_Store" || name === ".sessions.json" || name === ".revoked-sessions.json") return true;
  if (/^\.env($|\.)/i.test(name) && name !== ".env.example") return true;
  if (/\.log$/i.test(name)) return true;
  return false;
}
function collectFiles(dir, baseDir) {
  const results = [];
  if (!fs2.existsSync(dir)) return results;
  for (const entry of fs2.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      results.push(...collectFiles(path2.join(dir, entry.name), baseDir));
    } else if (entry.isFile()) {
      if (isExcludedFileName(entry.name)) continue;
      const full = path2.join(dir, entry.name);
      results.push(path2.relative(baseDir, full).replace(/\\/g, "/"));
    }
  }
  return results.sort();
}
function buildHostingUploadGuide() {
  return `# Youth IT POS \u2014 Easy Hosting & Local Setup Guide

## Included Files & Database
- \`database/youthit_pos_database.sql\` (and \`laravel/database/sql/youthits_pos.sql\`): Complete MySQL 8 / MariaDB schema + all live POS data.
- \`data/pos-store.json\`: Live JSON database used by the Node.js + React server.
- \`public/\`: Shop logos, favicon, QR code, and all uploaded product & avatar images.
- \`.env.example\`: Safe environment template (\`.env\` with fresh \`APP_KEY\` is auto-created on first run for Laravel).

---

## Option 1: cPanel Shared Hosting or Local XAMPP / Laragon (\`youthit-pos-laravel-13.zip\`)
1. **Create an empty MySQL Database** (in cPanel -> *MySQL Databases* or locally in *phpMyAdmin*).
2. **Upload & Extract** \`youthit-pos-laravel-13.zip\` into your domain folder (or \`C:\\xampp\\htdocs\\youthit-pos\` / \`C:\\laragon\\www\\youthit-pos\` locally).
3. **Install PHP Vendor Packages** (only if \`vendor/\` folder is not already present):
   \`\`\`bash
   composer install --no-dev --optimize-autoloader
   \`\`\`
4. **Open Your Site in Browser** (e.g. \`https://yourdomain.com\` or \`http://localhost/youthit-pos\`):
   - No manual \`.env\`, \`APP_KEY\`, or SQL import needed!
   - The built-in **1-Click Setup Wizard (\`/setup\`)** opens automatically, creates \`.env\` + \`APP_KEY\`, connects your MySQL database, imports \`youthits_pos.sql\`, sets your admin login password, and redirects to \`/login\`.
5. **Email & SMS Recovery (Optional)**: Update \`MAIL_*\` and \`SMS_*\` inside \`.env\`.

---

## Option 2: Node.js Hosting (VPS / cPanel Setup Node.js App) or Local PC (\`youthit-pos-full-project.zip\`)
Prebuilt \`dist/\` frontend and compiled \`server.js\` are already bundled inside the ZIP!
1. Extract \`youthit-pos-full-project.zip\`.
2. Copy \`.env.example\` to \`.env\` (optional: add \`SMTP_*\` / \`SMS_*\` settings).
3. Install runtime packages and start immediately (Node 18 / 20 / 22+):
   \`\`\`bash
   npm install --omit=dev
   npm start
   \`\`\`
   *(For cPanel Setup Node.js App, set **Application startup file** to \`server.js\`.)*
4. Open \`http://localhost:3000\` (or your domain) in the browser and sign in.
`;
}
async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  const uploadsDir = path2.resolve(process.cwd(), "public/uploads/avatars");
  const productUploadsDir = path2.resolve(process.cwd(), "public/uploads/products");
  if (!fs2.existsSync(uploadsDir)) {
    fs2.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs2.existsSync(productUploadsDir)) {
    fs2.mkdirSync(productUploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(path2.resolve(process.cwd(), "public/uploads")));
  const publicRootDir = path2.resolve(process.cwd(), "public");
  const PRODUCT_NAME_IMAGE_RULES = [
    [/ds-2ce70df0t|colorvu.*dome|hikvision.*dome/i, "/uploads/products/1778931608_ds-2ce70df0t-lpfss-01-500x500.webp"],
    [/ds-2ce12df0t|colorvu.*bullet|hikvision.*bullet/i, "/uploads/products/1778931750_Hikvision-DS-2CE12DF0T-FS.jpg"],
    [/ds-7108|hikvision.*(dvr|nvr|xvr)/i, "/uploads/products/1778932443_ds-7108hghi-m1-t-01-500x500.webp"],
    [/ptn-c6|protech.*(cat\s*6|cable|utp)/i, "/uploads/products/1778932161_ptn-c6-cca-in-wh-500x500.webp"],
    [/protech.*balun|black.*balun/i, "/uploads/products/1778932922_ProtechVideoBalun.jpg"],
    [/video\s*balu?n|split\s*joint.*balun/i, "/uploads/products/1774523205_VideoBaloon2.png"],
    [/dtech|fiber\s*optic.*hdmi|10\s*m.*hdmi|hdmi.*10\s*m/i, "/uploads/products/1775656388_DTECH10MeterFiberOpticHDMICable4K3DV2.0.jpeg"],
    [/deco|mesh\s*(wi-?fi|router)/i, "/uploads/products/1786888213_6a81c015a1644.jpg"],
    [/tp-?link|wr840|wr841|wi-?fi\s*router|wireless\s*router/i, "/uploads/products/1775156479_TPLinkRouter-YouthIT.jpg"],
    [/a4\s*tech|optical\s*mouse|wired\s*mouse|\bmouse\b/i, "/uploads/products/1774450128_Mouse-YouthIT.jpg"],
    [/projector.*(lamp|bulb)|lamp.*bulb/i, "/uploads/products/1784115645_6a5771bd2b1f6.jpg"],
    [/\bhp\b.*laptop|\blaptop\b/i, "/uploads/products/1786643697_6a7e04f104f8b.webp"],
    [/toten|rack.*(shelf|tray)|\bshelf\b|\btray\b/i, "/uploads/products/1786712765_6a7f12bd514d4.jpg"],
    [/(compact|small|4u|6u).*(rack|cabinet)|(rack|cabinet).*(4u|6u)/i, "/uploads/products/1786886944_6a81bb205ab7d.webp"],
    [/server\s*rack|network\s*(rack|cabinet)|wall\s*cabinet/i, "/uploads/products/1786712775_6a7f12c7eefe0.jpg"],
    [/onv.*(24|26).*poe|(24|26).*port.*poe/i, "/uploads/products/1786712866_6a7f13221e3cd.jpg"],
    [/onv.*gigabit.*poe|onv.*10.*1000/i, "/uploads/products/1786712826_6a7f12fa7a61f.jpg"],
    [/onv.*poe|10.*port.*poe/i, "/uploads/products/1786888040_6a81bf68722e3.jpg"],
    [/hrui.*poe|managed.*poe/i, "/uploads/products/1786887457_6a81bd213922c.jpg"],
    [/jovision.*(dvr|nvr|xvr)/i, "/uploads/products/1786712921_6a7f1359effd9.jpg"],
    [/jovision.*bullet/i, "/uploads/products/1786712947_6a7f1373e6f91.webp"],
    [/jovision.*(turret|two-?way|audio|mic)/i, "/uploads/products/1787689048_6a8df8588e59b.webp"],
    [/jovision.*dome|jovision.*camera/i, "/uploads/products/1786886564_6a81b9a493b8e.jpg"],
    [/\bmi\b.*(cat-?6|cable|305)/i, "/uploads/products/1786887301_6a81bc8550a80.jpg"],
    [/pixel|pxc-2501|1000ft.*cat/i, "/uploads/products/1786888782_6a81c24e35a8b.png"],
    [/toshiba|s300|6\s*tb|surveillance.*(hdd|hard\s*drive|disk)/i, "/uploads/products/1786887784_6a81be684747c.jpg"],
    [/zkteco|attendance|biometric|fingerprint/i, "/uploads/products/1786888313_6a81c079ebb06.webp"],
    [/keystone/i, "/uploads/products/1787336191_6a8895ffc4340.jpg"],
    [/rj-?45.*connector|modular\s*connector|rj-?45/i, "/uploads/products/1786888496_6a81c1309853e.webp"],
    [/logitech|webcam|web\s*cam/i, "/uploads/products/1787333051_6a8889bba4425.webp"],
    [/d-?link.*(faceplate|face\s*plate|wall|box)|faceplate/i, "/uploads/products/1787333152_6a888a2051d14.webp"],
    [/micro\s*sd|64\s*gb.*card|memory\s*card/i, "/uploads/products/1787335859_6a8894b34c414.jpg"],
    [/ezviz|pan.*tilt.*cam|smart.*wi-?fi.*cam/i, "/uploads/products/1787336060_6a88957c7a07e.webp"],
    [/vico|v-?15|trolley\s*speaker|portable.*speaker/i, "/uploads/products/1787676708_6a8dc824339ef.jpg"],
    [/ahuja.*(ssb|amplifier|amp)/i, "/uploads/products/1787683417_6a8de259d5253.webp"],
    [/ahuja.*(awm|wireless.*mic|microphone)/i, "/uploads/products/1787683865_6a8de419ec586.webp"],
    [/ahuja|column\s*speaker/i, "/uploads/products/1787683069_6a8de0fddd320.webp"],
    [/speaker\s*cable|audio\s*cable/i, "/uploads/products/1787683649_6a8de341673de.jpg"]
  ];
  function resolveProductImage(rawImage, productName) {
    const raw = String(rawImage ?? "").trim();
    if (raw && raw.toLowerCase() !== "null" && raw.toLowerCase() !== "undefined") {
      if (raw.startsWith("data:image/") || /^https?:\/\//i.test(raw)) {
        return raw;
      }
      const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
      const directCandidate = normalized.startsWith("public/") ? normalized.slice(7) : normalized;
      if (fs2.existsSync(path2.join(publicRootDir, directCandidate))) {
        return `/${directCandidate}`;
      }
      const base = path2.posix.basename(directCandidate);
      const strippedBase = base.replace(/_[0-9a-f]{8}(\.[^.]+)$/i, "$1");
      if (fs2.existsSync(path2.join(productUploadsDir, base))) {
        return `/uploads/products/${base}`;
      }
      if (strippedBase !== base && fs2.existsSync(path2.join(productUploadsDir, strippedBase))) {
        return `/uploads/products/${strippedBase}`;
      }
      if (fs2.existsSync(path2.join(publicRootDir, "assets/aistudio", base))) {
        return `/assets/aistudio/${base}`;
      }
    }
    const name = String(productName ?? "").trim();
    if (name) {
      for (const [pattern, imgPath] of PRODUCT_NAME_IMAGE_RULES) {
        if (pattern.test(name)) {
          return imgPath;
        }
      }
    }
    if (raw && raw.toLowerCase() !== "null" && raw.toLowerCase() !== "undefined") {
      const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
      return normalized.includes("/") ? `/${normalized}` : `/uploads/products/${normalized}`;
    }
    return null;
  }
  getStore();
  const PUBLIC_API_PATHS = /* @__PURE__ */ new Set([
    "/auth/session",
    "/auth/login",
    "/auth/request-recovery-code",
    "/auth/verify-recovery-code",
    "/auth/recover-password",
    "/auth/logout"
  ]);
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (PUBLIC_API_PATHS.has(req.path)) {
      next();
      return;
    }
    const session = getValidSession(req, res);
    if (!session) {
      clearSessionCookie(req, res);
      res.status(401).json({
        error: "Authentication required. Please sign in or re-authenticate after inactivity."
      });
      return;
    }
    req.authUser = session.user;
    const adminOnlyPrefixes = ["/settings", "/backup", "/laravel"];
    const isAdminOnly = adminOnlyPrefixes.some((p) => req.path.startsWith(p)) || req.path.startsWith("/menus") && req.method !== "GET" || req.path.startsWith("/users") && (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") && !req.path.endsWith("/avatar");
    if (isAdminOnly && !hasAnyRole(session.user, ["admin"])) {
      res.status(403).json({ error: "Administrator permission required for this action." });
      return;
    }
    const managerPrefixes = [
      "/owners",
      "/cashbook",
      "/accounts",
      "/expenses",
      "/purchases",
      "/suppliers",
      "/employees",
      "/returns",
      "/damages",
      "/reports"
    ];
    const isManagerArea = managerPrefixes.some((p) => req.path.startsWith(p)) || req.path.startsWith("/sales/") && req.method === "DELETE";
    if (isManagerArea && !hasAnyRole(session.user, ["admin", "manager"])) {
      res.status(403).json({ error: "Manager or Administrator permission required for this module." });
      return;
    }
    next();
  });
  function buildBootstrapPayload(store, authUser) {
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    let todaySales = 0;
    let todayProfit = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let customerDue = 0;
    for (const sale of store.sales) {
      if (String(sale.status ?? "completed") !== "completed") continue;
      const rec = Number(sale.receivable ?? 0);
      const prof = Number(sale.profit ?? 0);
      const due = Number(sale.due ?? 0);
      totalRevenue += rec;
      totalProfit += prof;
      customerDue += due;
      if (String(sale.date ?? "").startsWith(todayStr)) {
        todaySales += rec;
        todayProfit += prof;
      }
    }
    let supplierDue = 0;
    for (const pur of store.purchases) {
      supplierDue += Number(pur.due ?? 0);
    }
    let totalExpenses = 0;
    for (const exp of store.expenses) {
      totalExpenses += Number(exp.amount ?? 0);
    }
    const activeProducts = store.products.filter((p) => Number(p.status ?? 1) === 1);
    let stockCostValue = 0;
    let stockRetailValue = 0;
    for (const p of activeProducts) {
      const qty = Math.max(0, Number(p.quantity ?? 0));
      stockCostValue += qty * Number(p.purchase_price ?? 0);
      stockRetailValue += qty * Number(p.selling_price ?? 0);
    }
    const lowStock = activeProducts.filter((p) => Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5)).sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0)).slice(0, 10).map((p) => ({
      ...p,
      image: resolveProductImage(p.image, p.name)
    }));
    const recentSales = [...store.sales].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)).slice(0, 10);
    const monthTotals = {};
    for (const s of store.sales) {
      if (String(s.status ?? "completed") !== "completed") continue;
      const m = String(s.date ?? "").slice(0, 7);
      if (!m) continue;
      if (!monthTotals[m]) {
        monthTotals[m] = { month: m, revenue: 0, profit: 0, count: 0 };
      }
      monthTotals[m].revenue += Number(s.receivable ?? 0);
      monthTotals[m].profit += Number(s.profit ?? 0);
      monthTotals[m].count += 1;
    }
    const monthlyTrend = Object.values(monthTotals).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
    return {
      settings: store.settings,
      menus: [...store.menus].sort((a, b) => a.sort_order - b.sort_order),
      users: hasAnyRole(authUser, ["admin"]) ? store.users.map(sanitizeUser) : authUser ? [sanitizeUser(authUser)] : [],
      categories: store.categories,
      brands: store.brands,
      units: store.units,
      warranties: store.warranties,
      bankAccounts: store.bank_accounts,
      expenseCategories: store.expense_categories,
      metrics: {
        todaySales,
        todayProfit,
        totalRevenue,
        totalProfit,
        customerDue,
        supplierDue,
        totalExpenses,
        productCount: activeProducts.length,
        customerCount: store.customers.length,
        supplierCount: store.suppliers.length,
        saleCount: store.sales.length,
        purchaseCount: store.purchases.length,
        stockCostValue,
        stockRetailValue
      },
      lowStock,
      recentSales,
      monthlyTrend
    };
  }
  app.get("/api/bootstrap", (req, res) => {
    const store = getStore();
    res.json(buildBootstrapPayload(store, req.authUser));
  });
  app.get("/api/products", (req, res) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const brandId = req.query.brand_id ? Number(req.query.brand_id) : null;
    const lowStockOnly = req.query.low_stock === "1";
    const includeInactive = req.query.include_inactive === "1";
    const fetchAll = req.query.all === "1";
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = fetchAll ? Math.max(1, store.products.length) : Math.min(1e4, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? "")]));
    const brandMap = new Map(store.brands.map((b) => [Number(b.id), String(b.name ?? "")]));
    const unitMap = new Map(store.units.map((u) => [Number(u.id), String(u.name ?? "")]));
    const warrantyMap = new Map(store.warranties.map((w) => [Number(w.id), String(w.duration ?? w.name ?? "")]));
    let items = includeInactive ? [...store.products] : store.products.filter((p) => Number(p.status ?? 1) === 1);
    if (q) {
      items = items.filter((p) => {
        const catName = catMap.get(Number(p.category_id)) ?? "";
        const brandName = brandMap.get(Number(p.brand_id)) ?? "";
        const wName = String(p.warranty || warrantyMap.get(Number(p.warranty_id)) || "");
        return matchesSearchTokens(
          [p.name, p.sku, p.barcode, catName, brandName, wName, p.selling_price],
          q
        );
      });
    }
    if (categoryId) items = items.filter((p) => Number(p.category_id) === categoryId);
    if (brandId) items = items.filter((p) => Number(p.brand_id) === brandId);
    if (lowStockOnly) items = items.filter((p) => Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5));
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    const total = items.length;
    const sliced = (fetchAll ? items : items.slice((page - 1) * limit, page * limit)).map((p) => ({
      ...p,
      image: resolveProductImage(p.image, p.name),
      warranty: String(p.warranty || warrantyMap.get(Number(p.warranty_id)) || "No Warranty"),
      category_name: catMap.get(Number(p.category_id)) ?? "Uncategorized",
      brand_name: brandMap.get(Number(p.brand_id)) ?? "No Brand",
      unit_name: unitMap.get(Number(p.unit_id)) ?? "PC"
    }));
    res.json({ items: sliced, total, page, limit });
  });
  function saveProductImageFromDataUrl(dataUrl) {
    const raw = String(dataUrl ?? "");
    if (!raw) return null;
    const match = raw.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return null;
    const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.byteLength > 2 * 1024 * 1024) return null;
    const fileName = `prod-${Date.now()}-${Math.floor(Math.random() * 1e4)}.${ext}`;
    fs2.writeFileSync(path2.join(productUploadsDir, fileName), buffer);
    return `/uploads/products/${fileName}`;
  }
  app.post("/api/products", (req, res) => {
    const store = getStore();
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      res.status(400).json({ error: "Product name is required." });
      return;
    }
    const purchasePrice = Number(body.purchase_price ?? 0);
    const sellingPrice = Number(body.selling_price ?? 0);
    const rawQty = Number(body.quantity ?? 0);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      res.status(400).json({ error: "Purchase price and selling price must be 0 or greater." });
      return;
    }
    if (!Number.isFinite(rawQty) || rawQty < 0) {
      res.status(400).json({ error: "Quantity cannot be negative." });
      return;
    }
    const qty = Math.round(rawQty);
    const warrantyId = body.warranty_id ? Number(body.warranty_id) : null;
    const matchedWarranty = warrantyId ? store.warranties.find((w) => Number(w.id) === warrantyId) : null;
    const warrantyText = String(body.warranty ?? "").trim() || String(matchedWarranty?.duration ?? matchedWarranty?.name ?? "No Warranty");
    const savedImagePath = saveProductImageFromDataUrl(body.image_data);
    const rawWarrantyMonths = Number(body.warranty_months ?? 0);
    const rawAlertQty = Number(body.alert_quantity ?? 5);
    const newProduct = {
      id: nextId(store.products),
      name: String(body.name).trim(),
      sku: String(body.sku ?? "").trim() || `SKU-${Date.now().toString().slice(-6)}`,
      category_id: body.category_id ? Number(body.category_id) : null,
      brand_id: body.brand_id ? Number(body.brand_id) : null,
      warranty_id: warrantyId,
      unit_id: body.unit_id ? Number(body.unit_id) : Number(store.units[0]?.id ?? 4),
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      warranty_months: Number.isFinite(rawWarrantyMonths) && rawWarrantyMonths >= 0 ? Math.round(rawWarrantyMonths) : 0,
      quantity: qty,
      stock_quantity: qty,
      alert_quantity: Number.isFinite(rawAlertQty) && rawAlertQty >= 0 ? Math.round(rawAlertQty) : 5,
      description: String(body.description ?? ""),
      barcode: String(body.barcode ?? ""),
      image: savedImagePath,
      status: 1,
      warranty: warrantyText,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.products.unshift(newProduct);
    saveStore(store);
    res.status(201).json(newProduct);
  });
  app.put("/api/products/:id", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    const body = req.body ?? {};
    if (body.name !== void 0) {
      if (!String(body.name).trim()) {
        res.status(400).json({ error: "Product name cannot be empty." });
        return;
      }
      product.name = String(body.name).trim();
    }
    if (body.purchase_price !== void 0) {
      const pp = Number(body.purchase_price);
      if (!Number.isFinite(pp) || pp < 0) {
        res.status(400).json({ error: "Purchase price cannot be negative." });
        return;
      }
      product.purchase_price = pp;
    }
    if (body.selling_price !== void 0) {
      const sp = Number(body.selling_price);
      if (!Number.isFinite(sp) || sp < 0) {
        res.status(400).json({ error: "Selling price cannot be negative." });
        return;
      }
      product.selling_price = sp;
    }
    if (body.quantity !== void 0) {
      const parsedQ = Number(body.quantity);
      if (!Number.isFinite(parsedQ) || parsedQ < 0) {
        res.status(400).json({ error: "Quantity must be 0 or greater." });
        return;
      }
      const q = Math.round(parsedQ);
      product.quantity = q;
      product.stock_quantity = q;
    }
    if (body.sku !== void 0) product.sku = String(body.sku).trim();
    if (body.barcode !== void 0) product.barcode = String(body.barcode).trim();
    if (body.description !== void 0) product.description = String(body.description);
    if (body.category_id !== void 0) product.category_id = body.category_id ? Number(body.category_id) : null;
    if (body.brand_id !== void 0) product.brand_id = body.brand_id ? Number(body.brand_id) : null;
    if (body.unit_id !== void 0) product.unit_id = body.unit_id ? Number(body.unit_id) : null;
    if (body.warranty_id !== void 0) {
      const wId = body.warranty_id ? Number(body.warranty_id) : null;
      product.warranty_id = wId;
      const matchedW = wId ? store.warranties.find((w) => Number(w.id) === wId) : null;
      if (matchedW) {
        product.warranty = String(matchedW.duration ?? matchedW.name ?? "No Warranty");
      } else if (body.warranty === void 0) {
        product.warranty = "No Warranty";
      }
    }
    if (body.warranty !== void 0) product.warranty = String(body.warranty || "No Warranty");
    if (body.alert_quantity !== void 0) {
      const parsedAlert = Number(body.alert_quantity);
      if (!Number.isFinite(parsedAlert) || parsedAlert < 0) {
        res.status(400).json({ error: "Alert quantity must be 0 or greater." });
        return;
      }
      product.alert_quantity = Math.round(parsedAlert);
    }
    if (body.image_data) {
      const savedPath = saveProductImageFromDataUrl(body.image_data);
      if (savedPath) product.image = savedPath;
    } else if (body.remove_image) {
      product.image = null;
    }
    saveStore(store);
    res.json(product);
  });
  app.post("/api/products/:id/adjust", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    const rawQty = Number(req.body?.new_quantity ?? req.body?.quantity);
    if (!Number.isFinite(rawQty) || rawQty < 0) {
      res.status(400).json({ error: "Valid non-negative stock quantity is required." });
      return;
    }
    const newQty = Math.round(rawQty);
    const oldQty = Number(product.quantity ?? 0);
    product.quantity = newQty;
    product.stock_quantity = newQty;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: id,
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: newQty - oldQty,
      reason: String(req.body?.reason ?? "").trim() || "Manual Stock Adjustment",
      created_by: req.authUser?.id ?? 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    });
    saveStore(store);
    res.json(product);
  });
  app.delete("/api/products/:id", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    product.status = 0;
    saveStore(store);
    res.json({ ok: true });
  });
  app.patch("/api/products/:id/toggle", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    product.status = Number(product.status ?? 1) === 1 ? 0 : 1;
    saveStore(store);
    res.json(product);
  });
  app.post("/api/catalog/:kind", (req, res) => {
    const store = getStore();
    const kind = req.params.kind;
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Name is required." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    if (kind === "categories") {
      const row = { id: nextId(store.categories), name, description: String(req.body?.description ?? ""), status: 1, created_at: now };
      store.categories.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === "brands") {
      const row = { id: nextId(store.brands), name, status: 1, created_at: now };
      store.brands.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === "units") {
      const row = { id: nextId(store.units), name, description: String(req.body?.description ?? ""), status: 1, created_at: now };
      store.units.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === "warranties") {
      const row = { id: nextId(store.warranties), name, duration: String(req.body?.duration ?? name), status: 1, created_at: now };
      store.warranties.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    res.status(400).json({ error: "Unknown catalog type." });
  });
  app.delete("/api/catalog/:kind/:id", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const kind = req.params.kind;
    if (kind === "categories") store.categories = store.categories.filter((r) => Number(r.id) !== id);
    else if (kind === "brands") store.brands = store.brands.filter((r) => Number(r.id) !== id);
    else if (kind === "units") store.units = store.units.filter((r) => Number(r.id) !== id);
    else if (kind === "warranties") store.warranties = store.warranties.filter((r) => Number(r.id) !== id);
    else {
      res.status(400).json({ error: "Unknown catalog type." });
      return;
    }
    saveStore(store);
    res.json({ ok: true });
  });
  app.get("/api/sales", (req, res) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const paymentStatus = String(req.query.payment_status ?? "");
    const fetchAll = req.query.all === "1";
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 10);
    const limit = fetchAll ? Math.max(1, store.sales.length) : Math.min(5e3, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 10));
    const custPhoneMap = new Map(store.customers.map((c) => [Number(c.id), String(c.phone ?? "")]));
    const custNameMap = new Map(store.customers.map((c) => [Number(c.id), String(c.name ?? "")]));
    const productNameMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? "")]));
    const saleItemsMap = /* @__PURE__ */ new Map();
    for (const it of store.sale_items) {
      const sid = Number(it.sale_id);
      const arr = saleItemsMap.get(sid) ?? [];
      const resolvedName = String(it.product_name || productNameMap.get(Number(it.product_id)) || "Product");
      arr.push({
        product_name: resolvedName,
        quantity: Number(it.quantity ?? 1)
      });
      saleItemsMap.set(sid, arr);
    }
    let items = store.sales.map((s) => {
      const sid = Number(s.id);
      const cid = Number(s.customer_id ?? 0);
      const prods = saleItemsMap.get(sid) ?? [];
      return {
        ...s,
        customer_name: String(s.customer_name || (cid ? custNameMap.get(cid) : "") || "Walk-in Customer"),
        customer_phone: cid ? custPhoneMap.get(cid) ?? "" : "",
        products: prods
      };
    });
    if (q) {
      items = items.filter((s) => {
        const prods = s.products ?? [];
        return matchesSearchTokens(
          [s.invoice_no, s.customer_name, s.customer_phone, ...prods.map((p) => p.product_name)],
          q
        );
      });
    }
    if (paymentStatus) {
      items = items.filter((s) => String(s.payment_status ?? "") === paymentStatus);
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    const total = items.length;
    res.json({
      items: fetchAll ? items : items.slice((page - 1) * limit, page * limit),
      total,
      page,
      limit
    });
  });
  app.get("/api/sales/:id", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const sale = store.sales.find((s) => Number(s.id) === id);
    if (!sale) {
      res.status(404).json({ error: "Sale not found." });
      return;
    }
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? "")]));
    const productMap = new Map(store.products.map((p) => [Number(p.id), p]));
    const warrantyMap = new Map(store.warranties.map((w) => [Number(w.id), String(w.name || w.duration || "")]));
    const items = store.sale_items.filter((it) => Number(it.sale_id) === id).map((it) => {
      const prod = it.product_id ? productMap.get(Number(it.product_id)) : void 0;
      const resolvedCat = it.category_name || (prod?.category_id ? catMap.get(Number(prod.category_id)) : "") || "Electronics";
      const resolvedWarranty = String(
        it.warranty || it.warranty_name || prod?.warranty || (prod?.warranty_id ? warrantyMap.get(Number(prod.warranty_id)) : "") || ""
      );
      return {
        ...it,
        product_name: String(it.product_name || prod?.name || "Product"),
        category_name: String(resolvedCat),
        warranty: resolvedWarranty,
        serial_no: it.serial_no || it.serial_number || null
      };
    });
    const payments = store.payments.filter((p) => Number(p.sale_id) === id);
    const customer = sale.customer_id ? store.customers.find((c) => Number(c.id) === Number(sale.customer_id)) : null;
    const customerOpening = Number(customer?.opening_balance ?? 0);
    const saleDue = Number(sale.due ?? 0);
    const otherSalesDue = sale.customer_id ? store.sales.filter((s) => Number(s.customer_id) === Number(sale.customer_id) && Number(s.id) !== id).reduce((sum, s) => sum + Number(s.due ?? 0), 0) : 0;
    const previous_due = Math.max(Math.max(0, customerOpening - saleDue), otherSalesDue);
    const creatorId = Number(sale.created_by ?? sale.user_id ?? 1);
    const creator = store.users.find((u) => Number(u.id) === creatorId);
    const sold_by = String(creator?.name ?? "Youth IT");
    res.json({
      sale: {
        ...sale,
        customer_name: String(sale.customer_name || customer?.name || "Walk-in Customer"),
        customer_phone: String(customer?.phone ?? sale.customer_phone ?? ""),
        customer_address: String(customer?.address ?? ""),
        previous_due,
        sold_by
      },
      items,
      payments,
      customer
    });
  });
  app.post("/api/sales", (req, res) => {
    const store = getStore();
    const body = req.body ?? {};
    const itemsInput = Array.isArray(body.items) ? body.items : [];
    if (itemsInput.length === 0) {
      res.status(400).json({ error: "At least one line item is required." });
      return;
    }
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? "")]));
    const rawAccId = Number(body.account_id);
    const accountId = Number.isFinite(rawAccId) && rawAccId > 0 ? rawAccId : Number(store.bank_accounts[0]?.id ?? 0);
    const account = (accountId ? store.bank_accounts.find((a) => Number(a.id) === accountId) : void 0) ?? store.bank_accounts[0];
    const customerId = body.customer_id ? Number(body.customer_id) : null;
    const customer = customerId ? store.customers.find((c) => Number(c.id) === customerId) : null;
    let subtotal = 0;
    let totalCost = 0;
    const prepared = [];
    const requestedQtyMap = /* @__PURE__ */ new Map();
    for (const raw of itemsInput) {
      const product = store.products.find((p) => Number(p.id) === Number(raw.product_id));
      if (!product) {
        res.status(400).json({ error: `Product #${raw.product_id} not found.` });
        return;
      }
      const qty = Math.round(Number(raw.quantity ?? 0));
      if (!Number.isFinite(qty) || qty < 1) {
        res.status(400).json({ error: `Invalid quantity for "${product.name}". Quantity must be at least 1.` });
        return;
      }
      const price = Number(raw.price ?? product.selling_price ?? 0);
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ error: `Invalid unit price for "${product.name}".` });
        return;
      }
      const cumulativeQty = (requestedQtyMap.get(Number(product.id)) ?? 0) + qty;
      const availableStock = Number(product.quantity ?? 0);
      if (cumulativeQty > availableStock) {
        res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${cumulativeQty}.`
        });
        return;
      }
      requestedQtyMap.set(Number(product.id), cumulativeQty);
      const lineTotal = qty * price;
      const lineCost = qty * Number(product.purchase_price ?? 0);
      subtotal += lineTotal;
      totalCost += lineCost;
      prepared.push({
        product,
        qty,
        price,
        lineTotal,
        lineCost,
        serialNo: String(raw.serial_no ?? ""),
        warranty: String(raw.warranty ?? product.warranty ?? "No Warranty")
      });
    }
    const discount = Number(body.discount ?? 0);
    const vat = Number(body.vat ?? 0);
    if (!Number.isFinite(discount) || discount < 0) {
      res.status(400).json({ error: "Discount must be 0 or greater." });
      return;
    }
    if (discount > subtotal + 9e-3) {
      res.status(400).json({ error: `Discount cannot exceed Subtotal (${subtotal.toFixed(2)}).` });
      return;
    }
    if (!Number.isFinite(vat) || vat < 0) {
      res.status(400).json({ error: "VAT / Tax must be 0 or greater." });
      return;
    }
    const receivable = Math.max(0, subtotal - discount + vat);
    const rawPaid = body.paid !== void 0 && body.paid !== "" ? Number(body.paid) : receivable;
    if (!Number.isFinite(rawPaid) || rawPaid < 0) {
      res.status(400).json({ error: "Received amount must be 0 or greater." });
      return;
    }
    const paid = Math.min(receivable, rawPaid);
    const due = Math.max(0, receivable - paid);
    const profit = receivable - totalCost;
    const isWalkIn = !customer || String(customer.name ?? "").trim().toLowerCase() === "walk-in customer";
    if (isWalkIn && due > 9e-3) {
      res.status(400).json({
        error: "Walk-in Customer cannot have due balance! Please collect full payment or select a registered customer."
      });
      return;
    }
    const saleId = nextId(store.sales);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const dateStr = body.sale_date ? String(body.sale_date).slice(0, 10) : nowIso.slice(0, 10);
    const dateTimeStr = `${dateStr} ${nowIso.slice(11, 19)}`;
    const invoiceNo = `INV-${dateStr.replace(/-/g, "")}-${String(saleId).padStart(4, "0")}`;
    const paymentMethod = String(body.payment_method ?? (account ? String(account.account_name).toLowerCase() : "cash"));
    const saleNote = String(body.note ?? "");
    const sale = {
      id: saleId,
      invoice_no: invoiceNo,
      customer_id: customer ? Number(customer.id) : null,
      customer_name: customer ? String(customer.name) : String(body.customer_name ?? "").trim() || "Walk-in Customer",
      date: dateStr,
      discount,
      vat,
      receivable,
      paid,
      due,
      purchase_cost: totalCost,
      profit,
      status: "completed",
      created_at: dateTimeStr,
      sale_date: dateTimeStr,
      subtotal,
      account_id: account ? Number(account.id) : null,
      account_name: account ? String(account.account_name) : paymentMethod,
      payment_method: paymentMethod,
      note: saleNote,
      payment_status: due <= 0 ? "paid" : paid > 0 ? "partial" : "due",
      created_by: req.authUser?.id ?? 1
    };
    store.sales.unshift(sale);
    const createdItems = [];
    for (const p of prepared) {
      const sItem = {
        id: nextId(store.sale_items),
        product_id: Number(p.product.id),
        sale_id: saleId,
        product_name: String(p.product.name),
        category_name: catMap.get(Number(p.product.category_id)) ?? null,
        quantity: p.qty,
        price: p.price,
        total: p.lineTotal,
        purchase_cost: p.lineCost,
        serial_no: p.serialNo || null,
        warranty: p.warranty,
        buying_price: Number(p.product.purchase_price ?? 0),
        warranty_id: p.product.warranty_id ?? null,
        warranty_name: p.warranty
      };
      store.sale_items.push(sItem);
      createdItems.push(sItem);
      const oldQty = Number(p.product.quantity ?? 0);
      const newQty = Math.max(0, oldQty - p.qty);
      p.product.quantity = newQty;
      p.product.stock_quantity = newQty;
      store.stock_movements.unshift({
        id: nextId(store.stock_movements),
        product_id: Number(p.product.id),
        old_quantity: oldQty,
        new_quantity: newQty,
        difference: -p.qty,
        reason: `POS Sale ${invoiceNo}`,
        created_by: req.authUser?.id ?? 1,
        created_at: dateTimeStr
      });
    }
    if (paid > 0) {
      store.payments.unshift({
        id: nextId(store.payments),
        sale_id: saleId,
        customer_id: customer ? Number(customer.id) : null,
        amount: paid,
        payment_date: dateTimeStr,
        payment_method: account ? String(account.account_name).toLowerCase() : "cash",
        reference_no: null,
        note: "POS Checkout",
        created_by: req.authUser?.id ?? 1,
        created_at: dateTimeStr
      });
      if (account) {
        account.balance = Number(account.balance ?? 0) + paid;
      }
    }
    saveStore(store);
    res.status(201).json({ sale, items: createdItems });
  });
  app.post("/api/sales/:id/payments", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const sale = store.sales.find((s) => Number(s.id) === id);
    if (!sale) {
      res.status(404).json({ error: "Sale not found." });
      return;
    }
    const currentDue = Number(sale.due ?? 0);
    if (currentDue <= 0) {
      res.status(400).json({ error: "This invoice is already fully paid." });
      return;
    }
    const rawAmount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ error: "Valid positive payment amount required." });
      return;
    }
    if (rawAmount > currentDue + 0.01) {
      res.status(400).json({ error: `Payment amount cannot exceed current due (${currentDue.toFixed(2)}).` });
      return;
    }
    const collect = Math.min(currentDue, rawAmount);
    const rawAccId = Number(req.body?.account_id);
    const accountId = Number.isFinite(rawAccId) && rawAccId > 0 ? rawAccId : Number(sale.account_id ?? store.bank_accounts[0]?.id ?? 0);
    const account = (accountId ? store.bank_accounts.find((a) => Number(a.id) === accountId) : void 0) ?? store.bank_accounts[0];
    sale.paid = Number(sale.paid ?? 0) + collect;
    sale.due = Math.max(0, Number(sale.receivable ?? 0) - Number(sale.paid));
    sale.payment_status = Number(sale.due) <= 0 ? "paid" : "partial";
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    const payDate = req.body?.payment_date ? String(req.body.payment_date) : now;
    const payMethod = String(req.body?.payment_method ?? (account ? String(account.account_name).toLowerCase() : "cash"));
    store.payments.unshift({
      id: nextId(store.payments),
      sale_id: id,
      customer_id: sale.customer_id ?? null,
      amount: collect,
      payment_date: payDate,
      payment_method: payMethod,
      reference_no: req.body?.reference_no ? String(req.body.reference_no) : null,
      note: String(req.body?.note ?? "Due collection"),
      created_by: req.authUser?.id ?? 1,
      created_at: now
    });
    if (account) {
      account.balance = Number(account.balance ?? 0) + collect;
    }
    saveStore(store);
    res.json(sale);
  });
  app.delete("/api/sales/:id", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const idx = store.sales.findIndex((s) => Number(s.id) === id);
    if (idx === -1) {
      res.status(404).json({ error: "Sale not found." });
      return;
    }
    const sale = store.sales[idx];
    const items = store.sale_items.filter((it) => Number(it.sale_id) === id);
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    for (const item of items) {
      if (item.product_id) {
        const product = store.products.find((p) => Number(p.id) === Number(item.product_id));
        if (product) {
          const oldQty = Number(product.quantity ?? 0);
          const newQty = oldQty + Number(item.quantity ?? 0);
          product.quantity = newQty;
          product.stock_quantity = newQty;
          store.stock_movements.unshift({
            id: nextId(store.stock_movements),
            product_id: Number(product.id),
            old_quantity: oldQty,
            new_quantity: newQty,
            difference: Number(item.quantity ?? 0),
            reason: `Restored from deleted sale #${id}`,
            created_by: req.authUser?.id ?? 1,
            created_at: now
          });
        }
      }
    }
    const paidAmount = Number(sale.paid ?? 0);
    if (paidAmount > 0 && sale.account_id) {
      const account = store.bank_accounts.find((a) => Number(a.id) === Number(sale.account_id));
      if (account) {
        account.balance = Math.max(0, Number(account.balance ?? 0) - paidAmount);
      }
    }
    store.sale_items = store.sale_items.filter((it) => Number(it.sale_id) !== id);
    store.payments = store.payments.filter((p) => Number(p.sale_id) !== id);
    store.sales.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true });
  });
  app.get("/api/purchases", (req, res) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const supMap = new Map(store.suppliers.map((s) => [Number(s.id), String(s.name ?? "")]));
    let items = store.purchases.map((p) => ({
      ...p,
      supplier_name: supMap.get(Number(p.supplier_id)) ?? "Unknown Supplier"
    }));
    if (q) {
      items = items.filter(
        (p) => matchesSearchTokens([p.invoice_no, p.supplier_name, p.payment_method], q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({ items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit });
  });
  app.post("/api/purchases", (req, res) => {
    const store = getStore();
    const body = req.body ?? {};
    const product = store.products.find((p) => Number(p.id) === Number(body.product_id));
    if (!product) {
      res.status(400).json({ error: "Valid product is required." });
      return;
    }
    const supplierId = Number(body.supplier_id);
    const supplier = store.suppliers.find((s) => Number(s.id) === supplierId);
    if (!supplier) {
      res.status(400).json({ error: "Valid supplier is required." });
      return;
    }
    const rawQty = Number(body.quantity ?? 1);
    const rawPrice = Number(body.price ?? product.purchase_price ?? 0);
    const rawDiscount = Number(body.discount ?? 0);
    const rawPaid = Number(body.paid ?? 0);
    if (!Number.isFinite(rawQty) || rawQty < 1 || !Number.isFinite(rawPrice) || rawPrice < 0 || !Number.isFinite(rawDiscount) || rawDiscount < 0 || !Number.isFinite(rawPaid) || rawPaid < 0) {
      res.status(400).json({ error: "Quantity must be at least 1 and prices/amounts cannot be negative." });
      return;
    }
    const qty = Math.round(rawQty);
    const price = rawPrice;
    const subtotal = qty * price;
    const discount = Math.min(subtotal, rawDiscount);
    const total = Math.max(0, subtotal - discount);
    const paid = Math.min(total, rawPaid);
    const due = Math.max(0, total - paid);
    const purchaseId = nextId(store.purchases);
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    const invoiceNo = `PUR-${now.slice(0, 10).replace(/-/g, "")}-${String(purchaseId).padStart(4, "0")}`;
    const actorId = req.authUser?.id ?? 1;
    const purchase = {
      id: purchaseId,
      invoice_no: invoiceNo,
      supplier_id: supplierId,
      purchase_date: now,
      total_amount: total,
      paid_amount: paid,
      due_amount: due,
      discount,
      payment_method: String(body.payment_method ?? "cash"),
      note: String(body.note ?? ""),
      status: 1,
      user_id: actorId,
      subtotal,
      total,
      paid,
      due,
      created_at: now
    };
    store.purchases.unshift(purchase);
    store.purchase_items.push({
      id: nextId(store.purchase_items),
      purchase_id: purchaseId,
      product_id: Number(product.id),
      quantity: qty,
      price,
      warranty_months: 0,
      total: subtotal
    });
    const oldQty = Number(product.quantity ?? 0);
    const newQty = oldQty + qty;
    product.quantity = newQty;
    product.stock_quantity = newQty;
    product.purchase_price = price;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: Number(product.id),
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: qty,
      reason: `Purchase ${invoiceNo}`,
      created_by: actorId,
      created_at: now
    });
    if (paid > 0) {
      store.supplier_payments.unshift({
        id: nextId(store.supplier_payments),
        purchase_id: purchaseId,
        supplier_id: supplierId,
        amount: paid,
        payment_date: now,
        payment_method: String(body.payment_method ?? "cash"),
        reference_no: null,
        note: "Initial purchase payment",
        created_by: actorId,
        created_at: now
      });
    }
    saveStore(store);
    res.status(201).json(purchase);
  });
  app.post("/api/purchases/:id/payments", (req, res) => {
    const store = getStore();
    const id = Number(req.params.id);
    const purchase = store.purchases.find((p) => Number(p.id) === id);
    if (!purchase) {
      res.status(404).json({ error: "Purchase not found." });
      return;
    }
    const currentDue = Number(purchase.due ?? 0);
    if (currentDue <= 0) {
      res.status(400).json({ error: "This purchase is already fully paid." });
      return;
    }
    const rawPay = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(rawPay) || rawPay <= 0) {
      res.status(400).json({ error: "Valid positive amount required." });
      return;
    }
    if (rawPay > currentDue + 0.01) {
      res.status(400).json({ error: `Payment amount cannot exceed current due (${currentDue.toFixed(2)}).` });
      return;
    }
    const pay = Math.min(currentDue, rawPay);
    purchase.paid = Number(purchase.paid ?? 0) + pay;
    purchase.paid_amount = purchase.paid;
    purchase.due = Math.max(0, Number(purchase.total ?? 0) - Number(purchase.paid));
    purchase.due_amount = purchase.due;
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    store.supplier_payments.unshift({
      id: nextId(store.supplier_payments),
      purchase_id: id,
      supplier_id: purchase.supplier_id ?? null,
      amount: pay,
      payment_date: now,
      payment_method: String(req.body?.payment_method ?? "cash"),
      reference_no: null,
      note: "Supplier due settlement",
      created_by: req.authUser?.id ?? 1,
      created_at: now
    });
    saveStore(store);
    res.json(purchase);
  });
  app.get("/api/customers", (req, res) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const fetchAll = req.query.all === "1";
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = fetchAll ? Math.max(1, store.customers.length) : Math.min(1e4, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));
    const totals = /* @__PURE__ */ new Map();
    for (const s of store.sales) {
      const cid = Number(s.customer_id ?? 0);
      if (!cid) continue;
      const cur = totals.get(cid) ?? { billed: 0, paid: 0, due: 0, invoices: 0 };
      cur.billed += Number(s.receivable ?? 0);
      cur.paid += Number(s.paid ?? 0);
      cur.due += Number(s.due ?? 0);
      cur.invoices += 1;
      totals.set(cid, cur);
    }
    let items = store.customers.map((c) => {
      const t = totals.get(Number(c.id)) ?? { billed: 0, paid: 0, due: 0, invoices: 0 };
      return { ...c, ...t };
    });
    if (q) {
      items = items.filter(
        (c) => matchesSearchTokens([c.name, c.phone, c.email, c.address], q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({
      items: fetchAll ? items : items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit
    });
  });
  app.post("/api/customers", (req, res) => {
    const store = getStore();
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Customer name is required." });
      return;
    }
    const openingBalance = Number(req.body?.opening_balance ?? 0);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      res.status(400).json({ error: "Opening balance must be 0 or greater." });
      return;
    }
    const row = {
      id: nextId(store.customers),
      name,
      email: String(req.body?.email ?? ""),
      phone: String(req.body?.phone ?? ""),
      address: String(req.body?.address ?? ""),
      city: String(req.body?.city ?? ""),
      state: "",
      zip_code: "",
      opening_balance: openingBalance,
      status: 1,
      points: 0,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.customers.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });
  app.get("/api/suppliers", (req, res) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const fetchAll = req.query.all === "1";
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = fetchAll ? Math.max(1, store.suppliers.length) : Math.min(1e4, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));
    const totals = /* @__PURE__ */ new Map();
    for (const p of store.purchases) {
      const sid = Number(p.supplier_id ?? 0);
      if (!sid) continue;
      const cur = totals.get(sid) ?? { purchased: 0, paid: 0, due: 0, orders: 0 };
      cur.purchased += Number(p.total ?? 0);
      cur.paid += Number(p.paid ?? 0);
      cur.due += Number(p.due ?? 0);
      cur.orders += 1;
      totals.set(sid, cur);
    }
    let items = store.suppliers.map((s) => {
      const t = totals.get(Number(s.id)) ?? { purchased: 0, paid: 0, due: 0, orders: 0 };
      return { ...s, ...t };
    });
    if (q) {
      items = items.filter(
        (s) => matchesSearchTokens([s.name, s.phone, s.email, s.address], q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({
      items: fetchAll ? items : items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit
    });
  });
  app.post("/api/suppliers", (req, res) => {
    const store = getStore();
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Supplier name is required." });
      return;
    }
    const openingBalance = Number(req.body?.opening_balance ?? 0);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      res.status(400).json({ error: "Opening balance must be 0 or greater." });
      return;
    }
    const row = {
      id: nextId(store.suppliers),
      name,
      email: String(req.body?.email ?? ""),
      phone: String(req.body?.phone ?? ""),
      address: String(req.body?.address ?? ""),
      city: "",
      state: "",
      zip_code: "",
      opening_balance: openingBalance,
      status: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.suppliers.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });
  app.get("/api/estimates", (_req, res) => {
    const store = getStore();
    res.json({ items: [...store.estimates].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)) });
  });
  app.post("/api/estimates", (req, res) => {
    const store = getStore();
    const body = req.body ?? {};
    const product = store.products.find((p) => Number(p.id) === Number(body.product_id));
    if (!product || !String(body.customer_name ?? "").trim()) {
      res.status(400).json({ error: "Customer name and product are required." });
      return;
    }
    const rawQty = Number(body.quantity ?? 1);
    const rawPrice = Number(body.price ?? product.selling_price ?? 0);
    const rawDiscount = Number(body.discount ?? 0);
    if (!Number.isFinite(rawQty) || rawQty < 1 || !Number.isFinite(rawPrice) || rawPrice < 0 || !Number.isFinite(rawDiscount) || rawDiscount < 0) {
      res.status(400).json({ error: "Valid positive quantity and non-negative price/discount are required." });
      return;
    }
    const qty = Math.round(rawQty);
    const price = rawPrice;
    const subtotal = qty * price;
    const discount = Math.min(subtotal, rawDiscount);
    const total = Math.max(0, subtotal - discount);
    const estId = nextId(store.estimates);
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    const est = {
      id: estId,
      estimate_no: `EST-${now.slice(0, 10).replace(/-/g, "")}-${String(estId).padStart(4, "0")}`,
      customer_id: body.customer_id ? Number(body.customer_id) : null,
      customer_name: String(body.customer_name).trim(),
      customer_phone: String(body.customer_phone ?? ""),
      subtotal,
      discount,
      total,
      status: "pending",
      valid_until: String(body.valid_until ?? ""),
      notes: String(body.notes ?? ""),
      product_name: String(product.name),
      quantity: qty,
      created_at: now
    };
    store.estimates.unshift(est);
    saveStore(store);
    res.status(201).json(est);
  });
  app.patch("/api/estimates/:id", (req, res) => {
    const store = getStore();
    const est = store.estimates.find((e) => Number(e.id) === Number(req.params.id));
    if (!est) {
      res.status(404).json({ error: "Estimate not found." });
      return;
    }
    const nextStatus = String(req.body?.status ?? "approved").trim().toLowerCase();
    if (!["pending", "approved", "rejected", "converted"].includes(nextStatus)) {
      res.status(400).json({ error: "Invalid estimate status. Allowed: pending, approved, rejected, converted." });
      return;
    }
    est.status = nextStatus;
    saveStore(store);
    res.json(est);
  });
  app.get("/api/accounts", (_req, res) => {
    const store = getStore();
    const accMap = new Map(store.bank_accounts.map((a) => [Number(a.id), String(a.account_name ?? "")]));
    const transactions = [...store.bank_transactions].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)).map((tx) => ({ ...tx, account_name: accMap.get(Number(tx.bank_account_id)) ?? "Account" }));
    res.json({ accounts: store.bank_accounts, transactions });
  });
  app.post("/api/accounts/transactions", (req, res) => {
    const store = getStore();
    const acc = store.bank_accounts.find((a) => Number(a.id) === Number(req.body?.bank_account_id));
    if (!acc) {
      res.status(400).json({ error: "Account not found." });
      return;
    }
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Transaction amount must be greater than 0." });
      return;
    }
    const type = req.body?.type === "withdraw" ? "withdraw" : "deposit";
    const currentBalance = Number(acc.balance ?? 0);
    if (type === "withdraw" && amount > currentBalance + 9e-3) {
      res.status(400).json({
        error: `Insufficient balance in "${acc.account_name}" (${currentBalance.toFixed(2)} available).`
      });
      return;
    }
    const tx = {
      id: nextId(store.bank_transactions),
      bank_account_id: Number(acc.id),
      type,
      amount,
      description: String(req.body?.description ?? ""),
      transaction_date: String(req.body?.transaction_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.bank_transactions.unshift(tx);
    acc.balance = type === "deposit" ? currentBalance + amount : Math.max(0, currentBalance - amount);
    saveStore(store);
    res.status(201).json({ transaction: tx, account: acc });
  });
  app.get("/api/expenses", (_req, res) => {
    const store = getStore();
    res.json({
      items: [...store.expenses].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)),
      categories: store.expense_categories
    });
  });
  app.post("/api/expenses", (req, res) => {
    const store = getStore();
    const rawAmount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ error: "Valid positive expense amount is required." });
      return;
    }
    const amount = rawAmount;
    const category = String(req.body?.category ?? "Other").trim() || "Other";
    const exp = {
      id: nextId(store.expenses),
      category,
      description: String(req.body?.description ?? ""),
      amount,
      expense_date: String(req.body?.expense_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
      created_by: req.authUser?.id ?? 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.expenses.unshift(exp);
    saveStore(store);
    res.status(201).json(exp);
  });
  app.get("/api/returns-damages", (_req, res) => {
    const store = getStore();
    const prodMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? "")]));
    res.json({
      returns: store.returns.map((r) => ({ ...r, product_name: prodMap.get(Number(r.product_id)) ?? "Product" })),
      damages: store.damages.map((d) => ({ ...d, product_name: prodMap.get(Number(d.product_id)) ?? "Product" }))
    });
  });
  app.post("/api/returns", (req, res) => {
    const store = getStore();
    const sale = store.sales.find((s) => Number(s.id) === Number(req.body?.sale_id));
    const product = store.products.find((p) => Number(p.id) === Number(req.body?.product_id));
    if (!sale || !product) {
      res.status(400).json({ error: "Valid sale and product are required." });
      return;
    }
    const rawQty = Number(req.body?.quantity ?? 1);
    const rawPrice = Number(req.body?.price ?? product.selling_price ?? 0);
    if (!Number.isFinite(rawQty) || rawQty < 1 || !Number.isFinite(rawPrice) || rawPrice < 0) {
      res.status(400).json({ error: "Valid positive quantity and non-negative price are required." });
      return;
    }
    const qty = Math.round(rawQty);
    const price = rawPrice;
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    const actorId = req.authUser?.id ?? 1;
    const row = {
      id: nextId(store.returns),
      sale_id: Number(sale.id),
      invoice_no: String(sale.invoice_no),
      customer_id: sale.customer_id ?? null,
      product_id: Number(product.id),
      quantity: qty,
      price,
      total_amount: qty * price,
      reason: String(req.body?.reason ?? "").trim() || "Customer Return",
      return_date: now.slice(0, 10),
      created_by: actorId,
      created_at: now
    };
    store.returns.unshift(row);
    const oldQty = Number(product.quantity ?? 0);
    const newQty = oldQty + qty;
    product.quantity = newQty;
    product.stock_quantity = newQty;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: Number(product.id),
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: qty,
      reason: `Sales Return (${sale.invoice_no})`,
      created_by: actorId,
      created_at: now
    });
    saveStore(store);
    res.status(201).json(row);
  });
  app.post("/api/damages", (req, res) => {
    const store = getStore();
    const product = store.products.find((p) => Number(p.id) === Number(req.body?.product_id));
    if (!product) {
      res.status(400).json({ error: "Valid product is required." });
      return;
    }
    const available = Number(product.quantity ?? 0);
    const reqQty = Math.round(Number(req.body?.quantity ?? 0));
    if (!Number.isFinite(reqQty) || reqQty < 1) {
      res.status(400).json({ error: "Damage quantity must be at least 1." });
      return;
    }
    if (reqQty > available) {
      res.status(400).json({
        error: `Insufficient stock for damage entry on "${product.name}". Available stock: ${available}.`
      });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    const actorId = req.authUser?.id ?? 1;
    const row = {
      id: nextId(store.damages),
      product_id: Number(product.id),
      quantity: reqQty,
      reason: String(req.body?.reason ?? "").trim() || "Damaged item",
      loss_amount: reqQty * Number(product.purchase_price ?? 0),
      damage_date: now.slice(0, 10),
      created_by: actorId,
      created_at: now
    };
    store.damages.unshift(row);
    const newQty = available - reqQty;
    product.quantity = newQty;
    product.stock_quantity = newQty;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: Number(product.id),
      old_quantity: available,
      new_quantity: newQty,
      difference: -reqQty,
      reason: `Damage: ${row.reason}`,
      created_by: actorId,
      created_at: now
    });
    saveStore(store);
    res.status(201).json(row);
  });
  app.get("/api/reports", (req, res) => {
    const store = getStore();
    let from = String(req.query.from ?? "2026-01-01").slice(0, 10);
    let to = String(req.query.to ?? "2099-12-31").slice(0, 10);
    if (from && to && from > to) {
      [from, to] = [to, from];
    }
    const periodSales = store.sales.filter((s) => {
      const d = String(s.date ?? "");
      return d >= from && d <= to && String(s.status ?? "completed") === "completed";
    });
    const summary = periodSales.reduce(
      (acc, s) => {
        acc.invoiceCount += 1;
        acc.revenue += Number(s.receivable ?? 0);
        acc.collected += Number(s.paid ?? 0);
        acc.due += Number(s.due ?? 0);
        acc.profit += Number(s.profit ?? 0);
        return acc;
      },
      { invoiceCount: 0, revenue: 0, collected: 0, due: 0, profit: 0 }
    );
    const expensesTotal = store.expenses.filter((e) => {
      const d = String(e.expense_date ?? "");
      return d >= from && d <= to;
    }).reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const custDuesMap = /* @__PURE__ */ new Map();
    for (const c of store.customers) {
      custDuesMap.set(Number(c.id), { id: Number(c.id), name: String(c.name ?? ""), phone: String(c.phone ?? ""), due: 0 });
    }
    for (const s of store.sales) {
      const cid = Number(s.customer_id ?? 0);
      const entry = custDuesMap.get(cid);
      if (entry) entry.due += Number(s.due ?? 0);
    }
    const customerDues = [...custDuesMap.values()].filter((c) => c.due > 0).sort((a, b) => b.due - a.due).slice(0, 30);
    const supDuesMap = /* @__PURE__ */ new Map();
    for (const sup of store.suppliers) {
      supDuesMap.set(Number(sup.id), { id: Number(sup.id), name: String(sup.name ?? ""), phone: String(sup.phone ?? ""), due: 0 });
    }
    for (const p of store.purchases) {
      const sid = Number(p.supplier_id ?? 0);
      const entry = supDuesMap.get(sid);
      if (entry) entry.due += Number(p.due ?? 0);
    }
    const supplierDues = [...supDuesMap.values()].filter((s) => s.due > 0).sort((a, b) => b.due - a.due).slice(0, 30);
    res.json({
      from,
      to,
      summary,
      expensesTotal,
      netProfit: summary.profit - expensesTotal,
      customerDues,
      supplierDues
    });
  });
  app.get("/api/menus", (_req, res) => {
    const store = getStore();
    res.json([...store.menus].sort((a, b) => a.sort_order - b.sort_order));
  });
  app.post("/api/menus", (req, res) => {
    const store = getStore();
    const body = req.body ?? {};
    if (!body.title || !String(body.title).trim()) {
      res.status(400).json({ error: "Menu title is required." });
      return;
    }
    const rawOrder = Number(body.sort_order ?? store.menus.length + 1);
    if (!Number.isFinite(rawOrder) || rawOrder < 0) {
      res.status(400).json({ error: "Sort order must be a valid non-negative number." });
      return;
    }
    const menu = {
      id: nextId(store.menus),
      parent_id: null,
      title: String(body.title).trim(),
      group_label: String(body.group_label ?? "Custom").trim() || "Custom",
      route_key: String(body.route_key ?? "dashboard").trim(),
      url: String(body.url ?? "/dashboard").trim(),
      icon: String(body.icon ?? "circle").trim(),
      sort_order: Math.round(rawOrder),
      roles: Array.isArray(body.roles) && body.roles.length ? body.roles.map(String) : ["admin", "manager", "staff"],
      is_active: body.is_active !== false
    };
    store.menus.push(menu);
    saveStore(store);
    res.status(201).json(menu);
  });
  app.put("/api/menus/:id", (req, res) => {
    const store = getStore();
    const menu = store.menus.find((m) => m.id === Number(req.params.id));
    if (!menu) {
      res.status(404).json({ error: "Menu item not found." });
      return;
    }
    const body = req.body ?? {};
    if (body.title !== void 0) {
      if (!String(body.title).trim()) {
        res.status(400).json({ error: "Menu title cannot be empty." });
        return;
      }
      menu.title = String(body.title).trim();
    }
    if (body.group_label !== void 0) menu.group_label = String(body.group_label).trim();
    if (body.route_key !== void 0) menu.route_key = String(body.route_key).trim();
    if (body.icon !== void 0) menu.icon = String(body.icon).trim();
    if (body.sort_order !== void 0) {
      const parsedOrder = Number(body.sort_order);
      if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
        res.status(400).json({ error: "Sort order must be a valid non-negative number." });
        return;
      }
      menu.sort_order = Math.round(parsedOrder);
    }
    if (body.is_active !== void 0) menu.is_active = Boolean(body.is_active);
    if (Array.isArray(body.roles)) menu.roles = body.roles.map(String);
    saveStore(store);
    res.json(menu);
  });
  app.post("/api/menus/reorder", (req, res) => {
    const store = getStore();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    ids.forEach((id, idx) => {
      const m = store.menus.find((item) => item.id === id);
      if (m) m.sort_order = idx + 1;
    });
    saveStore(store);
    res.json([...store.menus].sort((a, b) => a.sort_order - b.sort_order));
  });
  app.delete("/api/menus/:id", (req, res) => {
    const store = getStore();
    const target = store.menus.find((m) => m.id === Number(req.params.id));
    if (!target) {
      res.status(404).json({ error: "Menu item not found." });
      return;
    }
    if (target.route_key === "menus" || target.route_key === "settings" || target.route_key === "dashboard") {
      res.status(400).json({ error: "Core system navigation items cannot be deleted. You can disable them instead." });
      return;
    }
    store.menus = store.menus.filter((m) => m.id !== target.id);
    saveStore(store);
    res.json({ ok: true });
  });
  app.put("/api/settings", (req, res) => {
    const store = getStore();
    if (req.body?.tax_rate !== void 0) {
      const parsedTax = Number(req.body.tax_rate);
      if (!Number.isFinite(parsedTax) || parsedTax < 0) {
        res.status(400).json({ error: "Tax rate must be 0 or greater." });
        return;
      }
    }
    const allowed = [
      "shop_name",
      "shop_address",
      "shop_phone",
      "shop_email",
      "shop_website",
      "shop_logo",
      "shop_favicon",
      "shop_qr",
      "currency",
      "tax_rate",
      "invoice_footer",
      "sidebar_theme",
      "primary_color",
      "layout_mode"
    ];
    for (const key of allowed) {
      if (req.body?.[key] !== void 0) {
        store.settings[key] = String(req.body[key]);
      }
    }
    saveStore(store);
    res.json(store.settings);
  });
  app.get("/api/auth/session", (req, res) => {
    const store = getStore();
    const publicSettings = getPublicSettings(store);
    const session = getValidSession(req, res);
    if (!session) {
      clearSessionCookie(req, res);
      res.json({
        authenticated: false,
        setupRequired: !store.users.some((u) => Boolean(u.password_hash)),
        settings: publicSettings
      });
      return;
    }
    setSessionCookie(req, res, session.token, session.expiresAt);
    res.json({
      authenticated: true,
      setupRequired: false,
      token: session.token,
      user: sanitizeUser(session.user),
      expiresAt: session.expiresAt,
      settings: publicSettings,
      bootstrap: buildBootstrapPayload(store, session.user)
    });
  });
  app.post("/api/auth/keepalive", (req, res) => {
    const session = getValidSession(req, res);
    if (!session) {
      clearSessionCookie(req, res);
      res.status(401).json({ error: "Session expired after 60 minutes of inactivity." });
      return;
    }
    setSessionCookie(req, res, session.token, session.expiresAt);
    res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt
    });
  });
  app.post("/api/auth/login", (req, res) => {
    const store = getStore();
    const identifier = String(req.body?.identifier ?? req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!identifier || !password) {
      res.status(400).json({ error: "Email or username and password are required." });
      return;
    }
    const user = store.users.find(
      (u) => u.email.toLowerCase() === identifier || u.name.toLowerCase() === identifier
    );
    if (!user) {
      res.status(401).json({ error: "Invalid credentials. Only registered dashboard accounts can sign in." });
      return;
    }
    if (!user.is_active) {
      res.status(403).json({ error: "This account is currently disabled. Contact the Super Admin." });
      return;
    }
    if (!user.password_hash) {
      res.status(401).json({
        error: "Password is not configured for this account. Use Forgot password? with your registered phone number to set or recover your password."
      });
      return;
    }
    if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({
        error: "Incorrect password. Please enter your authentic password or use Forgot password? to recover it."
      });
      return;
    }
    const { token, expiresAt } = createSignedSessionToken(user);
    setSessionCookie(req, res, token, expiresAt);
    res.json({
      token,
      expiresAt,
      user: sanitizeUser(user),
      bootstrap: buildBootstrapPayload(store, user)
    });
  });
  function findUserByEmailOrPhone(store, rawIdentifier) {
    const clean = rawIdentifier.trim().toLowerCase();
    const digits = normalizePhoneDigits(rawIdentifier);
    const tail = (d) => d.length >= 8 ? d.slice(-10) : d;
    return store.users.find((u) => {
      if (u.email.toLowerCase() === clean || u.name.toLowerCase() === clean) return true;
      if (digits.length >= 6) {
        const uDigits = normalizePhoneDigits(u.phone);
        if (uDigits.length >= 6 && tail(uDigits) === tail(digits)) return true;
        const shopDigits = normalizePhoneDigits(store.settings.shop_phone);
        if (["super_admin", "admin"].includes(u.role) && shopDigits.length >= 6 && tail(shopDigits) === tail(digits)) {
          return true;
        }
      }
      return false;
    });
  }
  function hashRecoveryCode(userId, code) {
    return crypto.createHmac("sha256", OTP_HMAC_KEY).update(`${userId}:${code}`).digest("hex");
  }
  function isSafeExternalWebhookUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      const host = parsed.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0" || host.endsWith(".local") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
  app.post("/api/auth/request-recovery-code", async (req, res) => {
    const store = getStore();
    const rawIdentifier = String(req.body?.identifier ?? req.body?.email ?? "").trim();
    const requestedChannel = String(req.body?.channel ?? "").trim().toLowerCase();
    if (!rawIdentifier) {
      res.status(400).json({ error: "Please enter your registered email address or mobile number." });
      return;
    }
    const channel = requestedChannel === "sms" || requestedChannel === "email" ? requestedChannel : rawIdentifier.includes("@") ? "email" : "sms";
    const cleanEnvVal = (raw, fallback = "") => {
      const trimmed = (raw ?? "").trim();
      if (!trimmed) return fallback;
      if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1).trim();
      }
      return trimmed;
    };
    const rawSmtpHost = cleanEnvVal(process.env.SMTP_HOST, "mail.youthit.com.bd");
    const smtpHost = rawSmtpHost.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0].trim() || "mail.youthit.com.bd";
    const parsedPort = Number(cleanEnvVal(process.env.SMTP_PORT, "465"));
    const smtpPort = Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 465;
    const rawSmtpUser = cleanEnvVal(process.env.SMTP_USER, "info@youthit.com.bd");
    const shopEmailFallback = (store.settings.shop_email || "info@youthit.com.bd").trim();
    const smtpUser = rawSmtpUser.toLowerCase() === smtpHost.toLowerCase() && shopEmailFallback.includes("@") ? shopEmailFallback : rawSmtpUser;
    const rawSmtpPass = process.env.SMTP_PASS || "";
    const cleanedSmtpPass = cleanEnvVal(rawSmtpPass, "");
    const smtpPass = rawSmtpPass || cleanedSmtpPass;
    const rawSmtpFrom = cleanEnvVal(process.env.SMTP_FROM, smtpUser) || smtpUser;
    const smtpFrom = rawSmtpFrom.includes("@") ? rawSmtpFrom : smtpUser;
    if (channel === "email") {
      if (!smtpHost || !smtpUser || !smtpPass) {
        res.status(422).json({
          error: `Email password (SMTP_PASS) for ${smtpUser} (${smtpHost}:${smtpPort}) is not configured in Settings -> Secrets yet. Add SMTP_PASS in Secrets to send verification emails.`
        });
        return;
      }
    } else {
      const safeSmsUrl = process.env.SMS_GATEWAY_URL ? isSafeExternalWebhookUrl(cleanEnvVal(process.env.SMS_GATEWAY_URL)) : null;
      if (!safeSmsUrl) {
        res.status(422).json({
          error: "SMS delivery is not configured in Settings -> Secrets (SMS_GATEWAY_URL, SMS_API_KEY). Configure an SMS gateway or switch to Email once configured."
        });
        return;
      }
    }
    const user = findUserByEmailOrPhone(store, rawIdentifier);
    if (!user || !user.is_active) {
      res.json({
        ok: true,
        channel,
        message: `If an active account matches that ${channel === "email" ? "email" : "mobile number"}, a 6-digit verification code has been sent.`
      });
      return;
    }
    const existing = recoveryCodes.get(user.id);
    if (existing && Date.now() - existing.sentAt < OTP_COOLDOWN_MS && Date.now() < existing.expiresAt) {
      res.status(429).json({ error: "Please wait a moment before requesting another verification code." });
      return;
    }
    const code = String(crypto.randomInt(1e5, 1e6));
    const codeHash = hashRecoveryCode(user.id, code);
    const shopName = store.settings.shop_name || "Youth IT POS";
    try {
      if (channel === "email") {
        if (!user.email) {
          res.status(400).json({ error: "No email address is registered for this account." });
          return;
        }
        const sendWithPass = async (passCandidate) => {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            requireTLS: smtpPort === 587,
            auth: {
              user: smtpUser,
              pass: passCandidate
            },
            connectionTimeout: 8e3,
            greetingTimeout: 8e3,
            socketTimeout: 1e4
          });
          await transporter.sendMail({
            from: `${shopName} <${smtpFrom}>`,
            to: user.email,
            subject: `${shopName} \u2014 Password Recovery Verification Code`,
            text: `Hello ${user.name},

Your 6-digit password recovery verification code is: ${code}

This code expires in 10 minutes. If you did not request this, ignore this email.`
          });
        };
        try {
          await sendWithPass(rawSmtpPass);
        } catch (smtpErr) {
          const errCode = smtpErr?.code;
          if (errCode === "EAUTH" && cleanedSmtpPass && cleanedSmtpPass !== rawSmtpPass) {
            await sendWithPass(cleanedSmtpPass);
          } else {
            throw smtpErr;
          }
        }
      } else {
        const fallbackShopPhone = ["super_admin", "admin"].includes(user.role) ? store.settings.shop_phone || "" : "";
        const targetPhone = String(user.phone || fallbackShopPhone).trim();
        if (!targetPhone) {
          res.status(400).json({
            error: "No mobile number is registered for this account. Please try Email recovery instead."
          });
          return;
        }
        const smsUrl = isSafeExternalWebhookUrl(cleanEnvVal(process.env.SMS_GATEWAY_URL));
        const smsSenderId = cleanEnvVal(
          process.env.SMS_SENDER_ID || smsUrl.searchParams.get("senderid") || smsUrl.searchParams.get("sender_id") || smsUrl.searchParams.get("SenderId") || ""
        );
        const rawDigits = normalizePhoneDigits(targetPhone);
        const bd13 = rawDigits.startsWith("8801") ? rawDigits : rawDigits.startsWith("01") && rawDigits.length === 11 ? `88${rawDigits}` : targetPhone.replace(/^\+/, "");
        const bd11 = rawDigits.startsWith("8801") && rawDigits.length === 13 ? rawDigits.slice(2) : bd13;
        const rawApiKeySecret = cleanEnvVal(
          process.env.SMS_API_KEY || smsUrl.searchParams.get("api_key") || smsUrl.searchParams.get("apikey") || smsUrl.searchParams.get("ApiKey") || smsUrl.searchParams.get("Apikey") || smsUrl.searchParams.get("token") || ""
        );
        let smsApiKey = rawApiKeySecret;
        let smsClientId = cleanEnvVal(
          process.env.SMS_CLIENT_ID || smsUrl.searchParams.get("ClientId") || smsUrl.searchParams.get("client_id") || smsUrl.searchParams.get("clientId") || ""
        );
        const smsUsername = cleanEnvVal(
          process.env.SMS_USERNAME || smsUrl.searchParams.get("UserName") || smsUrl.searchParams.get("username") || ""
        );
        const smsSecretKey = cleanEnvVal(
          process.env.SMS_SECRET_KEY || smsUrl.searchParams.get("secretkey") || smsUrl.searchParams.get("SecretKey") || smsUrl.searchParams.get("api_secret") || ""
        );
        if (!smsClientId && rawApiKeySecret.includes("|")) {
          const [cid, keyPart] = rawApiKeySecret.split("|", 2);
          if (cid && keyPart) {
            smsClientId = cid.trim();
            smsApiKey = keyPart.trim();
          }
        }
        const redactSecrets = (txt) => {
          let safe = txt.replaceAll(code, "******");
          if (smsApiKey) safe = safe.replaceAll(smsApiKey, "***");
          if (smsClientId) safe = safe.replaceAll(smsClientId, "***");
          if (smsUsername) safe = safe.replaceAll(smsUsername, "***");
          if (smsSecretKey) safe = safe.replaceAll(smsSecretKey, "***");
          if (smtpPass) safe = safe.replaceAll(smtpPass, "***");
          return safe.trim().slice(0, 160);
        };
        const dispatchSms = async (phoneValue, mode) => {
          const smsMsg = `${shopName} recovery code: ${code} (valid 10 min).`;
          const baseParams = {
            to: phoneValue,
            number: phoneValue,
            numbers: phoneValue,
            MobileNumber: phoneValue,
            MobileNumbers: phoneValue,
            msisdn: phoneValue,
            type: "text",
            TransactionType: "T",
            message: smsMsg,
            Message: smsMsg,
            msg: smsMsg,
            sms: smsMsg
          };
          if (smsApiKey) {
            baseParams.api_key = smsApiKey;
            baseParams.apikey = smsApiKey;
            baseParams.ApiKey = smsApiKey;
            baseParams.Apikey = smsApiKey;
            baseParams.api_token = smsApiKey;
            baseParams.token = smsApiKey;
          }
          if (smsClientId) {
            baseParams.ClientId = smsClientId;
            baseParams.client_id = smsClientId;
            if (!smsUsername) {
              baseParams.UserName = smsClientId;
            }
          }
          if (smsUsername) {
            baseParams.UserName = smsUsername;
            baseParams.username = smsUsername;
          }
          if (smsSecretKey) {
            baseParams.secretkey = smsSecretKey;
            baseParams.SecretKey = smsSecretKey;
            baseParams.api_secret = smsSecretKey;
          }
          if (smsSenderId) {
            baseParams.senderid = smsSenderId;
            baseParams.sender_id = smsSenderId;
            baseParams.SenderId = smsSenderId;
            baseParams.SenderName = smsSenderId;
            baseParams.sender = smsSenderId;
            baseParams.sid = smsSenderId;
          }
          const reqUrl = new URL(smsUrl.toString());
          if (mode === "get") {
            for (const [k, v] of Object.entries(baseParams)) {
              if (!reqUrl.searchParams.has(k)) {
                reqUrl.searchParams.set(k, v);
              }
            }
          }
          const smsRes = await fetch(reqUrl.toString(), {
            method: mode === "get" ? "GET" : "POST",
            headers: mode === "get" ? {} : {
              "Content-Type": mode === "form" ? "application/x-www-form-urlencoded" : "application/json"
            },
            body: mode === "get" ? void 0 : mode === "form" ? new URLSearchParams(baseParams).toString() : JSON.stringify(baseParams),
            signal: AbortSignal.timeout(8e3)
          });
          const rawSmsText = await smsRes.text();
          const trimmedSms = rawSmsText.trim();
          const smsContentType = (smsRes.headers.get("content-type") || "").toLowerCase();
          if (smsContentType.includes("text/html") || trimmedSms.startsWith("<!doctype") || trimmedSms.startsWith("<!DOCTYPE") || trimmedSms.startsWith("<html")) {
            throw new Error(
              "SMS_GATEWAY_URL returned an HTML page instead of an SMS API response. Please enter your actual SMS provider API endpoint in Settings -> Secrets."
            );
          }
          if (!smsRes.ok) {
            throw new Error(
              `SMS gateway rejected request (HTTP ${smsRes.status}): ${redactSecrets(trimmedSms) || "Check SMS_GATEWAY_URL and SMS_API_KEY."}`
            );
          }
          if (trimmedSms) {
            let parsedSms = null;
            try {
              const parsed = JSON.parse(trimmedSms);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                parsedSms = parsed;
              } else if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === "object") {
                parsedSms = parsed[0];
              }
            } catch {
              parsedSms = null;
            }
            if (parsedSms) {
              const rawCode = parsedSms.response_code ?? parsedSms.status_code ?? parsedSms.statusCode ?? parsedSms.StatusCode ?? parsedSms.error_code ?? parsedSms.errorCode ?? parsedSms.ErrorCode ?? parsedSms.code;
              const numCode = rawCode !== void 0 && rawCode !== null && rawCode !== "" ? Number(rawCode) : NaN;
              const statusStr = String(parsedSms.status ?? parsedSms.Status ?? parsedSms.result ?? "").toLowerCase();
              const errField = parsedSms.error_message ?? parsedSms.errorMessage ?? parsedSms.ErrorMessage ?? parsedSms.ErrorDescription ?? parsedSms.error ?? parsedSms.Error ?? parsedSms.errors;
              const hasExplicitError = Boolean(errField) && !["0", "none", "null", "false", "ok", "success"].includes(String(errField).toLowerCase());
              const badStatus = parsedSms.ok === false || parsedSms.success === false || parsedSms.success === "false" || statusStr === "false" || statusStr === "0" || /error|fail|reject|invalid|denied/.test(statusStr);
              const badNumericCode = Number.isFinite(numCode) && ![0, 200, 201, 202, 1101].includes(numCode) && (numCode >= 300 || numCode < 0 || numCode === 1 || numCode === 2);
              if (hasExplicitError || badStatus || badNumericCode) {
                const detail = String(
                  errField || parsedSms.message || parsedSms.Message || trimmedSms
                );
                const statusFlags = `SMS_API_KEY=${smsApiKey ? "set" : "missing"}, SMS_CLIENT_ID=${smsClientId ? "set" : "missing"}, SMS_USERNAME=${smsUsername ? "set" : "missing"}, SMS_SECRET_KEY=${smsSecretKey ? "set" : "missing"}, SMS_SENDER_ID=${smsSenderId ? "set" : "missing"}`;
                const extraHint = /sender\s*id/i.test(detail) ? " \u2014 Add SMS_SENDER_ID in Settings -> Secrets." : /credential|apikey|clientid|username|secret/i.test(detail) ? ` \u2014 Secrets detected: [${statusFlags}]. Add/verify the required credential in Settings -> Secrets.` : "";
                throw new Error(`SMS gateway error: ${redactSecrets(detail)}${extraHint}`);
              }
              const msgText = String(parsedSms.message ?? parsedSms.Message ?? "");
              if (/missing|required|invalid|not\s+found|unauthoriz|fail|error/i.test(msgText)) {
                throw new Error(`SMS gateway error: ${redactSecrets(msgText)}`);
              }
            } else {
              if (/error|fail|invalid|denied|missing|required|balance|sender|not\s+found|unauthoriz|expired|wrong/i.test(trimmedSms)) {
                throw new Error(`SMS gateway error: ${redactSecrets(trimmedSms)}`);
              }
              if (!/\b(ok|success|sent|queued|accepted|submitted|delivered|200|202|1101)\b/i.test(trimmedSms)) {
                throw new Error(`SMS gateway response did not confirm delivery: ${redactSecrets(trimmedSms)}`);
              }
            }
          }
        };
        const smsAttempts = [
          [bd13, "form"],
          [bd13, "get"],
          [bd13, "json"],
          ...bd11 !== bd13 ? [
            [bd11, "form"],
            [bd11, "get"],
            [bd11, "json"]
          ] : []
        ];
        let lastSmsErr = null;
        let specificApiErr = null;
        let smsDelivered = false;
        for (const [phoneCandidate, mode] of smsAttempts) {
          try {
            await dispatchSms(phoneCandidate, mode);
            smsDelivered = true;
            break;
          } catch (attemptErr) {
            lastSmsErr = attemptErr;
            const m = attemptErr instanceof Error ? attemptErr.message : "";
            if (m.startsWith("SMS gateway error:")) {
              specificApiErr = attemptErr;
            }
            if (!/invalid|missing|required|blank|credential|method|unsupported|media\s*type|http 400|http 401|http 403|http 404|http 405|http 406|http 415|http 422|did not confirm/i.test(
              m
            )) {
              throw attemptErr;
            }
          }
        }
        if (!smsDelivered) {
          throw specificApiErr ?? lastSmsErr;
        }
      }
      recoveryCodes.set(user.id, {
        codeHash,
        channel,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
        sentAt: Date.now(),
        attempts: 0
      });
      res.json({
        ok: true,
        channel,
        message: `A 6-digit verification code has been sent to your registered ${channel === "email" ? "email" : "mobile number"}.`
      });
    } catch (err) {
      const codeHint = err?.code;
      const errMsg = err instanceof Error ? err.message : "";
      const redact = (txt) => {
        let s = txt.replaceAll(code, "******");
        if (smtpPass) s = s.replaceAll(smtpPass, "***");
        if (cleanedSmtpPass) s = s.replaceAll(cleanedSmtpPass, "***");
        if (process.env.SMS_API_KEY) s = s.replaceAll(process.env.SMS_API_KEY, "***");
        if (process.env.SMS_CLIENT_ID) s = s.replaceAll(process.env.SMS_CLIENT_ID, "***");
        if (process.env.SMS_USERNAME) s = s.replaceAll(process.env.SMS_USERNAME, "***");
        if (process.env.SMS_SECRET_KEY) s = s.replaceAll(process.env.SMS_SECRET_KEY, "***");
        return s.trim().slice(0, 220);
      };
      const reason = codeHint === "EAUTH" ? `SMTP authentication failed for ${smtpUser} on ${smtpHost}:${smtpPort}. Please verify SMTP_USER and SMTP_PASS in Settings -> Secrets (enter plain values without surrounding quotes).` : codeHint === "ETIMEDOUT" || codeHint === "ECONNREFUSED" || codeHint === "ESOCKET" ? `Could not connect to mail server (${smtpHost}:${smtpPort}). Please verify SMTP_HOST and SMTP_PORT in Settings -> Secrets.` : errMsg.startsWith("SMS") ? errMsg : `Email delivery failed (${codeHint || "SMTP"}): ${redact(errMsg) || "Please verify SMTP credentials in Settings -> Secrets."}`;
      res.status(422).json({ error: reason });
    }
  });
  app.post("/api/auth/verify-recovery-code", (req, res) => {
    const store = getStore();
    const rawIdentifier = String(req.body?.identifier ?? req.body?.email ?? "").trim();
    const code = String(req.body?.code ?? "").trim();
    if (!rawIdentifier || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "Account email/mobile and 6-digit verification code are required." });
      return;
    }
    const user = findUserByEmailOrPhone(store, rawIdentifier);
    if (!user || !user.is_active) {
      res.status(401).json({ error: "Invalid or expired verification code." });
      return;
    }
    const entry = recoveryCodes.get(user.id);
    if (!entry || Date.now() > entry.expiresAt || entry.attempts >= 5) {
      recoveryCodes.delete(user.id);
      res.status(401).json({ error: "Verification code is invalid or expired. Please request a new code." });
      return;
    }
    const candidateHash = hashRecoveryCode(user.id, code);
    const validCode = crypto.timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(entry.codeHash, "hex")
    );
    if (!validCode) {
      entry.attempts += 1;
      if (entry.attempts >= 5) recoveryCodes.delete(user.id);
      res.status(401).json({ error: "Incorrect verification code. Please check your email/SMS and try again." });
      return;
    }
    const resetProof = crypto.randomBytes(32).toString("hex");
    entry.verifiedProofHash = crypto.createHash("sha256").update(resetProof).digest("hex");
    entry.verifiedUntil = Date.now() + OTP_EXPIRY_MS;
    entry.attempts = 0;
    res.json({
      ok: true,
      reset_proof: resetProof,
      message: "Verification code matched! Please enter your new password."
    });
  });
  app.post("/api/auth/recover-password", (req, res) => {
    const store = getStore();
    const rawIdentifier = String(req.body?.identifier ?? req.body?.email ?? "").trim();
    const code = String(req.body?.code ?? "").trim();
    const resetProof = String(req.body?.reset_proof ?? "").trim();
    const newPassword = String(req.body?.new_password ?? "");
    if (!rawIdentifier || !/^\d{6}$/.test(code) && !resetProof || !newPassword) {
      res.status(400).json({ error: "Verification is required before setting a new password." });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters long." });
      return;
    }
    const user = findUserByEmailOrPhone(store, rawIdentifier);
    if (!user || !user.is_active) {
      res.status(401).json({ error: "Invalid or expired verification session." });
      return;
    }
    const entry = recoveryCodes.get(user.id);
    if (!entry || Date.now() > entry.expiresAt || entry.attempts >= 5) {
      recoveryCodes.delete(user.id);
      res.status(401).json({ error: "Verification code is invalid or expired. Please request a new code." });
      return;
    }
    let verified = false;
    if (resetProof && entry.verifiedProofHash && entry.verifiedUntil && Date.now() <= entry.verifiedUntil) {
      const candidateProofHash = crypto.createHash("sha256").update(resetProof).digest("hex");
      verified = crypto.timingSafeEqual(
        Buffer.from(candidateProofHash, "hex"),
        Buffer.from(entry.verifiedProofHash, "hex")
      );
    } else if (/^\d{6}$/.test(code)) {
      const candidateHash = hashRecoveryCode(user.id, code);
      verified = crypto.timingSafeEqual(
        Buffer.from(candidateHash, "hex"),
        Buffer.from(entry.codeHash, "hex")
      );
    }
    if (!verified) {
      entry.attempts += 1;
      if (entry.attempts >= 5) recoveryCodes.delete(user.id);
      res.status(401).json({ error: "Verification code did not match. Please verify your code first." });
      return;
    }
    recoveryCodes.delete(user.id);
    user.password_hash = hashPassword(newPassword);
    saveStore(store);
    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.userId === user.id) activeSessions.delete(tok);
    }
    savePersistedSessions();
    res.json({
      ok: true,
      message: "Verification code confirmed and password updated. Please sign in with your new password."
    });
  });
  app.post("/api/auth/change-password", (req, res) => {
    const store = getStore();
    const authUser = req.authUser;
    const userId = Number(req.body?.user_id ?? authUser?.id ?? 0);
    const currentPassword = String(req.body?.current_password ?? "");
    const newPassword = String(req.body?.new_password ?? "");
    if (!authUser || authUser.id !== userId && !hasAnyRole(authUser, ["admin"])) {
      res.status(403).json({ error: "You do not have permission to change this password." });
      return;
    }
    if (!userId || newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters." });
      return;
    }
    const user = store.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: "User account not found." });
      return;
    }
    if (user.role === "super_admin" && authUser.role !== "super_admin") {
      res.status(403).json({ error: "Only the Super Admin can change the Super Admin password." });
      return;
    }
    if (user.password_hash && authUser.id === user.id && !verifyPassword(currentPassword, user.password_hash)) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }
    user.password_hash = hashPassword(newPassword);
    saveStore(store);
    res.json({ ok: true, user: sanitizeUser(user) });
  });
  app.post("/api/auth/logout", (req, res) => {
    const tokens = [];
    const authHeader = String(req.headers.authorization ?? "");
    if (authHeader.startsWith("Bearer ")) {
      tokens.push(authHeader.slice(7).trim());
    }
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      tokens.push(cookies[SESSION_COOKIE_NAME]);
    }
    let revokedAny = false;
    for (const tok of tokens) {
      if (!tok) continue;
      activeSessions.delete(tok);
      const parsed = parseSignedTokenJti(tok);
      if (parsed) {
        revokedSessionJtis.set(parsed.jti, parsed.exp);
        revokedAny = true;
      }
    }
    savePersistedSessions();
    if (revokedAny) saveRevokedSessions();
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
  app.get("/api/users", (req, res) => {
    const store = getStore();
    const authUser = req.authUser;
    if (!hasAnyRole(authUser, ["admin"])) {
      res.json(authUser ? [sanitizeUser(authUser)] : []);
      return;
    }
    res.json(store.users.map(sanitizeUser));
  });
  app.post("/api/users", (req, res) => {
    const store = getStore();
    const { name, email, role, phone, address, password } = req.body ?? {};
    const cleanName = String(name ?? "").trim();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    if (!cleanName || !cleanEmail) {
      res.status(400).json({ error: "Name and email are required." });
      return;
    }
    if (store.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    const cleanPassword = String(password ?? "");
    if (!cleanPassword || cleanPassword.length < 6) {
      res.status(400).json({ error: "Password is required (at least 6 characters) when adding a user." });
      return;
    }
    const requestedRole = String(role ?? "staff");
    const assignedRole = ["admin", "manager", "staff"].includes(requestedRole) ? requestedRole : "staff";
    const user = {
      id: nextId(store.users),
      name: cleanName,
      email: cleanEmail,
      role: assignedRole,
      phone: String(phone ?? "").trim(),
      address: String(address ?? "").trim(),
      password_hash: hashPassword(cleanPassword),
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.users.push(user);
    saveStore(store);
    res.status(201).json(sanitizeUser(user));
  });
  app.put("/api/users/:id", (req, res) => {
    const store = getStore();
    const authUser = req.authUser;
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (!authUser || authUser.id !== user.id && !hasAnyRole(authUser, ["admin"])) {
      res.status(403).json({ error: "You do not have permission to edit this user." });
      return;
    }
    if (user.role === "super_admin" && authUser.role !== "super_admin") {
      res.status(403).json({ error: "Only the Super Admin can modify the Super Admin account." });
      return;
    }
    const body = req.body ?? {};
    if (body.name !== void 0) {
      const n = String(body.name).trim();
      if (!n) {
        res.status(400).json({ error: "Name cannot be empty." });
        return;
      }
      user.name = n;
    }
    if (body.email !== void 0) {
      const e = String(body.email).trim().toLowerCase();
      if (!e) {
        res.status(400).json({ error: "Email cannot be empty." });
        return;
      }
      if (store.users.some((u) => u.id !== user.id && u.email.toLowerCase() === e)) {
        res.status(409).json({ error: "Another user already uses this email." });
        return;
      }
      user.email = e;
    }
    if (body.phone !== void 0) user.phone = String(body.phone).trim();
    if (body.address !== void 0) user.address = String(body.address).trim();
    if (body.profile_image === null || body.profile_image === "") {
      user.profile_image = null;
    } else if (typeof body.profile_image === "string" && (body.profile_image.startsWith("/uploads/") || body.profile_image.startsWith("/assets/"))) {
      user.profile_image = body.profile_image;
    }
    if (body.role !== void 0 && hasAnyRole(authUser, ["admin"])) {
      if (user.id === 1 || user.role === "super_admin") {
        user.role = "super_admin";
      } else if (["admin", "manager", "staff"].includes(String(body.role))) {
        user.role = String(body.role);
      }
    }
    if (body.password !== void 0 && String(body.password) !== "") {
      const p = String(body.password);
      if (p.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters." });
        return;
      }
      user.password_hash = hashPassword(p);
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.userId === user.id && authUser.id !== user.id) activeSessions.delete(tok);
      }
      savePersistedSessions();
    }
    saveStore(store);
    res.json(sanitizeUser(user));
  });
  app.post("/api/users/:id/avatar", (req, res) => {
    const store = getStore();
    const authUser = req.authUser;
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (!authUser || authUser.id !== user.id && !hasAnyRole(authUser, ["admin"])) {
      res.status(403).json({ error: "You do not have permission to update this profile photo." });
      return;
    }
    const dataUrl = String(req.body?.image_data ?? "");
    if (!dataUrl) {
      user.profile_image = null;
      saveStore(store);
      res.json(sanitizeUser(user));
      return;
    }
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      res.status(400).json({ error: "Please upload a valid PNG, JPG, or WEBP image." });
      return;
    }
    const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.byteLength > 2 * 1024 * 1024) {
      res.status(400).json({ error: "Profile image must be under 2MB." });
      return;
    }
    const fileName = `user-${user.id}-${Date.now()}.${ext}`;
    const targetPath = path2.join(uploadsDir, fileName);
    fs2.writeFileSync(targetPath, buffer);
    user.profile_image = `/uploads/avatars/${fileName}`;
    saveStore(store);
    res.json(sanitizeUser(user));
  });
  app.patch("/api/users/:id/toggle", (req, res) => {
    const store = getStore();
    const authUser = req.authUser;
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (user.id === 1 || user.role === "super_admin" || user.id === authUser?.id) {
      res.status(400).json({ error: "Super Admin or currently signed-in account cannot be disabled." });
      return;
    }
    user.is_active = !user.is_active;
    if (!user.is_active) {
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.userId === user.id) activeSessions.delete(tok);
      }
      savePersistedSessions();
    }
    saveStore(store);
    res.json(sanitizeUser(user));
  });
  app.delete("/api/users/:id", (req, res) => {
    const store = getStore();
    const authUser = req.authUser;
    const targetId = Number(req.params.id);
    const targetUser = store.users.find((u) => u.id === targetId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (targetId === 1 || targetUser.role === "super_admin" || targetId === authUser?.id) {
      res.status(400).json({ error: "Super Admin or currently signed-in account cannot be deleted." });
      return;
    }
    store.users = store.users.filter((u) => u.id !== targetId);
    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.userId === targetId) activeSessions.delete(tok);
    }
    savePersistedSessions();
    saveStore(store);
    res.json({ ok: true });
  });
  app.get("/api/owners", (_req, res) => {
    const store = getStore();
    res.json([...store.owners].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)));
  });
  app.post("/api/owners", (req, res) => {
    const store = getStore();
    const name = String(req.body?.name ?? "").trim();
    const sharePercent = Number(req.body?.share_percent ?? 0);
    if (!name) {
      res.status(400).json({ error: "Owner name is required." });
      return;
    }
    if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) {
      res.status(400).json({ error: "Share percentage must be between 0 and 100." });
      return;
    }
    const owner = {
      id: nextId(store.owners),
      name,
      phone: String(req.body?.phone ?? "").trim(),
      email: String(req.body?.email ?? "").trim(),
      address: String(req.body?.address ?? "").trim(),
      share_percent: sharePercent,
      is_active: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.owners.unshift(owner);
    saveStore(store);
    res.status(201).json(owner);
  });
  app.patch("/api/owners/:id/toggle", (req, res) => {
    const store = getStore();
    const owner = store.owners.find((o) => Number(o.id) === Number(req.params.id));
    if (!owner) {
      res.status(404).json({ error: "Owner not found." });
      return;
    }
    owner.is_active = Number(owner.is_active) === 1 ? 0 : 1;
    saveStore(store);
    res.json(owner);
  });
  app.delete("/api/owners/:id", (req, res) => {
    const store = getStore();
    store.owners = store.owners.filter((o) => Number(o.id) !== Number(req.params.id));
    saveStore(store);
    res.json({ ok: true });
  });
  app.post("/api/accounts", (req, res) => {
    const store = getStore();
    const accountName = String(req.body?.account_name ?? "").trim();
    const bankName = String(req.body?.bank_name ?? "").trim();
    const openingBalance = Number(req.body?.opening_balance ?? 0);
    if (!accountName) {
      res.status(400).json({ error: "Account name is required." });
      return;
    }
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      res.status(400).json({ error: "Opening balance cannot be negative." });
      return;
    }
    const acc = {
      id: nextId(store.bank_accounts),
      bank_name: bankName || accountName,
      account_name: accountName,
      branch: String(req.body?.branch ?? "").trim() || null,
      opening_balance: openingBalance,
      balance: openingBalance,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.bank_accounts.push(acc);
    saveStore(store);
    res.status(201).json(acc);
  });
  app.get("/api/cashbook", (_req, res) => {
    const store = getStore();
    const rows = [...store.cash_transactions].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    let totalIn = 0;
    let totalOut = 0;
    for (const r of rows) {
      if (String(r.type) === "in") totalIn += Number(r.amount ?? 0);
      else totalOut += Number(r.amount ?? 0);
    }
    res.json({
      items: rows,
      totalIn,
      totalOut,
      balance: totalIn - totalOut
    });
  });
  app.post("/api/cashbook", (req, res) => {
    const store = getStore();
    const type = req.body?.type === "out" ? "out" : "in";
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Cash transaction amount must be greater than 0." });
      return;
    }
    let totalIn = 0;
    let totalOut = 0;
    for (const r of store.cash_transactions) {
      if (String(r.type) === "in") totalIn += Number(r.amount ?? 0);
      else totalOut += Number(r.amount ?? 0);
    }
    const currentCash = totalIn - totalOut;
    if (type === "out" && amount > currentCash + 9e-3) {
      res.status(400).json({ error: `Insufficient cash book balance (${currentCash.toFixed(2)} available).` });
      return;
    }
    const row = {
      id: nextId(store.cash_transactions),
      type,
      amount,
      description: String(req.body?.description ?? "").trim(),
      transaction_date: String(req.body?.transaction_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
      created_by: req.authUser?.id ?? 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.cash_transactions.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });
  app.get("/api/stock", (req, res) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const filter = String(req.query.filter ?? "all");
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? "")]));
    const brandMap = new Map(store.brands.map((b) => [Number(b.id), String(b.name ?? "")]));
    const prodMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? "Product")]));
    let products = store.products.filter((p) => Number(p.status ?? 1) === 1).map((p) => ({
      ...p,
      image: resolveProductImage(p.image, p.name),
      category_name: catMap.get(Number(p.category_id)) ?? "Uncategorized",
      brand_name: brandMap.get(Number(p.brand_id)) ?? "No Brand",
      quantity: Number(p.stock_quantity ?? p.quantity ?? 0)
    }));
    if (q) {
      products = products.filter(
        (p) => matchesSearchTokens([p.name, p.sku, p.barcode, p.category_name, p.brand_name], q)
      );
    }
    if (filter === "low") {
      products = products.filter((p) => Number(p.quantity ?? 0) > 0 && Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5));
    } else if (filter === "out") {
      products = products.filter((p) => Number(p.quantity ?? 0) <= 0);
    }
    const movements = [...store.stock_movements].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)).slice(0, 80).map((m) => ({
      ...m,
      product_name: prodMap.get(Number(m.product_id)) ?? "Product"
    }));
    res.json({ products, movements });
  });
  app.get("/api/payments", (_req, res) => {
    const store = getStore();
    const saleMap = new Map(store.sales.map((s) => [Number(s.id), s]));
    const purMap = new Map(store.purchases.map((p) => [Number(p.id), p]));
    const custMap = new Map(store.customers.map((c) => [Number(c.id), String(c.name ?? "")]));
    const supMap = new Map(store.suppliers.map((s) => [Number(s.id), String(s.name ?? "")]));
    const customerPayments = [...store.payments].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)).map((p) => {
      const s = saleMap.get(Number(p.sale_id));
      return {
        ...p,
        invoice_no: s ? String(s.invoice_no ?? "") : `#${p.sale_id}`,
        party_name: (s ? String(s.customer_name ?? "") : "") || custMap.get(Number(p.customer_id)) || "Walk-in Customer"
      };
    });
    const supplierPayments = [...store.supplier_payments].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)).map((p) => {
      const pur = purMap.get(Number(p.purchase_id));
      return {
        ...p,
        invoice_no: pur ? String(pur.invoice_no ?? "") : `#${p.purchase_id}`,
        party_name: supMap.get(Number(p.supplier_id ?? pur?.supplier_id)) || "Supplier"
      };
    });
    const dueSales = store.sales.filter((s) => Number(s.due ?? 0) > 9e-3).map((s) => ({
      id: Number(s.id),
      invoice_no: String(s.invoice_no ?? ""),
      customer_name: String(s.customer_name ?? "Customer"),
      due: Number(s.due ?? 0)
    }));
    const duePurchases = store.purchases.filter((p) => Number(p.due ?? 0) > 9e-3).map((p) => ({
      id: Number(p.id),
      invoice_no: String(p.invoice_no ?? ""),
      supplier_name: supMap.get(Number(p.supplier_id)) || "Supplier",
      due: Number(p.due ?? 0)
    }));
    res.json({ customerPayments, supplierPayments, dueSales, duePurchases });
  });
  app.get("/api/employees", (_req, res) => {
    const store = getStore();
    res.json([...store.employees].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)));
  });
  app.post("/api/employees", (req, res) => {
    const store = getStore();
    const name = String(req.body?.name ?? "").trim();
    const salary = Number(req.body?.salary ?? 0);
    if (!name) {
      res.status(400).json({ error: "Employee name is required." });
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      res.status(400).json({ error: "Salary cannot be negative." });
      return;
    }
    const emp = {
      id: nextId(store.employees),
      employee_id: String(req.body?.employee_id ?? "").trim() || `EMP-${String(nextId(store.employees)).padStart(3, "0")}`,
      name,
      email: String(req.body?.email ?? "").trim(),
      phone: String(req.body?.phone ?? "").trim(),
      address: String(req.body?.address ?? "").trim(),
      designation: String(req.body?.designation ?? "").trim() || "Staff",
      department: String(req.body?.department ?? "").trim() || "Operations",
      joining_date: String(req.body?.joining_date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
      salary,
      status: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.employees.unshift(emp);
    saveStore(store);
    res.status(201).json(emp);
  });
  app.post("/api/employees/:id/pay-salary", (req, res) => {
    const store = getStore();
    const emp = store.employees.find((e) => Number(e.id) === Number(req.params.id));
    if (!emp) {
      res.status(404).json({ error: "Employee not found." });
      return;
    }
    const amount = Number(req.body?.amount ?? emp.salary ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Salary payment amount must be greater than 0." });
      return;
    }
    const exp = {
      id: nextId(store.expenses),
      category: "Salary",
      description: `Salary paid to ${emp.name} (${emp.designation || "Staff"})${req.body?.note ? ` - ${req.body.note}` : ""}`,
      amount,
      expense_date: String(req.body?.date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
      created_by: req.authUser?.id ?? 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    };
    store.expenses.unshift(exp);
    saveStore(store);
    res.status(201).json(exp);
  });
  app.patch("/api/employees/:id/toggle", (req, res) => {
    const store = getStore();
    const emp = store.employees.find((e) => Number(e.id) === Number(req.params.id));
    if (!emp) {
      res.status(404).json({ error: "Employee not found." });
      return;
    }
    emp.status = Number(emp.status ?? 1) === 1 ? 0 : 1;
    saveStore(store);
    res.json(emp);
  });
  app.delete("/api/employees/:id", (req, res) => {
    const store = getStore();
    store.employees = store.employees.filter((e) => Number(e.id) !== Number(req.params.id));
    saveStore(store);
    res.json({ ok: true });
  });
  app.get("/api/backup/export", (_req, res) => {
    const store = getStore();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="youthit-pos-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(store, null, 2));
  });
  app.get("/api/backup/export-sql", (_req, res) => {
    const store = getStore();
    const sqlDump = generateMysqlDumpSql(store);
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="youthit-pos-database-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.sql"`);
    res.send(sqlDump);
  });
  app.get("/api/backup/download-full-project-zip", async (_req, res) => {
    const projectRoot = process.cwd();
    const store = getStore();
    const sqlDump = generateMysqlDumpSql(store);
    const zip = new JSZip();
    const files = collectFiles(projectRoot, projectRoot);
    for (const rel of files) {
      if (rel === "database/youthit_pos_database.sql" || rel === "laravel/database/sql/youthits_pos.sql") {
        continue;
      }
      const full = path2.join(projectRoot, rel);
      zip.file(`youthit-pos-full-project/${rel}`, fs2.readFileSync(full));
    }
    zip.file("youthit-pos-full-project/database/youthit_pos_database.sql", sqlDump);
    zip.file("youthit-pos-full-project/laravel/database/sql/youthits_pos.sql", sqlDump);
    zip.file("youthit-pos-full-project/HOSTING_UPLOAD_GUIDE.md", buildHostingUploadGuide());
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="youthit-pos-full-project.zip"');
    res.send(buffer);
  });
  app.post("/api/backup/restore", (req, res) => {
    const payload = req.body?.backup;
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.products) || !Array.isArray(payload.sales)) {
      res.status(400).json({ error: "Invalid backup JSON file. Required POS tables missing." });
      return;
    }
    const current = getStore();
    const safeStore = {
      ...current,
      settings: payload.settings && typeof payload.settings === "object" ? { ...current.settings, ...payload.settings } : current.settings,
      menus: Array.isArray(payload.menus) && payload.menus.length ? payload.menus : current.menus,
      users: Array.isArray(payload.users) && payload.users.length ? payload.users : current.users,
      categories: Array.isArray(payload.categories) ? payload.categories : [],
      brands: Array.isArray(payload.brands) ? payload.brands : [],
      units: Array.isArray(payload.units) ? payload.units : [],
      warranties: Array.isArray(payload.warranties) ? payload.warranties : [],
      products: payload.products.map((p) => ({
        ...p,
        image: resolveProductImage(p.image, p.name)
      })),
      stock_movements: Array.isArray(payload.stock_movements) ? payload.stock_movements : [],
      customers: Array.isArray(payload.customers) ? payload.customers : [],
      suppliers: Array.isArray(payload.suppliers) ? payload.suppliers : [],
      owners: Array.isArray(payload.owners) ? payload.owners : [],
      employees: Array.isArray(payload.employees) ? payload.employees : [],
      bank_accounts: Array.isArray(payload.bank_accounts) ? payload.bank_accounts : [],
      bank_transactions: Array.isArray(payload.bank_transactions) ? payload.bank_transactions : [],
      cash_transactions: Array.isArray(payload.cash_transactions) ? payload.cash_transactions : [],
      expense_categories: Array.isArray(payload.expense_categories) ? payload.expense_categories : current.expense_categories,
      expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
      sales: payload.sales,
      sale_items: Array.isArray(payload.sale_items) ? payload.sale_items : [],
      payments: Array.isArray(payload.payments) ? payload.payments : [],
      purchases: Array.isArray(payload.purchases) ? payload.purchases : [],
      purchase_items: Array.isArray(payload.purchase_items) ? payload.purchase_items : [],
      supplier_payments: Array.isArray(payload.supplier_payments) ? payload.supplier_payments : [],
      estimates: Array.isArray(payload.estimates) ? payload.estimates : [],
      estimate_items: Array.isArray(payload.estimate_items) ? payload.estimate_items : [],
      returns: Array.isArray(payload.returns) ? payload.returns : [],
      damages: Array.isArray(payload.damages) ? payload.damages : []
    };
    saveStore(safeStore);
    res.json({ ok: true, products: safeStore.products.length, sales: safeStore.sales.length });
  });
  app.post("/api/backup/import-sql", (req, res) => {
    const sqlText = String(req.body?.sql ?? "");
    if (!sqlText.trim()) {
      res.status(400).json({ error: "SQL file content is empty." });
      return;
    }
    const { tables, schemas, truncated, incompleteTables } = parseMysqlDumpText(sqlText);
    const tableNames = Object.keys(tables);
    if (tableNames.length === 0) {
      const sizeKb = (Buffer.byteLength(sqlText, "utf8") / 1024).toFixed(1);
      const schemaList = Object.keys(schemas).join(", ") || "none";
      const cutTable = incompleteTables[0] || "unknown";
      res.status(400).json({
        error: truncated ? `The uploaded SQL file (${sizeKb} KB) is incomplete/truncated inside table "${cutTable}" before ";" finished (schemas found: ${schemaList}). Please export a complete .sql file from phpMyAdmin/MySQL.` : `No valid INSERT INTO table statements were found in this SQL file (${sizeKb} KB).`
      });
      return;
    }
    const current = getStore();
    const rawCategories = tables.categories ?? tables.product_categories ?? [];
    const rawBrands = tables.brands ?? [];
    const rawUnits = tables.units ?? [];
    const rawWarranties = tables.warranties ?? [];
    const rawProducts = tables.products ?? [];
    const rawCustomers = tables.customers ?? [];
    const rawSuppliers = tables.suppliers ?? [];
    const rawAccounts = tables.bank_accounts ?? tables.accounts ?? [];
    const rawExpenseCats = tables.expense_categories ?? [];
    const rawExpenses = tables.expenses ?? [];
    const rawSales = tables.sales ?? tables.sells ?? [];
    const rawSaleItems = tables.sale_items ?? tables.sell_items ?? [];
    const rawPurchases = tables.purchases ?? [];
    const rawPurchaseItems = tables.purchase_items ?? [];
    const rawActualPayments = tables.actual_payments ?? [];
    const custNameMap = new Map(rawCustomers.map((c) => [Number(c.id), String(c.name ?? "")]));
    const prodNameMap = new Map(rawProducts.map((p) => [Number(p.id), String(p.name ?? "")]));
    const expCatMap = new Map(rawExpenseCats.map((c) => [Number(c.id), String(c.name ?? "")]));
    const acctNameMap = new Map(
      rawAccounts.map((a) => [Number(a.id), String(a.account_name ?? a.name ?? "Account")])
    );
    const warranties = rawWarranties.map((w) => ({
      ...w,
      id: Number(w.id),
      name: String(w.name ?? w.duration ?? "Warranty"),
      duration: String(w.duration ?? w.name ?? ""),
      status: Number(w.status ?? 1)
    }));
    const products = rawProducts.map((p) => {
      const qty = Number(p.stock_quantity ?? p.quantity ?? p.stock ?? 0);
      return {
        ...p,
        id: Number(p.id),
        name: String(p.name ?? ""),
        sku: String(p.sku ?? p.code ?? ""),
        category_id: p.category_id ? Number(p.category_id) : null,
        brand_id: p.brand_id ? Number(p.brand_id) : null,
        unit_id: p.unit_id ?? p.main_unit_id ? Number(p.unit_id ?? p.main_unit_id) : null,
        warranty_id: p.warranty_id ? Number(p.warranty_id) : null,
        purchase_price: Number(p.purchase_price ?? p.purchase_cost ?? p.cost_price ?? 0),
        selling_price: Number(p.selling_price ?? p.sale_price ?? p.price ?? 0),
        quantity: qty,
        stock_quantity: qty,
        alert_quantity: Number(p.alert_quantity ?? 5),
        image: resolveProductImage(p.image, p.name),
        status: Number(p.status ?? 1)
      };
    });
    const customers = rawCustomers.map((c) => ({
      ...c,
      id: Number(c.id),
      name: String(c.name ?? ""),
      email: c.email ? String(c.email) : "",
      phone: c.phone ? String(c.phone) : "",
      address: c.address ? String(c.address) : "",
      opening_balance: Number(c.opening_balance ?? c.due ?? 0),
      status: Number(c.status ?? 1)
    }));
    const suppliers = rawSuppliers.map((s) => ({
      ...s,
      id: Number(s.id),
      name: String(s.name ?? ""),
      email: s.email ? String(s.email) : "",
      phone: s.phone ? String(s.phone) : "",
      address: s.address ? String(s.address) : "",
      opening_balance: Number(s.opening_balance ?? s.due ?? 0),
      status: Number(s.status ?? 1)
    }));
    const bank_accounts = rawAccounts.map((a) => ({
      ...a,
      id: Number(a.id),
      bank_name: String(a.bank_name ?? ""),
      account_name: String(a.account_name ?? a.name ?? "Account"),
      branch: a.branch ?? null,
      opening_balance: Number(a.opening_balance ?? 0),
      balance: Number(a.balance ?? a.current_balance ?? a.opening_balance ?? 0)
    }));
    const expenses = rawExpenses.map((ex) => ({
      ...ex,
      id: Number(ex.id),
      category: String(ex.category ?? (ex.expense_category_id ? expCatMap.get(Number(ex.expense_category_id)) : "") ?? "Other"),
      amount: Number(ex.amount ?? 0),
      expense_date: String(ex.expense_date ?? ex.date ?? ex.created_at ?? "").slice(0, 10),
      description: String(ex.description ?? ex.note ?? "")
    }));
    const sales = rawSales.map((s) => {
      const cid = s.customer_id ? Number(s.customer_id) : null;
      const receivable = Number(s.receivable ?? s.final_receivable ?? s.total_amount ?? s.total ?? 0);
      const paid = Number(s.paid ?? s.paid_amount ?? 0);
      const due = Number(s.due ?? s.due_amount ?? Math.max(0, receivable - paid));
      return {
        ...s,
        id: Number(s.id),
        invoice_no: String(s.invoice_no ?? s.invoice ?? `INV-${s.id}`),
        customer_id: cid,
        customer_name: String(s.customer_name ?? (cid ? custNameMap.get(cid) : "") ?? "Walk-in Customer"),
        date: String(s.date ?? s.sell_date ?? s.sale_date ?? s.created_at ?? "").slice(0, 10),
        discount: Number(s.discount ?? 0),
        vat: Number(s.vat ?? 0),
        receivable,
        paid,
        due,
        purchase_cost: Number(s.purchase_cost ?? s.total_cost ?? 0),
        profit: Number(s.profit ?? 0),
        status: String(s.status ?? "completed"),
        payment_status: String(
          s.payment_status ?? (due <= 0 ? "paid" : paid > 0 ? "partial" : "due")
        )
      };
    });
    const sale_items = rawSaleItems.map((it) => ({
      ...it,
      id: Number(it.id),
      product_id: it.product_id ? Number(it.product_id) : null,
      sale_id: Number(it.sale_id ?? it.sell_id ?? 0),
      product_name: String(it.product_name ?? (it.product_id ? prodNameMap.get(Number(it.product_id)) : "") ?? "Product"),
      quantity: Number(it.quantity ?? it.qty ?? 1),
      price: Number(it.price ?? it.rate ?? it.unit_price ?? 0),
      total: Number(it.total ?? it.sub_total ?? 0)
    }));
    const purchases = rawPurchases.map((p) => {
      const total = Number(p.total ?? p.total_amount ?? 0);
      const paid = Number(p.paid ?? p.paid_amount ?? 0);
      const due = Number(p.due ?? p.due_amount ?? Math.max(0, total - paid));
      return {
        ...p,
        id: Number(p.id),
        invoice_no: String(p.invoice_no ?? `PUR-${p.id}`),
        supplier_id: p.supplier_id ? Number(p.supplier_id) : null,
        total,
        paid,
        due
      };
    });
    const purchase_items = rawPurchaseItems.map((pi) => ({
      ...pi,
      id: Number(pi.id),
      purchase_id: Number(pi.purchase_id ?? 0),
      product_id: pi.product_id ? Number(pi.product_id) : null,
      quantity: Number(pi.quantity ?? pi.qty ?? 1),
      price: Number(pi.price ?? pi.rate ?? 0),
      total: Number(pi.total ?? pi.sub_total ?? 0)
    }));
    const actualReceives = rawActualPayments.filter((r) => String(r.payment_type ?? "") === "receive").map((r) => ({
      id: Number(r.id),
      sale_id: null,
      customer_id: r.customer_id ? Number(r.customer_id) : null,
      amount: Number(r.amount ?? 0),
      payment_date: String(r.date ?? r.created_at ?? ""),
      payment_method: Number(r.wallet_payment ?? 0) === 1 ? "wallet" : "cash",
      reference_no: null,
      note: r.note ? String(r.note) : null,
      created_by: 1,
      created_at: String(r.created_at ?? r.date ?? "")
    }));
    const actualPays = rawActualPayments.filter((r) => String(r.payment_type ?? "") === "pay").map((r) => ({
      id: Number(r.id),
      purchase_id: null,
      supplier_id: r.supplier_id ? Number(r.supplier_id) : null,
      amount: Number(r.amount ?? 0),
      payment_date: String(r.date ?? r.created_at ?? ""),
      payment_method: Number(r.wallet_payment ?? 0) === 1 ? "wallet" : "cash",
      reference_no: null,
      note: r.note ? String(r.note) : null,
      created_by: 1,
      created_at: String(r.created_at ?? r.date ?? "")
    }));
    const a2aTransactions = (tables.account_to_account_transections ?? []).map((t) => ({
      id: Number(t.id),
      bank_account_id: t.to ? Number(t.to) : t.from ? Number(t.from) : null,
      account_name: t.to ? acctNameMap.get(Number(t.to)) ?? "Account" : "Transfer",
      type: "deposit",
      amount: Number(t.amount ?? 0),
      description: String(t.note ?? "Account Transfer"),
      transaction_date: String(t.created_at ?? "").slice(0, 10)
    }));
    const updatedStore = {
      ...current,
      categories: rawCategories,
      brands: rawBrands,
      units: rawUnits,
      warranties,
      products,
      stock_movements: tables.stock_movements ?? [],
      customers,
      suppliers,
      owners: tables.owners ?? [],
      employees: tables.employees ?? [],
      bank_accounts,
      bank_transactions: [...tables.bank_transactions ?? [], ...a2aTransactions],
      cash_transactions: tables.cash_transactions ?? [],
      expense_categories: rawExpenseCats,
      expenses,
      sales,
      sale_items,
      payments: [...tables.payments ?? [], ...actualReceives],
      purchases,
      purchase_items,
      supplier_payments: [...tables.supplier_payments ?? [], ...actualPays],
      estimates: tables.estimates ?? [],
      estimate_items: tables.estimate_items ?? [],
      returns: tables.returns ?? tables.return_items ?? [],
      damages: tables.damages ?? []
    };
    saveStore(updatedStore);
    res.json({
      ok: true,
      truncated,
      tablesImported: tableNames.length,
      counts: {
        products: updatedStore.products.length,
        categories: updatedStore.categories.length,
        brands: updatedStore.brands.length,
        customers: updatedStore.customers.length,
        suppliers: updatedStore.suppliers.length,
        sales: updatedStore.sales.length,
        purchases: updatedStore.purchases.length,
        payments: updatedStore.payments.length + updatedStore.supplier_payments.length,
        bankAccounts: updatedStore.bank_accounts.length
      }
    });
  });
  app.post("/api/backup/clear", (_req, res) => {
    const current = getStore();
    const cleared = {
      ...current,
      categories: [],
      brands: [],
      units: [],
      warranties: [],
      products: [],
      stock_movements: [],
      customers: [],
      suppliers: [],
      owners: [],
      employees: [],
      bank_accounts: [],
      bank_transactions: [],
      cash_transactions: [],
      expense_categories: [],
      expenses: [],
      sales: [],
      sale_items: [],
      payments: [],
      purchases: [],
      purchase_items: [],
      supplier_payments: [],
      estimates: [],
      estimate_items: [],
      returns: [],
      damages: []
    };
    saveStore(cleared);
    res.json({ ok: true });
  });
  const laravelRoot = path2.resolve(process.cwd(), "laravel");
  app.get("/api/laravel/tree", (_req, res) => {
    const files = collectFiles(laravelRoot, laravelRoot);
    res.json({ files });
  });
  app.get("/api/laravel/file", (req, res) => {
    const rel = String(req.query.path ?? "");
    const target = path2.resolve(laravelRoot, rel);
    if (!target.startsWith(laravelRoot + path2.sep) || !fs2.existsSync(target) || fs2.statSync(target).isDirectory()) {
      res.status(404).json({ error: "File not found." });
      return;
    }
    const stats = fs2.statSync(target);
    if (stats.size > 35e4) {
      res.json({ path: rel, content: `/* Large SQL file (${(stats.size / 1024).toFixed(1)} KB) \u2014 included in ZIP download */` });
      return;
    }
    res.json({ path: rel, content: fs2.readFileSync(target, "utf8") });
  });
  app.get("/api/laravel/download-zip", async (_req, res) => {
    const zip = new JSZip();
    const files = collectFiles(laravelRoot, laravelRoot);
    const seen = /* @__PURE__ */ new Set();
    for (const rel of files) {
      if (rel === "database/sql/youthits_pos.sql" || rel === "database/youthit_pos_database.sql") {
        continue;
      }
      const full = path2.join(laravelRoot, rel);
      zip.file(`youthit-pos-laravel/${rel}`, fs2.readFileSync(full));
      seen.add(rel);
    }
    const rootPublic = path2.resolve(process.cwd(), "public");
    for (const publicRel of collectFiles(rootPublic, rootPublic)) {
      const targetRel = `public/${publicRel}`;
      if (!seen.has(targetRel)) {
        zip.file(`youthit-pos-laravel/${targetRel}`, fs2.readFileSync(path2.join(rootPublic, publicRel)));
        seen.add(targetRel);
      }
    }
    const sqlDump = generateMysqlDumpSql(getStore());
    zip.file("youthit-pos-laravel/database/sql/youthits_pos.sql", sqlDump);
    zip.file("youthit-pos-laravel/database/youthit_pos_database.sql", sqlDump);
    zip.file("youthit-pos-laravel/HOSTING_UPLOAD_GUIDE.md", buildHostingUploadGuide());
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="youthit-pos-laravel-13.zip"');
    res.send(buffer);
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  app.use("/api", (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  });
  const distPath = path2.resolve(process.cwd(), "dist");
  const distIndexExists = fs2.existsSync(path2.join(distPath, "index.html"));
  const runningCompiledServer = path2.basename(process.argv[1] || "") === "server.js";
  const hasViteInstalled = fs2.existsSync(path2.resolve(process.cwd(), "node_modules/vite/package.json"));
  const useProductionDist = process.env.NODE_ENV === "production" || runningCompiledServer && distIndexExists || !hasViteInstalled && distIndexExists;
  if (!useProductionDist) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Youth IT POS server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
