# web site

Web application for creating and keeping track of worldbuilding projects. Users add things to the world, then connect them with relationships.

## Currently Working On

- User registration, login, and logout
- Create, edit, and delete worlds, with public or private visibility
- Owner, editor, and viewer access levels
- World thumbnails stored in Backblaze B2
- Entry types: four built-in types per world (character, location, faction, event), and ability to add custom types
- Entries with names, descriptions, and types
- Custom fields on entry types (text, long text, number, true/false, scale, choice, multiple choice)
- Locations that can be nested inside other locations, with rules for which types can contain which
- Relationships between entries, with relationship types
- Tags, including rules that apply a tag to matching entries automatically
- Search with combined filters for type, tag, and relationship
- Entry links with [[Entry name]]
- Comments for everyone in the world and private notes for editors
- Up to 5 images per entry
- Edit conflict detection with a version number on each entry
- Deleted entries are soft deleted and shown as recently deleted
- World dashboard with entry count, recently created, modified, and deleted entries, and a list of entries without a type
- PostgreSQL database with migrations
- Automated lint, build, tests, and migration checks with GitHub Actions
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
DATABASE_URL=postgres:// [user] : [password] @localhost:5432/ [DB]  (Replace with values and remove []s and spaces)
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
npm run lint
```

```
cd frontend
npm run lint
npm run build
```

Github actions runs on pushes and pull request:

- Backend: install, lint, build, unit tests, and end to end tests
- Migrations: runs migration up, down, and up again on an empty database
- Frontend: install, lint, and build

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
- Deleting a type with entries asks for confirmation and lets the user move the entries to another type or leave them without a type
- Each entry has a version number. Saving an old version is rejected with a conflict, so one user's edit can't silently overwrite another's
- Deleting an entry keeps its data and records it in the activity log. Its images are kept for 7 days

## Custom Fields

- Each entry type can have its own fields, those being text, long text, number, true/false, scale, choice, and multiple choice
- Required fields and number ranges are checked when an entry is saved. Entries that no longer fit are listed under needs attention on the dashboard
- Removing a choice option that entries use asks for confirmation and clears it from those entries

## Nested Locations

- A type can be turned on as nestable, so its entries can be placed inside other entries of a nestable type
- A nestable type can allow any parent type or only chosen ones
- An entry can not be placed inside itself or inside something it contains
- Changes that would break existing links, such as changing a type's rules or an entry's type, list the affected entries and ask for confirmation
- Deleting an entry moves its children up to its parent when allowed

## Relationships

- Relationship types have a name and a description. Every new world starts with Friend, Enemy, Member of, Located in, and Occurred in, which can be edited or deleted like custom types
- Each side of a relationship type can allow for any entry type or only chosen ones
- An entry can not have a relationship with itself, and the same relationship can not be added twice
- If an entry's type changes and a relationship no longer matches, it is kept and listed under Needs attention on the dashboard

## Tags

- An entry can have any number of tags
- Tag changes show under recently modified on the dashboard but do not change the entry's version
- Deleting a tag asks for its name and shows how many entries have it
- A tag can have a rule that adds it to matching entries automatically. Rules can match an entry type, a relationship to another entry, or being inside a location, and can include or exclude entries, matching all or any of the included conditions
- If a rule points at something that was deleted, the rule pauses and is listed under Needs attention on the dashboard
- Automatic tags are marked on the entry and link to the tag's rule

## Search and Filters

- The entries list can be searched by name and description
- Advanced search can include or exclude entry types, tags, and relationships
- Tags can require all or any of the included tags
- A relationship filter picks a relationship type, a direction, and an entry, for example every "Member Of" "Knights"
- Filters are kept in the page address

## Entry Links

- Writing [[Entry name]] in a description links to that entry
- Renaming an entry updates the links to it in other descriptions
