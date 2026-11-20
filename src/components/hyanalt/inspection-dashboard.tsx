"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, CalendarDays, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, ClipboardCheck, FileText, List, Loader2, MapPin, Paperclip, RotateCcw, Search, ShieldAlert, Users, X } from "lucide-react";
import { NoAccess, useAccess } from "@/components/auth/access";
import { defaultBasemap, type Extent, type MapPoints } from "@/components/wells/map";
import { viewAllowed } from "@/lib/access";
import { arcgisBlobUrl, arcgisJson } from "@/lib/arcgis";
import { INSPECTIONS } from "@/lib/hyanalt-layers";
import { fetchLayerFeatures, fetchLayerInfo, serviceOf, type LayerFeatures, type LayerInfo } from "@/lib/portal-layers";
import { INSPECTION_GROUPS, inspectionText, inspectionDate, inspectionFields, inspectionGroup, inspectionRecord, inspectionValue, inspectionYes, inspectionsByOfficer, type InspectionRecord } from "@/lib/inspections";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import { AreaChart, PieChart, RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { cn, num } from "@/lib/utils";
import styles from "./inspection-dashboard.module.css";

const PointMap = dynamic(() => import("@/components/wells/map").then((m) => m.WellsMap), { ssr: false });
const LAYER = INSPECTIONS.layers[0];
type Loaded = { info: LayerInfo; data: LayerFeatures };
type Filter = "all" | "inspection" | "violation" | "resolved";

export function InspectionDashboard() {
  const { tabRule, pending, allowsTab } = useAccess();
  const rule = tabRule("hyanalt", "inspections");
  if (pending) return <div className={styles.state}><Loader2 size={18} className="animate-spin" />Ачаалж байна…</div>;
  if (!allowsTab("hyanalt", "inspections") || (rule.layers && !rule.layers.includes(LAYER))) return <NoAccess />;
  const canMap = viewAllowed(rule, "map");
  const canDb = viewAllowed(rule, "db");
  if (!canMap && !canDb) return <NoAccess />;
  return <InspectionBoard key={`${canMap}:${canDb}`} canMap={canMap} canDb={canDb} />;
}

function InspectionBoard({ canMap, canDb }: { canMap: boolean; canDb: boolean }) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [year, setYear] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [showRecords, setShowRecords] = React.useState(false);
  const [checkType, setCheckType] = React.useState("");
  /* Нэмэлт диаграмын шүүлт (хэрэглэгч 2026-11-13) — диаграм бүр өөрийн түлхүүрээр */
  const [picks, setPicks] = React.useState<Partial<Record<PickKey, string>>>({});
  const [attachments, setAttachments] = React.useState<Map<number, Attachment[]> | null>(null);
  const [geometryReady, setGeometryReady] = React.useState(false);
  const [basemap, setBasemap] = React.useState(defaultBasemap);
  const tip = useMapTip();

  React.useEffect(() => {
    const controller = new AbortController();
    fetchLayerInfo(INSPECTIONS, LAYER, controller.signal).then(async (info) => {
      const data = await fetchLayerFeatures(info, controller.signal, (partial) => setLoaded({ info, data: partial }));
      if (!controller.signal.aborted) { setLoaded({ info, data }); setGeometryReady(true); }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Мэдээлэл татагдсангүй");
    });
    return () => controller.abort();
  }, [attempt]);

  /* Хавсралт — бүх бүртгэлийнхийг НЭГ асуулгаар (`queryAttachments`) */
  React.useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    const url = `${serviceOf(loaded.info.set, loaded.info.id)}/${loaded.info.layerId}/queryAttachments`;
    arcgisJson<{ attachmentGroups?: { parentObjectId: number; attachmentInfos: Attachment[] }[] }>(
      `${url}?${new URLSearchParams({ definitionExpression: "1=1", f: "json" })}`, "Хавсралт", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setAttachments(new Map((result.attachmentGroups ?? []).map((g) => [g.parentObjectId, g.attachmentInfos]))); })
      .catch(() => { if (!controller.signal.aborted) setAttachments(new Map()); });
    return () => controller.abort();
  }, [loaded?.info]); // eslint-disable-line react-hooks/exhaustive-deps

  const records = React.useMemo(() => Object.entries(loaded?.data.rows ?? {}).map(([id, row]) => inspectionRecord(Number(id), row))
    .sort((a, b) => (Number.isFinite(b.date) ? b.date : 0) - (Number.isFinite(a.date) ? a.date : 0) || b.id - a.id), [loaded]);
  const baseOk = (record: InspectionRecord) => (!department || record.department === department)
    && (!year || inspectionDate(record.row.ognoo).startsWith(year)) && (!query.trim() || record.search.includes(query.trim().toLocaleLowerCase("mn")));
  /* Нэмэлт диаграмын шүүлт; `skip` — тухайн диаграм өөрийгөө алгасна (өөр утга руу шилжих боломж үлдэнэ) */
  const picksOk = (record: InspectionRecord, skip?: PickKey) => PICK_KEYS.every((key) => key === skip || !picks[key] || PICKS[key](record) === picks[key]);
  const searched = records.filter((record) => baseOk(record) && picksOk(record));
  const matchesType = (record: InspectionRecord) => (filter === "all" || (filter === "resolved" ? record.resolved : record.kind === filter)) && (!checkType || record.row[record.prefix + "turul"] === checkType);
  const filtered = searched.filter((record) => (!district || record.district === district) && matchesType(record));
  const chartRows = (skip: PickKey) => records.filter((record) => baseOk(record) && picksOk(record, skip) && (!district || record.district === district) && matchesType(record));
  const pickChart = (key: PickKey) => ({
    data: countBy(chartRows(key), PICKS[key]),
    selected: picks[key] ?? null,
    onSelect: (value: string | null) => { setPicks((current) => ({ ...current, [key]: value ?? undefined })); setSelectedId(null); },
  });
  const selected = canDb ? filtered.find((record) => record.id === selectedId) : undefined;
  const hovered = records.find((record) => record.id === tip.oid);
  const statRows = searched.filter((record) => (!district || record.district === district) && (!checkType || record.row[record.prefix + "turul"] === checkType));
  const stats = [
    { id: "all" as const, label: "Нийт бүртгэл", count: statRows.length, icon: FileText },
    { id: "inspection" as const, label: "Хяналт шалгалт", count: statRows.filter((record) => record.kind === "inspection").length, icon: ClipboardCheck },
    { id: "violation" as const, label: "Зөрчлийн бүртгэл", count: statRows.filter((record) => record.kind === "violation").length, icon: ShieldAlert },
    { id: "resolved" as const, label: "Газар дээр арилгуулсан", count: statRows.filter((record) => record.resolved).length, icon: CheckCheck },
  ];
  const points = React.useMemo(() => {
    const result: MapPoints = { oid: [], lon: [], lat: [] };
    for (const feature of loaded?.data.shapes.features ?? []) {
      if (feature.geometry?.type !== "Point") continue;
      const [lon, lat] = feature.geometry.coordinates;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      result.oid.push(Number(feature.id)); result.lon.push(lon); result.lat.push(lat);
    }
    return result;
  }, [loaded]);
  const ids = new Set(filtered.map((record) => record.id));
  const visible = Uint32Array.from(points.oid.flatMap((id, index) => ids.has(id) ? [index] : []));
  const pointIndex = selected ? points.oid.indexOf(selected.id) : -1;
  const focus = useInspectionFocus(points, visible, pointIndex);
  const pick = (id: number | null) => { if (canDb) setSelectedId(id); };
  const clear = () => { setQuery(""); setDistrict(""); setDepartment(""); setYear(""); setFilter("all"); setCheckType(""); setPicks({}); setSelectedId(null); };
  const pickCount = PICK_KEYS.filter((key) => picks[key]).length;
  const filteredOn = !!(query || district || department || year || checkType || filter !== "all" || pickCount);
  const recordList = <div className={styles.list} aria-label="Бөглөсөн албан хаагчаар">
    {inspectionsByOfficer(filtered).map((group) => <details key={group.key} className={styles.officerGroup} open>
      <summary title={group.department}><Users size={14} /><strong>{group.name}</strong><span className="num">{group.records.length} бүртгэл</span><ChevronDown size={13} /></summary>
      {group.records.map((record) => <button type="button" key={record.id} className={styles.record} aria-pressed={selected?.id === record.id} onClick={() => pick(record.id)}>
        <span className={styles.recordTop}><span className={cn(styles.badge, record.kind === "violation" && styles.violation)}>{record.type}</span><time className="num">{inspectionDate(record.row.ognoo)}</time></span>
        {record.activity && <span className={styles.activity}>{record.activity}</span>}
        <strong>{record.title}</strong>
        {(record.decision || record.resolved) && <span className={styles.recordOutcome}>{[record.decision, record.resolved ? "Газар дээр арилгуулсан" : ""].filter(Boolean).join(" · ")}</span>}
        <span className={styles.recordBottom}><span><MapPin size={12} />{record.place || "Байршил бүртгээгүй"}</span><ChevronRight size={14} /></span>
      </button>)}
    </details>)}
    {!filtered.length && <div className={styles.state}>Тохирох бүртгэл алга{filteredOn && <button type="button" onClick={clear}>Шүүлт арилгах</button>}</div>}
  </div>;

  return (
    <div className={styles.root}>
      <FilterBar title="ХЯНАЛТ ШАЛГАЛТ" activeCount={[query, district, department, year, checkType, filter !== "all"].filter(Boolean).length + pickCount} onReset={clear}>{/* Оны товч ("Бүгд · 2026") ХАСАГДСАН (хэрэглэгч 2026-11-13: "del") — огноогоор "Огноо, сараар" диаграмаас шүүнэ */}
        <FilterMenu label="Дүүрэг" icon={MapPin} value={district || null} active={!!district} onClear={() => setDistrict("")} width={230}>
          <PickList items={countBy(records, (record) => record.district)} selected={district || null} onPick={(value) => setDistrict(value ?? "")} />
        </FilterMenu>
        <FilterMenu label="Хэлтэс" icon={Users} value={department || null} active={!!department} onClear={() => setDepartment("")} width={280}>
          <PickList items={countBy(records, (record) => record.department)} selected={department || null} onPick={(value) => setDepartment(value ?? "")} />
        </FilterMenu>
        <label className={styles.search}><Search size={14} /><input aria-label="Бүртгэл хайх" placeholder="Бүртгэл хайх…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Хайлт арилгах" onClick={() => setQuery("")}><X size={13} /></button>}</label>
      </FilterBar>
      {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}><RotateCcw size={14} />Дахин оролдох</button></div>}
      {!loaded ? !error && <div className={styles.state}><Loader2 size={18} className="animate-spin" />Бүртгэл ачаалж байна…</div> : <>
        <Columns id="hyanalt-inspections-2" layout="flex" left={canDb ? 300 : undefined} right={canDb ? 300 : undefined} className={styles.columns}>
          {canDb && <aside className={styles.leftColumn} aria-label="Бүртгэлийн задаргаа">
            <SwitchCard views={[
              { title: "Бүртгэлийн төрлөөр", count: statRows.length, body: <PieChart data={countBy(statRows, (record) => record.type)} size={100} selected={filter === "inspection" ? "Хяналт шалгалт" : filter === "violation" ? "Зөрчил" : null} onSelect={(value) => { setFilter(value === "Хяналт шалгалт" ? "inspection" : value === "violation" || value === "Зөрчил" ? "violation" : "all"); setSelectedId(null); }} colorOf={(item) => item.key === "Зөрчил" ? "var(--clay)" : "var(--moss)"} outlined shares={false} /> },
              { title: "Үндсэн чиг үүргийн ажил эсэх", body: <PieChart {...pickChart("core")} size={100} colorOf={yesNoColor} outlined shares={false} /> },
            ]} />
            <ChartCard title="Зөрчил, арга хэмжээ">
              <RowChart data={[
                { key: "found", label: "Зөрчил илэрсэн", value: filtered.filter((record) => record.found).length },
                { key: "resolved", label: "Газар дээр арилгуулсан", value: filtered.filter((record) => record.resolved).length },
                { key: "case", label: "Зөрчлийн хэрэг нээсэн", value: filtered.filter((record) => inspectionYes(record.row.zr_z_hereg_neesen)).length },
              ]} dense />
            </ChartCard>
            <ChartCard title="Шалгалтын төрлөөр">
              <RowChart data={countBy(searched.filter((record) => (!district || record.district === district) && (filter === "all" || (filter === "resolved" ? record.resolved : record.kind === filter))), (record) => String(record.row[record.prefix + "turul"] || "Бүртгээгүй"))} selected={checkType || null} onSelect={(value) => { setCheckType(value ?? ""); setSelectedId(null); }} dense clamp />
            </ChartCard>
            <ChartCard title="Бөглөгчийн албан тушаал">
              <RowChart {...pickChart("position")} dense />
            </ChartCard>
          </aside>}
          <section className={styles.centerColumn} aria-label="Хяналт шалгалтын газрын зураг">
            <div className={styles.stats}>
              {stats.map(({ id, label, count, icon: Icon }) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => { setFilter(filter === id ? "all" : id); setSelectedId(null); }} className={styles.stat}>
                <Icon size={23} strokeWidth={1.3} /><span>{label}<strong className="num">{num(count)}</strong></span>
              </button>)}
            </div>
            {canMap ? <div className={styles.map}>
              <PointMap points={points} visible={visible} basemap={basemap} onSelect={(id) => pick(selectedId === id ? null : id)} onHover={tip.onHover} focus={focus} highlight={pointIndex >= 0 ? [points.lon[pointIndex], points.lat[pointIndex]] : null} cluster={false} esriFirefly colors={points.oid.map((id) => records.find((record) => record.id === id)?.kind === "violation" ? "#e47b7b" : "#67d7e4")} />
              <BasemapGallery value={basemap} onChange={setBasemap} />
              {hovered && <MapTip state={tip} width={245}><div className={styles.mapTooltip}><strong>{hovered.title}</strong><span>{hovered.type} · {inspectionDate(hovered.row.ognoo)}</span><MapTipRow icon={MapPin} text={hovered.place} /></div></MapTip>}
              <div className={styles.legend}><span><i />Хяналт шалгалт</span><span><i />Зөрчил</span></div>
              {!geometryReady ? <span className={styles.mapNote}>Байршил ачаалж байна…</span> : visible.length < filtered.length && <span className={styles.mapNote}>{num(filtered.length - visible.length)} бүртгэлийн байршил зурагт алга</span>}
            </div> : <section className={styles.listPanel}><div className={styles.panelHeading}><h3>Бүртгэлүүд</h3><span>{filtered.length} / {records.length}</span></div>{recordList}</section>}
            {canDb && <ResizableRow>
              <ChartCard title="Огноо, сараар" fill>
                <AreaChart {...pickChart("month")} data={pickChart("month").data.sort((a, b) => a.key.localeCompare(b.key))} labels fill unit="бүртгэл" />
              </ChartCard>
              <ChartCard title="Зураг, хавсралт" count={attachments ? filtered.reduce((n, record) => n + (attachments.get(record.id)?.length ?? 0), 0) : undefined}>
                <InspectionGallery records={filtered} attachments={attachments} url={(record, file) => `${serviceOf(loaded.info.set, loaded.info.id)}/${loaded.info.layerId}/${record.id}/attachments/${file.id}`} selectedId={selected?.id ?? null} onPick={(id) => pick(selected?.id === id ? null : id)} />
              </ChartCard>
            </ResizableRow>}
          </section>
          {canDb && <aside className={styles.rightColumn} data-detail={!!selected} aria-label="Дүүргийн задаргаа, дэлгэрэнгүй">
            {selected ? <section className={styles.detailPanel}><InspectionDetail key={selected.id} record={selected} info={loaded.info} onBack={() => setSelectedId(null)} /></section> : <>
              <div className={styles.viewSwitch} role="group" aria-label="Баруун самбар"><button type="button" aria-pressed={!showRecords} onClick={() => setShowRecords(false)}>Задаргаа</button><button type="button" aria-pressed={showRecords} onClick={() => setShowRecords(true)}><List size={13} />Бүртгэлүүд <span className="num">{filtered.length}</span></button></div>
              {showRecords ? <section className={styles.listPanel}>{recordList}</section> : <>
                <SwitchCard views={[
                  { title: "Газрын зориулалт", body: <RowChart {...pickChart("landuse")} inline /> },
                  { title: "Эзэмшлийн хэлбэр", body: <RowChart {...pickChart("tenure")} inline /> },
                ]} />
                {/* Хувь биш тоо; агуулгынхаа өндөртэй (`fill` хасагдсан), мөр нэг эгнээнд (`inline` — нэр · зурвас · тоо, ~23px) (хэрэглэгч 2026-11-16) */}
                <ChartCard title="Дүүргээр" count={filtered.length}>
                  <RowChart data={countBy(searched.filter(matchesType), (record) => record.district)} selected={district || null} onSelect={(value) => { setDistrict(value ?? ""); setSelectedId(null); }} inline />
                </ChartCard>
                <ChartCard title="Үйл ажиллагааны чиглэл" fill>
                  <RowChart data={countBy(filtered, (record) => String(record.row[record.prefix + "chiglel"] || "Бүртгээгүй"))} dense />
                </ChartCard>
              </>}
            </>}
          </aside>}
        </Columns>
        <p className={styles.sourceNote}>Суурь зураг: Esri · Мэдээлэл: Survey123 · <span className="num">{filtered.length} / {records.length}</span> бүртгэл</p>
      </>}
    </div>
  );
}

