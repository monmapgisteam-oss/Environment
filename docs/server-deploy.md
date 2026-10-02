# Платформыг environment.ub.gov.mn дээр автоматаар шинэчлэх

Байгаль орчны хяналтын нэгдсэн систем GitHub дээр хөгжүүлэгддэг. Код
`main` салаа руу орох бүрд GitHub сайтыг автоматаар бүтээж, **`server-build`**
салаанд бэлэн файл болгон хадгална. Сервер тэр салааг 5 минут тутам татаж,
nginx-ийн хавтас руу хуулна.

- Серверт гаднаас холбогдох шаардлагагүй: SSH, нууц үг, түлхүүр GitHub-д
  өгөхгүй. Сервер **GitHub руу гарах HTTPS (443)** л хэрэгтэй.
- Порталын замууд (`/gis`, `/hosting`) хөндөгдөхгүй.
- Шинэ хувилбар байхгүй бол скрипт юу ч хуулахгүй.

## 1. Нэг удаагийн тохиргоо

Шаардлагатай програм: `git`, `rsync`.

```sh
# Скриптийг татна
sudo mkdir -p /opt/environment-platform
sudo curl -fsSL -o /opt/environment-platform/server-update.sh \
  https://raw.githubusercontent.com/monmapgisteam-oss/Environment/main/scripts/server-update.sh
sudo chmod +x /opt/environment-platform/server-update.sh

# Эхний удаа гараар ажиллуулж шалгана
sudo /opt/environment-platform/server-update.sh
cat /var/www/environment-platform/version.txt   # commit-ийн дугаар ба огноо
```

Хавтсын байрлалыг өөрчлөх бол орчны хувьсагчаар өгнө:
`SRC` (git-ийн хуулбар, анхдагч `/opt/environment-platform/src`) ба `WEB`
(nginx-ийн root, анхдагч `/var/www/environment-platform`).

> ⚠ `WEB` нь **зөвхөн энэ сайтад зориулсан** хавтас байх ёстой. Скрипт
> хуучин хувилбарын файлуудыг цэвэрлэдэг (`rsync --delete`) тул тэнд
> байгаа өөр файл устана.

## 2. cron (5 минут тутам)

```sh
sudo crontab -e
```

```cron
*/5 * * * * /opt/environment-platform/server-update.sh >> /var/log/environment-platform.log 2>&1
```

## 3. nginx

Одоо гараар хуулсан хувилбар байгаа `root`-ийг шинэ хавтас руу заана.
`/gis`, `/hosting` гэх мэт порталын `location`-ууд **хэвээр** үлдэнэ.

```nginx
# Платформ (статик сайт)
location / {
    root /var/www/environment-platform;
    # Сайт төгсгөлийн зураастай замуудтай: /departments/orchin/ → .../index.html
    try_files $uri $uri/ $uri/index.html =404;
    error_page 404 /404.html;
}

# Хувилбар бүрд нэр нь өөрчлөгддөг файлууд — удаан кэшлэж болно
location /_next/static/ {
    root /var/www/environment-platform;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

HTML хуудсуудыг удаан кэшлэхгүй: эс тэгвээс хэрэглэгч шинэ хувилбарыг
хоцорч харна.

```sh
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Шалгах

- `https://environment.ub.gov.mn/version.txt` — эхний мөр нь GitHub дээрх
  `main`-ийн сүүлийн commit-тэй таарах ёстой (push хийснээс хойш ~10 минутын
  дотор: бүтээлт ~5 минут + cron 5 минут).
- `https://environment.ub.gov.mn/gis/` — портал хэвийн нээгдэнэ.
- Нэвтрэх товч ажиллана. Порталд бүртгэлтэй аппын **Redirect URI**-д
  `https://environment.ub.gov.mn/auth/callback/` (төгсгөлийн зураастай)
  байх ёстой — одоогийн хувилбар аль хэдийн энэ хаягаар нэвтэрдэг бол
  бүртгэлтэй байна.

## Буцаах

Скриптийг cron-оос хасаад, nginx-ийн `root`-ийг өмнөх хавтас руу буцааж
заана.
