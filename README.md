# MMO/RPG Game Community Forum

A modular, full-stack web application for gaming communities to discuss MMO and RPG games, share news, and engage in threaded conversations.

## 🎮 Features (Phase 1 MVP)

- **User Authentication**: Email/password registration and login with JWT tokens
- **Discussion Forums**: Create threads, reply with nested comments
- **Game-Specific Sections**: Organize conversations by game
- **Real-time Notifications**: WebSocket-based live notifications
- **User Profiles**: View user info, thread count, account creation date
- **Manual Moderation**: Admin-only content moderation and user promotion
- **Search**: Simple text search on threads and replies
- **Responsive Design**: Works on PC browsers and Android (PWA)

## 🚀 Tech Stack

- **Backend**: Node.js + Express.js
- **Frontend**: React 18+ with Vite
- **Database**: PostgreSQL
- **Real-time**: Socket.io (WebSockets)
- **Mobile**: PWA approach for Android
- **Authentication**: JWT tokens with refresh mechanism

## 📋 Project Structure

```
mmo-rpg-forum/
├── backend/                    # Node.js/Express backend
│   ├── src/
│   │   ├── config/            # Configuration modules
│   │   ├── modules/           # Feature modules
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Shared utilities
│   │   ├── db/                # Database setup
│   │   ├── app.js             # Express app
│   │   └── server.js          # Server entry point
│   └── package.json
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API & WebSocket services
│   │   ├── styles/            # Theme & styling
│   │   └── App.jsx
│   └── package.json
├── docs/                       # Documentation
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   ├── DATABASE_SCHEMA.md
│   └── DEPLOYMENT_GUIDE.md
└── TECHNICAL_DESCRIPTION.md    # Project requirements
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ LTS
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure database connection in .env
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173` (Vite default port)

## 📚 Documentation

- [TECHNICAL_DESCRIPTION.md](./TECHNICAL_DESCRIPTION.md) - Project requirements and specifications
- [docs/SYSTEM_ARCHITECTURE.md](./docs/SYSTEM_ARCHITECTURE.md) - Database schema, API specs, architecture
- [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) - Detailed API endpoints
- [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) - PostgreSQL schema
- [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) - Production deployment steps

## 🔄 Development Workflow

1. Create feature branch from `develop`
2. Implement feature with modular structure
3. Test locally
4. Submit pull request to `develop`
5. Merge to `main` for production deployment

## 📦 Available Scripts

### Backend
```bash
npm run dev      # Run with nodemon (auto-reload)
npm start        # Production start
npm test         # Run tests
npm run lint     # Lint code
```

### Frontend
```bash
npm run dev      # Development server with HMR
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Lint code
```

## 🚢 Deployment

### Demo Deployment
- **Backend**: Railway.app (free tier with $5/month credits)
- **Frontend**: Vercel (free tier)
- **Database**: PostgreSQL on Railway

See [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for detailed steps.

## 🤝 Architecture Principles

- **Modularity**: Each feature in isolated, independent modules
- **Configuration**: Settings in centralized config files (not hardcoded)
- **Scalability**: Designed to support future phases without major refactoring
- **Security**: Input validation, SQL injection prevention, XSS protection

## 📅 Phase Roadmap

- **Phase 1**: MVP (Forum, Auth, Moderation) ← **Current**
- **Phase 2**: Enhanced Features (Messages, News, Game Sections, Uploads)
- **Phase 3**: Mobile & PWA (React Native, Progressive Web App)
- **Phase 4**: Scaling (Reputation system, Advanced search, Analytics)

## ⚖️ License

MIT License - see LICENSE file for details

## 🤖 Initial Setup Checklist

- [ ] Clone repository
- [ ] Install backend dependencies (`cd backend && npm install`)
- [ ] Install frontend dependencies (`cd frontend && npm install`)
- [ ] Set up PostgreSQL database (see DEPLOYMENT_GUIDE.md)
- [ ] Configure `.env` files in backend and frontend
- [ ] Run database migrations
- [ ] Start backend server (`npm run dev` in backend/)
- [ ] Start frontend server (`npm run dev` in frontend/)
- [ ] Verify both running at `http://localhost:3001` (backend) and `http://localhost:5173` (frontend)

## 📞 Support

For questions or issues, please open an issue on GitHub.

---

**Created**: January 16, 2026  
**Status**: Phase 1 Development  
**Single Developer**: Solo project with modular architecture for future expansion