function InspectionDetail({ record, info, onBack }: { record: InspectionRecord; info: LayerInfo; onBack: () => void }) {
  const [showEmpty, setShowEmpty] = React.useState(false);
  const groupsRef = React.useRef<HTMLDivElement>(null);
  const fields = inspectionFields(info.fields, record, showEmpty);
  const populated = inspectionFields(info.fields, record, false).length;
  return <>
    <div className={styles.panelHeading}><button type="button" className={styles.mobileBack} onClick={onBack}><ArrowLeft size={15} />Буцах</button><h3>Дэлгэрэнгүй</h3><span className="num">№{record.id}</span></div>
    <div className={styles.detailScroll}>
      <div className={styles.detailIntro}>
        <div className={styles.introTop}><span className={cn(styles.badge, record.kind === "violation" && styles.violation)}>{record.type}</span>{record.resolved ? <span className={styles.resolved}><CheckCheck size={13} />Газар дээр арилгуулсан</span> : record.found && <span className={styles.violationFlag}><ShieldAlert size={13} />Зөрчил илэрсэн</span>}</div>
        <h3>{record.title}</h3>
        {record.subject && record.subject !== record.title && <p>{record.subject}</p>}
        <div className={styles.facts}>
          <div><CalendarDays size={15} /><span>Огноо<strong className="num">{inspectionDate(record.row.ognoo)}</strong></span></div>
          <div><MapPin size={15} /><span>Байршил<strong>{record.place || "Бүртгээгүй"}</strong></span></div>
          <div><Users size={15} /><span>Бүртгэсэн албан хаагч<strong>{record.officer || "Бүртгээгүй"}</strong></span></div>
        </div>
      </div>
      <div className={styles.fieldToolbar}>
        <div className={styles.fieldSummary}><span><FileText size={13} aria-hidden="true" />Бөглөсөн талбар</span><b className="num">{populated}</b></div>
        <div className={styles.expandActions} role="group" aria-label="Мэдээллийн бүлгүүдийг дэлгэх, хураах">
          <button type="button" onClick={() => groupsRef.current?.querySelectorAll("details").forEach((group) => { group.open = true; })}><ChevronsDown size={13} aria-hidden="true" />Бүгдийг дэлгэх</button>
          <button type="button" onClick={() => groupsRef.current?.querySelectorAll("details").forEach((group) => { group.open = false; })}><ChevronsUp size={13} aria-hidden="true" />Бүгдийг хураах</button>
        </div>
        <label className={styles.emptyFieldsToggle}><span>Бөглөөгүй талбарыг харуулах</span><input type="checkbox" role="switch" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} /></label>
      </div>
      <div ref={groupsRef} className={styles.groups}>
        {INSPECTION_GROUPS.map((group) => {
          const items = fields.filter((field) => inspectionGroup(field.name) === group.id);
          if (!items.length) return null;
          return <details key={group.id} className={styles.group} open={group.id === "findings" || group.id === "actions"}>
            <summary><span>{group.title}</span><small className="num">{items.length}</small><ChevronDown size={15} /></summary>
            <dl>{items.map((field) => <div key={field.name} data-field={field.name}>
              <dt>{field.alias.replace(/^(Хяналт,? шалгалт|Зөрчил):\s*/i, "")}</dt>
              <dd>{inspectionValue(field, record.row[field.name])}</dd>
            </div>)}</dl>
          </details>;
        })}
        <InspectionAttachments info={info} id={record.id} />
      </div>
    </div>
  </>;
}

