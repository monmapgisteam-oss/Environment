/*
  УЛААНБААТАРЫН ГЕОЛОГИ — газрын суурийн ангилал (JICA 2013), торон багц.

  Эх сурвалж, ангиллыг {@link scripts/build-geology.mjs} тайлбарласан.
  Материалын дугаар нь `latrine-sim.ts`-ийн `MATS`-тай ИЖИЛ (0–7) тул
  нэвчилтийн загвар, хөрсний зүсэлтийн гүний хэсэг хоёр НЭГ ангилал харна.

  ⚠ Тор 40 м — жорлонгийн бодит байршлаар шалгахад нэвчилтийн багцын
  материалтай 98.4% таарсан (2026-10-06, 15,158 жорлон); зөрүү нь зөвхөн
  хил дээр.
*/
import { asset } from "@/lib/base-path";

export type Geology = {
  /** Цэг дээрх материал (`MATS`-ийн дугаар), зураглалгүй бол `null` */
  at: (lon: number, lat: number) => number | null;
};

let pending: Promise<Geology> | null = null;

export function fetchGeology(): Promise<Geology> {
  pending ??= load().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

type Head = {
  x0: number; y0: number; dx: number; dy: number; nx: number; ny: number;
  blocks: { name: string; offset: number; count: number }[];
};

async function load(): Promise<Geology> {
  // eslint-disable-next-line no-restricted-globals -- статик файл, портал биш
  const res = await fetch(asset("/data/ub-geology.bin"));
  if (!res.ok) throw new Error(`Геологийн зураг уншигдсангүй (${res.status})`);
  const buf = await res.arrayBuffer();
  const n = new DataView(buf).getUint32(0, true);
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n))) as Head;
  const b = (name: string) => h.blocks.find((x) => x.name === name)!;
  /* ⚠ Блокууд 4 байтад эгнүүлэгдсэн — шууд харж болно */
  const rows = new Uint32Array(buf, b("rows").offset, b("rows").count);
  const ends = new Uint16Array(buf, b("ends").offset, b("ends").count);
  const vals = new Uint8Array(buf, b("vals").offset, b("vals").count);
  const { x0, y0, dx, dy, nx, ny } = h;
  return {
    at(lon, lat) {
      const c = Math.floor((lon - x0) / dx);
      const r = Math.floor((lat - y0) / dy);
      if (c < 0 || r < 0 || c >= nx || r >= ny) return null;
      /* мөрийн run-уудаас хоёртын хайлтаар */
      let lo = rows[r];
      let hi = rows[r + 1] - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (ends[m] > c) hi = m;
        else lo = m + 1;
      }
      const v = vals[lo];
      return v === 255 ? null : v;
    },
  };
}
