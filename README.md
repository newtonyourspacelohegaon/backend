# CampusConnect Backend Specification

This document outlines the features and technical requirements to transform CampusConnect into a fully functional production application.

## 1. Authentication & Security
- **Phone Number Auth**: Integration with **Twilio** or **Firebase Auth** for SMS OTP verification.
- **JWT Authentication**: Secure session management using JSON Web Tokens (Access + Refresh tokens).
- **Role-Based Access Control (RBAC)**:
  - `Student`: Standard access.
  - `Admin`: Dashboard access to manage events, reports, and users.
  - `Moderator`: Ability to review flagged content.
- **College Verification**: Email verification using `.edu` or specific college domain emails to verify student status.

## 2. User Profiles & Social Graph
- **Profile Management**: CRUD operations for bio, interests, personality tags, key photos.
- **Social Graph**:
  - `Follow`/`Unfollow` system.
  - `Friends`/`Connections` logic.
  - `Block`/`Report` user functionality.
- **Privacy Settings**: Toggle between Public/Private profiles.

## 3. Dating Mode (The Vibe)
- **Matching Algorithm**:
  - Match based on: College, Interests overlap, Personality tags, Year of study.
  - "My Vibe" logic: Active match limitations (one active match at a time).
- **Coin System (Economy)**:
  - Ledger system to track Coin balance.
  - Transactions history (Purchases, Spends).
  - Logic to deduct coins when switching matches.
- **Blind Matching**: Logic to blur photos until specific interaction criteria are met.

## 4. Content & Feed (Instagram-style)
- **Posts**: Image/Video uploads with captions and hashtags.
- **Stories**:
  - 24-hour ephemeral content.
  - View tracking (who saw the story).
- **Interactions**: Like, Comment, Share functionality.
- **Media Storage**: Integration with **AWS S3** or **Cloudinary** for optimized image/video delivery.

## 5. Events System
- **Event Management**: Create, Update, Delete events (Admin/Club leads).
- **RSVP/Join**: Users can join events.
- **Ticketing (Optional)**: QR Code generation for event entry.
- **Categories**: Filter by Tech, Cultural, Sports, etc.

## 6. Real-time Communication
- **Chat System**:
  - 1-on-1 messaging using **Socket.io**.
  - Message status (Sent, Delivered, Read).
  - Typing indicators.
- **Notifications**:
  - Push notifications (FCM/Expo Push) for:
    - New Matches.
    - New Messages.
    - Event reminders.
    - Likes/Comments.

## 7. Payments & Monetization
- **Payment Gateway**: Integration with **Razorpay** (India) or **Stripe** (Global).
- **Products**:
  - Coin Packages (100 coins, 500 coins, etc.).
  - Premium Subscriptions (Optional: See who liked you, etc.).
- **Security**: Server-side validation of payment webhooks.

## 8. Tech Stack Recommendation
- **Runtime**: Node.js
- **Framework**: Express.js or NestJS (for better scalability).
- **Database**:
  - **MongoDB**: Primary database for flexible schema (Users, Posts, Chats).
  - **Redis**: For caching and session management.
- **ORM/ODM**: Mongoose or Prisma (with MongoDB support).

## 9. API Structure (Draft)

### Auth
- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `POST /auth/refresh-token`

### Users
- `GET /users/me`
- `PATCH /users/me` (Update profile)
- `GET /users/:id`

### Dating
- `GET /dating/recommendations`
- `POST /dating/match/:userId` (Cost: 100 coins)
- `GET /dating/active-match`

### Shop
- `GET /shop/packages`
- `POST /shop/create-order`
- `POST /shop/webhook` (Payment confirmation)