type Attachment = { id: number; name: string; contentType: string; size: number };

/*
  НЭМЭЛТ ДИАГРАМ (хэрэглэгч 2026-11-13: албан тушаал · огноо · үндсэн чиг үүрэг ·
  газрын зориулалт · эзэмшлийн хэлбэр · хавсралт). Утга нь домэйны нэрээр
  (`INSPECTIONS.domains`). Газрын зориулалт, эзэмшлийн хэлбэр нь бүртгэлийн
  ӨӨРИЙН салаанаас (`zr_hs_*` / `zr_z_*`) — "Бүртгэлийн төрлөөр"-ийг дарахад
  зөвхөн зөрчлийнх үлдэнэ. Домэйны дугаарлалтыг ("1.Өмчлөх", "3.1 Түрээс") хасна.
*/
const plainLabel = (value: unknown) => inspectionText(value).replace(/^\d+(\.\d+)*\.?\s*/, "");
const PICKS = {
  position: (record: InspectionRecord) => inspectionText(record.row.buglugch_alban_tushaal),
  core: (record: InspectionRecord) => inspectionText(record.row.undsen_ajil),
  landuse: (record: InspectionRecord) => plainLabel(record.row[record.prefix + "gazar_zoriulalt"]),
  tenure: (record: InspectionRecord) => plainLabel(record.row[record.prefix + "gazar_ezemshil"]),
  month: (record: InspectionRecord) => inspectionDate(record.row.ognoo).match(/^\d{4}\.\d{2}/)?.[0] ?? "",
} satisfies Record<string, (record: InspectionRecord) => string>;
type PickKey = keyof typeof PICKS;
const PICK_KEYS = Object.keys(PICKS) as PickKey[];

