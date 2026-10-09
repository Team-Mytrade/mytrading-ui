# Flow Changes

## 2026-10-06

- Every Purchase Requisition now exposes the Create Purchase Order cart action; conversion is no longer restricted by a requisition status displayed in the list.

## 2026-10-03

- Purchase Order approval is now performed from the Status dropdown on the Purchase Orders list. The separate Approval submodule and its routes have been removed; only approved purchase orders are available when creating a Goods Receipt Note.

## 2026-09-28

- Vendor, Category, and Product management now live under the Product Catalogue sidebar module in that order. Their previous URLs redirect to the new module routes so existing bookmarks continue to work.

- Purchase operations now follow the Purchase Service flow: Purchase Requisition, Purchase Order, Approval, then Goods Receipt Note. Previous purchase URLs redirect to the corresponding new routes.

- Purchase Requisitions now collect request and required dates, remarks, requester ID, and inline product quantities in one submission instead of creating product line items in a separate step.

- Approved Purchase Requisitions now provide a Create Purchase Order action that opens Purchase Orders with that requisition and its line items preselected. Requisition status can be updated directly from the list.

## 2026-09-23

- The shared table-toolbar Share action now opens the export dialog for its associated table, while Refresh keeps users on the page and shows a table loading skeleton.

- Selecting a product from an inventory record now opens Products scoped to that product, with a return option for the full list.

- Selecting a user from Service Schedule Notify or Service Schedules now opens the filtered Users section in Role Configuration.

- On mobile, Role Configuration setup areas now open as an anchored dropdown instead of expanding the setup panel into a grid.

## 2026-09-21

- Selecting a segment's customer count now opens Customer Management scoped to that segment; users can return to the complete customer list from the scoped view.

- Selecting a named customer in Communication History now opens Customer Management scoped to that customer.

- Selecting a named lead in Communication History now opens the Leads submodule scoped to that lead.

- Selecting a sales person in Sales Targets now opens the Sales Persons submodule scoped to that person.

- Selecting a sales person in Quotations now opens the Sales Persons submodule scoped to that person.

- Selecting a customer in Quotations now opens Customer Management scoped to that customer.

- Selecting a customer or channel in Sales Orders now opens the respective Customer Management or Sales Channels submodule scoped to that record.

- Selecting a warehouse in Batch Management now opens the Warehouses submodule scoped to that warehouse.

- Selecting a warehouse or product in Inventory Reservations now opens the respective Warehouses or Products submodule scoped to that record.

- Selecting a vendor in Purchase Orders now opens the Vendors submodule scoped to that vendor.

## 2026-09-17

- Role Directory now paginates assignments based on available viewport height, with Previous/Next navigation and page reset when search or role filters change.

- Create access now permits selection of every sidebar module in the local assignment UI. Only each module’s arrow opens or closes its submodules; checking a module selects all children without opening the panel.

- Roles & Permissions creation now progresses through role selection, user/parent selection, and module/submodule permissions. Back returns to earlier steps; selecting a module selects all its submodules with individual overrides.

## 2026-08-23

- Added two administrator-only Profile submodules: Create User (`/role_config`) and Role (`/rolesPermissions`).

## 2026-09-08

- CRM Deals row selection now opens a right-side detail drawer instead of navigating to a separate record page.

## 2026-09-09

- Selecting a module from the compact sidebar rail now opens its adjacent submodule panel for page selection.

## 2026-10-09

- Product Categories now includes an Add Product row action that opens the Product Catalogue create flow with the selected category prefilled.
