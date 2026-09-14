# Python E-Learning System

Project này gồm 2 phần chính:

- Backend: Node.js + Express + Prisma + SQL Server
- Frontend: Next.js

## Yêu cầu trước khi chạy

- Node.js 18+ và npm
- SQL Server đang chạy
- Git bash / terminal / VS Code terminal

## 1) Cài đặt dependencies

Mở terminal và chạy các lệnh sau:

```bash
cd PythonElearning/backend
npm install

cd ../frontend
npm install
```

## 2) Cấu hình database (Backend)

File môi trường backend đã có sẵn tại:

```bash
PythonElearning/backend/.env
```

Nội dung hiện tại:

```env
DATABASE_URL="sqlserver://localhost:1433;database=PythonElearning;integratedSecurity=true;trustServerCertificate=true"
PORT=5000
```

Nếu bạn đang dùng SQL Server khác, hãy cập nhật `DATABASE_URL` cho đúng.

Sau đó, chạy lệnh để Prisma generate client và đồng bộ schema với database:

```bash
cd PythonElearning/backend
npx prisma generate
npx prisma db push
```

> Lưu ý: nếu database `PythonElearning` chưa tồn tại, hãy tạo trước trong SQL Server.

## 3) Chạy Backend

```bash
cd PythonElearning/backend
npm run dev
```

Backend sẽ chạy tại:

- http://localhost:5000

Bạn có thể kiểm tra trạng thái bằng:

```bash
http://localhost:5000/api/health
```

Nếu trả về JSON có `status: "OK"`, nghĩa là backend đang chạy tốt.

## 4) Chạy Frontend

Mở terminal mới:

```bash
cd PythonElearning/frontend
npm run dev
```

Frontend sẽ chạy tại:

- http://localhost:3000

## 5) Chạy production build (tùy chọn)

Backend không có build riêng, chỉ cần chạy dev server như trên.

Frontend production:

```bash
cd PythonElearning/frontend
npm run build
npm run start
```

## 6) Kiểm tra nhanh

- Backend health check: http://localhost:5000/api/health
- Frontend homepage: http://localhost:3000

## 7) Troubleshooting

### Lỗi Prisma / SQL Server

- Kiểm tra SQL Server đã chạy chưa
- Kiểm tra `DATABASE_URL` trong `PythonElearning/backend/.env`
- Chạy lại:

```bash
cd PythonElearning/backend
npx prisma generate
```

### Lỗi frontend không chạy

- Đảm bảo đã chạy `npm install` trong `frontend`
- Kiểm tra port 3000 không đang bị sử dụng

### Lỗi backend không chạy

- Đảm bảo đang ở thư mục `backend`
- Kiểm tra file `.env`
- Thử chạy `npm run dev` lại sau khi cài dependencies xong

## 8) Cấu trúc thư mục nhanh

```text
PythonElearning/
├── backend/
│   ├── .env
│   ├── index.js
│   ├── package.json
│   └── prisma/
└── frontend/
    ├── app/
    ├── package.json
    └── public/
```
