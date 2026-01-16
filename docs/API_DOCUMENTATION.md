# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints except `/auth/register` and `/auth/login` require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Response Format
All responses are JSON with the following structure:

**Success (2xx)**
```json
{
  "data": {},
  "message": "Success message"
}
```

**Error (4xx, 5xx)**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Endpoints

### Authentication

#### Register User
```
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}

Response 201:
{
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "message": "User registered successfully"
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}

Response 200:
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user"
    }
  },
  "message": "Login successful"
}
```

#### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response 200:
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Token refreshed"
}
```

### Forums

#### List Forums
```
GET /forums

Response 200:
{
  "data": [
    {
      "id": 1,
      "gameId": 1,
      "name": "General Discussion",
      "description": "General forum for WoW",
      "createdAt": "2024-01-16T10:00:00Z"
    }
  ],
  "message": "Forums retrieved"
}
```

#### Get Forum by ID
```
GET /forums/:id

Response 200:
{
  "data": {
    "id": 1,
    "gameId": 1,
    "name": "General Discussion",
    "description": "General forum for WoW",
    "threads": [
      {
        "id": 1,
        "title": "New expansion released",
        "userId": 1,
        "createdAt": "2024-01-16T10:00:00Z"
      }
    ],
    "createdAt": "2024-01-16T10:00:00Z"
  },
  "message": "Forum retrieved"
}
```

### Threads

#### List Threads
```
GET /threads?forumId=1&page=1&limit=10

Response 200:
{
  "data": [
    {
      "id": 1,
      "forumId": 1,
      "userId": 1,
      "title": "New expansion released",
      "content": "Amazing new content...",
      "commentCount": 5,
      "createdAt": "2024-01-16T10:00:00Z",
      "updatedAt": "2024-01-16T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42
  },
  "message": "Threads retrieved"
}
```

#### Create Thread
```
POST /threads
Authorization: Bearer <token>
Content-Type: application/json

{
  "forumId": 1,
  "title": "Best leveling zones?",
  "content": "What are the best zones for leveling..."
}

Response 201:
{
  "data": {
    "id": 2,
    "forumId": 1,
    "userId": 1,
    "title": "Best leveling zones?",
    "content": "What are the best zones for leveling...",
    "createdAt": "2024-01-16T11:00:00Z"
  },
  "message": "Thread created"
}
```

#### Get Thread by ID
```
GET /threads/:id

Response 200:
{
  "data": {
    "id": 1,
    "forumId": 1,
    "userId": 1,
    "title": "New expansion released",
    "content": "Amazing new content...",
    "author": {
      "id": 1,
      "username": "john_doe"
    },
    "comments": [
      {
        "id": 1,
        "threadId": 1,
        "userId": 2,
        "content": "Great expansion!",
        "author": {
          "id": 2,
          "username": "jane_doe"
        },
        "createdAt": "2024-01-16T10:30:00Z"
      }
    ],
    "createdAt": "2024-01-16T10:00:00Z"
  },
  "message": "Thread retrieved"
}
```

#### Update Thread
```
PUT /threads/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "content": "Updated content..."
}

Response 200:
{
  "data": {
    "id": 1,
    "title": "Updated title",
    "content": "Updated content...",
    "updatedAt": "2024-01-16T12:00:00Z"
  },
  "message": "Thread updated"
}
```

#### Delete Thread
```
DELETE /threads/:id
Authorization: Bearer <token>

Response 200:
{
  "message": "Thread deleted"
}
```

### Comments

#### Create Comment
```
POST /threads/:threadId/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Great thread! I agree..."
}

Response 201:
{
  "data": {
    "id": 5,
    "threadId": 1,
    "userId": 2,
    "content": "Great thread! I agree...",
    "createdAt": "2024-01-16T11:30:00Z"
  },
  "message": "Comment created"
}
```

#### Update Comment
```
PUT /comments/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated comment..."
}

Response 200:
{
  "data": {
    "id": 5,
    "content": "Updated comment...",
    "updatedAt": "2024-01-16T12:00:00Z"
  },
  "message": "Comment updated"
}
```

#### Delete Comment
```
DELETE /comments/:id
Authorization: Bearer <token>

Response 200:
{
  "message": "Comment deleted"
}
```

### Search

#### Full-text Search
```
GET /search?q=leveling&type=threads&limit=10

Response 200:
{
  "data": [
    {
      "id": 1,
      "type": "thread",
      "title": "Best leveling zones?",
      "forumId": 1,
      "createdAt": "2024-01-16T10:00:00Z"
    }
  ],
  "message": "Search results"
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| INVALID_CREDENTIALS | 401 | Email or password is incorrect |
| TOKEN_EXPIRED | 401 | JWT token has expired |
| UNAUTHORIZED | 403 | User not authorized for this action |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Input validation failed |
| SERVER_ERROR | 500 | Internal server error |