/** Зургийн цомог — шүүлтэд тохирох бүртгэлийн зураг, дарахад тэр бүртгэл сонгогдоно */
function InspectionGallery({ records, attachments, url, selectedId, onPick }: {
  records: InspectionRecord[]; attachments: Map<number, Attachment[]> | null;
  url: (record: InspectionRecord, file: Attachment) => string; selectedId: number | null; onPick: (id: number) => void;
}) {
  if (!attachments) return <p className={styles.galleryNote}><Loader2 size={13} className="animate-spin" />Хавсралт ачаалж байна…</p>;
  const items = records.flatMap((record) => (attachments.get(record.id) ?? []).filter((file) => file.contentType.startsWith("image/")).map((file) => ({ record, file })));
  if (!items.length) return <p className={styles.galleryNote}>Зураг хавсаргаагүй байна</p>;
  return <div className={styles.gallery}>
    {items.map(({ record, file }) => <button type="button" key={file.id} className={styles.thumb} aria-pressed={selectedId === record.id} title={`${record.title} · ${inspectionDate(record.row.ognoo)}`} onClick={() => onPick(record.id)}>
      <span className={styles.thumbImage}><GalleryImage url={url(record, file)} name={file.name} /></span>
      <span className={styles.thumbCaption}><i className={cn(record.kind === "violation" && styles.violation)} aria-hidden />{record.title}</span>
    </button>)}
  </div>;
}

