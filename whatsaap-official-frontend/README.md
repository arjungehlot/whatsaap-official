# Flow Connect

Build a modern, production-quality SaaS frontend for a WhatsApp automation and messaging platform.

IMPORTANT:
For this phase, build ONLY the frontend UI/UX and frontend routing.

Do NOT build:

Backend

Database

Supabase

WhatsApp API integration

Baileys integration

Real authentication

Real message sending

Real campaign execution

Real automation execution

Real API calls

Use realistic mock data and mock states so the entire application feels functional and can be clicked through.

The backend will later be built separately using Node.js, Express, MongoDB and Baileys. The frontend should therefore be structured cleanly so REST/WebSocket APIs can easily be connected later.

==================================================

PRODUCT CONCEPT
==================================================

This is a SaaS platform that allows users to connect their WhatsApp account and manage WhatsApp messaging automation from a web dashboard.

Main flow:

Landing Page
→ Register
→ Login
→ Dashboard
→ Connect WhatsApp
→ WhatsApp account connected
→ Manage contacts
→ Create message templates
→ Create campaigns
→ Send messages
→ Manage automations
→ Monitor campaign results
→ View message logs
→ Analytics

The product should feel like a serious B2B SaaS product, not a simple admin panel.

Think of the UX quality of products such as:

Intercom

Brevo

HubSpot

WATI

Respond.io

Manychat

But create an original design. Do not copy their UI.

==================================================
2. DESIGN DIRECTION

Create a clean, premium, modern SaaS dashboard.

Design characteristics:

Minimal

Professional

Fast-looking

Spacious

Highly readable

Modern cards

Subtle borders

Soft shadows

Rounded corners

Excellent typography

Strong visual hierarchy

Responsive

Desktop-first but fully responsive on tablet/mobile

Use a primarily light interface.

Suggested visual direction:

Background:

Very light gray / off-white

Primary:

Deep green / WhatsApp-inspired green, but do not overuse WhatsApp branding

Secondary:

Dark charcoal

Cards:

White

Thin subtle borders

Small radius, approximately 10-14px

Success:

Green

Warning:

Amber

Error:

Red

Info:

Blue

Typography:

Inter or a similar modern sans-serif font

Avoid:

Excessive gradients

Huge rounded cards

Excessive animations

Neon colors

Overly colorful dashboards

Generic template-looking UI

The application should look like a polished commercial SaaS product.

==================================================
3. APPLICATION STRUCTURE

Create these major areas:

PUBLIC WEBSITE

Landing page

Features

Pricing

Login

Register

Forgot Password

AUTHENTICATED APPLICATION

Dashboard

WhatsApp

Inbox

Contacts

Campaigns

Templates

Automations

Analytics

Message Logs

Billing

Settings

Use a persistent authenticated dashboard layout with:

LEFT SIDEBAR
TOP HEADER
MAIN CONTENT AREA

The sidebar should be collapsible.

==================================================
4. LANDING PAGE

Create a professional SaaS landing page.

Header:

Logo:
"WAFlow"

Navigation:

Features

How it Works

Pricing

FAQ

Right side:

Login

Get Started

Hero section:

Headline:

"Powerful WhatsApp Automation, Built for Your Business"

Subheadline:

"Connect your WhatsApp, manage contacts, create campaigns, automate conversations, and track every message from one powerful dashboard."

Primary CTA:
"Get Started Free"

Secondary CTA:
"View Demo"

Add a modern dashboard/product preview on the right side.

Sections:

Trusted / social proof section

Features

How it works

WhatsApp automation capabilities

Campaign management

Contact management

Analytics

Pricing

FAQ

Final CTA

Footer

Feature cards:

WhatsApp Connection

Campaign Management

Contact Management

Message Templates

Automations

Analytics

Message History

Team Management

==================================================
5. AUTHENTICATION UI

Create:

/login
/register
/forgot-password

Login:

Email

Password

Remember me

Forgot password

Login button

Continue with Google UI

Link to Register

Register:

Full name

Email

Password

Confirm password

Terms checkbox

Create account

