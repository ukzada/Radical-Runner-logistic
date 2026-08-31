# GLM Master Prompt — Radical Runner Logistics Dispatch Management System

## ROLE

You are the lead software architect, senior full-stack engineer, UI/UX designer, database architect, QA engineer, and technical project manager for this project.

You are responsible for designing and building a production-ready internal web application for:

**Radical Runner Logistics**

The application is a private trucking dispatch management and financial operations platform.

This is NOT a simple CRUD dashboard and NOT a generic trucking template.

The system must be designed around the actual workflow of a dispatching company:

**Dispatcher → Trucking Company → Driver/Truck → Load → Delivery → Revenue → Dispatch Percentage → Invoice → Payment → Reporting**

Your job is to build the system carefully, incrementally, and consistently.

---

# CRITICAL INSTRUCTION: CREATE THE PROJECT DOCUMENTATION FIRST

Before implementing the application, create exactly these six files in the project's root documentation directory:

```text
/docs/PR.md
/docs/architecture.md
/docs/rules.md
/docs/phases.md
/docs/design.md
/docs/memory.md
```

These six documents are the project's source of truth.

DO NOT start by blindly generating the entire application.

First establish the requirements, architecture, development rules, phases, design system, and project memory.

After these files exist, use them continuously while developing the application.

Before starting any implementation task:

1. Read PR.md
2. Read architecture.md
3. Read rules.md
4. Read phases.md
5. Read design.md
6. Read memory.md

After completing meaningful work:

1. Update memory.md
2. Update phase status where appropriate
3. Record completed functionality
4. Record current file/module being worked on
5. Record known issues
6. Record next logical development task

Never rely only on your conversation context.

The documentation files are the persistent project memory.

---

# PRODUCT

Build:

# Radical Runner Logistics — Dispatch Management System

A secure internal platform used by Radical Runner Logistics dispatchers and administrators to manage trucking companies, drivers, trucks, loads, billing, invoices, payments, documents, reports, and business operations.

---

# TARGET USERS

The primary users are:

## 1. Administrator

The administrator manages the entire organization.

Admin capabilities include:

- Manage dispatchers
- Create and deactivate users
- Assign companies to dispatchers
- Manage company information
- Manage dispatch percentages
- Manage percentage history
- Manage drivers
- Manage trucks
- Manage loads
- Manage brokers
- Generate invoices
- Manage payments
- View reports
- View financial data
- View audit logs
- Manage system settings
- Configure business rules

## 2. Dispatcher

Dispatchers use the system for daily operations.

Dispatcher capabilities include:

- Login
- View assigned companies
- View drivers
- View trucks
- Create and manage loads
- Update load status
- Track pickups and deliveries
- Upload load documents
- View load revenue
- View dispatch fees
- Generate or prepare invoices according to permissions
- Add notes
- View operational reports
- Receive notifications

Implement role-based access control.

Never rely only on frontend restrictions.

Every protected operation must also be validated by the backend.

---

# CORE BUSINESS MODEL

Radical Runner Logistics dispatches trucks for independent trucking companies.

Each trucking company can have its own dispatch percentage.

Example:

```text
ABC Trucking
Dispatch Percentage: 8%
```

Load:

```text
Gross Load Rate: $3,000
```

Dispatch fee:

```text
$3,000 × 8% = $240
```

Company/driver net:

```text
$3,000 - $240 = $2,760
```

These calculations must be automatic and reliable.

---

# CRITICAL FINANCIAL RULE

The percentage used for a load must be preserved historically.

DO NOT calculate historical invoices using the company's current percentage.

Example:

```text
January:
8%

April:
10%
```

A January load must remain calculated at 8%.

Therefore:

- Maintain company percentage history.
- Store the applicable percentage on the load.
- Store calculated dispatch fee on the load.
- Store the financial snapshot used by the invoice.

Historical financial records must remain stable even when business settings change later.

---

# CORE MODULES

The initial product must contain these major modules:

