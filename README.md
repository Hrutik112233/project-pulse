# Project Pulse

Enterprise Multi-Admin Project Progress Management System

Objective

Develop a production-ready Enterprise Project Progress Management System similar to Porter, Jira, ClickUp, or Monday.com that enables organizations to manage multiple projects, multiple admins, and multiple team members with complete progress tracking, analytics, and reporting.

The application must support role-based authentication, real-time collaboration, detailed progress updates, project analytics, and a comprehensive Super Admin dashboard.

User Roles

1. Super Admin

The Super Admin has unrestricted access to the system.

Permissions

Create, edit, archive, and delete projects

Create, edit, activate/deactivate admins

Create, edit, activate/deactivate team members

Assign one or more admins to any project

Remove admins from projects

Assign project deadlines and priorities

View every project in the organization

View every admin and every team member

View all uploaded files and screenshots

View complete activity history

Monitor project completion

Generate reports

Export PDF and Excel reports

View analytics dashboards

Configure project settings

2. Admin

One admin may be assigned to multiple projects.

Multiple admins may also collaborate on the same project.

Admins can:

View only assigned projects

Update project progress

Create tasks

Assign tasks to team members

Upload screenshots

Upload documents

Add GitHub links

Add live hosting/demo links

Update progress percentage

Change task status

Add comments

View updates made by other admins assigned to the same project

View project timeline

Admins cannot:

Access projects not assigned to them

Manage other admins

Access Super Admin analytics

3. Team Member

Team members can:

View assigned tasks

Update task progress

Upload screenshots

Upload GitHub links

Upload hosting/demo links

Upload documents

Add comments

They cannot:

Create projects

Assign admins

View organization analytics

Authentication

Implement:

JWT Authentication

Refresh Tokens

Role-Based Access Control (RBAC)

bcrypt password hashing

Login

Logout

Forgot Password

Reset Password

Optional Email Verification

Project Management

Each project contains:

Project Name

Description

Client Name

Category

Priority

Start Date

End Date

Deadline

Status

Overall Progress

Assigned Admins

Assigned Team Members

Attachments

Activity Timeline

Project Status values:

Not Started

Planning

In Progress

Under Review

Completed

On Hold

Cancelled

Multi-Admin Collaboration

A single project can have multiple admins.

Example:

Project Alpha

Assigned Admins:

Admin A

Admin B

Admin C

Each admin independently updates:

Progress %

Tasks

Screenshots

GitHub Repository

Live Hosting Link

Comments

Documents

All updates appear in one shared project timeline.

Task Management

Each project supports unlimited tasks.

Each task contains:

Task Title

Description

Assigned Admin

Assigned Team Member

Priority

Start Date

Due Date

Progress Percentage

Status

Attachments

Comments

Task Status:

Pending

Started

In Progress

Under Review

Completed

Rejected

Blocked

Progress Update Module

Every project update creates a permanent activity record.

Required Fields

Work Title

Work Description

Progress Percentage (0–100%)

Task Status

Updated By

Date

Time

Optional Fields

GitHub Repository Link

Live Hosting / Deployment Link

Multiple Screenshot Upload

Demo Video

PDF/DOCX/ZIP Attachments

Additional Notes

Even if optional fields are empty, the update card should still display placeholders such as "Not Provided" or "No Screenshots Uploaded" to maintain a consistent interface.

Progress Update Card

Each update should display:

User Avatar

User Name

Role

Project Name

Task Name

Progress Bar

Progress Percentage

Status Badge

Description

GitHub Button

Live Demo Button

Screenshot Gallery

Attachments

Comments

Date & Time

Automatic Project Progress

The system should automatically calculate overall project progress.

Example:

Admin A (Frontend): 80%

Admin B (Backend): 70%

Admin C (Testing): 40%

Overall project progress should be calculated either:

As an average of all assigned modules, or

Using configurable module weights defined by the Super Admin.

Activity Timeline

Every update appears chronologically.

Example:

09:00 AM

Admin A

Frontend

Progress: 60% → 70%

GitHub: Available

Live Demo: Available

Screenshots: 3 Uploaded

11:30 AM

Admin B

Backend

Progress: 40% → 55%

GitHub: Available

Live Demo: Not Provided

Screenshots: 2 Uploaded

02:15 PM

Team Member

Testing

Progress: 20% → 35%

