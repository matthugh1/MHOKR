# Getting Started with OKR Nexus

Welcome to OKR Nexus! This guide will help you get up and running quickly.

## 🚀 Quick Start (5 Minutes)

### Prerequisites Check
```bash
node --version    # Should be 18+
npm --version     # Should be 9+
psql --version    # Should be 14+
redis-cli ping    # Should return PONG
```

### 1. Install Dependencies
```bash
cd "/Users/matthewhughes/Documents/App_Folder/OKR Framework"
npm install
```

### 2. Start Services
```bash
# All services are already configured!
npm run dev
```

Wait 15-20 seconds for all services to start, then:

### 3. Access the Application
Open your browser to: **http://localhost:5173**

### 4. Create Your Account
1. Click "Sign up"
2. Fill in your details
3. Start creating OKRs!

---

## 🎯 What Can You Do?

### Create OKRs
- **Dashboard → OKRs**: View all your OKRs in list or grid view
- **New OKR Button**: Create a new Objective with Key Results

### Use the Visual Builder
- **Dashboard → Visual Builder**: Drag and drop to create connected OKRs
- **Node Types**: Blue (Objectives), Green (Key Results), Purple (Initiatives)
- **Connections**: Drag from one node to another to show relationships

### Get AI Help
- **Dashboard → AI Assistant**: Chat with three AI personas
  - **OKR Coach**: "Help me write a better OKR for launching our product"
  - **Cascade Assistant**: "How should our team's OKRs align with company goals?"
  - **Progress Analyst**: "How are we tracking this quarter?"

### View Analytics
- **Dashboard → Analytics**: See progress, trends, and team health

---

## 📊 Sample Data

The database has been seeded with sample data. You can explore:
- Sample organizations and workspaces
- Example OKRs from different teams
- Activity history

---

## 🔧 Troubleshooting

### Services Won't Start
```bash
# Kill all services
lsof -ti:3000,3001,3002,3003,5173 | xargs kill -9

# Restart
npm run dev
```

### Database Issues
```bash
# Reset database (WARNING: Deletes all data)
cd services/core-api
npx prisma migrate reset
```

### Port Already in Use
If port 3000, 3001, 3002, 3003, or 5173 is in use:
```bash
# Find what's using the port
lsof -i:3000

# Kill it
kill -9 <PID>
```

---

## 📖 Learning Resources

### API Documentation
- **Core API**: http://localhost:3001/api/docs
- **Swagger UI**: Interactive API testing

### Code Structure
- `apps/web/src/app/` - Frontend pages
- `apps/web/src/components/` - React components
- `services/core-api/src/modules/` - Backend modules
- `services/ai-service/src/personas/` - AI personas

### Key Files
- `.env` - Environment configuration
- `services/core-api/prisma/schema.prisma` - Database schema
- `services/api-gateway/src/index.ts` - API routing

---

## 🎓 Next Steps

1. **Explore the Dashboard**: Click around and familiarize yourself with the UI
2. **Create Your First OKR**: Use the OKR Coach to help you write it
3. **Try the Visual Builder**: Drag nodes and connect them
4. **Chat with AI**: Ask questions and get recommendations
5. **Check Analytics**: See how progress is tracked

---

## 💡 Pro Tips

- **Save Your Work**: The app auto-saves, but click "Save" to be sure
- **Use AI Validation**: Before finalizing an OKR, ask the OKR Coach to review it
- **Connect Everything**: In the Visual Builder, connect related OKRs to see alignment
- **Track Progress**: Update Key Result progress regularly for better insights
- **Ask for Help**: The AI personas are there to guide you

---

## 📞 Need Help?

- Check `README.md` for detailed documentation
- See `PROJECT_STATUS.md` for feature completion status
- Review `ARCHITECTURE.md` for technical details (coming soon)

---

**Enjoy using OKR Nexus! 🎉**