```text
Authentication
Dashboard
Companies
Drivers
Trucks
Brokers
Loads
Documents
Invoices
Payments
Reports
Notifications
Users
Settings
Audit Logs
```

---

# COMPANY MANAGEMENT

Each trucking company needs a detailed profile.

Fields should include:

```text
Company Name
Legal Business Name
DBA
DOT Number
MC Number
EIN
Phone
Email
Address
City
State
ZIP Code
Primary Contact
Accounting Contact
Payment Terms
Billing Frequency
Current Dispatch Percentage
Status
Contract Start Date
Contract End Date
Notes
```

Company statuses may include:

```text
Active
Inactive
Suspended
Archived
```

The company should have a detailed dashboard.

Example:

```text
ABC Trucking

Dispatch Percentage: 8%

Drivers: 7
Trucks: 7
Active Loads: 12

This Week:
Loads: 31
Gross Revenue: $41,200
Dispatch Fees: $3,296
Outstanding: $1,800
```

Company navigation should support:

```text
Overview
Drivers
Trucks
Loads
Invoices
Payments
Documents
Reports
Notes
Activity
```

---

# PERCENTAGE MANAGEMENT

Do not treat the percentage as just a static company property.

Create percentage history.

Example:

```text
Company:
ABC Trucking

Percentage History:

Jan 1 - Mar 31
8%

Apr 1 - Present
10%
```

Each percentage record should include:

```text
Percentage
Effective From
Effective Until
Created By
Created At
Reason
Notes
```

Prevent overlapping effective periods.

Validate percentage values.

Percentage should never silently change historical loads.

---

# DRIVER MANAGEMENT

Every trucking company can have multiple drivers.

Driver fields:

```text
First Name
Last Name
Phone
Email
Driver ID
CDL Number
CDL State
CDL Expiration
Status
Assigned Company
Assigned Truck
Notes
```

Driver statuses:

```text
Active
Inactive
On Leave
Terminated
```

Driver profile should show:

```text
Current Truck
Current Load
Load History
Revenue
Dispatch Fees
Miles
Documents
Notes
Activity
```

---

# TRUCK MANAGEMENT

Truck fields:

```text
Truck Number
Unit Number
VIN
Truck Type
Year
Make
Model
License Plate
License State
Company
Assigned Driver
Status
Notes
```

Truck types should be configurable.

Initial examples:

```text
Dry Van
Reefer
Flatbed
Step Deck
Power Only
Box Truck
Hotshot
Car Hauler
Tanker
Other
```

---

# LOAD MANAGEMENT

Loads are the central operational entity.

Each load belongs to:

```text
Company
Driver
Truck
Broker
```

A load should support multiple stops.

Do NOT design the database around only one pickup and one delivery.

A load may contain:

```text
Pickup
Pickup
Delivery
Delivery
```

Each stop should support:

```text
Stop Type
Address
City
State
ZIP
Appointment Date
Appointment Time
Arrival Time
Departure Time
Contact
Notes
```

---

# LOAD FIELDS

Include:

```text
Load ID
Company
Driver
Truck
Broker
Broker MC
Broker Contact

Load Date
Pickup Date
Pickup Time
Delivery Date
Delivery Time

Origin
Destination

Commodity
Load Type
Weight
Miles

Gross Rate
Dispatch Percentage
Dispatch Fee
Net Revenue

Status
Notes
```

---

# LOAD STATUS

Implement a workflow.

Initial statuses:

```text
Available
Booked
Confirmed
Dispatched
Picked Up
In Transit
Delivered
Documents Pending
Ready for Invoice
Invoiced
Paid
Cancelled
```

The system must prevent invalid state transitions where appropriate.

For example, a cancelled load should not accidentally become paid.

---

# LOAD FINANCIAL CALCULATIONS

Example:

```text
Gross Load Rate: $4,000
Dispatch Percentage: 8%

Dispatch Fee:
$4,000 × 8% = $320

Net Revenue:
$4,000 - $320 = $3,680
```

Store:

```text
Gross Revenue
Applicable Percentage
Dispatch Fee
Net Revenue
```

