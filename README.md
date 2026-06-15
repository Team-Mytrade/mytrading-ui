# MyTrade ERP Frontend

Enterprise Resource Planning (ERP) platform built using **React + Vite** with a **Java Spring Boot Microservices** backend.

The platform manages multiple business domains through a role-based access control (RBAC) system, including:

* CRM
* Sales
* Inventory Management
* Purchase & Procurement
* Delivery & Returns
* HRMS & Payroll
* User Management
* RBAC & Permissions

---

## Technology Stack

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* React Router
* Axios

### Backend

* Java Spring Boot
* Microservices Architecture
* REST APIs
* JWT Authentication

---

## Getting Started

### Install Dependencies

```bash
npm install

# or

yarn install
```

> Some packages may cause peer dependency issues when using React 18.
>
> If installation fails, use:

```bash
npm install --legacy-peer-deps
```

### Start Development Server

```bash
npm run dev

# or

yarn dev
```

### Build Application

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Environment Configuration

Create a `.env` file in the project root.

Example:

```env
VITE_API_URL=http://localhost:8080
```

The frontend communicates with backend services through configured proxy URLs.

---

# Git Workflow

## Branch Strategy

Never commit directly to `main`.

### Available Branches

```text
main        → Production
develop     → Development Integration
feature/*   → New Features
bugfix/*    → Bug Fixes
hotfix/*    → Production Hot Fixes
```

Examples:

```text
feature/crm-leads-management
feature/inventory-item-master
bugfix/login-validation
hotfix/token-refresh
```

---

## Mandatory Development Process

Before starting any new task:

### Step 1: Update Task Status

Move the assigned task status to:

```text
In Progress
```

in the project tracker.

### Step 2: Pull Latest Changes

```bash
git checkout develop
git pull origin develop
```

### Step 3: Create New Branch

Create a dedicated branch for the task.

```bash
git checkout -b feature/module-task-name
```

Example:

```bash
git checkout -b feature/crm-customer-list
```

### Step 4: Start Development

Develop only within the created branch.

### Step 5: Push Changes

```bash
git push origin feature/crm-customer-list
```

### Step 6: Create Pull Request

Create a Pull Request against:

```text
develop
```

branch.

### Step 7: Code Review

Pull Requests must be reviewed and approved before merging.

### Step 8: Update Task Status

Once PR is approved:

```text
Code Review
```

After merge:

```text
Done
```

---

# Commit Message Convention

Use meaningful commit messages.

### Feature

```text
feat(crm): add customer listing page
```

### Bug Fix

```text
fix(auth): handle token expiration
```

### Refactor

```text
refactor(shared): optimize table component
```

### UI Changes

```text
style(inventory): improve item card layout
```

---

# Pull Request Checklist

Before creating a PR ensure:

* [ ] Latest develop branch merged
* [ ] Build passes successfully
* [ ] No console errors
* [ ] No unused imports
* [ ] Code formatted properly
* [ ] Responsive behavior verified
* [ ] API integrations tested
* [ ] Task status updated

---

# Team Rules

## Task Ownership

* One task = One owner
* Do not work on tasks assigned to others without approval
* Update task status regularly

## Branch Rules

* Create a new branch for every task
* Never reuse old branches
* Never push directly to `main`
* Never push directly to `develop`

## Code Quality

* Use reusable components whenever possible
* Follow existing folder structure
* Avoid duplicate code
* Keep components modular
* Follow project naming conventions

## Communication

If blocked for more than 30 minutes:

* Update task status as `Blocked`
* Notify the team lead
* Mention blocker details

---

# Daily Update Format

Every team member should share:

```text
Yesterday:
- Completed task(s)

Today:
- Working on task(s)

Blockers:
- Any blockers or dependencies
```

---

# Project Modules

## CRM

* Leads
* Customers
* Opportunities
* Quotations

## Sales

* Sales Orders
* Deliveries
* Invoices

## Inventory

* Items
* Warehouses
* Stock Management

## Procurement

* Purchase Requests
* Purchase Quotations
* Purchase Orders

## HRMS

* Employees
* Attendance
* Payroll

## Administration

* Users
* Roles
* Permissions
* RBAC

---

# Maintainers

Frontend Team

* Frontend Lead
* Frontend Developer 1
* Frontend Developer 2

Backend Team

* Backend Lead
* Backend Developer 1
* Backend Developer 2

---

## Important

Before starting any task:

1. Assign the task to yourself.
2. Move task status to **In Progress**.
3. Pull latest `develop`.
4. Create a new branch.
5. Develop.
6. Raise PR.
7. Get review approval.
8. Merge into `develop`.

**No development should begin without a dedicated branch and task status update.**
