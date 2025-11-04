"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** ================== Roller & Etiketler ================== */
type Role =
  | "OPS"            // Operasyon Müdürü
  | "TECH_MANAGER"   // Teknik Müdür
  | "TECH"           // Teknik Personel
  | "SUPERVISOR"     // Supervisor
  | "OPERATOR";      // Operatör

type Lang = "tr" | "en";

type UnitTag = "RED" | "BLUE" | "GREEN"; // Kırmızı / Mavi / Yeşil

type Frequency = "daily" | "weekly" | "monthly" | "yearly";

/** ================== Tipler ================== */
type Unit = {
  id: number;
  name: string;
  tag: UnitTag;            // RED/MAVI/GREEN
  manufacturer?: string;
  year?: string;
  ndtDate?: string;        // YYYY-MM-DD
  imageDataUrl?: string;
};

type ChecklistItem = { id: number; tr: string; en: string };
type ChecklistTick = { id: number; checked: boolean };

type MaintenanceSign = {
  unitId: number;
  frequency: Frequency;
  date: string;            // YYYY-MM-DD
  items: ChecklistTick[];
  notes?: string;          // parça/iş notu
  signedBy: string;
  role: "TECH" | "TECH_MANAGER" | "OPS";
  signedAt: string;        // ISO
};

type OpeningSign = {
  unitId: number;
  date: string;            // YYYY-MM-DD
  role: "SUPERVISOR" | "OPERATOR";
  name: string;
  signedAt: string;        // ISO
};

type Incident = {
  id: string;
  unitId: number;
  openedBy: "OPERATOR" | "TECH" | "SUPERVISOR";
  openedAt: string;        // ISO
  // kapanınca:
  closedAt?: string;       // ISO
  cause?: string;          // arıza nedeni
  fix?: string;            // yapılan işlem
  reopened?: boolean;
};

type Store = {
  lang: Lang;
  role: Role;
  units: Unit[];
  templates: Record<Frequency, ChecklistItem[]>;
  maintenance: MaintenanceSign[]; // teknik imza kayıtları
  openings: OpeningSign[];        // supervisor & operator imzaları
  incidents: Incident[];          // arıza akışı
};

/** ================== Varsayılanlar ================== */
const LS_KEY = "lp_maintenance_v1";

const DEFAULT_UNITS: Unit[] = [
  { id: 1, name: "Dönme Dolap", tag: "RED", manufacturer: "SBF", year: "2021" },
  { id: 2, name: "Çarpışan Arabalar", tag: "RED", manufacturer: "IE Park", year: "2019" },
  { id: 3, name: "Gondol", tag: "RED", manufacturer: "Fabbri", year: "2017" },
];

const TPL_DAILY: ChecklistItem[] = [
  { id: 1, tr: "Emniyet barları ve kilitleri kontrol edildi", en: "Restraints and locks checked" },
  { id: 2, tr: "Operatör paneli test edildi",                en: "Operator panel tested" },
  { id: 3, tr: "Alan güvenliği ve bariyerler kontrol edildi", en: "Area safety & barriers checked" },
];
const TPL_WEEKLY: ChecklistItem[] = [
  { id: 11, tr: "Cıvata ve bağlantı tork kontrolü",           en: "Bolts & fasteners torque check" },
  { id: 12, tr: "Tahrik elemanları görsel kontrol",           en: "Drive elements visual check" },
];
const TPL_MONTHLY: ChecklistItem[] = [
  { id: 21, tr: "Yağlama (katalog referanslı)",               en: "Lubrication per manual" },
  { id: 22, tr: "Elektrik pano terminal sıkılık kontrolü",    en: "Electrical terminals tightness" },
];
const TPL_YEARLY: ChecklistItem[] = [
  { id: 31, tr: "Yıllık genel bakım prosedürü",               en: "Annual general procedure" },
  { id: 32, tr: "Kapsamlı emniyet testleri",                  en: "Comprehensive safety tests" },
];