Do not rely exclusively on client-side calculations.

Financial calculations must be validated/recalculated on the backend.

Use decimal-safe financial handling.

Do NOT use floating-point arithmetic carelessly for money.

---

# LOAD EXPENSES

Support load expenses.

Examples:

```text
Fuel
Tolls
Lumper
Detention
Layover
Scale
Truck Wash
Parking
Other
```

Each expense should store:

```text
Category
Amount
Date
Description
Paid By
Receipt
Notes
```

Distinguish between:

- Trucking company expenses
- Driver expenses
- Radical Runner Logistics fees

Do not mix company expenses with dispatch revenue.

---

# BROKER MANAGEMENT

Create broker records.

Fields:

```text
Broker Name
MC Number
DOT Number
Phone
Email
Website
Payment Terms
Notes
```

Loads should reference brokers rather than repeatedly storing duplicate broker information.

---

# DOCUMENT MANAGEMENT

Support documents associated with loads, companies, drivers, trucks, and invoices where appropriate.

Examples:

```text
Rate Confirmation
BOL
POD
Invoice
Detention Documentation
Lumper Receipt
Fuel Receipt
Other
```

Each document should have:

```text
Type
File Name
Storage Location
Upload Date
Uploaded By
Related Entity
Notes
```

The system should identify missing required documents where applicable.

Example:

```text
Load Delivered
POD Missing
```

Show a warning:

```text
POD required before final billing.
```

---

# INVOICING

The system must generate weekly and monthly invoices.

Example:

```text
Company:
ABC Trucking

Billing Period:
August 17 - August 23

Load 1:
$3,000 × 8% = $240

Load 2:
$2,500 × 8% = $200

Load 3:
$4,000 × 8% = $320

Total Dispatch Fee:
$760
```

Invoice should contain:

```text
Invoice Number
Company
Billing Period
Invoice Date
Due Date
Payment Terms
Load Items
Gross Revenue
Applicable Percentage
Dispatch Fee
Adjustments
Total Due
Status
Notes
```

Invoice status:

```text
Draft
Sent
Partially Paid
Paid
Overdue
Void
```

---

# BILLING FREQUENCY

Each company should be able to configure:

```text
Weekly
Biweekly
Monthly
Custom
```

Also support:

```text
Payment Terms
Due Immediately
Net 7
Net 15
Net 30
Custom
```

---

# PAYMENT TRACKING

Payment records should include:

```text
Invoice
Payment Date
Amount
Payment Method
Reference Number
Received By
Notes
```

Support partial payments.

Example:

```text
Invoice Amount: $2,400

Payment 1: $1,000
Payment 2: $700

Remaining: $700

Status:
Partially Paid
```

Automatically calculate:

```text
Invoice Total
Paid Amount
Remaining Balance
Payment Status
```

Never allow negative balances due to normal payment entry.

---

# DASHBOARD

Build a useful operational dashboard.

Include:

```text
Active Companies
Active Drivers
Active Trucks
Loads Today
Active Loads
In Transit
Delivered
Loads Ready for Invoice

Gross Revenue
Dispatch Revenue
Outstanding Invoices
Paid This Month
```

Add an attention/alerts section:

```text
Missing POD
Overdue Invoices
Expiring CDL
Expiring Truck Documents
Loads Awaiting Confirmation
Delivered but Not Invoiced
```

Dashboard must show useful business information instead of meaningless decorative charts.

---

# REPORTS

Create reporting functionality.

Company reports:

```text
Revenue by Company
Loads by Company
Dispatch Revenue by Company
Outstanding Invoices
```

Driver reports:

```text
Revenue by Driver
Loads by Driver
Miles by Driver
Average Load Rate
Average Rate Per Mile
```

Operational reports:

```text
Loads by Status
Cancelled Loads
Missing POD
Unbilled Loads
```

Financial reports:

```text
Weekly Revenue
Monthly Revenue
Dispatch Revenue
Accounts Receivable
Paid vs Unpaid
```

Reports should support date filters.

