# web site
## Done:

- User registration, login, and logout
- Create, edit, and delete worlds, with public or private visibility
- Owner, editor, and viewer access levels
- World thumbnails stored in Backblaze B2
- Basic world dashboard
- PostgreSQL database with migrations
- Automated builds and tests with GitHub Actions
- Docker deployment on Render

## Runnin Locally

Requirements: Node.js, Docker Desktop, a Backblaze B2 bucket


Create a `.env` file in the project root with these variables:

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=postgres:// [user] : [password] @localhost:5432/ [DB]  (Replace with values and emove []s and spaces)
JWT_SECRET=

B2_ENDPOINT=
B2_REGION=
B2_BUCKET=
B2_KEY_ID=
B2_APPLICATION_KEY=
```

Start the database:

```
docker compose up -d
```

Install dependencies, and run migrations and backend(http://localhost:3000):

```
cd backend
npm install
npm run migrate up
npm run start:dev
```

In another terminal, start the frontend (http://localhost:5173):

```
cd frontend
npm install
npm run dev
```

## Tests

```
cd backend
npm test
npm run test:e2e
```

## Project Structure

backend: NestJS API

frontend: React 

## Authentication

- Passwords are hashed with bcrypt
- Login returns a JWT that expires after 7 days
- Logout removes the token on the client. The token itself stays valid on the server until it expires


