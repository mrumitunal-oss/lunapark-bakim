'use client';

import React, { useEffect, useMemo, useState } from 'react';

// Basit stiller (UI kütüphanesine ihtiyaç yok)
const container: React.CSSProperties = { maxWidth: 1100, margin: '24px auto', padding: 16, fontFamily: 'system-ui, Arial' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const grid = { display: 'grid', gap: 12 } as const;
const row = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } as const;
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { ...btn, background: '#111827', color: 'white', borderColor: '#111827' };
const badge = (bg: string, color: string) => ({ padding: '4px 10px', borderRadius: 999, fontSize: 12, background: bg, color });

const LS_KEY = 'luna_maintenance_v01_lite';
const todayKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const nowISO = () => new Date().toISOString();

type Role = 'Operatör' | 'Supervisor' | 'Teknik Personel' | 'Teknik Müdür' | 'İşletme Müdürü';
type Ticket = { id: string; unitId: string; title: string; desc: string; priority: 'Düşük'|'Orta'|'Yüksek'|'Kritik'; status: 'Açık'|'Kapalı'; createdBy: string; createdAt: string; closedAt?: string };
type Part = { id: string; unitId: string; name: string; qty: number; action: 'Kullanıldı'|'Depoya Girdi'|'İade'|'Hurda'; by: string; at: string };

const DEFAULT_UNITS = [
  { id: 'U-001', name: 'Atlı Karınca', type: 'Aile', location: 'Meydan' },
  { id: 'U-002', name: 'Çarpışan Arabalar', type: 'Aile', location: 'Kapalı A' },
  { id: 'U-003', name: 'Crazy Dance', type: 'Adrenalin', location: 'Kuzey' },
];
const DEFAULT_CHECKLIST = [
  { id: 'c1', text: 'Görsel kontrol – çatlak, deformasyon, gevşek bağlantı yok' },
  { id: 'c2', text: 'Emniyet barları ve kilitler fonksiyon testi' },
  { id: 'c3', text: 'Acil durdurma (E-Stop) fonksiyon testi' },
  { id: 'c4', text: 'Alan güvenlik bariyerleri ve turnike kontrolü' },
  { id: 'c5', text: 'Operatör paneli ve göstergelerin çalışması' },
];

type Store = {
  units: typeof DEFAULT_UNITS;
  checklist: typeof DEFAULT_CHECKLIST;
  logs: any[];
  tickets: Ticket[];
  parts: Part[];
  settings: { siteName: string };
};
const loadStore = (): Store => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error('empty');
    return JSON.parse(raw);
  } catch {
    return { units: DEFAULT_UNITS, checklist: DEFAULT_CHECKLIST, logs: [], tickets: [], parts: [], settings: { siteName: 'BW Entertainment & Attractions' } };
  }
};
const saveStore = (s: Store) => localStorage.setItem(LS_KEY, JSON.stringify(s));

function computeDailyStatus(log: any) {
  if (!log || !log.items) return 'kirmizi';
  const total = log.items.length;
  const done = log.items.filter((i: any) => i.done).length;
  const approvals = [log.approvalOperator, log.approvalSupervisor, log.approvalTech, log.approvalManager];
  const approvedCount = approvals.filter(Boolean).length;
  if (approvedCount === 4) return 'mavi';
  if (done === 0) return 'kirmizi';
  if (done < total) return 'sari';
  return 'yesil';
}
const statusText: Record<string,string> = { kirmizi: 'Başlamadı', sari: 'Eksik', yesil: 'Tamam', mavi: '4 Onay' };
const statusStyle: Record<string, React.CSSProperties> = {
  kirmizi: badge('#fee2e2', '#991b1b'),
  sari:   badge('#fef3c7', '#92400e'),
  yesil:  badge('#dcfce7', '#166534'),
  mavi:   badge('#dbeafe', '#1e40af'),
};