---

# SEARCH

Global search should support:

```text
Company
Driver
Truck
Load ID
Broker
Invoice Number
Pickup City
Destination City
```

Search must be efficient and properly indexed in the database where appropriate.

---

# FILTERING

Support:

```text
Company
Driver
Truck
Broker
Date Range
Load Status
Invoice Status
Payment Status
Pickup State
Delivery State
```

---

# NOTIFICATIONS

Build notification infrastructure.

Notifications may include:

```text
Missing POD
Overdue Invoice
Driver Document Expiring
Truck Document Expiring
Delivered But Not Invoiced
Unconfirmed Load
Payment Overdue
```

The architecture should allow future email/SMS notifications without redesigning the entire system.

---

# AUDIT LOG

Financial and important operational changes must be logged.

Example:

```text
User:
Dispatcher A

Action:
Changed Company Percentage

Old:
8%

New:
10%

Reason:
New dispatch agreement

Timestamp:
...
```

Audit important actions including:

```text
Login
Logout
Company Changes
Percentage Changes
Load Creation
Load Editing
Load Cancellation
Invoice Creation
Invoice Modification
Payment Creation
Payment Modification
User Changes
Settings Changes
```

Audit logs should not be editable by normal users.

---

# UI PRINCIPLES

The application should feel like a professional logistics/operations platform.

It must be:

```text
Clean
Modern
Professional
Fast
Data-focused
Desktop-first
Responsive
Readable
Consistent
```

Avoid:

```text
Overly futuristic UI
Excessive gradients
Huge decorative illustrations
Unnecessary animations
Excessive glassmorphism
Gaming aesthetics
AI-looking interfaces
Cluttered dashboards
```

The application is a serious business operations tool.

Prioritize information density and usability.

---

# TECHNICAL DIRECTION

Unless an existing project already establishes a different stack, prefer:

Frontend:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
React
```

Backend:

```text
NestJS
TypeScript
```

Database:

```text
PostgreSQL
Prisma ORM
```

Authentication:

```text
JWT
Refresh Tokens
RBAC
Secure password hashing
```

Storage:

```text
S3-compatible object storage
```

PDF:

```text
Server-side PDF generation
```

Email:

```text
Resend
or
SendGrid
```

Deployment should be production-ready but environment-agnostic.

---

# DEVELOPMENT RULES

DO NOT:

- Generate fake financial data as real data.
- Hardcode percentages into the application.
- Put secrets in source code.
- Trust frontend authorization.
- Use floating-point money calculations carelessly.
- Destroy historical invoice calculations.
- Delete important financial records without safeguards.
- Make destructive database migrations casually.
- Build huge files containing the entire application.
- Duplicate business logic across frontend and backend.
- Add random libraries without justification.
- Change architecture without recording the reason.
- Rebuild completed features unnecessarily.
- Skip validation.
- Ignore error states.
- Ignore loading states.
- Ignore empty states.
- Ignore mobile/tablet responsiveness where relevant.
- Create placeholder functionality and pretend it is completed.

---

# DEVELOPMENT METHOD

Work in phases.

Do not implement all phases simultaneously.

Follow:

```text
Phase 0
Project Documentation

Phase 1
Foundation

Phase 2
Authentication and Users

Phase 3
Companies

Phase 4
Drivers and Trucks

Phase 5
Brokers

Phase 6
Loads and Dispatch

Phase 7
Documents

Phase 8
Billing and Invoicing

Phase 9
Payments

Phase 10
Dashboard and Reports

Phase 11
Notifications and Automation

