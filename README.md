# BloodLink Rwanda

A website where voluntary blood donors register, and families who urgently need blood search for them by blood type and district. It works alongside RBC/NCBT, not in place of it: when no donor matches, it shows the nearest official blood centre (RCBT).

Built with HTML/CSS/JavaScript, Node.js + Express, and SQLite (MVP for the ALU formative assignment).

## Run it

```bash
npm install
npm run create-admin -- <username> <password>   # password: 8+ characters
npm run seed                                     # optional: 30 sample donors (phones 0700...)
npm start                                        # http://localhost:3000
npm test                                         # automated requirement tests
```

Remove the sample donors with `npm run seed -- --remove`.

## Pages

| Page | Path |
|---|---|
| Home + Help/FAQ | `/` |
| Donor registration | `/register.html` |
| Search + results + RCBT list | `/search.html` |
| Admin login | `/admin-login.html` |
| Admin dashboard (login required) | `/admin` |

## Where each requirement lives

| SRS | Where |
|---|---|
| FR 1 Registration, validation, update-if-phone-exists | `server.js` `POST /api/donors/register`, `Public/js/register.js` |
| FR 2 / FR 3 Search, max 20, first names only | `GET /api/donors/search`, `Public/js/search.js` |
| FR 3.2 / FR 4 No results → nearest RCBT | `GET /api/rcbt`, `NEAREST_RCBT` in `Public/js/data.js` |
| FR 3.3 Report, hidden after 2 reports | `POST /api/donors/:id/report` |
| 90-day reconfirmation rule | search query in `server.js` (re-registering reconfirms) |
| FR 5 / NFR 1–3 Admin login, hashed password, 15-min timeout, removal log | `/api/admin/*`, `views/admin.html`, `scripts/create-admin.js` |
| NFR 6 HTTPS redirect | `server.js` (when `NODE_ENV=production`) |
| NFR 11 English / Kinyarwanda | `Public/js/language.js` |

## Deploying (Render / Railway)

Set `NODE_ENV=production` and `SESSION_SECRET=<long random string>`. Start command: `npm start`.
Note: free hosts may wipe the SQLite file on restart unless you attach a persistent disk.

## Before a real launch

- Confirm each RCBT's direct phone number with RBC (currently all use the RBC toll-free line 114) in `database.js`.
- Have two Kinyarwanda speakers check the translations in `Public/js/language.js`.
- Follow Rwanda's data protection law (Law No. 058/2021).