const DEFAULT_STORE: Store = {
  lang: "tr",
  role: "TECH",
  units: DEFAULT_UNITS,
  templates: {
    daily: TPL_DAILY,
    weekly: TPL_WEEKLY,
    monthly: TPL_MONTHLY,
    yearly: TPL_YEARLY,
  },
  maintenance: [],
  openings: [],
  incidents: [],
};

/** ================== Yardımcılar ================== */
const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const nowISO = () => new Date().toISOString();

const t = (lang: Lang, tr: string, en: string) => (lang === "tr" ? tr : en);

const tagLabel = (lang: Lang, tag: UnitTag) =>
  tag === "GREEN" ? t(lang, "Yeşil (Aktif)", "Green (Active)")
  : tag === "BLUE" ? t(lang, "Mavi (Bakım Sürüyor)", "Blue (Maintenance)")
  : t(lang, "Kırmızı (Kapalı)", "Red (Closed)");

const tagClass =
  (tag: UnitTag) =>
    tag === "GREEN" ? "bg-green-100 text-green-700"
    : tag === "BLUE" ? "bg-blue-100 text-blue-700"
    : "bg-red-100 text-red-700";

/** ================== Yetkiler ================== */
const canSeeAll = (r: Role) => r === "OPS" || r === "TECH_MANAGER";
const canEditMeta = (r: Role) => r === "OPS" || r === "TECH_MANAGER";
const canTechnical = (r: Role) => r === "TECH" || r === "TECH_MANAGER" || r === "OPS";
const canOpening = (r: Role) => r === "SUPERVISOR" || r === "OPERATOR";

/** ================== LocalStorage ================== */
const loadStore = (): Store => {
  try {
    if (typeof window === "undefined") return DEFAULT_STORE;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      lang: parsed.lang ?? DEFAULT_STORE.lang,
      role: parsed.role ?? DEFAULT_STORE.role,
      units: parsed.units ?? DEFAULT_STORE.units,
      templates: parsed.templates ?? DEFAULT_STORE.templates,
      maintenance: parsed.maintenance ?? [],
      openings: parsed.openings ?? [],
      incidents: parsed.incidents ?? [],
    };
  } catch {
    return DEFAULT_STORE;
  }
};
const saveStore = (s: Store) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
};