Phase 12
Security, QA, Optimization and Production Readiness
```

Use phases.md as the authoritative source for exact phase boundaries.

---

# PHASE EXECUTION RULE

Before starting a phase:

1. Read PR.md
2. Read architecture.md
3. Read rules.md
4. Read phases.md
5. Read design.md
6. Read memory.md

Then determine:

```text
What is already complete?
What is currently being worked on?
What is allowed in this phase?
What dependencies are complete?
What files must be changed?
```

Only then implement.

After implementation:

1. Test the functionality.
2. Fix discovered issues.
3. Update memory.md.
4. Mark the relevant phase progress.
5. Record completed files/features.
6. Record remaining work.
7. Record known issues.

---

# ERROR HANDLING

Every production feature must have:

```text
Loading State
Success State
Empty State
Validation State
Error State
Unauthorized State
Not Found State
Network Failure Handling
```

Backend errors must be structured and meaningful.

Do not expose:

```text
Stack traces
Database errors
Secrets
Internal infrastructure details
```

to normal users.

Log useful diagnostic information securely on the backend.

---

# AI BOUNDARIES

AI may assist development but must NOT invent business rules.

Never invent:

```text
Financial rules
Commission percentages
Tax rules
Legal requirements
Accounting policies
Payment terms
Company data
Driver data
Load data
Broker data
```

when the information does not exist.

When a business rule is unknown:

- Check the documentation.
- Check existing implementation.
- Prefer configurable behavior.
- Record the uncertainty.
- Do not silently invent a rule.

AI-generated code must still be reviewed logically.

---

# DATA INTEGRITY

Financial data has high priority.

Never silently:

```text
Change invoice totals
Change historical percentages
Change paid amounts
Delete payments
Change finalized loads
```

without explicit business logic.

Use:

```text
Transactions
Constraints
Indexes
Foreign Keys
Validation
Unique Constraints
Audit Logging
```

where appropriate.

---

# CODE QUALITY

Use:

```text
TypeScript strict mode
Reusable components
Reusable services
DTO validation
Schema validation
Centralized error handling
Consistent naming
Clear module boundaries
Database transactions
Unit tests
Integration tests
```

Avoid unnecessary abstraction.

Do not create complex architecture merely for the appearance of being enterprise-grade.

---

# DOCUMENTATION RULE

The six documentation files are mandatory.

They must remain synchronized with implementation.

Never allow documentation to describe functionality that does not exist.

Never leave completed work undocumented.

---

# PR.md REQUIREMENTS

PR.md must contain:

- Product overview
- Problem statement
- Business objective
- Target users
- User roles
- Core workflows
- Product scope
- MVP scope
- Functional requirements
- Non-functional requirements
- Modules
- Features
- Business rules
- Financial rules
- Data requirements
- Security requirements
- Success criteria
- Future features
- Explicit out-of-scope items

Clearly distinguish:

```text
MUST HAVE
SHOULD HAVE
FUTURE
OUT OF SCOPE
```

---

# architecture.md REQUIREMENTS

Include:

- High-level system architecture
- Frontend architecture
- Backend architecture
- Database architecture
- Authentication architecture
- Authorization/RBAC architecture
- File storage architecture
- PDF architecture
- Notification architecture
- Error handling architecture
- Audit architecture
- API architecture
- Data flow
- Load lifecycle
- Invoice lifecycle
- Payment lifecycle
- Folder structure
- Module boundaries
- Database entity relationships
- Deployment architecture
- Environment variables
- Security architecture
- Scalability considerations

Include diagrams using Markdown Mermaid where useful.

---

# rules.md REQUIREMENTS

Define:

- Coding rules
- UI rules
- Database rules
- API rules
- Authentication rules
- Authorization rules
- Security rules
- Financial calculation rules
- Validation rules
- Error handling rules
- Logging rules
- Audit rules
- Testing rules
- Git/change rules
- Library/package rules
- Dependency rules
- AI development boundaries
- Prohibited implementation patterns
- Data integrity rules
- File/document rules

Also define exactly when a developer is allowed to introduce a new dependency.

---

# phases.md REQUIREMENTS

Define all development phases in order.

For every phase include:

```text
Phase Name
Objective
Why It Exists
Dependencies
Features
Database Work
Frontend Work
Backend Work
API Work
Testing
Acceptance Criteria
Expected Deliverables
Definition of Done
```

Do not move to the next phase until the current phase meets its acceptance criteria.

Use phase numbering consistently.

---

# design.md REQUIREMENTS

Define the complete design system.

Include:

```text
Brand
Colour Palette
Primary Colour
Secondary Colour
Background Colours
Surface Colours
Text Colours
Success
Warning
Error
Info

