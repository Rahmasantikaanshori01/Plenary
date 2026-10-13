# 🎟️ Plenary

**Plenary — One Platform, Every Experience.**

Plenary adalah platform ticketing berbasis website yang dirancang untuk memudahkan pengguna mencari, membeli, dan mengelola tiket berbagai acara hiburan, seperti konser, teater, film, musik, dan pertunjukan lainnya.

Plenary memiliki beberapa jenis pengguna, yaitu Admin, Seller, Buyer, dan Staff. Setiap pengguna memiliki hak akses dan fitur yang berbeda sesuai dengan perannya.

Project ini dikembangkan untuk membangun platform ticketing dengan sistem pengelolaan acara, transaksi, tiket digital, serta manajemen pengguna yang terintegrasi dengan database.

---

## ✨ Fitur Utama

### 👤 Buyer (Pembeli)
- Registrasi dan login akun.
- Melihat daftar acara yang tersedia.
- Mencari dan memfilter acara.
- Melihat detail acara dan informasi tiket.
- Melakukan pemesanan tiket.
- Mengelola pesanan dan riwayat transaksi.
- Menambahkan acara ke wishlist.
- Melihat tiket yang dimiliki.
- Mengakses profil dan notifikasi.

### 🏪 Seller (Penjual)
- Pengajuan pendaftaran sebagai seller.
- Proses verifikasi dan persetujuan oleh admin.
- Login menggunakan akun seller yang telah disetujui.
- Membuat dan mengelola acara.
- Mengatur kategori, jenis tiket, harga, dan kuantitas tiket.
- Mengelola pesanan tiket.
- Melihat informasi penjualan.
- Mengelola profil toko.
- Menyiapkan pengelolaan akun staf.

### 🛡️ Admin
- Mengelola data pengguna.
- Mengelola data buyer dan seller.
- Memverifikasi pengajuan seller.
- Mengelola acara dan tiket.
- Memantau pesanan dan transaksi.
- Mengelola langganan seller.
- Melihat aktivitas sistem.
- Mengakses laporan dan statistik.
- Mengelola notifikasi serta komunikasi dengan seller.

### 🎫 Sistem Ticketing
- Pengelolaan data acara.
- Pengelolaan jenis dan kuantitas tiket.
- Pencatatan pesanan.
- Pengelolaan status transaksi.
- Pengelolaan tiket digital.
- Pencatatan riwayat aktivitas.

---

## 🧑‍💻 Bahasa Pemrograman

| Bahasa | Penggunaan |
|---|---|
| TypeScript | Pengembangan frontend dan backend dengan dukungan tipe data |
| JavaScript | Ekosistem pengembangan aplikasi web |
| HTML5 | Struktur halaman web |
| CSS3 | Tampilan, layout, animasi, dan responsivitas |
| SQL | Pengelolaan dan manipulasi data pada database MySQL |

**Catatan:** HTML5, CSS3, dan SQL dicantumkan sebagai bagian dari teknologi yang digunakan atau didukung dalam pengembangan. Implementasi aktualnya mengikuti kode yang tersedia di repository.

---

## ⚙️ Framework, Library, dan Tools

### Frontend
- **Next.js** — Framework React untuk membangun aplikasi web.
- **React.js** — Library untuk membangun antarmuka pengguna.
- **Tailwind CSS** — Framework CSS untuk membantu pengembangan tampilan.
- **TypeScript** — Mendukung penulisan kode yang lebih terstruktur dan memiliki pemeriksaan tipe data.

### Backend
- **Node.js** — Runtime untuk menjalankan JavaScript di sisi server.
- **Express.js** — Framework untuk membangun REST API.
- **TypeScript** — Digunakan untuk membantu menjaga konsistensi tipe data pada backend.

### Database dan ORM
- **MySQL** — Database relasional untuk menyimpan data aplikasi.
- **Prisma ORM** — ORM untuk menghubungkan backend dengan database, mengelola model data, dan menjalankan migrasi database.

### Autentikasi dan Keamanan
- **JWT (JSON Web Token)** — Digunakan untuk mendukung autentikasi berbasis token.
- **bcrypt** — Digunakan untuk hashing password sebelum disimpan ke database.

### Tools Pengembangan
- **Visual Studio Code** — Code editor.
- **Git** — Version control.
- **GitHub** — Penyimpanan repository dan kolaborasi kode.
- **npm** — Package manager untuk mengelola dependency.
- **XAMPP** — Lingkungan pengembangan lokal yang menyediakan MySQL.
- **phpMyAdmin** — Antarmuka berbasis web untuk mengelola database MySQL.

---

## 🗄️ Database

Plenary menggunakan **MySQL** sebagai database relasional dengan nama database:

`plenary`

Database digunakan untuk menyimpan dan mengelola data aplikasi, termasuk:

- Data pengguna.
- Profil buyer.
- Profil seller.
- Pengajuan dan verifikasi seller.
- Data staf.
- Data acara.
- Jenis dan harga tiket.
- Pesanan.
- Pembayaran.
- Tiket digital.
- Wishlist.
- Notifikasi.
- Langganan seller.
- Riwayat aktivitas sistem.

Prisma ORM digunakan untuk menghubungkan backend dengan database MySQL serta mengelola struktur tabel melalui schema dan migration.

### Gambaran Arsitektur

```text
Frontend (Next.js)
        |
        | HTTP Request
        v
Backend REST API
(Node.js + Express.js)
        |
        | Prisma ORM
        v
Database MySQL
(Database: plenary)