function GalleryImage({ url, name }: { url: string; name: string }) {
  const [blob, setBlob] = React.useState("");
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    let local = "";
    arcgisBlobUrl(url, name).then((value) => { local = value; if (alive) setBlob(value); else URL.revokeObjectURL(value); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (local) URL.revokeObjectURL(local); };
  }, [url, name]);
  /* eslint-disable-next-line @next/next/no-img-element -- нэвтрэлттэй хавсралт нь локал blob */
  return blob ? <img src={blob} alt={name} /> : <span className={styles.thumbWait}>{failed ? <Paperclip size={16} /> : <Loader2 size={14} className="animate-spin" />}</span>;
}

function InspectionAttachments({ info, id }: { info: LayerInfo; id: number }) {
  const [files, setFiles] = React.useState<Attachment[] | null>(null);
  const [error, setError] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  const url = `${serviceOf(info.set, info.id)}/${info.layerId}/${id}/attachments`;
  React.useEffect(() => {
    const controller = new AbortController();
    arcgisJson<{ attachmentInfos?: Attachment[] }>(`${url}?f=json`, "Хавсралт", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setFiles(result.attachmentInfos ?? []); })
      .catch(() => { if (!controller.signal.aborted) setError("Хавсралт татагдсангүй"); });
    return () => controller.abort();
  }, [url, attempt]);
  return <details className={styles.group}>
    <summary><Paperclip size={15} /><span>Зураг, хавсралт</span><small className="num">{files?.length ?? "…"}</small><ChevronDown size={15} /></summary>
    <div className={styles.attachments}>
      {error ? <p role="alert">{error} <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Дахин оролдох</button></p> : files ? files.length ? files.map((file) => <AttachmentFile key={file.id} file={file} url={`${url}/${file.id}`} />) : <p>Хавсралт байхгүй</p> : <p>Хавсралт ачаалж байна…</p>}
    </div>
  </details>;
}

