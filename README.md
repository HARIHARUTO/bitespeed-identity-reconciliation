# Bitespeed Backend Task - Identity Reconciliation

## Tech Stack
- Node.js + TypeScript
- Express
- SQLite

## Run Locally
```bash
npm install
npm run dev
```
Server runs at `http://localhost:3000`.

## Endpoint
### `POST /identify`
Request body:
```json
{
  "email": "string | null",
  "phoneNumber": "string | number | null"
}
```
At least one of `email` or `phoneNumber` must be present.

Response body:
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["a@b.com", "c@d.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Verify
```bash
npm test
npm run build
```

## Deployment
Set environment variables if needed:
- `PORT` (default: `3000`)
- `DB_PATH` (default: `./contacts.db`)

You can deploy this service on Render/Railway/Fly and expose `/identify`.