GitHub: Not Provided

Live Demo: Not Provided

Screenshots: 5 Uploaded

Super Admin Dashboard

Display:

Total Projects

Active Projects

Completed Projects

Delayed Projects

Total Admins

Total Team Members

Total Tasks

Pending Tasks

Completed Tasks

Daily Updates

Weekly Updates

Monthly Updates

Charts:

Overall Project Progress

Admin Performance

Team Performance

Task Completion Trend

Project Status Distribution

Monthly Productivity

Admin Dashboard

Display:

Assigned Projects

Assigned Tasks

My Progress

Team Progress

Pending Tasks

Completed Tasks

Notifications

Recent Activity

Team Member Dashboard

Display:

Assigned Tasks

Task Status

Upload Progress

Recent Updates

Comments

Notifications

Super Admin Calendar Dashboard

Create a full-page interactive monthly calendar.

Each date should visually indicate activity levels.

Clicking any date should open a detailed daily report.

Daily report should include:

Active Users

Active Admins

Active Team Members

Projects Updated

Tasks Completed

Pending Tasks

Screenshots Uploaded

Documents Uploaded

Comments Added

Overall Daily Progress

Daily User Activity

For every selected date display:

User Name

Role

Assigned Project

Tasks Completed

Tasks Pending

Progress Percentage

Login Time

Logout Time

Working Hours

Last Activity

Project Activity Summary

For every project updated on the selected date display:

Project Name

Overall Progress

Assigned Admins

Number of Updates

Tasks Completed

Pending Tasks

Uploaded Screenshots

Uploaded Documents

Calendar Filters

Allow filtering by:

Date

Project

Admin

Team Member

Priority

Status

Department

Attendance & Presence

Track:

Login Time

Logout Time

Total Working Hours

Online Status

Last Active Time

Status Indicators:

🟢 Online

🟡 Idle

🔴 Offline

Notifications

Real-time notifications for:

Task Assigned

Task Completed

Project Updated

Screenshot Uploaded

GitHub Link Added

Live Demo Added

Document Uploaded

Deadline Reminder

New Comment

Use WebSockets (Socket.IO).

Reports

Generate:

Daily Report

Weekly Report

Monthly Report

Admin Performance Report

Team Performance Report

Project Progress Report

Export to:

PDF

Excel

File Uploads

Support:

Images

PDF

DOCX

XLSX

ZIP

MP4

Store files in AWS S3 or Firebase Storage.

Database Schema

Create normalized tables for:

Users

Roles

Projects

Project_Admin

Project_Members

Tasks

Task_Assignees

Progress_Updates

Comments

Attachments

Notifications

Activity_Logs

Reports

Technology Stack

Frontend:

Next.js (App Router)

React

TypeScript

Tailwind CSS

Material UI

Redux Toolkit

React Query

Backend:

Node.js

Express.js

TypeScript

Database:

PostgreSQL

ORM:

Prisma

Authentication:

JWT

bcrypt

Storage:

AWS S3

Real-Time:

Socket.IO

Charts:

Recharts or Chart.js

Deployment:

Frontend: Vercel

Backend: Railway or Render

Database: PostgreSQL

Storage: AWS S3

UI Requirements

Develop a clean, modern enterprise interface with:

Responsive design

Light/Dark mode

Sidebar navigation

Breadcrumbs

Search

Filters

Pagination

Sorting

Dashboard widgets

Kanban board

Calendar view

Timeline view

Table view

Mobile support

Progressive Web App (PWA)

Deliverables

Build a complete production-ready application including:

System Architecture Diagram

Database ER Diagram

API Documentation

Backend REST APIs

Frontend UI

Authentication & RBAC

Super Admin Dashboard

Admin Dashboard

Team Member Dashboard

Calendar Activity Module

Progress Tracking System

Multi-Admin Collaboration

GitHub, Live Demo & Screenshot Support

File Upload Module

Notifications

Reports & Analytics

Audit Logs

Docker Configuration

Seed Data

Unit & Integration Tests

Deployment Guide

Comprehensive README

Use a clean, modular architecture, follow SOLID principles, implement secure coding practices, validate all inputs, handle errors gracefully, optimize database queries, and produce well-documented, maintainable code suitable for enterprise deployment.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/225b5df0-f903-4d3f-b692-551da4ba6539).

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