After successful mock login/register:

Redirect to:

/dashboard

Use frontend-only mock authentication.

==================================================
6. DASHBOARD

Create the main dashboard at:

/dashboard

Top header:

Page title

Search

Notifications

Help

User avatar

User dropdown

Main dashboard should show:

Welcome section:

"Good morning, Kashif"

Subtitle:
"Here's what's happening with your WhatsApp automation today."

Connection status card:

"WhatsApp Connection"

Show:

Connected
WhatsApp number
+91 XXXXX XXXXX
Connection uptime
Last synced
Messages sent today

Include:

"Manage Connection"

button.

If disconnected, show a different mock state:

"WhatsApp Not Connected"

CTA:

"Connect WhatsApp"

==================================================
7. DASHBOARD KPI CARDS

Create four primary metric cards:

Messages Sent
2,481

Messages Delivered
2,341

Active Campaigns
8

Total Contacts
12,540

Each card should contain:

Icon

Value

Percentage change

Comparison with previous period

Small visual indicator

==================================================
8. DASHBOARD ANALYTICS

Create:

Messages Overview chart

Show:

Sent

Delivered

Failed

Read

Allow date filters:

Today
7 Days
30 Days
90 Days

Add another chart:

Campaign Performance

Metrics:

Sent

Delivered

Read

Failed

==================================================
9. RECENT CAMPAIGNS

Create a table:

Campaign Name
Status
Recipients
Sent
Delivered
Read
Failed
Created
Actions

Example campaigns:

Summer Sale
Running
2,500 recipients

Product Launch
Completed
5,000 recipients

Festival Offer
Scheduled
1,250 recipients

Actions:

View

Edit

Duplicate

Pause

Delete

==================================================
10. WHATSAPP CONNECTION

Create:

/whatsapp

This is one of the most important sections.

Show a connection card.

When disconnected:

Large empty-state design.

Icon:

WhatsApp

Title:

"Connect your WhatsApp"

Description:

"Connect your WhatsApp account to start sending messages and managing conversations."

Button:

"Connect WhatsApp"

When clicked, open a modal.

Connection modal:

Step 1:
"Prepare your WhatsApp"

Step 2:
"Scan QR Code"

Show a realistic mock QR code area.

Text:

"Open WhatsApp on your phone → Linked Devices → Link a Device → Scan this QR code."

Show:

QR code

Countdown:
"QR code expires in 58 seconds"

Buttons:

Refresh QR

Cancel

Also show connection states:

Connecting...
Connected
Disconnected
Connection Error
Session Expired

When connected, show:

WhatsApp Account

Profile picture
Business/person name
Phone number
Connection status
Last connected
Device information
Session status

Actions:

Reconnect

Disconnect

Refresh Status

Also create a small connection activity timeline.

IMPORTANT:

Do not implement actual WhatsApp/Baileys functionality.

Only create the UI and mock states.

==================================================
11. INBOX

Create:

/inbox

This should feel like a modern WhatsApp customer-support inbox.

Layout:

LEFT:
Conversation list

CENTER:
Selected conversation

RIGHT:
Contact information

Conversation list should contain:

Profile picture
Name
Last message
Time
Unread count
Online/offline indicator

Filters:

All

Unread

Starred

Assigned

Groups

Conversation area:

Header:
Contact name
Phone number
Online status

Message bubbles:

Incoming
Outgoing

Message composer:

Text input
Emoji button
Attachment button
Template button
Send button

Additional actions:

Mark unread

Star

Archive

Block

Contact details

Right sidebar:

Contact information
Phone
Email
Tags
Campaigns
Notes
Conversation history

==================================================
12. CONTACTS

Create:

/contacts

This should be a powerful contact management page.

Top:

"Contacts"

Description:

"Manage and organize all your WhatsApp contacts."

Buttons:

Add Contact

Import Contacts

Export

Create Segment

Stats:

Total Contacts
12,540

Active
10,421

New This Month
1,248

Blocked
82

Contact table:

Checkbox
Name
Phone
Email
Tags
Source
Status
Last Contacted
Created
Actions

