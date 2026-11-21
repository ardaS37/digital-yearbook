
# Digital Yearbook

Digital Yearbook is a server-rendered web application for creating private school yearbooks. It supports role-based access, student and teacher profiles, moderated messages, class pages, photo galleries, consent flows, and offline export.

## Highlights

- Access-code authentication with hashed access codes and role-based authorization
- Student, teacher, administrator, and guest accounts
- Class pages, profiles, messages, announcements, galleries, and printable views
- Consent, privacy, moderation, audit-log, and access-control features
- Excel import, backups, and offline yearbook export tools
- Optional embedded board-game routes

## Stack

- Node.js and Express
- EJS templates and browser-side JavaScript
- SQLite for local development; PostgreSQL supported through `DATABASE_URL`

## Quick start

Requirements: Node.js 20 or newer.

```bash
cd backend
npm ci
cp ../.env.example ../.env
npm run init-db
npm run dev
```

Open `http://127.0.0.1:3000`.

## Configuration

Copy `.env.example` to `.env` and set a strong `SESSION_SECRET` before any production deployment. If `DATABASE_URL` is set, the application uses PostgreSQL; otherwise it creates a local SQLite database under `database/`.

## Data safety

This repository intentionally contains no real accounts, access codes, database files, backups, uploads, logs, or deployment credentials. Use only synthetic data in development and keep production data outside version control.

## Testing

```bash
cd backend
npm test
```

## License

No license is granted. All rights reserved.


## Images
<img width="1919" height="1070" alt="Screenshot 2026-08-27 120956" src="https://github.com/user-attachments/assets/3e84d541-babe-4bf0-8a95-2623470c817d" />
<img width="1911" height="1074" alt="Screenshot 2026-08-27 120932" src="https://github.com/user-attachments/assets/4adf1de5-1b23-4980-87b1-d863ae1a1cf7" />
<img width="1912" height="1068" alt="Screenshot 2026-08-27 121004" src="https://github.com/user-attachments/assets/8e49d1ac-054c-4b21-a614-f5070ebf36de" />

<!-- project-screenshot-gallery:start -->
## Demo screenshots

The signed-in screens show Liquid Glass v3 in a local demo with fictional student accounts and stock photographs. [Photo 1](https://images.unsplash.com/photo-1470770841072-f978cf4d019e) · [Photo 2](https://images.unsplash.com/photo-1516321318423-f06f85e504b3) · [Photo 3](https://images.unsplash.com/photo-1501785888041-af3ef285b470)

<p>
  <a href="docs/screenshots/readme/01-yilliga-giris.png"><img src="docs/screenshots/readme/01-yilliga-giris.png" alt="Yearbook sign-in" width="440"></a>
  <a href="docs/screenshots/readme/02-hesap-basvurusu.png"><img src="docs/screenshots/readme/02-hesap-basvurusu.png" alt="Account application" width="440"></a>
</p>

<p>
  <a href="docs/screenshots/readme/03-yillik-ana-sayfa.png"><img src="docs/screenshots/readme/03-yillik-ana-sayfa.png" alt="Home page with Liquid Glass v3" width="440"></a>
  <a href="docs/screenshots/readme/04-siniflar.png"><img src="docs/screenshots/readme/04-siniflar.png" alt="Class list with Liquid Glass v3" width="440"></a>
</p>

<p>
  <a href="docs/screenshots/readme/05-sinif-sayfasi.png"><img src="docs/screenshots/readme/05-sinif-sayfasi.png" alt="Class page with Liquid Glass v3" width="440"></a>
  <a href="docs/screenshots/readme/06-ogrenci-profili.png"><img src="docs/screenshots/readme/06-ogrenci-profili.png" alt="Student profile with Liquid Glass v3" width="440"></a>
</p>

<p>
  <a href="docs/screenshots/readme/07-fotograf-galerisi.png"><img src="docs/screenshots/readme/07-fotograf-galerisi.png" alt="Photo gallery with Liquid Glass v3" width="440"></a>
  <a href="docs/screenshots/readme/08-galeri-albumu.png"><img src="docs/screenshots/readme/08-galeri-albumu.png" alt="Gallery album with Liquid Glass v3" width="440"></a>
</p>
<!-- project-screenshot-gallery:end -->