export default function Page() {
  const [store, setStore] = useState<Store>(() => (typeof window === 'undefined' ? ({} as any) : loadStore()));
  useEffect(() => { if (store && (store as any).units) saveStore(store); }, [store]);

  const [user, setUser] = useState<{name: string; role: Role} | null>(null);
  const [tab, setTab] = useState<'units'|'daily'|'tickets'|'parts'|'reports'|'settings'>('units');

  const day = todayKey();
  const dailyLogs = useMemo(() => {
    const entries = store.logs.filter((l: any) => l.date === day);
    const map: Record<string, any> = {};
    entries.forEach((l: any) => (map[l.unitId] = l));
    return map;
  }, [store.logs, day]);

  return (
    <div style={container}>
      <div style={{...row, justifyContent: 'space-between', marginBottom: 12}}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Lunapark Bakım Yazılımı – Lite</h1>
          <div style={{ color: '#6b7280', fontSize: 12 }}>{store.settings?.siteName}</div>
        </div>
        <div style={row as any}>
          {user ? (
            <>
              <span style={badge('#eef2ff','#3730a3')}>👤 {user.role}</span>
              <button style={btn} onClick={()=>setUser(null)}>Çıkış</button>
            </>
          ) : (
            <Login onLogin={setUser} />
          )}
        </div>
      </div>

      <div style={{...row, gap: 6, marginBottom: 12}}>
        {[
          ['units','Üniteler'],['daily','Günlük Kontrol'],['tickets','İş Emirleri'],['parts','Yedek Parça'],['reports','Raporlar'],['settings','Ayarlar'],
        ].map(([k,l])=>(
          <button key={k} style={tab===k as any ? btnPrimary : btn} onClick={()=>setTab(k as any)}>{l}</button>
        ))}
      </div>

      {tab==='units' && <Units store={store} dailyLogs={dailyLogs} />}
      {tab==='daily' && <Daily store={store} setStore={setStore} user={user} />}
      {tab==='tickets' && <Tickets store={store} setStore={setStore} user={user} />}
      {tab==='parts' && <Parts store={store} setStore={setStore} user={user} />}
      {tab==='reports' && <Reports store={store} />}
      {tab==='settings' && <Settings store={store} setStore={setStore} />}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (u:{name:string; role:Role})=>void }) {
  const [name,setName] = useState('');
  const [role,setRole] = useState<Role>('Operatör');
  return (
    <div style={row}>
      <input placeholder="Adınız" value={name} onChange={e=>setName(e.target.value)} style={{ padding: 8, borderRadius: 10, border: '1px solid #e5e7eb' }} />
      <select value={role} onChange={e=>setRole(e.target.value as Role)} style={{ padding: 8, borderRadius: 10, border: '1px solid #e5e7eb' }}>
        {['İşletme Müdürü','Teknik Müdür','Teknik Personel','Supervisor','Operatör'].map(r=><option key={r} value={r}>{r}</option>)}
      </select>
      <button style={btnPrimary} onClick={()=>onLogin({ name: name || 'Kullanıcı', role })}>Giriş</button>
    </div>
  );
}

