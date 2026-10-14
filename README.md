# web site
## Done:

- User registration, login, and logout
- PostgreSQL database with migrations
- Automated builds and tests with GitHub Actions
- Docker deployment on Render

## Runnin Locally

Requirements: Node.js, Docker Desktop.


Create a `.env` file in the project root with these variables:

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=postgres:// [user] : [password] @localhost:5432/ [DB]  (Replace with values and emove []s and spaces)
JWT_SECRET=
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


