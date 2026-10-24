# web site

Web application for creating and keeping track of worldbuilding projects. Users add things to the world, then connect them with relationships.

## Currently Working

- User registration, login, and logout
- Create, edit, and delete worlds, with public or private visibility
- Owner, editor, and viewer access levels
- World thumbnails stored in Backblaze B2
- Entry types: four built-in types per world (character, location, faction, event), and ability to add custom types, currently can act as any of the four built in types or none.
- Entries with names, descriptions, and types, filtered by type
- Up to 5 images per entry
- Edit conflict detection with a version number on each entry
- Deleted entries are soft deleted and shown as recently deleted
- World dashboard with entry count, recently created, modified, and deleted entries, and a list of entries without a type
- PostgreSQL database with migrations
- Automated builds and tests with GitHub Actions
- Docker deployment on Render

## Tech Stack

- Frontend: React, Vite, React Router
- Backend: NestJS, Passport, JWT, bcrypt
- Database: PostgreSQL with node-postgres and node-pg-migrate
- File storage: Backblaze B2
- Hosting: Docker, Render
- CI: GitHub Actions

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

Install dependencies, run migrations, and start the backend (http://localhost:3000):

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

## Worlds and Access

- Each world is public or private
- Owners can edit and delete their worlds. Deleting requires typing the world's name
- Editors can change world content. Viewers can only read it
- Public worlds can be viewed by anyone, including people who aren't signed in
- Private worlds are only visible to members
- Thumbnails and entry images are PNG, JPEG, or WebP files stored in a private bucket and shown through temporary signed links

## Entries

- Every world starts with four types: Characters, Locations, Factions, and Events. They can be renamed, edited, or deleted like any custom type
- A type can act as a character, location, faction, or event. Later features like the location hierarchy and the timeline use this, so a custom "Dungeon" type can act as a location
- Deleting a type with entries asks for confirmation and lets the user move the entries to another type or leave them without a type
- Each entry has a version number. Saving an old version is rejected with a conflict, so one user's edit can't silently overwrite another's
- Deleting an entry keeps its data and records it in the activity log. Its images are kept for 7 days
