"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** ====== Roller ====== */
type Role =
  | "OPS"            // Operasyon Müdürü
  | "TECH_MANAGER"   // Teknik Müdür
  | "SUPERVISOR"     // Supervisor
  | "TECH"           // Teknik Personel
  | "OPERATOR";      // Operatör

/** ====== Dil ====== */
type Lang = "tr" | "en";

/** ====== Tipler ====== */
type UnitStatus = "Aktif" | "Kırmızı Etiket"; // aktif = yeşil, kırmızı etiket = servis dışı
type Frequency = "daily" | "weekly" | "monthly" | "yearly";

type Unit = {
  id: number;
  name: string;
  status: UnitStatus;
  year?: string;
  manufacturer?: string;
  ndtDate?: string; // YYYY-MM-DD
  imageDataUrl?: string; // base64 (yerel depoda)
};

type ChecklistItem = { id: number; titleTR: string; titleEN: string };
type ChecklistState = { id: number; checked: boolean };

type MaintenanceLog = {
  unitId: number;
  frequency: Frequency;
  date: string; // YYYY-MM-DD
  items: ChecklistState[];
  notes?: string; // kullanılan parça vb. kısa not
};

type OpeningSign = {
  unitId: number;
  date: string;   // YYYY-MM-DD
  role: "SUPERVISOR" | "OPERATOR";
  name: string;   // imzalayanın adı (şimdilik serbest metin)
};

type TechNote = {
  id: string;
  unitId: number;
  date: string;
  from: "OPS" | "TECH_MANAGER"; // kim yazdı
  text: string;                 // soru/not
  reply?: { date: string; text: string }; // Teknik Müdür cevabı
};

type Store = {
  lang: Lang;
  role: Role;
  units: Unit[];
  // şablon (varsayılan form maddeleri) – tüm ünitelerde aynı temel şablon
  templates: Record<Frequency, ChecklistItem[]>;
  logs: MaintenanceLog[];       // teknik bakım işaretlemeleri
  openings: OpeningSign[];      // açılış imzaları (supervisor/operator)
  techNotes: TechNote[];        // not/soru-cevap
};

/** ====== LS anahtarı ====== */
const LS_KEY = "lunapark_bakim_store_v2";

/** ====== Varsayılanlar ====== */
const DEFAULT_UNITS: Unit[] = [
  { id: 1, name: "Dönme Dolap", status: "Aktif", year: "2021", manufacturer: "SBF/Visa" },
  { id: 2, name: "Çarpışan Arabalar", status: "Aktif", year: "2019", manufacturer: "IE Park" },
  { id: 3, name: "Gondol", status: "Kırmızı Etiket", year: "2017", manufacturer: "Fabbri" },
];

// Basit şablon maddeleri (TR/EN)
const TEMPLATE_DAILY: ChecklistItem[] = [
  { id: 1, titleTR: "Emniyet kemerleri/Barlar kontrol edildi", titleEN: "Restraints checked" },
  { id: 2, titleTR: "Operatör paneli test edildi",            titleEN: "Operator panel tested" },
  { id: 3, titleTR: "Alan güvenliği sağlandı",                 titleEN: "Area secured" },
];
const TEMPLATE_WEEKLY: ChecklistItem[] = [
  { id: 11, titleTR: "Cıvata ve bağlantılar tork kontrolü",   titleEN: "Bolts & fasteners torque" },
  { id: 12, titleTR: "Zincir/Kayış görsel kontrol",            titleEN: "Chain/belt visual check" },
];
const TEMPLATE_MONTHLY: ChecklistItem[] = [
  { id: 21, titleTR: "Yağlama ve gres noktaları",              titleEN: "Lubrication/grease points" },
  { id: 22, titleTR: "Elektrik pano bağlantı kontrolü",        titleEN: "Electrical cabinet check" },
];
const TEMPLATE_YEARLY: ChecklistItem[] = [
  { id: 31, titleTR: "Yıllık genel bakım",                     titleEN: "Annual general maintenance" },
  { id: 32, titleTR: "Kapsamlı emniyet testleri",              titleEN: "Comprehensive safety tests" },
];

const DEFAULT_STORE: Store = {
  lang: "tr",
  role: "TECH", // başlangıç: teknik personel
  units: DEFAULT_UNITS,
  templates: {
    daily: TEMPLATE_DAILY,
    weekly: TEMPLATE_WEEKLY,
    monthly: TEMPLATE_MONTHLY,
    yearly: TEMPLATE_YEARLY,
  },
  logs: [],
  openings: [],
  techNotes: [],
};

