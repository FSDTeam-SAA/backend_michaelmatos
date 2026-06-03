# Travel Social Platform — Backend API

A full-featured Node.js/Express/MongoDB REST API for a travel social platform.

## Stack
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express 5.x
- **Database**: MongoDB via Mongoose 8.x
- **Auth**: JWT (access + refresh tokens)
- **File Uploads**: Multer (memory) → Cloudinary
- **Real-time**: Socket.IO 4.x
- **Email**: Nodemailer (Gmail)
- **Scheduling**: node-cron (trip status automation)

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env

# Run development server
npm run dev
```

## Environment Variables
See `.env.example` for all required variables.

## API Base URL
All endpoints are prefixed with `/api/v1`

---

## API Endpoints

### Auth — `/api/v1/auth`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | — | Register new user |
| POST | `/verify-email` | — | Verify email with code |
| POST | `/resend-verification` | — | Resend verification code |
| POST | `/login` | — | Login |
| POST | `/refresh-token` | — | Refresh access token |
| POST | `/forgot-password` | — | Send password reset code |
| POST | `/reset-password` | — | Reset password with code |
| POST | `/logout` | ✓ | Logout |
| PATCH | `/change-password` | ✓ | Change password |

### Users — `/api/v1/users`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | ✓ | Get own profile |
| PATCH | `/me` | ✓ | Update profile (avatar, name, bio, location) |
| GET | `/me/saved-posts` | ✓ | Get bookmarked posts |
| POST | `/help-ticket` | ✓ | Submit help & support ticket |
| GET | `/:id` | ✓ | Get user profile |
| POST | `/:id/follow` | ✓ | Follow user |
| DELETE | `/:id/follow` | ✓ | Unfollow user |
| POST | `/:id/block` | ✓ | Block user |
| DELETE | `/:id/block` | ✓ | Unblock user |
| GET | `/:id/followers` | ✓ | List followers (searchable) |
| GET | `/:id/following` | ✓ | List following (searchable) |
| GET | `/:id/posts` | ✓ | Get user's posts |
| GET | `/:id/trips` | ✓ | Get user's trips |

### Posts — `/api/v1/posts`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/feed` | ✓ | Home feed (followed users' posts) |
| POST | `/` | ✓ | Create post (multipart: images[]) |
| GET | `/:id` | ✓ | Get post by ID |
| PATCH | `/:id` | ✓ | Update post |
| PATCH | `/:id/toggle-private` | ✓ | Toggle private/public |
| DELETE | `/:id` | ✓ | Delete post |
| POST | `/:id/like` | ✓ | Like / unlike post (toggle) |
| GET | `/:id/likes` | ✓ | Get list of users who liked |
| POST | `/:id/bookmark` | ✓ | Bookmark / unbookmark (toggle) |

### Comments — `/api/v1/comments`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/post/:postId` | ✓ | Get top-level comments |
| GET | `/:commentId/replies` | ✓ | Get nested replies |
| POST | `/` | ✓ | Add comment or reply |
| DELETE | `/:id` | ✓ | Delete comment |
| POST | `/:id/like` | ✓ | Like / unlike comment |

### Trips — `/api/v1/trips`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✓ | Create trip (coverImage upload) |
| GET | `/my` | ✓ | Get my trips (filter by status) |
| GET | `/:id` | ✓ | Get trip detail |
| PATCH | `/:id` | ✓ | Update trip |
| DELETE | `/:id` | ✓ | Delete trip |

### Places — `/api/v1/places`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✓ | List/search places (geo, filter) |
| GET | `/trending` | ✓ | Trending places (by tripCount) |
| GET | `/:id` | ✓ | Place detail (gallery, reviews, nearby) |
| POST | `/` | Admin | Create place |

### Reviews — `/api/v1/reviews`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✓ | Submit review for completed trip |
| GET | `/my` | ✓ | Get my reviews |
| GET | `/place/:placeId` | ✓ | Get reviews for a place |
| DELETE | `/:id` | ✓ | Delete review |

### Notifications — `/api/v1/notifications`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✓ | Get notifications (with unread count) |
| PATCH | `/mark-all-read` | ✓ | Mark all as read |
| PATCH | `/:id/read` | ✓ | Mark one as read |
| DELETE | `/:id` | ✓ | Delete notification |

### Search — `/api/v1/search`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/?q=&type=` | ✓ | Full search (places/users/posts) |
| GET | `/suggestions?q=` | ✓ | Autocomplete suggestions |

### Admin — `/api/v1/admin` (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/stats` | Total counts, today's activity |
| GET | `/dashboard/user-join-chart?period=` | User join chart (7d/30d/12m) |
| GET | `/users` | List all users (search, ban filter) |
| GET | `/users/:id` | Get user detail |
| PATCH | `/users/:id/ban` | Ban / unban user |
| DELETE | `/users/:id` | Delete user |
| GET | `/posts` | List all posts |
| DELETE | `/posts/:id` | Delete post |
| GET | `/trips` | List all trips (filter by status) |
| DELETE | `/trips/:id` | Delete trip |
| GET | `/reviews` | List all reviews |
| DELETE | `/reviews/:id` | Delete review |
| GET | `/places` | List all places |
| DELETE | `/places/:id` | Delete place |
| GET | `/help-tickets` | List help tickets |
| PATCH | `/help-tickets/:id` | Update ticket status |

---

## Key Business Logic

### Trending Places
Every time a trip is created, the system finds or creates a `Place` document at those coordinates and increments its `tripCount`. `GET /places/trending` returns places sorted by `tripCount` descending.

### Place Gallery Images
The gallery shown on a place detail page aggregates images from `Post` documents whose coordinates are within 1km of the place — not from the Place document itself.

### Trip Status Automation
A cron job runs every minute:
- `upcoming` → `ongoing` when `fromDate` is reached
- `ongoing` → `completed` when `toDate` passes
- Sends in-app notification on each status change
- On completion, prompts user to submit a review

### Reviews
Only available after a trip is `completed`. One review per user per trip (`userId + tripId` unique index). Submitting a review recalculates the place's average rating.

### Real-time Notifications
Socket.IO room per user (`userId` string). Events: `newNotification`. Client connects and calls `socket.emit("join", userId)`.

---

## Authentication
Send `Authorization: Bearer <accessToken>` header on all protected routes.

## File Upload
All file uploads use `multipart/form-data`. Files are uploaded to Cloudinary via memory storage (no temp disk files).
