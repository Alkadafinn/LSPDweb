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

Draft = report dengan `status: "draft"`; autosave 0,7 detik setelah mengetik.

## Menuju V2 (database)
UI hanya memanggil `Store.saveIncident / getIncidents / getIncident / updateIncident / deleteIncident`,
`saveSurveillance / getSurveillance / ...`. Ganti isi `js/storage.js` dengan klien API/database
(dibuat async) dan sesuaikan pemanggilnya; tampilan tidak perlu dibongkar.

## Catatan
- Data hanya ada di browser/perangkat yang dipakai. Gunakan Settings > Export backup secara rutin.
- localStorage terbatas (~5 MB). Hanya gambar yang disimpan sebagai lampiran; file lain hanya dicatat namanya.
