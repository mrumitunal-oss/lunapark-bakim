"use client";

import React, { useEffect, useMemo, useState } from "react";

/** -----------------------------
 *  Tipler
 *  ---------------------------- */
type Unit = { id: number; name: string; status: "Aktif" | "Bakımda" };
type CheckItem = { id: number; title: string; checked: boolean };
type Log = { unitId: number; date: string; ok: boolean };
type Ticket = { id: number; title: string; status: "Açık" | "Kapalı" };
type Part = { id: number; name: string; qty: number };
type Settings = { siteName: string };

type Store = {
  units: Unit[];
  checklist: CheckItem[];
  logs: Log[];
  tickets: Ticket[];
  parts: Part[];
  settings: Settings;
};

/** -----------------------------
 *  Varsayılan veriler
 *  ---------------------------- */
const DEFAULT_UNITS: Unit[] = [
  { id: 1, name: "Dönme Dolap", status: "Aktif" },
  { id: 2, name: "Çarpışan Arabalar", status: "Aktif" },
  { id: 3, name: "Gondol", status: "Bakımda" },
];

const DEFAULT_CHECKLIST: CheckItem[] = [
  { id: 1, title: "Emniyet kemerleri kontrol edildi", checked: false },
  { id: 2, title: "Operatör paneli test edildi", checked: false },
  { id: 3, title: "Alan güvenliği sağlandı", checked: false },
];

const LS_KEY = "lunapark_bakim_store";

/** -----------------------------
 *  SSR için güvenli varsayılan depo
 *  ---------------------------- */
const DEFAULT_STORE: Store = {
  units: DEFAULT_UNITS,
  checklist: DEFAULT_CHECKLIST,
  logs: [],
  tickets: [],
  parts: [],
  settings: { siteName: "BW Entertainment & Attractions" },
};

/** -----------------------------
 *  LocalStorage yardımcıları
 *  ---------------------------- */
const loadStore = (): Store => {
  try {
    if (typeof window === "undefined") return DEFAULT_STORE;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw) as Store;
  } catch {
    return DEFAULT_STORE;
  }
};

const saveStore = (store: Store) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    // sessiz geç
  }
};

/** -----------------------------
 *  Sayfa
 *  ---------------------------- */