Filters:

Search

Tags

Status

Source

Date Added

Bulk actions:

Add Tag

Remove Tag

Add to Campaign

Export

Delete

Create contact modal:

Name
Phone
Email
Tags
Notes

==================================================
13. CONTACT DETAILS

Create:

/contacts/:id

Show:

Contact profile

Name
Phone
Email
Profile picture

Status

Tags

Custom fields

Notes

Last contacted

Campaign history

Message history

Activity timeline

Buttons:

Send Message

Add to Campaign

Edit Contact

Delete Contact

==================================================
14. CAMPAIGNS

Create:

/campaigns

This is one of the core modules.

Header:

"Campaigns"

Buttons:

Create Campaign

Import Campaign

Stats:

Total Campaigns
Running
Scheduled
Completed
Failed

Campaign table:

Campaign
Status
Audience
Template
Scheduled
Sent
Delivered
Read
Failed
Created
Actions

Statuses:

Draft
Scheduled
Running
Paused
Completed
Failed

Actions:

View
Edit
Duplicate
Pause
Resume
Delete

==================================================
15. CREATE CAMPAIGN

Create:

/campaigns/create

Use a multi-step campaign builder.

STEP 1:
Campaign Details

Campaign name

Description

STEP 2:
Select Audience

Options:

All Contacts

Contact Segment

Tags

Upload CSV

Show audience preview:

Total recipients: 2,540

STEP 3:
Message

Choose template

OR

Create custom message

Message editor:

Text
Emoji
Variables

Variables:

{{name}}
{{phone}}
{{company}}
{{custom_field}}

Preview panel:

Show realistic WhatsApp message preview.

STEP 4:
Schedule

Options:

Send Now

Schedule for later

Date
Time
Timezone

Optional:

Rate limit / sending speed UI

STEP 5:
Review

Show:

Campaign name
Audience
Template
Recipients
Schedule
Message preview

Buttons:

Back
Save Draft
Launch Campaign

Do not actually send anything.

==================================================
16. CAMPAIGN DETAILS

Create:

/campaigns/:id

Header:

Campaign name
Status

Actions:

Pause
Resume
Edit
Duplicate

Show KPI cards:

Recipients
Sent
Delivered
Read
Failed

Charts:

Delivery rate
Read rate
Failure rate

Message activity timeline.

Recipient table:

Contact
Phone
Status
Sent
Delivered
Read
Failed
Last Attempt

==================================================
17. TEMPLATES

Create:

/templates

Template management system.

Top:

"Message Templates"

Buttons:

Create Template

Filters:

Search

Category

Status

Categories:

Marketing
Transactional
Reminder
Welcome
Follow-up
Other

Template cards/table:

Template Name
Category
Language
Status
Usage
Updated
Actions

Statuses:

Draft
Active
Inactive

==================================================
18. CREATE TEMPLATE

Create:

/templates/create

Fields:

Template Name

Category

Language

Message body

Variable insertion:

{{name}}
{{company}}
{{order_id}}
{{amount}}

Show real-time WhatsApp preview on the right.

Example:

"Hi {{name}}, 👋

Your order {{order_id}} is ready.

Thank you for choosing us."

Buttons:

Save Draft
Save Template

==================================================
19. AUTOMATIONS

Create:

/automations

This should be a visual automation management page.

Header:

"Automations"

Description:

"Create automated workflows for your WhatsApp conversations."

Button:

"Create Automation"

Show automation cards:

Welcome New Contact
Trigger: New contact
Status: Active

Order Follow-up
Trigger: Tag added
Status: Active

Inactive Customer Reminder
Trigger: No reply for 7 days
Status: Paused

Each card shows:

Trigger
Actions
Last Run
Runs
Status

==================================================
20. AUTOMATION BUILDER

Create:

/automations/create

Build a visual workflow editor.

Example:

TRIGGER

New Contact

↓

ACTION

Send WhatsApp Message

↓

WAIT

1 Day

↓

CONDITION

Customer replied?

YES → Send follow-up

NO → Send reminder

The UI should visually represent nodes and connections.

