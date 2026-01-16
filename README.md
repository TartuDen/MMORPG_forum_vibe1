# MMO/RPG Game Community Forum

A modular, full-stack web application for gaming communities to discuss MMO and RPG games, share news, and engage in threaded conversations.

## 🎮 Features (Phase 1 MVP)

- **User Authentication**: Email/password registration and login with JWT tokens
- **Discussion Forums**: Create threads, reply with nested comments
- **Game-Specific Sections**: Organize conversations by game
- **Real-time Notifications**: WebSocket-based live notifications (Phase 2)
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
mmorpg-forum/
├── backend/                    # Node.js/Express backend
│   ├── src/
│   │   ├── config/            # Routes and configuration
│   │   ├── modules/           # Feature modules (users, forums, threads, comments)
│   │   ├── middleware/        # Express middleware (auth, errors)
│   │   ├── utils/             # Shared utilities (JWT, password, validators)
│   │   ├── db/                # Database setup and initialization
│   │   ├── app.js             # Express app
│   │   └── server.js          # Server entry point
│   ├── .env.example           # Environment variables template
│   └── package.json
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components (Navbar)
│   │   ├── pages/             # Page components (Home, Login, Register)
│   │   ├── services/          # API & Auth services
│   │   ├── styles/            # CSS stylesheets
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
├── docs/                       # Documentation
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   ├── DATABASE_SCHEMA.md
│   └── DEPLOYMENT_GUIDE.md
├── TECHNICAL_DESCRIPTION.md    # Project requirements
└── README.md
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ LTS
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database configuration:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=mmorpg_forum
# DB_USER=postgres
# DB_PASSWORD=your_password
# PORT=5000
# NODE_ENV=development
# JWT_SECRET=your_jwt_secret_here

# Start development server
npm run dev
```

Backend API will be available at `http://localhost:5000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with API URL:
# VITE_API_BASE_URL=http://localhost:5000/api

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:5173`

### Database Setup

1. Start PostgreSQL server
2. Create database and user:
   ```sql
   CREATE DATABASE mmorpg_forum;
   CREATE USER forum_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE mmorpg_forum TO forum_user;
   ```
3. The backend will automatically initialize the schema on first run

## 📚 Documentation

- [TECHNICAL_DESCRIPTION.md](./TECHNICAL_DESCRIPTION.md) - Project requirements and specifications
- [docs/SYSTEM_ARCHITECTURE.md](./docs/SYSTEM_ARCHITECTURE.md) - Database schema, API specs, architecture
- [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) - Detailed API endpoints with examples
- [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) - PostgreSQL schema definitions
- [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) - Production deployment steps

## 🔐 Authentication

The application uses JWT-based authentication:

1. User registers or logs in with email/password
2. Server validates credentials and generates JWT token
3. Frontend stores token in localStorage
4. Token is automatically included in all API requests
5. On token expiry, refresh token is used to get new token
6. Session persists across browser refreshes

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user profile (requires auth)
- `PUT /api/auth/me` - Update user profile (requires auth)

### Users
- `GET /api/users` - List all users (paginated)
- `GET /api/users/:id` - Get user profile

### Forums
- `GET /api/forums` - Get all forums
- `GET /api/forums/:forumId` - Get forum with threads

### Threads
- `GET /api/forums/:forumId/threads/:threadId` - Get thread with comments
- `POST /api/forums/:forumId/threads` - Create thread (auth required)
- `PUT /api/forums/:forumId/threads/:threadId` - Update thread (owner only)
- `DELETE /api/forums/:forumId/threads/:threadId` - Delete thread (owner only)

### Comments
- `POST /api/forums/:forumId/threads/:threadId/comments` - Create comment (auth required)
- `PUT /api/forums/:forumId/threads/:threadId/comments/:commentId` - Update comment (owner only)
- `DELETE /api/forums/:forumId/threads/:threadId/comments/:commentId` - Delete comment (owner only)

## 📦 Available Scripts

### Backend
```bash
npm run dev      # Start with nodemon (auto-reload)
npm start        # Production start
npm test         # Run tests
```

### Frontend
```bash
npm run dev      # Development server with HMR
npm run build    # Production build
npm run preview  # Preview production build
```

## 🗄️ Database

The application uses PostgreSQL with the following tables:

- **users**: User accounts and authentication
- **games**: MMO/RPG game definitions
- **forums**: Discussion forums per game
- **threads**: Discussion threads
- **comments**: Replies to threads with soft delete
- **moderation_log**: Audit trail for moderation actions

All tables are automatically created on first backend startup.

## 🔄 Development Workflow

1. Create feature branch from `main`
2. Implement feature with modular structure
3. Test locally with both backend and frontend
4. Submit pull request to `main`
5. Code review and merge

## 🚀 Deployment

See [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for detailed deployment instructions including:

- Linux server setup with Node.js and PostgreSQL
- Docker deployment with Docker Compose
- Nginx reverse proxy configuration
- SSL certificates with Let's Encrypt
- PM2 process management
- Database backup strategy

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 👥 Team

- **Author**: TartuDen
- **Email**: denver1033@gmail.com
- **Status**: Phase 1 Development

## 🎯 Roadmap

### Phase 1 (Current - MVP)
- ✅ User authentication with JWT
- ✅ Forum/thread/comment system
- ✅ Backend API with full CRUD operations
- ✅ Frontend pages (Login, Register, Home)
- ⏳ Frontend forum/thread pages
- ⏳ Testing & bug fixes

### Phase 2
- Real-time notifications (Socket.io)
- User profiles with avatars
- Advanced search functionality
- Moderation dashboard
- User reputation/karma system

### Phase 3
- PWA for mobile access
- Rich text editor for posts
- File upload support
- Email notifications

### Phase 4
- Admin panel
- Advanced analytics
- Performance optimization
- Scaling improvements

## 🆘 Support

For issues, questions, or suggestions, please open an issue on GitHub or contact the development team.

---

**Created**: January 16, 2026
**Status**: Phase 1 - MVP Development
**Repository**: https://github.com/TartuDen/MMORPG_forum_vibe1
