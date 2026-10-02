#!/bin/sh
# Платформын шинэ хувилбарыг GitHub-аас татаж nginx-ийн хавтас руу хуулна.
# Байгууллагын сервер дээр cron-оор 5 минут тутам ажиллана
# (заавар: docs/server-deploy.md).
#
# Сервер GitHub руу ГАРАХ HTTPS л шаардана — гаднаас серверт холбогдох
# зүйл байхгүй. Шинэ хувилбар байхгүй бол юу ч хуулахгүй.
set -eu

REPO="${REPO:-https://github.com/monmapgisteam-oss/Environment.git}"
SRC="${SRC:-/opt/environment-platform/src}"     # git-ийн хуулбар
WEB="${WEB:-/var/www/environment-platform}"     # nginx-ийн root

if [ ! -d "$SRC/.git" ]; then
  git clone -q --depth 1 --branch server-build "$REPO" "$SRC"
  changed=1
else
  before=$(git -C "$SRC" rev-parse HEAD)
  git -C "$SRC" fetch -q --depth 1 origin server-build
  git -C "$SRC" reset -q --hard FETCH_HEAD
  [ "$before" = "$(git -C "$SRC" rev-parse HEAD)" ] && changed=0 || changed=1
fi

[ "$changed" = 1 ] || exit 0

mkdir -p "$WEB"
# `.git` вэбэд ГАРАХГҮЙ. --delete нь хуучин хувилбарын файлыг цэвэрлэнэ —
# тиймээс WEB нь ЗӨВХӨН энэ сайтын хавтас байх ёстой.
rsync -a --delete --exclude .git "$SRC/" "$WEB/"
echo "$(date -u +%FT%TZ) шинэчлэгдэв: $(head -n1 "$WEB/version.txt")"