/** ====== Yardımcılar ====== */
const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const t = (lang: Lang, tr: string, en: string) => (lang === "tr" ? tr : en);

/** ====== LocalStorage ====== */
const loadStore = (): Store => {
  try {
    if (typeof window === "undefined") return DEFAULT_STORE;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      lang: parsed.lang ?? "tr",
      role: parsed.role ?? "TECH",
      units: parsed.units ?? DEFAULT_UNITS,
      templates: parsed.templates ?? DEFAULT_STORE.templates,
      logs: parsed.logs ?? [],
      openings: parsed.openings ?? [],
      techNotes: parsed.techNotes ?? [],
    };
  } catch {
    return DEFAULT_STORE;
  }
};

const saveStore = (store: Store) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {}
};

/** ====== İzinler ====== */
const canEditUnitMeta = (role: Role) => role === "OPS" || role === "TECH_MANAGER";
const canSeeAll = (role: Role) => role === "OPS" || role === "TECH_MANAGER";
const canDoTechnical = (role: Role) => role === "TECH" || role === "TECH_MANAGER" || role === "OPS";
const canDoOpening = (role: Role) => role === "SUPERVISOR" || role === "OPERATOR";

/** ====== Sayfa ====== */
export default function Page() {
  // SSR güvenliği
  const [mounted, setMounted] = useState(false);

  // Depo
  const [store, setStore] = useState<Store>(DEFAULT_STORE);

  // UI state
  const [activeUnitId, setActiveUnitId] = useState<number | null>(null); // detay paneli
  const [freq, setFreq] = useState<Frequency>("daily"); // aktif bakım sekmesi
  const [openingSigner, setOpeningSigner] = useState<string>(""); // imza adı

  const [imgFile, setImgFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Mount
  useEffect(() => {
    setMounted(true);
    setStore(loadStore());
  }, []);

  // Persist
  useEffect(() => {
    if (!mounted) return;
    saveStore(store);
  }, [store, mounted]);

  const day = useMemo(() => todayStr(), []);

  const activeUnit = useMemo(
    () => store.units.find((u) => u.id === activeUnitId) ?? null,
    [store.units, activeUnitId]
  );

  /** === Dil ve Rol değişimi === */
  const switchLang = () =>
    setStore((s) => ({ ...s, lang: s.lang === "tr" ? "en" : "tr" }));

  const setRole = (r: Role) => setStore((s) => ({ ...s, role: r }));

  /** === Ünite adı/status/meta güncelleme (yalnız OPS + TECH_MANAGER) === */
  const updateUnit = (patch: Partial<Unit>) => {
    if (!activeUnit) return;
    setStore((s) => ({
      ...s,
      units: s.units.map((u) =>
        u.id === activeUnit.id ? { ...u, ...patch } : u
      ),
    }));
  };

  /** === Görsel yükleme (base64) === */
  const onImageChoose = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      updateUnit({ imageDataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  /** === Bakım formu maddelerini getir (şablon) === */
  const templateItems = useMemo(() => store.templates[freq] ?? [], [store.templates, freq]);

  /** === Bu ünite + bu freq + bugün için state === */
  const currentLog = useMemo<MaintenanceLog | null>(() => {
    if (!activeUnit) return null;
    const found = (store.logs || []).find(
      (l) => l.unitId === activeUnit.id && l.frequency === freq && l.date === day
    );
    if (found) return found;
    // yoksa varsayılan boş state
    return {
      unitId: activeUnit.id,
      frequency: freq,
      date: day,
      items: templateItems.map((i) => ({ id: i.id, checked: false })),
      notes: "",
    };
  }, [store.logs, activeUnit, freq, day, templateItems]);

  /** === Teknik bakım kaydet (yalnız TECH/TECH_MANAGER/OPS) === */
  const saveMaintenance = () => {
    if (!activeUnit || !currentLog) return;
    if (!canDoTechnical(store.role)) {
      alert(t(store.lang, "Bu işlem için yetkiniz yok.", "You are not allowed to perform this action."));
      return;
    }
    setStore((s) => {
      const others = s.logs.filter(
        (l) =>
          !(
            l.unitId === currentLog.unitId &&
            l.frequency === currentLog.frequency &&
            l.date === currentLog.date
          )
      );
      return { ...s, logs: [...others, currentLog] };
    });
    alert(t(store.lang, "Kayıt edildi.", "Saved."));
  };

  /** === Açılış kontrol imzası (Supervisor/Operator) — yalnız Aktif ünite === */
  const signOpening = () => {
    if (!activeUnit) return;
    if (!canDoOpening(store.role)) {
      alert(t(store.lang, "Bu işlem için yetkiniz yok.", "You are not allowed to perform this action."));
      return;
    }
    if (activeUnit.status !== "Aktif") {
      alert(t(store.lang, "Ünite aktif olmadan imza atılamaz.", "Cannot sign opening while unit is not Active."));
      return;
    }
    if (!openingSigner.trim()) {
      alert(t(store.lang, "İmza ismi giriniz.", "Enter signer name."));
      return;
    }
    setStore((s) => ({
      ...s,
      openings: [
        ...s.openings,
        {
          unitId: activeUnit.id,
          date: day,
          role: store.role as "SUPERVISOR" | "OPERATOR",
          name: openingSigner.trim(),
        },
      ],
    }));
    setOpeningSigner("");
    alert(t(store.lang, "İmza alındı.", "Signed."));
  };

  /** === Not/Soru (OPS & TECH_MANAGER yazar) — Cevap (TECH_MANAGER) === */
  const [noteDraft, setNoteDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");

  const addNote = () => {
    if (!activeUnit) return;
    if (!(store.role === "OPS" || store.role === "TECH_MANAGER")) {
      alert(t(store.lang, "Not ekleme yetkiniz yok.", "You cannot add notes."));
      return;
    }
    const newNote: TechNote = {
      id: `${activeUnit.id}-${Date.now()}`,
      unitId: activeUnit.id,
      date: day,
      from: store.role === "OPS" ? "OPS" : "TECH_MANAGER",
      text: noteDraft.trim(),
    };
    if (!newNote.text) return;
    setStore((s) => ({ ...s, techNotes: [newNote, ...s.techNotes] }));
    setNoteDraft("");
  };

  const answerNote = (noteId: string) => {
    if (store.role !== "TECH_MANAGER") {
      alert(t(store.lang, "Cevaplama yetkiniz yok.", "You cannot answer."));
      return;
    }
    const msg = replyDraft.trim();
    if (!msg) return;
    setStore((s) => ({
      ...s,
      techNotes: s.techNotes.map((n) =>
        n.id === noteId ? { ...n, reply: { date: day, text: msg } } : n
      ),
    }));
    setReplyDraft("");
  };

  /** === Ünite detay paneli görünürlüğü === */
  const closeDetail = () => {
    setActiveUnitId(null);
    setFreq("daily");
    setOpeningSigner("");
    setNoteDraft("");
    setReplyDraft("");
    setImgFile(null);
  };

  /** === Filtre: Rol görünürlüğü ===
   *  - OPS & TECH_MANAGER: tümünü görür
   *  - TECH: tüm teknik verilere erişebilir (isteğe göre tüm üniteleri görür)
   *  - SUPERVISOR/OPERATOR: sadece aktif üniteleri görmek daha mantıklı
   */
  const visibleUnits = useMemo(() => {
    if (canSeeAll(store.role) || store.role === "TECH") return store.units;
    // Supervisor/Operator: sadece Aktif olanlar
    return store.units.filter((u) => u.status === "Aktif");
  }, [store.units, store.role]);

  /** === UI metinleri === */
  const L = {
    title: t(store.lang, "Lunapark Bakım Yazılımı – Lite", "Amusement Park Maintenance – Lite"),
    rides: t(store.lang, "Üniteler / Rides", "Units / Rides"),
    daily: t(store.lang, "Günlük Bakımlar", "Daily Maintenance"),
    weekly: t(store.lang, "Haftalık Bakımlar", "Weekly Maintenance"),
    monthly: t(store.lang, "Aylık Bakımlar", "Monthly Maintenance"),
    yearly: t(store.lang, "Yıllık Bakımlar", "Yearly Maintenance"),
    ndt: t(store.lang, "NDT Test Tarihi", "NDT Test Date"),
    save: t(store.lang, "Kaydet", "Save"),
    notes: t(store.lang, "Not/Soru", "Note/Question"),
    reply: t(store.lang, "Cevap", "Reply"),
    addNote: t(store.lang, "Not Ekle", "Add Note"),
    answer: t(store.lang, "Cevapla", "Answer"),
    opening: t(store.lang, "Operasyon Açılış Kontrolü", "Operational Opening Check"),
    signerName: t(store.lang, "İmzalayan isim", "Signer name"),
    sign: t(store.lang, "İmzala", "Sign"),
    active: t(store.lang, "Aktif", "Active"),
    redTag: t(store.lang, "Kırmızı Etiket", "Red Tag"),
    unitMeta: t(store.lang, "Ünite Künyesi", "Unit Info"),
    manufacturer: t(store.lang, "Üretici", "Manufacturer"),
    year: t(store.lang, "Üretim Yılı", "Year of Manufacture"),
    photo: t(store.lang, "Ünite Fotoğrafı", "Unit Photo"),
    changePhoto: t(store.lang, "Fotoğraf Yükle", "Upload Photo"),
    openDetail: t(store.lang, "Detay", "Detail"),
    roleLabel: t(store.lang, "Rol", "Role"),
    langLabel: t(store.lang, "Dil", "Language"),
    status: t(store.lang, "Durum", "Status"),
    checklist: t(store.lang, "Form Maddeleri", "Checklist"),
    usedParts: t(store.lang, "Kullanılan Yedek Parça (not)", "Used Spare (note)"),
    cannotOpenWhenRed: t(store.lang, "Kırmızı etiketli ünitede açılış imzası atılamaz.", "Cannot sign opening on Red-Tagged unit."),
    needsActiveForSupervisor: t(store.lang, "Supervisor kontrolü için ünite Aktif olmalıdır.", "Unit must be Active for Supervisor check."),
  };

  /** === SSR skeleton === */
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 font-sans">
        <h1 className="text-2xl font-bold text-blue-700">{L.title}</h1>
        <div className="mt-3 bg-white border rounded p-4 text-gray-500">Yükleniyor / Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      {/* Üst header */}
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-700">{L.title}</h1>
          <div className="text-sm text-gray-600">
            {t(store.lang, "Bugün", "Today")}: {day}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dil */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{L.langLabel}:</span>
            <button
              className="px-2 py-1 rounded bg-gray-200"
              onClick={switchLang}
              title="TR/EN"
            >
              {store.lang.toUpperCase()}
            </button>
          </div>

          {/* Rol seçimi */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{L.roleLabel}:</span>
            <select
              className="border rounded p-1"
              value={store.role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="OPS">Ops.Müdürü</option>
              <option value="TECH_MANAGER">Teknik Müdür</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="TECH">Teknik Personel</option>
              <option value="OPERATOR">Operatör</option>
            </select>
          </div>
        </div>
      </header>

      {/* Üniteler listesi */}
      <section className="mb-4">
        <h2 className="text-xl font-semibold mb-2">{L.rides}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleUnits.map((u) => (
            <div key={u.id} className="bg-white border rounded p-3">
              {u.imageDataUrl && (
                <img
                  src={u.imageDataUrl}
                  alt={u.name}
                  className="w-full h-32 object-cover rounded mb-2"
                />
              )}
              <div className="font-semibold">{u.name}</div>
              <div className="text-sm">
                {L.status}:{" "}
                <b className={u.status === "Aktif" ? "text-green-700" : "text-red-700"}>
                  {u.status}
                </b>
              </div>
              <button
                className="mt-2 px-3 py-1 rounded bg-blue-600 text-white"
                onClick={() => setActiveUnitId(u.id)}
              >
                {L.openDetail}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Detay paneli (modal benzeri) */}
      {activeUnit && (
        <section className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {activeUnit.name} — {L.unitMeta}
              </h3>
              <button
                className="px-3 py-1 rounded bg-gray-200"
                onClick={closeDetail}
              >
                ✖
              </button>
            </div>

            {/* Meta alanları */}
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500">{L.manufacturer}</label>
                <input
                  className="border rounded w-full p-2"
                  value={activeUnit.manufacturer ?? ""}
                  onChange={(e) =>
                    canEditUnitMeta(store.role) && updateUnit({ manufacturer: e.target.value })
                  }
                  disabled={!canEditUnitMeta(store.role)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">{L.year}</label>
                <input
                  className="border rounded w-full p-2"
                  value={activeUnit.year ?? ""}
                  onChange={(e) =>
                    canEditUnitMeta(store.role) && updateUnit({ year: e.target.value })
                  }
                  disabled={!canEditUnitMeta(store.role)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">{L.ndt}</label>
                <input
                  type="date"
                  className="border rounded w-full p-2"
                  value={activeUnit.ndtDate ?? ""}
                  onChange={(e) =>
                    canEditUnitMeta(store.role) && updateUnit({ ndtDate: e.target.value })
                  }
                  disabled={!canEditUnitMeta(store.role)}
                />
              </div>
            </div>

            {/* Fotoğraf + Status */}
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500">{L.photo}</label>
                {activeUnit.imageDataUrl ? (
                  <img
                    src={activeUnit.imageDataUrl}
                    alt="unit"
                    className="w-full h-40 object-cover rounded mb-2"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-100 rounded mb-2 grid place-items-center text-gray-400">
                    {t(store.lang, "Fotoğraf yok", "No photo")}
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImageChoose(f);
                  }}
                />
                <button
                  className={`px-3 py-1 rounded ${canEditUnitMeta(store.role) ? "bg-gray-200" : "bg-gray-100 text-gray-400"}`}
                  onClick={() => canEditUnitMeta(store.role) && fileRef.current?.click()}
                  disabled={!canEditUnitMeta(store.role)}
                >
                  {L.changePhoto}
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-500">{L.status}</label>
                <select
                  className="border rounded w-full p-2"
                  value={activeUnit.status}
                  onChange={(e) =>
                    canEditUnitMeta(store.role) &&
                    updateUnit({ status: e.target.value as UnitStatus })
                  }
                  disabled={!canEditUnitMeta(store.role)}
                >
                  <option value="Aktif">{L.active}</option>
                  <option value="Kırmızı Etiket">{L.redTag}</option>
                </select>

                {/* Açılış kontrolü (Supervisor/Operatör) */}
                <div className="mt-4 p-3 border rounded">
                  <div className="font-semibold mb-2">{L.opening}</div>
                  <input
                    className="border rounded w-full p-2 mb-2"
                    placeholder={L.signerName}
                    value={openingSigner}
                    onChange={(e) => setOpeningSigner(e.target.value)}
                  />
                  <button
                    className={`px-3 py-1 rounded ${canDoOpening(store.role) ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}
                    onClick={signOpening}
                    disabled={!canDoOpening(store.role)}
                    title={
                      activeUnit.status === "Aktif"
                        ? ""
                        : t(store.lang, L.cannotOpenWhenRed, L.cannotOpenWhenRed)
                    }
                  >
                    {L.sign}
                  </button>
                  {activeUnit.status !== "Aktif" && (
                    <div className="mt-2 text-xs text-red-600">
                      {L.needsActiveForSupervisor}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bakım sekmeleri */}
            <div className="mt-4">
              <div className="flex gap-2 mb-3">
                {(["daily", "weekly", "monthly", "yearly"] as Frequency[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFreq(f)}
                    className={`px-3 py-1 rounded ${
                      freq === f ? "bg-blue-600 text-white" : "bg-gray-200"
                    }`}
                  >
                    {f === "daily" && L.daily}
                    {f === "weekly" && L.weekly}
                    {f === "monthly" && L.monthly}
                    {f === "yearly" && L.yearly}
                  </button>
                ))}
              </div>

              {/* Checklist */}
              <div className="p-3 border rounded bg-gray-50">
                <div className="font-semibold mb-2">{L.checklist}</div>
                <div className="grid gap-2">
                  {templateItems.map((it) => {
                    const label = store.lang === "tr" ? it.titleTR : it.titleEN;
                    const checked =
                      (currentLog?.items.find((x) => x.id === it.id)?.checked ??
                        false);
                    return (
                      <label
                        key={it.id}
                        className={`flex items-center gap-2 p-2 rounded ${
                          canDoTechnical(store.role)
                            ? "bg-white border"
                            : "bg-gray-100 border border-dashed"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!canDoTechnical(store.role)}
                          checked={checked}
                          onChange={(e) => {
                            if (!currentLog) return;
                            const items = currentLog.items.map((x) =>
                              x.id === it.id ? { ...x, checked: e.target.checked } : x
                            );
                            // güvenli güncelleme
                            if (!canDoTechnical(store.role)) return;
                            const newLog: MaintenanceLog = { ...currentLog, items };
                            // sadece state içinde güncelle (kaydet butonuyla persist)
                            // geçici olarak currentLog’u recreate etmek için:
                            setStore((s) => {
                              // geçici: store içinde log yoksa da görüntü için tutmayacağız, Save ile yazacağız
                              return { ...s };
                            });
                            // local state objesini güncellemek için küçük bir hile:
                            // (currentLog useMemo olduğu için doğrudan set edemeyiz, checkbox'lar save'e kadar UI'da görünsün diye)
                            (currentLog as any).items = items;
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Not / Parça notu */}
                <div className="mt-3">
                  <label className="block text-xs text-gray-500">{L.usedParts}</label>
                  <textarea
                    className="border rounded w-full p-2"
                    placeholder={t(store.lang, "Örn: 2x M8 cıvata değiştirildi…", "Ex: Changed 2x M8 bolts…")}
                    value={currentLog?.notes ?? ""}
                    onChange={(e) => {
                      if (!currentLog) return;
                      if (!canDoTechnical(store.role)) return;
                      (currentLog as any).notes = e.target.value;
                    }}
                    rows={2}
                  />
                </div>

                <div className="mt-3">
                  <button
                    className={`px-3 py-1 rounded ${canDoTechnical(store.role) ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500"}`}
                    onClick={saveMaintenance}
                    disabled={!canDoTechnical(store.role)}
                  >
                    {L.save}
                  </button>
                </div>
              </div>
            </div>

            {/* Not/Soru - Cevap alanı */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="p-3 border rounded">
                <div className="font-semibold mb-2">{L.notes}</div>
                <textarea
                  className="border rounded w-full p-2"
                  placeholder={t(store.lang, "Teknik ekip için not/soru…", "Note/question for technical team…")}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  disabled={!(store.role === "OPS" || store.role === "TECH_MANAGER")}
                  rows={2}
                />
                <button
                  className={`mt-2 px-3 py-1 rounded ${
                    store.role === "OPS" || store.role === "TECH_MANAGER"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                  onClick={addNote}
                  disabled={!(store.role === "OPS" || store.role === "TECH_MANAGER")}
                >
                  {L.addNote}
                </button>
              </div>

              <div className="p-3 border rounded">
                <div className="font-semibold mb-2">{L.reply}</div>
                <textarea
                  className="border rounded w-full p-2"
                  placeholder={t(store.lang, "Cevap… (yalnız Teknik Müdür)", "Answer… (Tech Manager only)")}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  disabled={store.role !== "TECH_MANAGER"}
                  rows={2}
                />
                <button
                  className={`mt-2 px-3 py-1 rounded ${
                    store.role === "TECH_MANAGER"
                      ? "bg-amber-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                  onClick={() => {
                    // en son eklenen notu cevapla (örnek akış)
                    const lastNote = store.techNotes.find((n) => n.unitId === activeUnit.id && !n.reply);
                    if (lastNote) answerNote(lastNote.id);
                  }}
                  disabled={store.role !== "TECH_MANAGER"}
                >
                  {L.answer}
                </button>
              </div>
            </div>

            {/* İlgili notların listesi */}
            <div className="mt-4 p-3 border rounded">
              <div className="font-semibold mb-2">{t(store.lang, "Son Notlar", "Recent Notes")}</div>
              <div className="grid gap-2 max-h-48 overflow-auto">
                {store.techNotes.filter((n) => n.unitId === activeUnit.id).map((n) => (
                  <div key={n.id} className="p-2 bg-gray-50 border rounded">
                    <div className="text-xs text-gray-500">{n.date} — {n.from === "OPS" ? "OPS" : "TECH_MANAGER"}</div>
                    <div className="whitespace-pre-wrap">{n.text}</div>
                    {n.reply && (
                      <div className="mt-1 pl-3 border-l-2 border-amber-400">
                        <div className="text-xs text-gray-500">{t(store.lang, "Cevap", "Reply")} — {n.reply.date}</div>
                        <div className="whitespace-pre-wrap">{n.reply.text}</div>
                      </div>
                    )}
                  </div>
                ))}
                {store.techNotes.filter((n) => n.unitId === activeUnit.id).length === 0 && (
                  <div className="text-sm text-gray-500">
                    {t(store.lang, "Henüz not yok.", "No notes yet.")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