/** ================== Sayfa ================== */
export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [store, setStore] = useState<Store>(DEFAULT_STORE);

  const [activeUnitId, setActiveUnitId] = useState<number | null>(null);
  const [freq, setFreq] = useState<Frequency>("daily");

  // teknik imza çizelgesi (geçici UI state)
  const [ticks, setTicks] = useState<ChecklistTick[]>([]);
  const [techNotes, setTechNotes] = useState("");
  const [techSigner, setTechSigner] = useState("");

  // opening (supervisor/operator)
  const [openerName, setOpenerName] = useState("");

  // arıza
  const [incidentCause, setIncidentCause] = useState("");
  const [incidentFix, setIncidentFix] = useState("");

  // foto upload
  const imgInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setStore(loadStore());
  }, []);
  useEffect(() => {
    if (!mounted) return;
    saveStore(store);
  }, [store, mounted]);

  const day = useMemo(() => todayStr(), []);
  const activeUnit = useMemo(
    () => store.units.find((u) => u.id === activeUnitId) ?? null,
    [store.units, activeUnitId]
  );

  /** =========== Dil / Rol =========== */
  const switchLang = () => setStore((s) => ({ ...s, lang: s.lang === "tr" ? "en" : "tr" }));
  const changeRole = (r: Role) => setStore((s) => ({ ...s, role: r }));

  /** =========== Görünecek üniteler (Supervisor/Operator ise sadece GREEN/Mavi?) =========== */
  const visibleUnits = useMemo(() => {
    if (canSeeAll(store.role) || store.role === "TECH") return store.units;
    // Supervisor & Operator: sahada genellikle açılış öncesi de bakar;
    // isteğe göre yalnız RED dışlanabilir; burada tüm üniteleri gösterelim ama açılış imzasını sadece GREEN’de değil, "teknik onay sonrası" çalıştıracağız.
    return store.units;
  }, [store.units, store.role]);

  /** =========== Ünite meta güncelleme (OPS & TECH_MANAGER) =========== */
  const patchUnit = (patch: Partial<Unit>) => {
    if (!activeUnit) return;
    setStore((s) => ({
      ...s,
      units: s.units.map((u) => (u.id === activeUnit.id ? { ...u, ...patch } : u)),
    }));
  };

  /** =========== Foto yükleme (base64) =========== */
  const onChooseImage = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => patchUnit({ imageDataUrl: reader.result as string });
    reader.readAsDataURL(f);
  };

  /** =========== Checklists (şablon) =========== */
  const template = store.templates[freq] ?? [];
  // activeUnit + freq + today için mevcut imza var mı?
  const existingSign = useMemo(() => {
    if (!activeUnit) return null;
    return store.maintenance.find(
      (m) => m.unitId === activeUnit.id && m.frequency === freq && m.date === day
    ) ?? null;
  }, [store.maintenance, activeUnit, freq, day]);

  // panel açılınca/sekme değişince checkbox state yenile
  useEffect(() => {
    if (!activeUnit) return;
    if (existingSign) {
      setTicks(existingSign.items);
      setTechNotes(existingSign.notes ?? "");
      setTechSigner(existingSign.signedBy);
    } else {
      setTicks(template.map((i) => ({ id: i.id, checked: false })));
      setTechNotes("");
      setTechSigner("");
    }
  }, [activeUnitId, freq, existingSign, template]);

  /** =========== Teknik bakım imzası =========== */
  const signTechnical = () => {
    if (!activeUnit) return;
    if (!canTechnical(store.role)) {
      alert(t(store.lang, "Yetkiniz yok.", "Not allowed."));
      return;
    }
    if (!techSigner.trim()) {
      alert(t(store.lang, "İmza (ad) giriniz.", "Enter signer name."));
      return;
    }
    const sign: MaintenanceSign = {
      unitId: activeUnit.id,
      frequency: freq,
      date: day,
      items: ticks,
      notes: techNotes || undefined,
      signedBy: techSigner.trim(),
      role: (store.role === "TECH" ? "TECH" : store.role === "TECH_MANAGER" ? "TECH_MANAGER" : "OPS"),
      signedAt: nowISO(),
    };
    setStore((s) => {
      // aynı gün & freq kaydını değiştir
      const others = s.maintenance.filter(
        (m) => !(m.unitId === sign.unitId && m.frequency === sign.frequency && m.date === sign.date)
      );
      return { ...s, maintenance: [sign, ...others] };
    });
    // Teknik ekip YEŞİL / MAVİ etiketi belirleyebilir:
    if (freq === "daily" || freq === "weekly") {
      // günlük/haftalık tamamladıysa mavi veya yeşile alma kararı teknik ekipte
      // burada basit bir kural: tüm maddeler işaretli ise GREEN, değilse BLUE.
      const allOk = ticks.every((x) => x.checked);
      patchUnit({ tag: allOk ? "GREEN" : "BLUE" });
    }
    alert(t(store.lang, "Teknik imza kaydedildi.", "Technical sign saved."));
  };

  /** =========== Açılış (Supervisor & Operator) =========== */
  const canOpenNow = activeUnit
    ? activeUnit.tag === "GREEN" // teknik onaydan sonra
    : false;

  const signOpening = () => {
    if (!activeUnit) return;
    if (!canOpening(store.role)) {
      alert(t(store.lang, "Yetkiniz yok.", "Not allowed."));
      return;
    }
    if (!canOpenNow) {
      alert(t(store.lang, "Teknik onay (Yeşil) olmadan imzalanamaz.", "Cannot sign before technical approval (Green)."));
      return;
    }
    if (!openerName.trim()) {
      alert(t(store.lang, "İmzalayan adı giriniz.", "Enter signer name."));
      return;
    }
    const rec: OpeningSign = {
      unitId: activeUnit.id,
      date: day,
      role: store.role as "SUPERVISOR" | "OPERATOR",
      name: openerName.trim(),
      signedAt: nowISO(),
    };
    setStore((s) => ({ ...s, openings: [rec, ...s.openings] }));
    setOpenerName("");
    alert(t(store.lang, "Açılış imzası alındı.", "Opening signed."));
  };

  const todaysOpenings = useMemo(() => {
    if (!activeUnit) return { sup: null as OpeningSign | null, op: null as OpeningSign | null };
    const sup = store.openings.find((o) => o.unitId === activeUnit.id && o.date === day && o.role === "SUPERVISOR") ?? null;
    const op = store.openings.find((o) => o.unitId === activeUnit.id && o.date === day && o.role === "OPERATOR") ?? null;
    return { sup, op };
  }, [store.openings, activeUnit, day]);

  /** =========== Arıza akışı =========== */
  const unitIncidents = useMemo(
    () => (activeUnit ? store.incidents.filter((i) => i.unitId === activeUnit.id) : []),
    [store.incidents, activeUnit]
  );
  const hasOpenIncident = unitIncidents.some((i) => !i.closedAt);

  const openIncident = () => {
    if (!activeUnit) return;
    if (!(store.role === "OPERATOR" || store.role === "SUPERVISOR" || store.role === "TECH")) {
      alert(t(store.lang, "Arıza açma yetkiniz yok.", "You cannot open incidents."));
      return;
    }
    if (hasOpenIncident) {
      alert(t(store.lang, "Zaten açık arıza var.", "Incident already open."));
      return;
    }
    const inc: Incident = {
      id: `${activeUnit.id}-${Date.now()}`,
      unitId: activeUnit.id,
      openedBy: (store.role as any),
      openedAt: nowISO(),
    };
    // arıza açılınca ünite otomatik KIRMIZI
    patchUnit({ tag: "RED" });
    setStore((s) => ({ ...s, incidents: [inc, ...s.incidents] }));
    alert(t(store.lang, "Arıza açıldı.", "Incident opened."));
  };

  const closeIncident = () => {
    if (!activeUnit) return;
    if (!canTechnical(store.role)) {
      alert(t(store.lang, "Arıza kapatma yetkiniz yok.", "You cannot close incidents."));
      return;
    }
    const open = unitIncidents.find((i) => !i.closedAt);
    if (!open) {
      alert(t(store.lang, "Açık arıza yok.", "No open incident."));
      return;
    }
    // teknik kapanış: neden + çözüm zorunlu
    if (!incidentCause.trim() || !incidentFix.trim()) {
      alert(t(store.lang, "Neden ve çözüm yazınız.", "Fill in cause and fix."));
      return;
    }
    setStore((s) => ({
      ...s,
      incidents: s.incidents.map((i) =>
        i.id === open.id ? { ...i, closedAt: nowISO(), cause: incidentCause.trim(), fix: incidentFix.trim() } : i
      ),
    }));
    // kapanınca etiketi MAVİ yap, teknik tekrar GREEN’e alır (güvenli akış)
    patchUnit({ tag: "BLUE" });
    setIncidentCause("");
    setIncidentFix("");
    alert(t(store.lang, "Arıza kapatıldı (teknik tekrar onaylamalı).", "Incident closed (requires technical re-approval)."));
  };

  /** =========== Yedek / Geri Yükle / Sıfırla =========== */
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lunapark-bakim-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const fileRef = useRef<HTMLInputElement | null>(null);
  const importJSON = async (f: File) => {
    try {
      const text = await f.text();
      const parsed = JSON.parse(text) as Partial<Store>;
      const next: Store = {
        lang: parsed.lang ?? "tr",
        role: parsed.role ?? "TECH",
        units: parsed.units ?? DEFAULT_UNITS,
        templates: parsed.templates ?? DEFAULT_STORE.templates,
        maintenance: parsed.maintenance ?? [],
        openings: parsed.openings ?? [],
        incidents: parsed.incidents ?? [],
      };
      setStore(next);
      alert(t(store.lang, "Veri içe aktarıldı.", "Data imported."));
    } catch (e: any) {
      alert("Import error: " + (e?.message || e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const resetAll = () => {
    if (!confirm(t(store.lang, "Tüm veriler sıfırlansın mı?", "Reset all data?"))) return;
    setStore(DEFAULT_STORE);
  };

  /** =========== SSR iskelet =========== */
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 font-sans">
        <h1 className="text-2xl font-bold text-blue-700">Lunapark Bakım Yazılımı – Saha Akışı v1</h1>
        <div className="mt-3 bg-white border rounded p-4 text-gray-500">Yükleniyor / Loading…</div>
      </div>
    );
  }

  /** =========== UI Metinleri =========== */
  const L = {
    title: t(store.lang, "Lunapark Bakım Yazılımı – Saha Akışı v1", "Amusement Park Maintenance – Field Flow v1"),
    today: t(store.lang, "Bugün", "Today"),
    lang: t(store.lang, "Dil", "Language"),
    role: t(store.lang, "Rol", "Role"),
    rides: t(store.lang, "Üniteler", "Units"),
    detail: t(store.lang, "Detay", "Detail"),
    unitInfo: t(store.lang, "Ünite Künyesi", "Unit Info"),
    manufacturer: t(store.lang, "Üretici", "Manufacturer"),
    year: t(store.lang, "Üretim Yılı", "Year"),
    ndt: t(store.lang, "NDT Test Tarihi", "NDT Test Date"),
    photo: t(store.lang, "Ünite Fotoğrafı", "Unit Photo"),
    upload: t(store.lang, "Fotoğraf Yükle", "Upload Photo"),
    status: t(store.lang, "Etiket", "Tag"),
    tabs: {
      technical: t(store.lang, "Teknik Bakım", "Technical Maintenance"),
      opening: t(store.lang, "Operasyon Açılış", "Operational Opening"),
      incident: t(store.lang, "Arıza", "Incident"),
      history: t(store.lang, "Geçmiş", "History"),
    },
    freq: {
      daily: t(store.lang, "Günlük", "Daily"),
      weekly: t(store.lang, "Haftalık", "Weekly"),
      monthly: t(store.lang, "Aylık", "Monthly"),
      yearly: t(store.lang, "Yıllık", "Yearly"),
    },
    checklist: t(store.lang, "Form Maddeleri", "Checklist"),
    notes: t(store.lang, "Not / Parça Notu", "Note / Spare Note"),
    signer: t(store.lang, "İmzalayan Adı", "Signer Name"),
    signTech: t(store.lang, "Teknik İmzala", "Technical Sign"),
    needsGreen: t(store.lang, "Teknik onay (Yeşil) olmadan imzalanamaz.", "Cannot sign before Green."),
    openerName: t(store.lang, "İmzalayan Adı", "Signer Name"),
    signOpen: t(store.lang, "Açılış İmzası", "Opening Sign"),
    openIncident: t(store.lang, "Arıza Aç", "Open Incident"),
    cause: t(store.lang, "Arıza Nedeni", "Cause"),
    fix: t(store.lang, "Yapılan İşlem / Çözüm", "Fix / Action"),
    closeIncident: t(store.lang, "Arızayı Kapat", "Close Incident"),
    noOpenIncident: t(store.lang, "Açık arıza yok.", "No open incident."),
    export: t(store.lang, "Yedekle (JSON)", "Export (JSON)"),
    import: t(store.lang, "Geri Yükle", "Import"),
    reset: t(store.lang, "Sıfırla", "Reset"),
  };

  /** =========== Görsel Katman =========== */
  const [tab, setTab] = useState<"technical" | "opening" | "incident" | "history">("technical");

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      {/* Header */}
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-700">{L.title}</h1>
          <div className="text-sm text-gray-600">{L.today}: {day}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{L.lang}:</span>
            <button className="px-2 py-1 rounded bg-gray-200" onClick={switchLang}>
              {store.lang.toUpperCase()}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{L.role}:</span>
            <select className="border rounded p-1" value={store.role} onChange={(e) => changeRole(e.target.value as Role)}>
              <option value="OPS">Ops.Müdürü</option>
              <option value="TECH_MANAGER">Teknik Müdür</option>
              <option value="TECH">Teknik Personel</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="OPERATOR">Operatör</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded bg-gray-200" onClick={exportJSON}>⬇ {L.export}</button>
            <button className="px-3 py-1 rounded bg-gray-200" onClick={() => fileRef.current?.click()}>⬆ {L.import}</button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); }} />
            <button className="px-3 py-1 rounded bg-amber-500 text-white" onClick={resetAll}>♻ {L.reset}</button>
          </div>
        </div>
      </header>

      {/* Üniteler */}
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">{L.rides}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleUnits.map((u) => (
            <div key={u.id} className="bg-white border rounded p-3">
              {u.imageDataUrl ? (
                <img src={u.imageDataUrl} alt={u.name} className="w-full h-32 object-cover rounded mb-2" />
              ) : (
                <div className="w-full h-32 bg-gray-100 rounded mb-2 grid place-items-center text-gray-400">No Photo</div>
              )}
              <div className="font-semibold">{u.name}</div>
              <div className={`inline-block text-xs mt-1 px-2 py-0.5 rounded ${tagClass(u.tag)}`}>
                {tagLabel(store.lang, u.tag)}
              </div>
              <button className="mt-2 px-3 py-1 rounded bg-blue-600 text-white" onClick={() => setActiveUnitId(u.id)}>
                {L.detail}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Detay Paneli */}
      {activeUnit && (
        <section className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {activeUnit.name} — {L.unitInfo}
              </h3>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setActiveUnitId(null)}>✖</button>
            </div>

            {/* Meta */}
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500">{L.manufacturer}</label>
                <input className="border rounded w-full p-2"
                  value={activeUnit.manufacturer ?? ""}
                  disabled={!canEditMeta(store.role)}
                  onChange={(e) => canEditMeta(store.role) && patchUnit({ manufacturer: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500">{L.year}</label>
                <input className="border rounded w-full p-2"
                  value={activeUnit.year ?? ""}
                  disabled={!canEditMeta(store.role)}
                  onChange={(e) => canEditMeta(store.role) && patchUnit({ year: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500">{L.ndt}</label>
                <input type="date" className="border rounded w-full p-2"
                  value={activeUnit.ndtDate ?? ""}
                  disabled={!canEditMeta(store.role)}
                  onChange={(e) => canEditMeta(store.role) && patchUnit({ ndtDate: e.target.value })} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500">{L.photo}</label>
                {activeUnit.imageDataUrl ? (
                  <img src={activeUnit.imageDataUrl} alt="unit" className="w-full h-40 object-cover rounded mb-2" />
                ) : (
                  <div className="w-full h-40 bg-gray-100 rounded mb-2 grid place-items-center text-gray-400">No Photo</div>
                )}
                <input ref={imgInput} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onChooseImage(f); }} />
                <button className={`px-3 py-1 rounded ${canEditMeta(store.role) ? "bg-gray-200" : "bg-gray-100 text-gray-400"}`}
                  onClick={() => canEditMeta(store.role) && imgInput.current?.click()}
                  disabled={!canEditMeta(store.role)}>
                  {L.upload}
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500">{L.status}</label>
                <select className="border rounded w-full p-2"
                  value={activeUnit.tag}
                  disabled={!canEditMeta(store.role)}
                  onChange={(e) => canEditMeta(store.role) && patchUnit({ tag: e.target.value as UnitTag })}>
                  <option value="RED">{tagLabel(store.lang, "RED")}</option>
                  <option value="BLUE">{tagLabel(store.lang, "BLUE")}</option>
                  <option value="GREEN">{tagLabel(store.lang, "GREEN")}</option>
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4">
              <div className="flex gap-2 mb-3">
                <button onClick={() => setTab("technical")} className={`px-3 py-1 rounded ${tab === "technical" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>{L.tabs.technical}</button>
                <button onClick={() => setTab("opening")} className={`px-3 py-1 rounded ${tab === "opening" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>{L.tabs.opening}</button>
                <button onClick={() => setTab("incident")} className={`px-3 py-1 rounded ${tab === "incident" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>{L.tabs.incident}</button>
                <button onClick={() => setTab("history")} className={`px-3 py-1 rounded ${tab === "history" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>{L.tabs.history}</button>
              </div>

              {/* Teknik */}
              {tab === "technical" && (
                <div className="p-3 border rounded bg-gray-50">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(["daily","weekly","monthly","yearly"] as Frequency[]).map(f => (
                      <button key={f} onClick={() => setFreq(f)} className={`px-3 py-1 rounded ${freq===f?"bg-blue-600 text-white":"bg-gray-200"}`}>
                        {f==="daily"&&L.freq.daily}{f==="weekly"&&L.freq.weekly}{f==="monthly"&&L.freq.monthly}{f==="yearly"&&L.freq.yearly}
                      </button>
                    ))}
                  </div>

                  <div className="font-semibold mb-2">{L.checklist}</div>
                  <div className="grid gap-2">
                    {template.map((it) => {
                      const label = store.lang === "tr" ? it.tr : it.en;
                      const val = ticks.find((x) => x.id === it.id)?.checked ?? false;
                      return (
                        <label key={it.id} className={`flex items-center gap-2 p-2 rounded ${canTechnical(store.role)?"bg-white border":"bg-gray-100 border border-dashed"}`}>
                          <input
                            type="checkbox"
                            disabled={!canTechnical(store.role)}
                            checked={val}
                            onChange={(e) =>
                              setTicks(prev => prev.map(x => x.id === it.id ? { ...x, checked: e.target.checked } : x))
                            }
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs text-gray-500">{L.notes}</label>
                    <textarea
                      className="border rounded w-full p-2"
                      rows={2}
                      placeholder={t(store.lang,"Örn: 2 adet M8 civata değişti…","Ex: Replaced 2× M8 bolts…")}
                      value={techNotes}
                      onChange={(e)=>setTechNotes(e.target.value)}
                      disabled={!canTechnical(store.role)}
                    />
                  </div>

                  <div className="mt-3 grid sm:grid-cols-2 gap-2">
                    <input
                      className="border rounded w-full p-2"
                      placeholder={L.signer}
                      value={techSigner}
                      onChange={(e)=>setTechSigner(e.target.value)}
                      disabled={!canTechnical(store.role)}
                    />
                    <button
                      className={`px-3 py-1 rounded ${canTechnical(store.role)?"bg-green-600 text-white":"bg-gray-200 text-gray-500"}`}
                      onClick={signTechnical}
                      disabled={!canTechnical(store.role)}
                    >
                      {L.signTech}
                    </button>
                  </div>
                </div>
              )}

              {/* Açılış */}
              {tab === "opening" && (
                <div className="p-3 border rounded bg-gray-50">
                  <div className="text-sm mb-2">
                    {t(store.lang,"Teknik onay gereklidir (Yeşil).","Technical approval required (Green).")}
                    {" "} {canOpenNow ? "✅" : "❌"}
                  </div>
                  <input className="border rounded w-full p-2 mb-2" placeholder={L.openerName}
                    value={openerName} onChange={(e)=>setOpenerName(e.target.value)} />
                  <button
                    className={`px-3 py-1 rounded ${canOpening(store.role)?"bg-blue-600 text-white":"bg-gray-200 text-gray-500"}`}
                    onClick={signOpening}
                    disabled={!canOpening(store.role) || !canOpenNow}
                    title={!canOpenNow ? L.needsGreen : ""}
                  >
                    {L.signOpen} ({store.role === "SUPERVISOR" ? "Supervisor" : store.role === "OPERATOR" ? "Operator" : "-"})
                  </button>

                  <div className="mt-3 grid sm:grid-cols-2 gap-2">
                    <div className="p-2 border rounded bg-white">
                      <div className="text-xs text-gray-500">Supervisor</div>
                      <div className="text-sm">
                        {todaysOpenings.sup ? `${todaysOpenings.sup.name} — ${new Date(todaysOpenings.sup.signedAt).toLocaleTimeString()}` : t(store.lang,"İmza yok","No sign")}
                      </div>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <div className="text-xs text-gray-500">Operator</div>
                      <div className="text-sm">
                        {todaysOpenings.op ? `${todaysOpenings.op.name} — ${new Date(todaysOpenings.op.signedAt).toLocaleTimeString()}` : t(store.lang,"İmza yok","No sign")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Arıza */}
              {tab === "incident" && (
                <div className="p-3 border rounded bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={openIncident} disabled={hasOpenIncident}>
                      {L.openIncident}
                    </button>
                    {!hasOpenIncident && <span className="text-sm text-gray-600">{L.noOpenIncident}</span>}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-gray-500">{L.cause}</label>
                      <textarea className="border rounded w-full p-2" rows={2}
                        value={incidentCause} onChange={(e)=>setIncidentCause(e.target.value)}
                        placeholder={t(store.lang,"Örn: Sensör arızası","e.g., Sensor fault")} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">{L.fix}</label>
                      <textarea className="border rounded w-full p-2" rows={2}
                        value={incidentFix} onChange={(e)=>setIncidentFix(e.target.value)}
                        placeholder={t(store.lang,"Örn: Sensör değişimi yapıldı","e.g., Replaced sensor")} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={closeIncident}>
                      {L.closeIncident}
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="font-semibold mb-2">{t(store.lang,"Arıza Geçmişi","Incident History")}</div>
                    <div className="grid gap-2 max-h-48 overflow-auto">
                      {unitIncidents.length === 0 && <div className="text-sm text-gray-500">-</div>}
                      {unitIncidents.map((i) => (
                        <div key={i.id} className="p-2 bg-white border rounded">
                          <div className="text-xs text-gray-500">
                            {new Date(i.openedAt).toLocaleString()} — {t(store.lang,"Açan:","Opened by:")} {i.openedBy}
                            {i.closedAt ? ` → ${new Date(i.closedAt).toLocaleString()}` : " (open)"}
                          </div>
                          {i.cause && <div><b>{t(store.lang,"Neden:","Cause:")}</b> {i.cause}</div>}
                          {i.fix && <div><b>{t(store.lang,"Çözüm:","Fix:")}</b> {i.fix}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Geçmiş */}
              {tab === "history" && (
                <div className="p-3 border rounded bg-gray-50">
                  <div className="font-semibold mb-2">{t(store.lang,"Bugünkü Kayıtlar","Today's Records")}</div>
                  <div className="grid gap-2">
                    <div className="p-2 bg-white border rounded">
                      <div className="text-xs text-gray-500">{t(store.lang,"Teknik İmzalar","Technical Signs")}</div>
                      <ul className="list-disc list-inside text-sm">
                        {store.maintenance.filter(m => m.unitId === activeUnit.id && m.date === day).map((m,idx)=>(
                          <li key={idx}>
                            {t(store.lang,"Sıklık","Freq")}: {m.frequency} — {m.signedBy} ({m.role}) @ {new Date(m.signedAt).toLocaleTimeString()}
                          </li>
                        ))}
                        {store.maintenance.filter(m => m.unitId === activeUnit.id && m.date === day).length===0 && <li>-</li>}
                      </ul>
                    </div>
                    <div className="p-2 bg-white border rounded">
                      <div className="text-xs text-gray-500">{t(store.lang,"Açılış İmzaları","Opening Signs")}</div>
                      <ul className="list-disc list-inside text-sm">
                        {store.openings.filter(o => o.unitId === activeUnit.id && o.date === day).map((o,idx)=>(
                          <li key={idx}>{o.role}: {o.name} @ {new Date(o.signedAt).toLocaleTimeString()}</li>
                        ))}
                        {store.openings.filter(o => o.unitId === activeUnit.id && o.date === day).length===0 && <li>-</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