function AttachmentFile({ file, url }: { file: Attachment; url: string }) {
  const [blob, setBlob] = React.useState("");
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!file.contentType.startsWith("image/")) return;
    let alive = true;
    let local = "";
    arcgisBlobUrl(url, file.name).then((value) => {
      local = value;
      if (alive) setBlob(value); else URL.revokeObjectURL(value);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (local) URL.revokeObjectURL(local); };
  }, [url, file.contentType, file.name]);
  return <figure className={styles.attachment}>
    {blob ? <a href={blob} target="_blank" rel="noreferrer">
      {/* Authenticated attachment is a local blob, not an optimizable remote image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={blob} alt={file.name} />
    </a> : <span><Paperclip size={20} />{failed ? "Зураг татагдсангүй" : file.contentType.startsWith("image/") ? "Зураг ачаалж байна…" : "Хавсралт файл"}</span>}
    <figcaption>{file.name}<small>{num(file.size / 1024, 1)} КБ</small></figcaption>
  </figure>;
}

function countBy(records: InspectionRecord[], keyOf: (record: InspectionRecord) => string): Datum[] {
  const counts = new Map<string, number>();
  for (const record of records) { const key = keyOf(record) || "Бүртгээгүй"; counts.set(key, (counts.get(key) ?? 0) + 1); }
  return [...counts].map(([key, value]) => ({ key, label: key, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function ChartCard({ title, count, fill, children }: { title: string; count?: number; fill?: boolean; children: React.ReactNode }) {
  return <section className={cn(styles.chartCard, fill && styles.fillCard)}>
    <div className={styles.panelHeading}><h3>{title}</h3>{count != null && <span className="num">{num(count)}</span>}</div>
    <div className={styles.chartContent}>{children}</div>
  </section>;
}

/*
  ДООД МӨР ЧИРЖ ХЭМЖЭЭ СОЛИГДОНО (хэрэглэгч 2026-11-16: "resize hiij boldog bolgo").
  Дээд ирмэгийн бариул — мөрийн өндөр (зураг дагаж багасна/томорно), хоёр картын
  хоорондох бариул — "Огноо, сараар" ба "Зураг, хавсралт"-ын өргөний харьцаа.
  Утга нь CSS хувьсагчид (`--insp-bottom-h`, `--insp-left`), React төлөв БИШ —
  чирэх бүрд самбар бүхэлдээ дахин зурагдахгүй (`Columns`-тэй нэг зарчим);
  `localStorage["insp.bottom"]`-д хадгалагдана, давхар товшилт анхны хэмжээнд буцаана.
*/
const BOTTOM_KEY = "insp.bottom";
const BOTTOM_DEF = { h: 208, left: 40 };
function ResizableRow({ children }: { children: React.ReactNode }) {
  const row = React.useRef<HTMLDivElement>(null);
  const apply = React.useCallback((v: { h: number; left: number }) => {
    const el = row.current; if (!el) return;
    el.style.setProperty("--insp-bottom-h", `${Math.round(v.h)}px`);
    el.style.setProperty("--insp-left", `${v.left.toFixed(1)}%`);
  }, []);
  const read = () => {
    const el = row.current;
    return { h: el?.getBoundingClientRect().height ?? BOTTOM_DEF.h, left: parseFloat(el?.style.getPropertyValue("--insp-left") || "") || BOTTOM_DEF.left };
  };
  const save = (v: { h: number; left: number }) => { try { localStorage.setItem(BOTTOM_KEY, JSON.stringify(v)); } catch {} };
  React.useLayoutEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(BOTTOM_KEY) ?? "null"); if (saved && Number.isFinite(saved.h) && Number.isFinite(saved.left)) apply(saved); } catch {}
  }, [apply]);
  const drag = (axis: "h" | "left", event: React.PointerEvent) => {
    const el = row.current; if (!el) return;
    event.preventDefault();
    const start = read(), x0 = event.clientX, y0 = event.clientY;
    const width = el.getBoundingClientRect().width;
    const column = el.parentElement?.getBoundingClientRect().height ?? 800;
    let next = start;
    const move = (e: PointerEvent) => {
      next = axis === "h"
        ? { ...start, h: Math.min(Math.max(start.h - (e.clientY - y0), 140), Math.max(column - 260, 140)) }
        : { ...start, left: Math.min(Math.max(start.left + (e.clientX - x0) / width * 100, 22000 / width, 20), 100 - 26000 / width, 80) }; // огнооны тэнхлэг ≥ 220px, цомог ≥ 260px
      apply(next);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.style.cursor = ""; save(next); };
    document.body.style.cursor = axis === "h" ? "row-resize" : "col-resize";
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const reset = (axis: "h" | "left") => { const v = { ...read(), [axis]: BOTTOM_DEF[axis] }; apply(v); save(v); };
  return <div ref={row} className={styles.bottomRow}>
    {children}
    <span className={styles.rowGrip} role="separator" aria-orientation="horizontal" aria-label="Доод мөрийн өндөр" title="Чирж өндрийг өөрчилнө" onPointerDown={(e) => drag("h", e)} onDoubleClick={() => reset("h")} />
    <span className={styles.colGrip} role="separator" aria-orientation="vertical" aria-label="Картын өргөн" title="Чирж өргөнийг өөрчилнө" onPointerDown={(e) => drag("left", e)} onDoubleClick={() => reset("left")} />
  </div>;
}