function Units({ store, dailyLogs }: any) {
  return (
    <div style={{...grid, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'}}>
      {store.units.map((u: any)=> {
        const log = dailyLogs[u.id];
        const status = computeDailyStatus(log);
        return (
          <div key={u.id} style={card}>
            <div style={{...row, justifyContent:'space-between'}}>
              <b>{u.name}</b>
              <span style={statusStyle[status]}>{statusText[status]}</span>
            </div>
            <div style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>
              <div><b>Kod:</b> {u.id}</div>
              <div><b>Tip:</b> {u.type}</div>
              <div><b>Konum:</b> {u.location}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Daily({ store, setStore, user }: any) {
  const [selected, setSelected] = useState<string>(store.units[0]?.id || '');
  const day = todayKey();
  const base = useMemo(()=>{
    const found = store.logs.find((l:any)=> l.unitId===selected && l.date===day);
    if (found) return found;
    return {
      id: `${selected}-${day}`,
      unitId: selected,
      date: day,
      items: store.checklist.map((c:any)=> ({...c, done:false})),
      notes: '',
      approvalOperator: null,
      approvalSupervisor: null,
      approvalTech: null,
      approvalManager: null,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
  },[store.logs, selected, store.checklist, day]);

  useEffect(()=>{
    if (!store.logs.find((l:any)=> l.id===base.id)) {
      setStore({ ...store, logs: [...store.logs, base] });
    }
    // eslint-disable-next-line
  },[base.id]);

  const updateLog = (patch:any) => {
    setStore({
      ...store,
      logs: store.logs.map((l:any)=> l.id===base.id ? { ...l, ...patch, updatedAt: nowISO() } : l)
    });
  };

  const approve = () => {
    if (!user) return;
    const stamp = { by: user.name, at: nowISO() };
    const role = user.role as Role;
    if (role === 'Operatör') updateLog({ approvalOperator: stamp });
    else if (role === 'Supervisor') updateLog({ approvalSupervisor: stamp });
    else if (role === 'Teknik Personel') updateLog({ approvalTech: stamp });
    else if (role === 'Teknik Müdür' || role === 'İşletme Müdürü') updateLog({ approvalManager: stamp });
  };

  const status = computeDailyStatus(base);
  const approvals = [
    ['Operatör', base.approvalOperator],
    ['Supervisor', base.approvalSupervisor],
    ['Teknik Personel', base.approvalTech],
    ['Teknik/İşletme Müdürü', base.approvalManager],
  ];

  return (
    <div style={{...grid, gridTemplateColumns: '300px 1fr'}}>
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Ünite Seç</div>
        <select value={selected} onChange={e=>setSelected(e.target.value)} style={{ padding: 8, borderRadius: 10, border: '1px solid #e5e7eb', width: '100%' }}>
          {store.units.map((u:any)=> <option key={u.id} value={u.id}>{u.id} – {u.name}</option>)}
        </select>
        <div style={{ marginTop: 10 }}>
          <span style={{ marginRight: 8 }}>Durum:</span>
          <span style={statusStyle[status]}>{statusText[status]}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <button style={btnPrimary} onClick={approve} disabled={!user}>Rolümle Onay Ver ✅</button>
        </div>
        <div style={{ marginTop: 12, ...grid }}>
          {approvals.map(([label, v])=>(
            <div key={label as string} style={{ display:'flex', justifyContent:'space-between', fontSize: 14 }}>
              <span>{label}</span>
              <span style={v ? badge('#e0f2fe','#075985') : badge('#f3f4f6','#111827')}>{v ? 'Onaylı' : 'Bekliyor'}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Günlük Kontrol Listesi</div>
        <div style={{ display:'grid', gap: 8 }}>
          {base.items.map((it:any)=>(
            <label key={it.id} style={{ display:'flex', gap: 8, alignItems:'flex-start', border:'1px solid #e5e7eb', borderRadius: 10, padding: 8 }}>
              <input type="checkbox" checked={!!it.done} onChange={e=>{
                const items = base.items.map((x:any)=> x.id===it.id ? { ...x, done: e.target.checked } : x);
                updateLog({ items });
              }} />
              <span style={{ fontSize: 14 }}>{it.text}</span>
            </label>
          ))}
          <textarea placeholder="Notlar" value={base.notes} onChange={e=>updateLog({ notes: e.target.value })} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb', minHeight:80 }} />
          <div style={row}>
            <button style={btn} onClick={()=>downloadJSON({ logs:[base] })}>Formu JSON İndir</button>
            <button style={btn} onClick={()=>window.print()}>Yazdır</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tickets({ store, setStore, user }: any) {
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState<Ticket>({ id:'', unitId: store.units[0]?.id || '', title:'', desc:'', priority:'Orta', status:'Açık', createdBy: user?.name || 'Sistem', createdAt: nowISO() });
  const add = () => {
    if (!ticket.unitId || !ticket.title) return;
    const t = { ...ticket, id: `T-${Date.now()}`, createdBy: user?.name || 'Sistem', createdAt: nowISO() };
    setStore({ ...store, tickets: [t, ...store.tickets] });
    setOpen(false);
    setTicket({ id:'', unitId: store.units[0]?.id || '', title:'', desc:'', priority:'Orta', status:'Açık', createdBy: user?.name || 'Sistem', createdAt: nowISO() });
  };
  const closeTicket = (id:string) => setStore({ ...store, tickets: store.tickets.map((t:Ticket)=> t.id===id ? { ...t, status:'Kapalı', closedAt: nowISO() } : t) });

  return (
    <div style={{...grid}}>
      <div style={{...row, justifyContent:'space-between'}}>
        <h3>🛠️ Açık İş Emirleri</h3>
        <button style={btnPrimary} onClick={()=>setOpen(true)}>+ Yeni İş Emri</button>
      </div>

      {open && (
        <div style={card}>
          <div style={grid}>
            <select value={ticket.unitId} onChange={e=>setTicket({...ticket, unitId: e.target.value})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb' }}>
              {store.units.map((u:any)=><option key={u.id} value={u.id}>{u.id} – {u.name}</option>)}
            </select>
            <input placeholder="Başlık" value={ticket.title} onChange={e=>setTicket({...ticket, title:e.target.value})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb' }} />
            <textarea placeholder="Açıklama" value={ticket.desc} onChange={e=>setTicket({...ticket, desc:e.target.value})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb', minHeight:80 }} />
            <select value={ticket.priority} onChange={e=>setTicket({...ticket, priority: e.target.value as any})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb' }}>
              {['Düşük','Orta','Yüksek','Kritik'].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <div style={row}>
              <button style={btn} onClick={()=>setOpen(false)}>Vazgeç</button>
              <button style={btnPrimary} onClick={add}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gap: 12 }}>
        {store.tickets.map((t:Ticket)=>(
          <div key={t.id} style={card}>
            <div style={{...row, justifyContent:'space-between'}}>
              <b style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</b>
              <span style={badge('#eef2ff','#3730a3')}>{t.status}</span>
            </div>
            <div style={{ fontSize:14, color:'#6b7280', marginTop:6 }}>
              <div><b>Ünite:</b> {t.unitId} — <b>Öncelik:</b> {t.priority}</div>
              <div>{t.desc}</div>
              <div style={{ fontSize:12, marginTop:6 }}>Oluşturan: {t.createdBy} — {new Date(t.createdAt).toLocaleString()}</div>
            </div>
            {t.status==='Açık' && (
              <div style={{ marginTop:8 }}>
                <button style={btn} onClick={()=>closeTicket(t.id)}>Kapattım</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Parts({ store, setStore, user }: any) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<Part>({ id:'', unitId: store.units[0]?.id || '', name:'', qty:1, action:'Kullanıldı', by: user?.name || 'Sistem', at: nowISO() });
  const add = () => {
    if (!part.name) return;
    const p = { ...part, id: `P-${Date.now()}`, by: user?.name || 'Sistem', at: nowISO() };
    setStore({ ...store, parts: [p, ...store.parts] });
    setOpen(false);
    setPart({ id:'', unitId: store.units[0]?.id || '', name:'', qty:1, action:'Kullanıldı', by: user?.name || 'Sistem', at: nowISO() });
  };
  return (
    <div style={grid}>
      <div style={{...row, justifyContent:'space-between'}}>
        <h3>📦 Parça Hareketleri</h3>
        <button style={btnPrimary} onClick={()=>setOpen(true)}>+ Yeni Kayıt</button>
      </div>

      {open && (
        <div style={card}>
          <div style={grid}>
            <select value={part.unitId} onChange={e=>setPart({...part, unitId:e.target.value})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb' }}>
              {store.units.map((u:any)=><option key={u.id} value={u.id}>{u.id} – {u.name}</option>)}
            </select>
            <input placeholder="Parça Adı / Kod" value={part.name} onChange={e=>setPart({...part, name:e.target.value})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb' }} />
            <input type="number" min={1} placeholder="Adet" value={part.qty} onChange={e=>setPart({...part, qty:Number(e.target.value||1)})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb', width:120 }} />
            <select value={part.action} onChange={e=>setPart({...part, action:e.target.value as any})} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb' }}>
              {['Kullanıldı','Depoya Girdi','İade','Hurda'].map(a=><option key={a} value={a}>{a}</option>)}
            </select>
            <div style={row}>
              <button style={btn} onClick={()=>setOpen(false)}>Vazgeç</button>
              <button style={btnPrimary} onClick={add}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gap: 12 }}>
        {store.parts.map((p:Part)=>(
          <div key={p.id} style={card}>
            <div style={{...row, justifyContent:'space-between'}}>
              <b>{p.name}</b>
              <span style={badge('#eef2ff','#3730a3')}>{p.action}</span>
            </div>
            <div style={{ fontSize:14, color:'#6b7280', marginTop:6 }}>
              <div><b>Ünite:</b> {p.unitId} — <b>Adet:</b> {p.qty}</div>
              <div style={{ fontSize:12 }}>Kayıt: {p.by} — {new Date(p.at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reports({ store }: any) {
  const day = todayKey();
  const todayLogs = store.logs.filter((l:any)=> l.date===day);
  const totals = useMemo(()=>{
    const units = new Set(todayLogs.map((l:any)=> l.unitId)).size;
    const approvals = todayLogs.reduce((acc:number, l:any)=> acc + [l.approvalOperator,l.approvalSupervisor,l.approvalTech,l.approvalManager].filter(Boolean).length, 0);
    const ok = todayLogs.filter((l:any)=> computeDailyStatus(l)==='mavi').length;
    const openTickets = store.tickets.filter((t:Ticket)=> t.status==='Açık').length;
    return { units, approvals, ok, openTickets };
  },[todayLogs, store.tickets]);

  return (
    <div style={{...grid, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'}}>
      <Stat title="Bugün İşlem Gören Ünite" value={totals.units} />
      <Stat title="Toplam Onay" value={totals.approvals} />
      <Stat title="4 Onaylı Ünite" value={totals.ok} />
      <Stat title="Açık İş Emri" value={totals.openTickets} />

      <div style={{ gridColumn: '1 / -1', ...card }}>
        <b>Ham Veriyi Dışa Aktar</b>
        <div style={{...row, marginTop: 8}}>
          <button style={btn} onClick={()=>downloadJSON(store)}>JSON İndir</button>
          <button style={btn} onClick={()=>downloadCSV(store)}>CSV (loglar) İndir</button>
        </div>
      </div>
    </div>
  );
}
function Stat({ title, value }: {title:string; value:number}) {
  return (
    <div style={card}>
      <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
        <div style={{ padding: 8, borderRadius: 12, background:'#f3f4f6' }}>📊</div>
        <div>
          <div style={{ color:'#6b7280', fontSize: 13 }}>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function Settings({ store, setStore }: any) {
  const [siteName,setSiteName] = useState(store.settings.siteName || '');
  const importJSON = (file: File) => {
    const r = new FileReader();
    r.onload = ()=> {
      try {
        const json = JSON.parse(String(r.result));
        localStorage.setItem(LS_KEY, JSON.stringify(json));
        alert('Veri içe aktarıldı. Sayfa yenilenecek.');
        window.location.reload();
      } catch {
        alert('JSON okunamadı.');
      }
    };
    r.readAsText(file);
  };
  return (
    <div style={{...grid, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'}}>
      <div style={card}>
        <b>Genel</b>
        <div style={{ marginTop: 8, ...grid }}>
          <input value={siteName} onChange={e=>setSiteName(e.target.value)} style={{ padding:8, borderRadius:10, border:'1px solid #e5e7eb' }} />
          <button style={btnPrimary} onClick={()=>setStore({ ...store, settings: { ...store.settings, siteName } })}>Kaydet</button>
        </div>
      </div>
      <div style={card}>
        <b>Veri</b>
        <div style={{ marginTop: 8, ...grid }}>
          <button style={btn} onClick={()=>downloadJSON(store)}>JSON İndir</button>
          <label style={{ ...btn, display:'inline-block' }}>
            JSON İçe Aktar
            <input type="file" accept="application/json" style={{ display:'none' }} onChange={e=> e.target.files?.[0] && importJSON(e.target.files[0]) } />
          </label>
        </div>
      </div>
    </div>
  );
}

// İndirme yardımcıları
function downloadJSON(data:any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `lunapark_bakim_${todayKey()}.json`; a.click();
  URL.revokeObjectURL(url);
}
function downloadCSV(store:any) {
  const headers = ["unitId","date","itemId","itemText","done","notes","approvalOperator","approvalSupervisor","approvalTech","approvalManager"];
  const rows: string[] = [];
  store.logs.forEach((l:any)=>{
    l.items.forEach((it:any)=>{
      rows.push([
        l.unitId,
        l.date,
        it.id,
        `"${(it.text||'').replaceAll('"','""')}"`,
        it.done ? 1 : 0,
        `"${(l.notes||'').replaceAll('"','""')}"`,
        l.approvalOperator ? 1 : 0,
        l.approvalSupervisor ? 1 : 0,
        l.approvalTech ? 1 : 0,
        l.approvalManager ? 1 : 0,
      ].join(','));
    });
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `lunapark_bakim_logs_${todayKey()}.csv`; a.click();
  URL.revokeObjectURL(url);
}