export default function Page() {
  // 1) SSR'da hesaplama yapmamak için "mounted" bayrağı
  const [mounted, setMounted] = useState(false);

  // 2) Store'u güvenli varsayılanla başlat
  const [store, setStore] = useState<Store>(DEFAULT_STORE);

  // 3) Sekme
  const [tab, setTab] = useState<"Üniteler" | "Günlük Kontrol" | "Raporlar">(
    "Üniteler"
  );

  // 4) Tarih (YYYY-MM-DD)
  const day = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // 5) Yalnızca tarayıcıda mount olunca veriyi yükle
  useEffect(() => {
    setMounted(true);
    setStore(loadStore());
  }, []);

  // 6) Değişiklikleri localStorage'a yaz (yalnızca tarayıcıda)
  useEffect(() => {
    if (!mounted) return;
    saveStore(store);
  }, [store, mounted]);

  // 7) (Sadece tarayıcıda) bugüne ait logları map'e çevir
  const dailyLogs = useMemo(() => {
    if (!mounted) return {} as Record<number, Log>;
    const entries = (store.logs || []).filter((l) => l.date === day);
    const map: Record<number, Log> = {};
    entries.forEach((l) => (map[l.unitId] = l));
    return map;
  }, [mounted, store.logs, day]);

  // 8) Bir ünite için "uygun/arızalı" işaretle
  const toggleLog = (unitId: number, ok: boolean) => {
    if (!mounted) return;
    const withoutToday = (store.logs || []).filter(
      (l) => !(l.unitId === unitId && l.date === day)
    );
    const updatedLogs = [...withoutToday, { unitId, date: day, ok }];
    setStore({ ...store, logs: updatedLogs });
  };

  /** -------- ÜNİTELER SEKME -------- */
  const UnitsTab = () => (
    <div>
      <h2 className="text-xl font-semibold mb-3">Ünite Listesi</h2>
      {(store.units || []).map((u) => {
        const today = (dailyLogs as any)[u.id];
        const badge =
          today == null
            ? "bg-gray-200 text-gray-800"
            : today.ok
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700";
        const badgeText =
          today == null ? "Kontrolsüz" : today.ok ? "Uygun" : "Arızalı";

        return (
          <div
            key={u.id}
            className="p-3 border rounded mb-2 flex justify-between items-center bg-white"
          >
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-sm text-gray-500">
                Durum:{" "}
                <b
                  className={
                    u.status === "Aktif" ? "text-green-600" : "text-amber-600"
                  }
                >
                  {u.status}
                </b>
              </div>
              <div
                className={`inline-block text-xs mt-1 px-2 py-0.5 rounded ${badge}`}
              >
                {badgeText}
              </div>
            </div>
            <div className="space-x-2">
              <button
                className="px-3 py-1 rounded bg-green-600 text-white"
                onClick={() => toggleLog(u.id, true)}
              >
                ✅ Uygun
              </button>
              <button
                className="px-3 py-1 rounded bg-red-600 text-white"
                onClick={() => toggleLog(u.id, false)}
              >
                ❌ Arızalı
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  /** -------- GÜNLÜK KONTROL SEKME -------- */
  const DailyTab = () => (
    <div>
      <h2 className="text-xl font-semibold mb-3">Günlük Kontrol Listesi</h2>
      {(store.checklist || []).map((item) => (
        <label
          key={item.id}
          className="flex items-center gap-2 p-2 bg-white border rounded mb-2"
        >
          <input
            type="checkbox"
            checked={item.checked}
            onChange={(e) => {
              const updated = (store.checklist || []).map((c) =>
                c.id === item.id ? { ...c, checked: e.target.checked } : c
              );
              setStore({ ...store, checklist: updated });
            }}
          />
          <span>{item.title}</span>
        </label>
      ))}
    </div>
  );

  /** -------- RAPORLAR SEKME -------- */
  const ReportsTab = () => {
    if (!mounted) {
      return <div className="text-gray-500">Rapor hazırlanıyor…</div>;
    }
    const total = (store.logs || []).filter((l) => l.date === day).length;
    const oks = (store.logs || []).filter(
      (l) => l.date === day && l.ok
    ).length;
    const faults = total - oks;

    return (
      <div>
        <h2 className="text-xl font-semibold mb-3">Rapor Özeti ({day})</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="p-3 rounded bg-white border">
            <div className="text-sm text-gray-500">Toplam Kontrol</div>
            <div className="text-2xl font-bold">{total}</div>
          </div>
          <div className="p-3 rounded bg-white border">
            <div className="text-sm text-gray-500">Uygun</div>
            <div className="text-2xl font-bold text-green-600">{oks}</div>
          </div>
          <div className="p-3 rounded bg-white border">
            <div className="text-sm text-gray-500">Arızalı</div>
            <div className="text-2xl font-bold text-red-600">{faults}</div>
          </div>
        </div>
      </div>
    );
  };

  // --- SSR sırasında sadece hafif bir iskelet göster ---
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 font-sans">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-blue-700">
            Lunapark Bakım Yazılımı – Lite
          </h1>
          <div className="text-sm text-gray-600">
            {DEFAULT_STORE.settings.siteName}
          </div>
        </header>
        <div className="bg-white border rounded p-4 text-gray-500">
          Yükleniyor…
        </div>
      </div>
    );
  }

  // --- Normal render ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-blue-700">
          Lunapark Bakım Yazılımı – Lite
        </h1>
        <div className="text-sm text-gray-600">{store.settings.siteName}</div>
      </header>

      {/* Sekme butonları */}
      <div className="flex gap-2 mb-4">
        {(["Üniteler", "Günlük Kontrol", "Raporlar"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded ${
              tab === t ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <main className="max-w-4xl mx-auto">
        {tab === "Üniteler" && <UnitsTab />}
        {tab === "Günlük Kontrol" && <DailyTab />}
        {tab === "Raporlar" && <ReportsTab />}
      </main>
    </div>
  );
}
