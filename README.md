# WhatsApp Official Platform

This repository contains both the frontend and backend services for the WhatsApp Official management application.

## Repository Structure

```
.
├── whatsaap-official-frontend/   # React / Vite frontend web client
└── whatsapp-official-backend/    # Node.js backend API and webhook service
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm, yarn, or bun

### 1. Backend Setup
```bash
cd whatsapp-official-backend
cp .env.example .env
npm install
npm run dev
```

### 2. Frontend Setup
```bash
cd whatsaap-official-frontend
cp .env.example .env
npm install
npm run dev
```

## Environment Variables
Refer to `.env.example` in both directories for required environment configurations. Never commit `.env` files containing live secrets to source control.
