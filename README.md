# Externaliza2

A comprehensive financial management platform for advisors and clients, built with Next.js, TypeScript, and Supabase.

## Overview

Externaliza2 is a modern web application that facilitates document management, financial analysis, and communication between financial advisors and their clients. The platform includes AI-powered features for document processing, financial analysis, and automated notifications.

## Features

### For Advisors

* **Dashboard**: Real-time KPIs, client metrics, and activity monitoring
* **Document Management**: Bulk operations, AI auto-posting, and document verification
* **Financial Dashboard**: Aggregate financial metrics, risk analysis, and AI-powered financial assistant
* **Client Management**: Track client upload frequency, send notifications, and manage client relationships
* **Incident Management**: Handle client issues with integrated chat system
* **User Management**: Create and manage users, assign clients to advisors

### For Clients

* **Document Upload**: Upload and manage financial documents
* **Financial Dashboard**: View personal financial metrics and analysis
* **AI Assistant**: Get answers to financial questions
* **Incident Reporting**: Report issues and communicate with advisors
* **Profile Management**: Update contact information and preferences
* **Notifications**: Configure notification preferences

### Core Capabilities

* AI-powered document verification and processing
* Automated financial calculations and analysis
* Real-time notifications and reminders
* Multi-role access control (Admin, Advisor, Client)
* Secure authentication with Supabase
* ERP integration for accounting entries

## Tech Stack

* **Framework**: Next.js 16
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **Database**: Supabase (PostgreSQL)
* **Authentication**: Supabase Auth
* **AI**: OpenAI API
* **UI Components**: Lucide React, React Hot Toast

## Getting Started

### Prerequisites

* Node.js 18+ and npm
* Supabase account and project
* OpenAI API key (for AI features)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd code
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:

```env
NEXT\_PUBLIC\_SUPABASE\_URL=your\_supabase\_url
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=your\_supabase\_anon\_key
SUPABASE\_SERVICE\_ROLE\_KEY=your\_service\_role\_key
OPENAI\_API\_KEY=your\_openai\_api\_key
NEXT\_PUBLIC\_SITE\_URL=http://localhost:3000
```

4. Run database migrations:
Apply the SQL migrations from the `supabase/migrations/` directory to your Supabase project.
5. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
code/
├── components/          # Reusable React components
├── lib/                 # Utility functions and configurations
├── pages/               # Next.js pages and API routes
│   ├── admin/          # Admin dashboard pages
│   ├── asesor/         # Advisor dashboard pages
│   ├── cliente/        # Client dashboard pages
│   └── api/            # API endpoints
├── styles/             # Global styles
├── types/              # TypeScript type definitions
├── scripts/            # SQL scripts and utilities
├── supabase/           # Supabase migrations and schema
└── docs/               # Documentation files
```

## Available Scripts

* `npm run dev` - Start development server on port 3000
* `npm run build` - Build for production
* `npm run start` - Start production server on port 3000
* `npm run lint` - Run ESLint



|Variable|Description|Required|
|-|-|-|
|`NEXT\_PUBLIC\_SUPABASE\_URL`|Supabase project URL|Yes|
|`NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY`|Supabase anonymous key|Yes|
|`SUPABASE\_SERVICE\_ROLE\_KEY`|Supabase service role key|Yes|
|`OPENAI\_API\_KEY`|OpenAI API key for AI features|Yes|
|`NEXT\_PUBLIC\_SITE\_URL`|Base URL of the application|Yes|

## Roles and Permissions

The platform supports three main roles:

1. **Admin**: Full system access, user management, system configuration
2. **Advisor**: Client management, document processing, financial analysis
3. **Client**: Document upload, view financial data, incident reporting

## Security

* Row Level Security (RLS) policies in Supabase
* Role-based access control
* Secure API endpoints with authentication
* Environment variables for sensitive data

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Private project - All rights reserved

## Support

For issues and questions, please contact the development team or refer to the documentation in the `docs/` directory.