Allow mock nodes:

Triggers:

New Contact

Incoming Message

Tag Added

Campaign Completed

Scheduled Time

No Reply

Actions:

Send Message

Send Template

Add Tag

Remove Tag

Wait

Assign Contact

Start Campaign

Conditions:

Contact has tag

Message contains text

Customer replied

Time condition

Do not implement the workflow engine.

Build only the frontend interaction and visual builder.

==================================================
21. ANALYTICS

Create:

/analytics

Dashboard for detailed WhatsApp analytics.

Filters:

Today
7 Days
30 Days
90 Days
Custom

Metrics:

Messages Sent
Delivered
Read
Failed
Reply Rate
Delivery Rate
Read Rate

Charts:

Message volume
Delivery performance
Campaign performance
Response rate

Top campaigns table.

Top contacts table.

==================================================
22. MESSAGE LOGS

Create:

/logs

Show every message activity.

Table:

Timestamp
Contact
Phone
Campaign
Message
Status
Direction
Error
Actions

Statuses:

Sent
Delivered
Read
Failed
Pending

Filters:

Date

Campaign

Contact

Status

Direction

Add message details drawer when clicking a row.

Show:

Message ID
Timestamp
Contact
Campaign
Message body
Status timeline
Error details if failed

==================================================
23. BILLING

Create:

/billing

Show current subscription.

Plan:

Professional

Price:
₹999/month

Usage:

Contacts
Messages
Campaigns
Automations

Usage progress bars.

Buttons:

Upgrade

Change Plan

Manage Subscription

Plans:

Free
Starter
Professional
Business

Do not implement real payments.

==================================================
24. SETTINGS

Create:

/settings

Use settings sidebar.

Sections:

Profile
Account
WhatsApp
Notifications
Security
Team
API
Billing

PROFILE:

Name
Email
Profile picture
Company name
Timezone

WHATSAPP:

Connected number
Connection status
Session information
Reconnect
Disconnect

NOTIFICATIONS:

Campaign completed
Campaign failed
WhatsApp disconnected
Low balance
Automation errors

SECURITY:

Change password
Two-factor authentication UI
Active sessions

TEAM:

Team members
Role
Status
Invite member

API:

API key interface

Show masked API key.

Buttons:

Generate API Key
Regenerate
Revoke

Do not implement API functionality yet.

==================================================
25. SIDEBAR

Create a professional collapsible sidebar.

Logo:

WAFlow

Navigation:

Overview
Dashboard

Messaging
Inbox

WhatsApp

Contacts
Campaigns
Templates
Automations

Analytics
Message Logs

Account
Billing
Settings

At bottom:

Help & Support

User profile

Sidebar should have active route highlighting.

On mobile, convert sidebar into a drawer.

==================================================
26. HEADER

Top header:

Breadcrumbs

Global search

Notifications

Help

User profile

User dropdown:

Profile
Settings
Billing
Logout

Create notification dropdown with realistic examples:

"Campaign Summer Sale completed"

"WhatsApp disconnected"

"2,341 messages delivered"

==================================================
27. GLOBAL COMPONENTS

Create reusable components for:

Buttons

Cards

Tables

Modals

Drawers

Dropdowns

Tabs

Badges

Toast notifications

Empty states

Loading states

Error states

Confirmation dialogs

Form fields

Date pickers

Search

Pagination

Charts

Status indicators

Avatar

Tooltips

Maintain a consistent design system throughout the entire application.

==================================================
28. MOCK DATA

Use realistic mock data throughout the frontend.

Create mock:

Users
WhatsApp accounts
Contacts
Conversations
Messages
Campaigns
Templates
Automations
Analytics
Message logs
Notifications

The application should never look empty when opened.

Use realistic Indian phone numbers where appropriate, but do not use real people's personal information.

==================================================
29. ROUTING

Create frontend routes for:

/
/login
/register
/forgot-password

/dashboard

/whatsapp

/inbox

/contacts
/contacts/:id

/campaigns
/campaigns/create
/campaigns/:id

/templates
/templates/create

