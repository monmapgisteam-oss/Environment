import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Leaf,
  Trees,
  PawPrint,
  Sprout,
  CloudSun,
  ShieldAlert,
  Wallet,
} from "lucide-react";

export type DepartmentStatus = "live" | "partial" | "pending";

/**
 * Хэлтсийн бүртгэл.
 *
 * ЭНД ЗӨВХӨН БОДИТ МЭДЭЭЛЭЛ БАЙНА. Одоогоор хэлтсээс ирсэн цорын ганц зүйл нь
 * албан ёсны нэр. Модуль, ажлын урсгал, бүртгэх обьект, товчлол, чиг үүргийн
 * тайлбар зэргийг ТААМАГЛАЖ БҮҮ БИЧ — хэлтсээс ирмэгц энэ файлд нэмнэ.
 *
 * `icon`, `tone` нь дизайны сонголт (баримт биш) тул одооноос тогтоосон.
 */
export type Department = {
  slug: string;
  name: string;
  icon: LucideIcon;
  /** CSS хувьсагчийн нэр — globals.css дотор тодорхойлогдсон */
  tone: string;
  status: DepartmentStatus;
};

export const DEPARTMENTS: Department[] = [
  {
    slug: "zahirgaa",
    name: "Захиргаа удирдлагын хэлтэс",
    icon: Building2,
    tone: "--d-zahirgaa",
    status: "pending",
  },
  {
    slug: "sanhuu-monitoring",
    name: "Санхүү аж ахуй, мониторингийн хэлтэс",
    icon: Wallet,
    tone: "--d-sanhuu",
    status: "pending",
  },
  {
    slug: "orchin",
    name: "Хүрээлэн буй орчны ашиглалт хамгаалалтын хэлтэс",
    icon: Leaf,
    tone: "--d-orchin",
    status: "live",
  },
  {
    slug: "oi",
    name: "Ойн хэлтэс",
    icon: Trees,
    tone: "--d-oi",
    status: "live",
  },
  {
    slug: "amitan-urgamal",
    name: "Амьтан, ургамлыг хамгаалах хэлтэс",
    icon: PawPrint,
    tone: "--d-amitan",
    status: "live",
  },
  {
    slug: "nogoon-bus",
    name: "Ногоон бүсийн ашиглалт, хамгаалалтын хэлтэс",
    icon: Sprout,
    tone: "--d-nogoon",
    status: "live",
  },
  {
    slug: "unelgee-uur-amisgal",
    name: "Байгаль орчны үнэлгээ, уур амьсгалын өөрчлөлтийн хэлтэс",
    icon: CloudSun,
    tone: "--d-unelgee",
    status: "live",
  },
  {
    slug: "hyanalt",
    name: "Хяналтын хэлтэс",
    icon: ShieldAlert,
    tone: "--d-hyanalt",
    status: "live",
  },
];

export function getDepartment(slug: string) {
  return DEPARTMENTS.find((d) => d.slug === slug);
}

export const STATUS_LABEL: Record<DepartmentStatus, string> = {
  live: "Дата холбогдсон",
  partial: "Хэсэгчлэн",
  pending: "Мэдээлэл хүлээгдэж байна",
};
