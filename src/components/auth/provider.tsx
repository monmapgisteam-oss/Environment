"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { APP_ID } from "@/lib/portal";
import {
  isLive,
  getToken,
  readSession,
  signIn,
  signOut as forget,
  type Session,
} from "@/lib/auth";
import { SignIn } from "@/components/auth/sign-in";

/* --------------------------------------------------------------------------
   НЭВТРЭЛТИЙН ХААЛГА

   Байгууллагын өгөгдөл бүхэлдээ `organization` түвшинд хуваалцагдсан тул
   нэвтрээгүй хөтөч ямар ч давхарга татаж чадахгүй. Тиймээс нэвтрэлт нь
   нэмэлт боломж БИШ, системд орох ЗААВАЛ ёсны нөхцөл — хаалга нь бүх
   хуудсыг хамарна.

   ⚠ ХОЁР ЗАМ ХААЛГААР ОРОХГҮЙ:
     `/auth/callback/` — порталаас буцаж ирэх цэг. Хаавал хэрэглэгч
     нэвтэрч дуусаад дахин нэвтрэх дэлгэц рүү унана (мөчлөг үүснэ).

   ⚠ ЭХНИЙ ЗУРАГДАЛТ ДЭЭР ШИЙДВЭР ГАРГАХГҮЙ. Сесси нь `localStorage`-д
   сууна — сервер тал түүнийг мэдэхгүй тул статик HTML нь үргэлж
   "нэвтрээгүй" гэж зурагдана. Тэр чигээр нь харуулбал нэвтэрсэн
   хэрэглэгч ч хуудас сэргээх бүрд нэвтрэх дэлгэцийн анивчилтыг харна.
   Тиймээс `checking` гэсэн ГУРАВ ДАХЬ төлөв байна: хөтөч дээр
   хадгалалтыг уншиж дуустал юу ч шийдэхгүй.
   -------------------------------------------------------------------------- */

type State = "checking" | "in" | "out";

type Auth = {
  state: State;
  session: Session | null;
  /** Порталын нэвтрэх хуудас руу шилжинэ */
  enter: () => void;
  /** Гарах — локал сессийг устгана */
  leave: () => void;
  /**
   * Хадгалалтаас сессийг ДАХИН уншина.
   *
   * ⚠ `/auth/callback/` нь нэвтрэлтээ дуусгасны ДАРАА үүнийг ЗААВАЛ
   * дуудна. Хаалга нь сессийг ачаалагдахдаа НЭГ УДАА уншдаг бөгөөд
   * callback нь чөлөөт зам тул тэр мөчид сесси хараахан байхгүй —
   * `state` нь `out` болж тогтоно. Дараа нь `router.replace` нь
   * КЛИЕНТ талын шилжилт хийдэг учир хаалга дахин ачаалагддаггүй:
   * токен амжилттай бичигдсэн хэрнээ хэрэглэгч нэвтрэх дэлгэц рүү
   * буцаж, хязгааргүй мөчлөгт орно. `storage` үйл явдал ч аварахгүй —
   * тэр нь зөвхөн ӨӨР табд дуугардаг.
   */
  sync: () => void;
};

/**
 * Хадгалалтаас хүчинтэй сессийг уншина — төлөв ХӨНДӨХГҮЙ.
 *
 * `getToken()` нь хүчинтэй сессийг шууд буцааж, хугацаа нь дуусаж
 * эхэлсэн бол чимээгүй сунгадаг тул энд `isLive`-ийг дахин шалгахгүй.
 * Бүрэлдэхүүнээс гадна суух нь санаатай: цэвэр функц тул нөлөө ба
 * `sync` хоёулаа ижил замаар дуудна.
 */
async function readLive(): Promise<Session | null> {
  const token = await getToken();
  return token ? readSession() : null;
}

const Ctx = React.createContext<Auth | null>(null);

export function useAuth(): Auth {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAuth нь AuthProvider дотор дуудагдана");
  return v;
}

/** Порталаас буцаж ирэх цэг — хаалганаас чөлөөлөгдөнө */
const OPEN_PATHS = ["/auth/callback"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [state, setState] = React.useState<State>("checking");
  const [session, setSession] = React.useState<Session | null>(null);

  /** Уншсан сессийг төлөвт буулгах цорын ганц цэг */
  const settle = React.useCallback((fresh: Session | null) => {
    setSession(fresh);
    setState(fresh ? "in" : "out");
  }, []);

  /* Хадгалсан сессийг сэргээх. Хугацаа нь дуусаж эхэлсэн бол чимээгүй
     сунгана — хэрэглэгч ажлынхаа дундуур нэвтрэх дэлгэц рүү унах ёсгүй.
     `alive` нь салсан бүрэлдэхүүн рүү бичихээс сэргийлнэ */
  React.useEffect(() => {
    let alive = true;
    /* Төлөвийг АМЛАЛТЫН буцаа дуудлагад тавина. Нөлөөний биед шууд
       `setState` дуудвал зурагдалтын гинжин урвал үүсдэг тул
       `react-hooks/set-state-in-effect` хориглодог — уншилт нь цэвэр
       функц (`readLive`), төлөв тавих нь буцаа дуудлага байх нь мөн
       зөв хуваарилалт */
    void readLive().then((fresh) => {
      if (alive) settle(fresh);
    });
    return () => {
      alive = false;
    };
  }, [settle]);

  /*
    Токен хүчингүй болсныг өөр таб мэдэгдэнэ. Нэг табд гарахад нөгөө нь
    нэвтэрсэн хэвээр үлдвэл тэндээс явуулсан хүсэлт бүр 498-аар унана.
  */
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "arcgis.session") return;
      const s = readSession();
      setSession(s);
      setState(isLive(s) ? "in" : "out");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = React.useMemo<Auth>(
    () => ({
      state,
      session,
      enter: () => {
        void signIn();
      },
      leave: () => {
        forget();
        setSession(null);
        setState("out");
      },
      sync: () => {
        void readLive().then(settle);
      },
    }),
    [state, session, settle],
  );

  const open = OPEN_PATHS.some((p) => path === p || path === `${p}/`);

  return (
    <Ctx.Provider value={value}>
      {open || state === "in" ? (
        children
      ) : state === "checking" ? (
        <Checking />
      ) : (
        <SignIn onEnter={value.enter} configured={!!APP_ID} />
      )}
    </Ctx.Provider>
  );
}

/**
 * Хадгалалт уншигдах хүртэлх төлөв.
 *
 * Эргэлдэх тэмдэг БАЙХГҮЙ: уншилт нь миллисекундын хэрэг бөгөөд тэмдэг
 * нь өөрөө анивчилт болно. Зөвхөн дэвсгэрийн өнгийг барина — нэвтэрсэн
 * хэрэглэгчид энэ нь үл мэдэгдэх, нэвтрээгүйд нь нэвтрэх дэлгэц рүү
 * жигд шилжинэ.
 */
function Checking() {
  return <div className="min-h-[calc(100dvh-var(--head-h))] bg-paper" />;
}
