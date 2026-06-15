export const USER_ROLES = {

    ADMIN: 'ADMIN',
    DISTRIBUTOR: 'DISTRIBUTOR',
    SALES: 'SALES',
    CUSTOMER: 'CUSTOMER',
    WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
    FINANCE_OFFICER: 'FINANCE_OFFICER',
    MANAGER: 'MANAGER',
} as const;

export const APP_LABELS = {
    TITLE: 'My Trading App',
    FOOTER: '© 2025 All rights reserved',
    VERSION: '1.0.0',
    COPYRIGHT: '© 2025 My Trading App',
    COMPANY: 'My Trading App Inc.',
    SUPPORT_EMAIL: 'support@mytradingapp.com',
    CONTACT_NUMBER: '+91 123 456 7890',
    ADDRESS: 'my address, City, Country',

} as const;

export const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  IND: "₹",
  AED: "د.إ",
  QAR: "ر.ق",

}as const;

export const CUSTOMER_UTILS = {
  CURRENCY: "₹",
  ICON: "./images/logo/logo.png",
  ICON_D:"./images/logo/logo-dark.svg"

}as const;