# LSPD Record Management System (V1)

Satu aplikasi web statis: Incident Report, Surveillance Report, Penal Calculator, dan Records.
Berjalan penuh di browser (HTML + CSS + JavaScript + localStorage). Tanpa backend.

## Cara deploy ke GitHub Pages
1. Upload seluruh isi folder ini ke repository (index.html harus di root).
2. Taruh seal di `assets/LSPD-SEALS.png` (opsional).
3. Settings > Pages > Deploy from a branch > `main` / `(root)`.
4. Buka `https://username.github.io/repository/`.

Bisa dites lokal dengan `python3 -m http.server` lalu buka http://localhost:8000
(membuka index.html langsung via file:// tetap jalan, tapi seal tidak bisa ikut ter-export).

## Struktur
- `index.html` shell: topbar, sidebar, dialog
- `css/app.css` tampilan aplikasi (tema light/dark) | `css/paper.css` tampilan formulir A4
- `js/storage.js` **satu-satunya** file yang menyentuh localStorage
- `js/doc.js` editor bersama (autosave, file/reopen, export, delete)
- `js/incident.js`, `js/surveillance.js`, `js/penal.js`, `js/views.js`, `js/app.js` (router hash)
- `js/exporter.js` PDF / JPG / PNG (A4, dipotong hanya di batas blok)

## localStorage
| Key | Isi |
|---|---|
| `lspd_incident_reports` | Incident report (status `draft` / `filed`) |
| `lspd_surveillance_reports` | Surveillance report + evidence (foto dikompres) |
| `lspd_penal_calculations` | Hasil kalkulasi penal yang disimpan |
| `lspd_recent_records` | Log record yang terakhir dibuka/disimpan |
| `lspd_settings` | Data officer + tema |
| `lspd_accounts` | Akun lokal (password di-hash PBKDF2-SHA256 + salt, tidak pernah plain text) |
| `lspd_session` | Sesi login (sessionStorage; localStorage 7 hari jika "Keep me signed in") |

Draft = report dengan `status: "draft"`; autosave 0,7 detik setelah mengetik.

## Login (V1, lokal)
- Akun pertama di sebuah browser otomatis menjadi **administrator** (bisa reset password dan hapus akun lain di Settings).
- Password minimal 8 karakter, di-hash dengan Web Crypto (butuh HTTPS atau localhost; GitHub Pages sudah HTTPS).
- 5x salah password = jeda 30 detik. Password tidak bisa dipulihkan, hanya di-reset admin.
- Backup JSON **tidak** memuat akun/password.
- **Ini bukan keamanan sungguhan.** Situs statis: siapa pun yang membuka URL bisa membuat akun sendiri, dan siapa pun yang punya akses ke browser bisa membaca/menghapus data lewat DevTools. Akun tidak tersinkron antar perangkat. Untuk kontrol akses nyata perlu server (V2).

## Menuju V2 (database)
UI hanya memanggil `Store.saveIncident / getIncidents / getIncident / updateIncident / deleteIncident`,
`saveSurveillance / getSurveillance / ...`. Ganti isi `js/storage.js` dengan klien API/database
(dibuat async) dan sesuaikan pemanggilnya; tampilan tidak perlu dibongkar.

## Catatan
- Data hanya ada di browser/perangkat yang dipakai. Gunakan Settings > Export backup secara rutin.
- localStorage terbatas (~5 MB). Hanya gambar yang disimpan sebagai lampiran; file lain hanya dicatat namanya.
