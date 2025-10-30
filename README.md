# OKR Nexus - AI-First OKR Platform

An advanced, AI-powered Objectives and Key Results (OKR) management platform featuring a visual builder, intelligent assistance, and seamless integrations.

## 🚀 Features

### Core Capabilities
- **Visual OKR Builder**: Interactive drag-and-drop canvas for creating and aligning OKRs using React Flow
- **AI-Powered Assistance**: Three specialized AI personas to help you succeed
  - **OKR Coach**: Validates OKRs, suggests improvements, and ensures SMART criteria
  - **Cascade Assistant**: Recommends alignments and detects conflicts across teams
  - **Progress Analyst**: Provides insights, generates reports, and identifies at-risk OKRs
- **Multi-Tenancy**: Support for Organizations → Workspaces → Teams hierarchy
- **Real-Time Collaboration**: Live updates and notifications
- **Rich Analytics**: Dashboards, completion tracking, and trend analysis

### Technical Highlights
- **Microservices Architecture**: Scalable, maintainable, and extensible
- **Model-Agnostic AI**: Works with OpenAI, Anthropic, or custom LLM providers
- **Type-Safe**: Full TypeScript across frontend and backend
- **Modern Stack**: Next.js 14, NestJS, Prisma, PostgreSQL, Redis

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 7+
- OpenAI or Anthropic API key (for AI features)

## 🏗️ Architecture

```
OKR Nexus (Monorepo)
├── apps/
│   └── web/                    # Next.js 14 frontend
├── services/
│   ├── api-gateway/            # Express API Gateway
│   ├── core-api/               # NestJS Core API (OKRs, Users, Teams)
│   ├── ai-service/             # NestJS AI Service (LLM integration)
│   └── integration-service/    # NestJS Integration Service (Jira, GitHub, Slack)
└── packages/
    ├── types/                  # Shared TypeScript types
    └── utils/                  # Shared utility functions
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

```bash
# Create PostgreSQL database and user
psql postgres
CREATE DATABASE okr_nexus;
CREATE USER okr_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE okr_nexus TO okr_user;
ALTER USER okr_user CREATEDB;  # For Prisma shadow database
\q

# Copy environment variables
cp .env.example .env

# Update .env with your database credentials
# DATABASE_URL=postgresql://okr_user:your_password@localhost:5432/okr_nexus

# Run migrations
cd services/core-api
npx prisma migrate dev
npx prisma db seed  # Optional: Add sample data
```

### 3. Configure Environment

Edit `.env` and set:

```env
# Database
DATABASE_URL=postgresql://okr_user:your_password@localhost:5432/okr_nexus

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-this-in-production

# AI Provider (choose one)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
# or
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...

# Services
CORE_API_URL=http://localhost:3001
AI_SERVICE_URL=http://localhost:3002
INTEGRATION_SERVICE_URL=http://localhost:3003
```

### 4. Start Services

```bash
# Start all services (from project root)
npm run dev

# Or start individually:
# Terminal 1: API Gateway
cd services/api-gateway && npm run dev

# Terminal 2: Core API
cd services/core-api && npm run dev

# Terminal 3: AI Service
cd services/ai-service && npm run dev

# Terminal 4: Integration Service
cd services/integration-service && npm run dev

# Terminal 5: Frontend
cd apps/web && npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:3000
- **Core API Docs**: http://localhost:3001/api/docs
- **AI Service**: http://localhost:3002

## 📖 Usage

### Creating an Account

1. Navigate to http://localhost:5173
2. Click "Sign up" to create an account
3. Fill in your details and submit

### Creating Your First OKR

#### Via List View
1. Go to Dashboard → OKRs
2. Click "New OKR"
3. Enter your Objective and Key Results
4. Save

#### Via Visual Builder
1. Go to Dashboard → Visual Builder
2. Drag nodes onto the canvas
3. Connect Objectives to Key Results and Initiatives
4. Save your layout

### Using AI Assistance

#### OKR Coach
```bash
# Ask the OKR Coach to review your OKR
"Can you review this objective: 'Make the product better'?"

# Get suggestions for Key Results
"Suggest key results for: 'Launch AI-powered recommendation engine'"
```

#### Cascade Assistant
```bash
# Check alignment
"How does our team's OKR align with company goals?"

# Get recommendations
"What should our team focus on to support the Q2 objectives?"
```

#### Progress Analyst
```bash
# Get progress insights
"How are we tracking this quarter?"

# Generate a report
"Generate an executive summary for our OKR progress"
```

## 🔧 Development

### Project Structure

```
services/core-api/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Database migrations
│   └── seed.ts                # Sample data
├── src/
│   ├── modules/
│   │   ├── auth/              # Authentication
│   │   ├── user/              # User management
│   │   ├── organization/      # Organizations
│   │   ├── workspace/         # Workspaces
│   │   ├── team/              # Teams
│   │   ├── okr/               # OKRs (Objectives, Key Results, Initiatives)
│   │   └── activity/          # Activity tracking
│   └── common/
│       ├── prisma/            # Prisma service
│       └── redis/             # Redis service
```

### Available Scripts

```bash
# Root
npm run dev                    # Start all services
npm run build                  # Build all services
npm run lint                   # Lint all services

# Core API
cd services/core-api
npm run dev                    # Start in watch mode
npm run build                  # Build for production
npm run start:prod             # Start production build
npx prisma studio              # Open Prisma Studio
npx prisma migrate dev         # Create and apply migration
npx prisma db seed             # Seed database

# Frontend
cd apps/web
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run start                  # Start production server
```

### Adding a New Feature

1. **Backend**: Create a new module in `services/core-api/src/modules/`
2. **Frontend**: Create components in `apps/web/src/components/`
3. **API**: Add routes to API Gateway if needed
4. **Database**: Update Prisma schema and create migration

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run e2e tests
npm run test:e2e
```

## 🐳 Docker Deployment (Future)

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🔒 Security

- **Authentication**: JWT-based with bcrypt password hashing
- **Authorization**: Role-based access control (RBAC)
- **API Gateway**: Rate limiting, CORS, Helmet security headers
- **Database**: Prepared statements via Prisma (SQL injection protection)
- **Secrets**: Environment variables (never commit `.env`)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 🗺️ Roadmap

### Phase 1: MVP ✅
- [x] Project setup and architecture
- [x] Authentication and user management
- [x] Core OKR CRUD operations
- [x] Visual OKR builder
- [x] AI personas (Coach, Cascade, Analyst)
- [x] Basic analytics dashboard

### Phase 2: Enhancements 🚧
- [ ] Workspace and team hierarchy with RBAC
- [ ] Real-time collaboration and notifications
- [ ] Integration with Jira, GitHub, Slack
- [ ] Advanced analytics and reporting
- [ ] Mobile responsive design

### Phase 3: Enterprise Features 🔮
- [ ] Azure AD / Keycloak integration
- [ ] Custom workflows and templates
- [ ] Advanced permissions and audit logs
- [ ] Performance optimization
- [ ] Multi-language support

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@okr-nexus.com

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/), [NestJS](https://nestjs.com/), and [Prisma](https://www.prisma.io/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Visual builder powered by [React Flow](https://reactflow.dev/)
- AI integration via OpenAI and Anthropic