/automations
/automations/create

/analytics

/logs

/billing

/settings
/settings/profile
/settings/account
/settings/whatsapp
/settings/notifications
/settings/security
/settings/team
/settings/api

All routes should work with mock data.

==================================================
30. RESPONSIVENESS

Desktop:
Full sidebar + header + content.

Tablet:
Collapsible sidebar.

Mobile:
Drawer navigation.

Tables should become responsive cards or horizontally scrollable where appropriate.

Campaign builder and automation builder should remain usable on smaller screens.

Inbox should become a mobile conversation view.

==================================================
31. UX DETAILS

Add subtle interactions:

Hover states

Button loading states

Skeleton loaders

Toast notifications

Confirmation dialogs

Dropdown animations

Modal transitions

Sidebar collapse

Table row hover

Copy-to-clipboard UI

Search interactions

Filter interactions

Do not over-animate the application.

==================================================
32. EMPTY STATES

Every major module should have a polished empty state.

Examples:

No WhatsApp connected:

"Connect your WhatsApp to get started."

No contacts:

"Import your contacts or add your first contact."

No campaigns:

"Create your first campaign."

No templates:

"Create a reusable message template."

No automations:

"Automate your first WhatsApp workflow."

==================================================
33. IMPORTANT ARCHITECTURE REQUIREMENT

Keep frontend code modular.

Use reusable components.

Do not put everything into one large component.

Create a logical structure such as:

components/
layouts/
pages/
features/
hooks/
mock/
types/
utils/

Keep mock data separate from UI components.

Create TypeScript interfaces/types for:

User
WhatsAppAccount
Contact
Conversation
Message
Campaign
Template
Automation
Analytics
MessageLog
Notification

This will make it easy to replace mock data with real API responses later.

==================================================
34. FUTURE BACKEND COMPATIBILITY

The future backend will use:

Node.js
Express
MongoDB
Baileys
REST APIs
WebSockets

The frontend should be designed so that API services can later replace mock services.

For example:

authService
whatsappService
contactService
campaignService
templateService
automationService
analyticsService
messageService

Do NOT implement these APIs now.

Create mock service functions/interfaces where useful.

==================================================
35. WHATSAPP / BAILEYS IMPORTANT NOTE

The actual WhatsApp connection will later be handled by the backend using Baileys.

The frontend should NOT know or depend on Baileys internals.

The frontend should simply consume states such as:

DISCONNECTED
CONNECTING
QR_REQUIRED
CONNECTED
DISCONNECTING
SESSION_EXPIRED
ERROR

For the QR connection screen, use a mock QR code.

Later the backend will provide the actual QR data.

==================================================
36. SECURITY / PRODUCT UX

Do not display sensitive session credentials.

Do not expose authentication tokens in the UI.

Mask API keys.

Use confirmation dialogs for destructive actions.

Show clear warnings for:

Disconnect WhatsApp
Delete contact
Delete campaign
Delete template
Delete automation
Revoke API key

==================================================
37. FINAL VISUAL QUALITY

The final application should feel like a real SaaS product that could be shown to customers.

Prioritize:

Excellent dashboard

Excellent WhatsApp connection experience

Excellent Inbox

Excellent Campaign Builder

Excellent Contact Management

Excellent Template Management

Excellent Automation Builder

Excellent analytics

Consistent design system

Responsive behavior

Do not create a generic admin dashboard.

This is a WhatsApp automation SaaS product, so the UI should clearly communicate messaging, campaigns, contacts, automation and communication workflows.

==================================================
38. DEVELOPMENT APPROACH

Start by creating the complete frontend foundation:

Design system

App layout

Sidebar

Header

Routing

Authentication pages

Dashboard

WhatsApp connection page

Inbox

Contacts

Campaigns

Templates

Automations

Analytics

Logs

Billing

Settings

Use mock data.

Do not implement backend functionality yet.

Before making major architectural decisions, keep the UI modular and easy to connect to an external Node.js API later.

The final result should be polished, responsive and production-quality.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d3d0c82f-6086-4fe6-a4b4-d7336b08785d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