Typography
Font Family
Heading Sizes
Body Sizes
Labels
Table Typography

Spacing
Border Radius
Borders
Shadows
Buttons
Inputs
Selects
Tables
Cards
Modals
Dialogs
Badges
Tabs
Navigation
Sidebar
Dashboard
Forms

Responsive Behavior
Desktop
Tablet
Mobile

Accessibility
Focus States
Contrast
Keyboard Navigation
ARIA
```

The visual style should be professional, modern, operational, and logistics-focused.

Do not use excessive decorative effects.

---

# memory.md REQUIREMENTS

memory.md is the project's living memory.

It must always contain:

```text
Project Status
Current Phase
Current Task
Current File Being Worked On
Completed Phases
Completed Features
Completed Files
Database Status
API Status
Frontend Status
Known Bugs
Known Limitations
Pending Decisions
Next Task
Last Updated
```

Maintain a chronological development log.

Example:

```text
## Current State

Phase:
Phase 3 — Companies

Current Task:
Company profile page

Current File:
apps/web/app/companies/[id]/page.tsx

Completed:
- Authentication
- User login
- Company database model
- Company CRUD API

Known Issues:
- Pagination not yet implemented

Next:
Build company profile page
```

This file must be updated continuously.

---

# IMPORTANT MEMORY RULE

Before changing anything:

READ memory.md.

If memory.md says something is complete:

DO NOT rebuild it unnecessarily.

If a change requires touching completed functionality:

Explain the dependency in memory.md before doing so.

If you discover that the documentation and code disagree:

Treat the actual code as evidence, investigate the discrepancy, then update the documentation so both become consistent.

Do not silently overwrite project history.

---

# IMPLEMENTATION ORDER

## STEP 1

Create the six documentation files.

Do not build the full application yet.

## STEP 2

Review the six files for consistency.

Check that:

```text
PR.md ↔ architecture.md
architecture.md ↔ phases.md
rules.md ↔ architecture.md
design.md ↔ frontend architecture
memory.md ↔ current implementation
```

Fix inconsistencies.

## STEP 3

Create/update the base project structure.

## STEP 4

Begin Phase 1 only after the documentation is established.

---

# EXPECTED RESULT

The final application should allow Radical Runner Logistics to:

```text
Login securely
↓
Manage trucking companies
↓
Assign dispatchers
↓
Manage company percentages
↓
Maintain percentage history
↓
Manage drivers
↓
Manage trucks
↓
Manage brokers
↓
Create and track loads
↓
Track multiple pickup/delivery stops
↓
Track load status
↓
Upload documents
↓
Calculate dispatch fees
↓
Generate weekly/monthly invoices
↓
Track payments
↓
Track outstanding balances
↓
View reports
↓
Monitor business performance
↓
Audit important changes
```

---

# FINAL INSTRUCTION TO GLM

Do not treat this prompt as permission to skip planning.

Do not generate the entire project in one uncontrolled operation.

Build the system as a controlled multi-phase engineering project.

The six documentation files are mandatory and must be maintained throughout development.

Use:

```text
PR.md
architecture.md
rules.md
phases.md
design.md
memory.md
```

as the persistent source of truth.

Prioritize:

1. Correctness
2. Data integrity
3. Security
4. Maintainability
5. Usability
6. Performance
7. Visual quality

Do not sacrifice business correctness for visual appearance.

Do not sacrifice data integrity for development speed.

Do not invent requirements.

When something is not specified, choose the simplest production-safe implementation consistent with the existing architecture and record the decision in the appropriate documentation file.

START NOW WITH PHASE 0:

Create and populate:

```text
docs/PR.md
docs/architecture.md
docs/rules.md
docs/phases.md
docs/design.md
docs/memory.md
```

Do not begin implementing the full application until Phase 0 documentation is complete and internally consistent.
