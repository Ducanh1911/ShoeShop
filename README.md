# 👟 Shoe Shop - E-Commerce Platform

Một ứng dụng thương mại điện tử bán giày hoàn chỉnh được xây dựng với MERN Stack (MongoDB, Express, React, Node.js).

## 👥 Thành viên nhóm

| STT | Họ và tên       | MSSV        |
| --- | --------------- | ----------- |
| 1   | Nguyễn Văn Toàn | 22810310059 |
| 2   | Bùi Đức Anh     | 22810310038 |
| 3   | Nguyễn Mạnh Chí | 22810310044 |

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cài đặt](#-cài-đặt)
- [Cấu hình](#-cấu-hình)
- [Tài khoản demo](#-tài-khoản-demo)
- [Tài liệu tham khảo](#-tài-liệu-tham-khảo)

## ✨ Tính năng

### Người dùng

- 🔐 Đăng ký và đăng nhập
- 🛍️ Xem danh sách sản phẩm
- 🔍 Tìm kiếm và lọc sản phẩm
- 🛒 Giỏ hàng và thanh toán
- 📦 Theo dõi đơn hàng
- 👤 Quản lý thông tin cá nhân

### Quản trị viên

- 📊 Dashboard quản lý
- 📦 Quản lý sản phẩm (thêm, sửa, xóa)
- 🏷️ Quản lý danh mục
- 👥 Quản lý người dùng
- 📋 Quản lý đơn hàng

## 🛠️ Công nghệ sử dụng

### Frontend

- **React.js** - Thư viện UI
- **Redux** - State management
- **React Router** - Routing
- **Axios** - HTTP client

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Bcrypt** - Password hashing

## 🚀 Cài đặt

### Yêu cầu hệ thống

- Node.js >= 14.x
- npm hoặc yarn
- MongoDB

### Bước 1: Clone repository

```bash
git clone https://github.com/toankunsss/BaoCaoCuoiMon.git
cd BaoCaoCuoiMon
```

### Bước 2: Cài đặt Backend

```bash
cd Backend
npm install
npm start
```

Backend sẽ chạy tại `http://localhost:3000`

### Bước 3: Cài đặt Frontend

Mở terminal mới:

```bash
cd Frontend
npm install
npm start
```

Frontend sẽ chạy tại `http://localhost:3001`

### Bước 4: Cài đặt Server

Mở terminal mới:

```bash
cd Server
npm install
npm start
```

Server API sẽ chạy tại `http://localhost:5000`

## ⚙️ Cấu hình

### Database

1. Tạo database MongoDB với tên `shoeshop123456`
2. Import dữ liệu mẫu từ thư mục `db/`:
   - `shoeshop123456.categories.json`
   - `shoeshop123456.products.json`
   - `shoeshop123456.users.json`
   - `shoeshop123456.orders.json`

### Environment Variables

Tạo file `.env` trong thư mục `Server/` với nội dung:

```env
MONGO_URL=mongodb://localhost:27017/shoeshop123456
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

## 🔑 Tài khoản demo

### Admin

- **Email:** `admin@gmail.com`
- **Password:** `123456`

### User

- **Email:** `user@gmail.com`
- **Password:** `123456`

## 📚 Tài liệu tham khảo

- [Video hướng dẫn](https://www.youtube.com/watch?v=3_96f9Tk3m8)

## 📝 License

© 2025 Shoe Shop. All rights reserved.

---

**Developed with ❤️ by toankunsss**