/*
  ДАВХАРЛАСАН КАРТ (хэрэглэгч 2026-11-16): "Үндсэн чиг үүргийн ажил эсэх" бөгж нь
  "Бүртгэлийн төрлөөр"-ийн, "Эзэмшлийн хэлбэр" нь "Газрын зориулалт"-ын АРД —
  толгойн ‹ › товчоор сэлгэнэ (порталын самбарын `StackPager`-тэй нэг санаа).
  Шүүлт нь нуугдсан диаграмынх ч хадгалагдана (`picks`).
*/
function SwitchCard({ views }: { views: { title: string; count?: number; body: React.ReactNode }[] }) {
  const [at, setAt] = React.useState(0);
  const view = views[at] ?? views[0];
  const go = (step: number) => setAt((at + step + views.length) % views.length);
  return <section className={styles.chartCard}>
    <div className={styles.panelHeading}>
      <h3>{view.title}</h3>
      <span className={styles.pager}>
        {views.length > 1 && <span className={styles.pagerControls} role="group" aria-label="Диаграм сэлгэх">
          <button type="button" aria-label="Өмнөх диаграм" title={views[(at - 1 + views.length) % views.length].title} onClick={() => go(-1)}><ChevronLeft size={12} aria-hidden="true" /></button>
          <span className={cn(styles.pagerPosition, "num")} aria-live="polite" aria-atomic="true"><strong>{at + 1}</strong><span aria-hidden="true">/</span><span>{views.length}</span></span>
          <button type="button" aria-label="Дараагийн диаграм" title={views[(at + 1) % views.length].title} onClick={() => go(1)}><ChevronRight size={12} aria-hidden="true" /></button>
        </span>}
      </span>
    </div>
    <div className={styles.chartContent}>{view.body}</div>
  </section>;
}

/** Тийм / үгүй утгын өнгө — бөгжний зүсэм ижил өнгөтэй бол ялгагдахгүй */
const yesNoColor = (item: Datum) => /^тийм/i.test(item.key) ? "var(--moss)" : /^үгүй/i.test(item.key) ? "var(--ochre)" : "var(--ink-3)";

function inspectionFocus(points: MapPoints, visible: Uint32Array, selected: number): Extent | null {
  if (selected >= 0) return [points.lon[selected] - .015, points.lat[selected] - .01, points.lon[selected] + .015, points.lat[selected] + .01];
  if (!visible.length) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const index of visible) { west = Math.min(west, points.lon[index]); east = Math.max(east, points.lon[index]); south = Math.min(south, points.lat[index]); north = Math.max(north, points.lat[index]); }
  return [west - .01, south - .01, east + .01, north + .01];
}

function useInspectionFocus(points: MapPoints, visible: Uint32Array, selected: number) {
  const bounds = inspectionFocus(points, visible, selected);
  const west = bounds?.[0], south = bounds?.[1], east = bounds?.[2], north = bounds?.[3];
  return React.useMemo<Extent | null>(() => west == null || south == null || east == null || north == null ? null : [west, south, east, north], [west, south, east, north]);
}
