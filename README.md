# Event Dashboard

Admin dashboard thống kê + vẽ chart cho dữ liệu sự kiện. Dữ liệu được poll định kỳ từ Google Sheet và lưu ở file JSON (không cần DB).

```
apps/api         Fastify + TypeScript  (API, job sync, lưu JSON)
apps/web         React + Vite + Recharts
packages/shared  Types dùng chung FE/BE
```

## Chạy nhanh

```bash
pnpm install
pnpm seed      # data mẫu (dataset "su_kien"), bỏ qua nếu đã nối Google Sheet
pnpm dev       # API :3001, web :5173 (Vite tự nhảy cổng nếu bận)
pnpm test      # unit test (parse, build dataset, stats)
```

## Docker

```bash
docker compose up -d --build   # http://localhost:3001 (web + API cùng một cổng)
docker compose logs -f
docker compose down            # dữ liệu JSON nằm trong volume `dashboard-data`, down -v mới xoá
```

Cấu hình đọc từ `apps/api/.env` (GOOGLE_SHEET_ID, GOOGLE_SHEET_TABS, SYNC_INTERVAL_MINUTES…). File key được mount read-only từ `apps/api/credentials/service-account.json`; key và `.env` không được đưa vào image (`.dockerignore`).

## Nối Google Sheet (service account)

1. Google Cloud → tạo service account, bật **Google Sheets API**, tải JSON key về `apps/api/credentials/service-account.json` (đã gitignore).
2. Mở Google Sheet → **Share** cho email của service account (quyền Viewer).
3. `cp .env.example apps/api/.env`, điền `GOOGLE_SHEET_ID` (đoạn giữa `/d/` và `/edit` trong URL) và `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`.
4. Chạy lại `pnpm dev`. Job sync chạy ngay khi khởi động, sau đó poll mỗi `SYNC_INTERVAL_MINUTES` phút; có thể bấm **Sync ngay** ở trang Đồng bộ.

Quy ước sheet: mỗi **tab = 1 dataset**. Header được tự tìm (bỏ qua tiêu đề/ghi chú phía trên) và bảng là dãy ô header liền nhau — ô header trống đầu tiên là biên phải, các cột công thức phụ phía sau bị bỏ qua. Kiểu cột tự nhận diện (number / date / string, ngưỡng 90% ô hợp lệ); ngày dạng `dd/mm/yyyy` hoặc `yyyy-mm-dd`. Ô không ép được kiểu sẽ thành rỗng và được đếm vào "Ô lỗi kiểu". Khi sync lỗi, dữ liệu cũ được giữ nguyên.

## Dữ liệu

- `apps/api/data/datasets/<tab>.json`: dữ liệu từng tab (ghi atomic, bỏ qua nếu hash không đổi)
- `apps/api/data/sync-state.json`: trạng thái lần sync gần nhất

## API

| Endpoint | Mô tả |
|---|---|
| `GET /api/datasets` | Danh sách dataset + schema cột |
| `GET /api/datasets/:name/records` | `page, pageSize, search, sort, order, from, to` |
| `GET /api/datasets/:name/stats/summary` | Số dòng, khoảng ngày, sum/avg/min/max từng cột số |
| `GET /api/datasets/:name/stats/timeseries` | `metric, agg, groupBy=day\|week\|month, from, to` |
| `GET /api/datasets/:name/stats/breakdown` | `by, metric, agg, limit` |
| `GET /api/dashboard/tasks` | Dữ liệu trang Tổng quan (task board): `status, label, assignee, category, today`; cần dataset có cột Task / Status / Assignee |
| `GET /api/sync/status`, `POST /api/sync/run` | Trạng thái / chạy sync tay |

## Trang Tổng quan (task board)

Tái hiện sheet "Tổng quan" của file Google Sheet hiện tại, dựa trên tab ẩn **All Tasks** (gom từ các tab Backlog / Chờ / Cần thực hiện / Đang tiến hành / Đã hoàn thành / Đã lưu trữ). Cấu hình: `GOOGLE_SHEET_TABS=All Tasks`. Gồm bộ lọc (trạng thái, nhãn, người thực hiện, dự án), số task theo trạng thái, task theo người thực hiện / dự án / hạn chót, bảng chi tiết task theo dự án (mặc định chỉ hiện task "Cần thực hiện", có bộ lọc ngay trên bảng) và danh sách task quá hạn. Task có cột Status trống được tính riêng thành "Chưa gán trạng thái".

Tab **Phân tích** là bộ chart tổng quát cho bất kỳ dataset nào (chọn cột ngày / chỉ số / nhóm).

## Giao diện

Nút **Tự động / Sáng / Tối** ở góc phải thanh trên; Tự động theo hệ điều hành, lựa chọn Sáng/Tối được nhớ trong trình duyệt.

## Deploy lên VPS (Docker + HTTPS)

Yêu cầu: VPS có Docker + Docker Compose v2, domain trỏ A record về IP VPS, mở cổng 80/443.

```bash
# 1. Đưa code lên VPS (git clone, hoặc: rsync -av --exclude node_modules --exclude .git ./ user@vps:~/dashboard/)
cd ~/dashboard

# 2. Cấu hình (các file này KHÔNG nằm trong git)
mkdir -p apps/api/credentials
#    scp file key từ máy bạn:  scp credentials/service-account.json user@vps:~/dashboard/apps/api/credentials/
cp .env.example apps/api/.env      # rồi sửa: GOOGLE_SHEET_ID, GOOGLE_SHEET_TABS=All Tasks, BASIC_AUTH_USER/PASSWORD
echo "DOMAIN=dashboard.example.com" > .env

# 3. Chạy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose logs -f dashboard   # thấy "sync ok" là xong
```

Lưu ý:
- **Nên đặt `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`**: dashboard không có trang đăng nhập, không đặt thì ai biết domain cũng xem được dữ liệu và bấm "Sync ngay". Mật khẩu chỉ an toàn khi truy cập qua HTTPS (đã có Caddy).
- Cập nhật phiên bản mới: đưa code mới lên rồi chạy lại lệnh `up -d --build`. Dữ liệu nằm trong volume nên không mất.
- Chỉ muốn chạy thử không HTTPS: `docker compose up -d --build` (cổng 3001).

### VPS đã có reverse proxy (80/443 bị chiếm): không dùng Caddy

Kiểm tra port trống: `sudo ss -tlnp`. Ví dụ chạy app ở `127.0.0.1:3100`:

```bash
printf 'HOST_PORT=3100\nBIND_ADDR=127.0.0.1\n' > .env
docker compose up -d --build            # KHÔNG dùng docker-compose.prod.yml
curl -s http://127.0.0.1:3100/api/health
```

Rồi trỏ reverse proxy hiện có vào `127.0.0.1:3100`. Ví dụ nginx:

```nginx
server {
    server_name dashboard.example.com;
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    listen 443 ssl;   # certbot --nginx -d dashboard.example.com sẽ thêm cert
}
```

Nếu proxy hiện có là container (Traefik, nginx-proxy…), `127.0.0.1` bên trong nó không phải máy host: cho cả hai vào chung một Docker network và proxy tới `dashboard:3001`.
