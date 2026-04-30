'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0d0f18;--card:#13161f;--card2:#1a1e2e;--border:#252a3d;
    --accent:#f0b429;--blue:#4e8ef7;--purple:#a78bfa;
    --green:#34d399;--red:#f87171;--text:#eef0f8;--sub:#8b93b8;--muted:#4a5170;
  }
  html,body{height:100%;background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif}
  input,select{background:var(--card2);border:1.5px solid var(--border);color:var(--text);border-radius:10px;padding:12px 14px;font-family:'DM Sans',sans-serif;font-size:15px;width:100%;outline:none;transition:border-color .2s;-webkit-appearance:none}
  input:focus,select:focus{border-color:var(--accent)}
  input::placeholder{color:var(--muted)}
  button{cursor:pointer;font-family:'DM Sans',sans-serif;border:none;outline:none}
  .fade{animation:fi .2s ease}
  @keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .spin{animation:sp .8s linear infinite;display:inline-block}
  @keyframes sp{to{transform:rotate(360deg)}}
  .tap{transition:transform .1s,opacity .1s}
  .tap:active{transform:scale(.96);opacity:.85}
`;

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0);
const today = () => new Date().toISOString().split('T')[0];
const monthKey = d => d?d.slice(0,7):'';
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmtMes = k => { if(!k) return ''; const [y,m]=k.split('-'); return MONTHS[+m-1]+' '+y; };
const uid = () => Math.random().toString(36).slice(2,10);
const prevMonths = () => {
  const result = [];
  const now = new Date();
  for(let i=1; i<=6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return result;
};

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function loadConfig() {
  const { data } = await supabase.from('config').select('*').eq('id',1).single();
  return data || { empresa:'Mi Empresa', socios:['Socio A','Socio B'], destinatarios:[] };
}
async function saveConfig(cfg) {
  await supabase.from('config').upsert({ id:1, empresa:cfg.empresa, socios:cfg.socios, destinatarios:cfg.destinatarios||[] });
}
async function loadCheques() {
  const { data } = await supabase.from('cheques').select('*').order('created_at',{ascending:false});
  return data || [];
}
async function loadRetiros(socioIdx) {
  const { data } = await supabase.from('retiros').select('*').eq('socio_idx',socioIdx).order('fecha',{ascending:false});
  return data || [];
}
async function insertRetiro(retiro) {
  const { error } = await supabase.from('retiros').insert(retiro);
  return !error;
}
async function deleteRetiro(id) {
  await supabase.from('retiros').delete().eq('id',id);
}
async function loadCierres(socioIdx) {
  const { data } = await supabase.from('cierres_mes').select('*').eq('socio_idx',socioIdx).order('mes',{ascending:false});
  return data || [];
}
async function insertCierre(cierre) {
  const { error } = await supabase.from('cierres_mes').insert(cierre);
  return !error;
}
async function acreditarCheques(ids, now) {
  await supabase.from('cheques').update({ estado:'acreditado', acreditado_en:String(now) }).in('id',ids);
}

// ─── UI Primitivos ────────────────────────────────────────────────────────────
const Card = ({children,style:s}) => <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:16,...s}}>{children}</div>;
const Lbl = ({children}) => <div style={{fontSize:11,fontWeight:600,color:'var(--sub)',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:8}}>{children}</div>;
const Pill = ({color,children}) => <span style={{background:color+'22',color,fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,whiteSpace:'nowrap'}}>{children}</span>;
const Spinner = () => <span className="spin" style={{display:'inline-block'}}>⟳</span>;

function Btn({children, onClick, disabled, loading, bg, color, full, style:ex, variant}) {
  const bgc = variant==='ghost'?'var(--card2)':variant==='danger'?'var(--red)':bg||'var(--accent)';
  const col = variant==='ghost'?'var(--sub)':variant==='danger'?'#fff':color||'#0d0f18';
  return (
    <button onClick={onClick} disabled={disabled||loading} className="tap"
      style={{padding:'13px 20px',borderRadius:12,background:bgc,color:col,fontWeight:700,fontSize:15,
        width:full?'100%':'auto',opacity:(disabled||loading)?0.6:1,cursor:(disabled||loading)?'not-allowed':'pointer',
        border:variant==='ghost'?'1px solid var(--border)':'none',...ex}}>
      {loading?<Spinner/>:children}
    </button>
  );
}

function Confirm({data,onOk,onCancel,titulo,loading}) {
  return (
    <div style={{position:'fixed',inset:0,background:'#000b',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div className="fade" style={{background:'var(--card)',borderRadius:'20px 20px 0 0',padding:24,width:'100%',maxWidth:480,border:'1px solid var(--border)'}}>
        <div style={{fontFamily:'Syne',fontSize:17,fontWeight:700,marginBottom:16}}>{titulo||'Confirmás?'}</div>
        <Card style={{background:'var(--card2)',marginBottom:20}}>
          {Object.entries(data).map(([k,v]) => v?(
            <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <span style={{color:'var(--sub)',fontSize:13}}>{k}</span>
              <span style={{fontSize:14,fontWeight:k==='Monto'?600:400,fontFamily:k==='Monto'?'DM Mono':'inherit',color:k==='Monto'?'var(--accent)':'var(--text)'}}>{v}</span>
            </div>
          ):null)}
        </Card>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onCancel} disabled={loading} className="tap" style={{flex:1,padding:14,borderRadius:12,background:'var(--card2)',color:'var(--sub)',fontWeight:600,fontSize:15}}>Cancelar</button>
          <button onClick={onOk} disabled={loading} className="tap" style={{flex:2,padding:14,borderRadius:12,background:'var(--accent)',color:'#0d0f18',fontFamily:'Syne',fontWeight:800,fontSize:16}}>
            {loading?<Spinner/>:'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function PantallaLogin({config,onLogin}) {
  return (
    <div className="fade" style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{fontFamily:'Syne',fontSize:28,fontWeight:800,color:'var(--accent)',marginBottom:6,textAlign:'center'}}>{config.empresa}</div>
      <div style={{color:'var(--sub)',fontSize:14,marginBottom:8,textAlign:'center'}}>Panel de retiros</div>
      <div style={{color:'var(--muted)',fontSize:12,marginBottom:44,textAlign:'center'}}>Solo elegis una vez — este dispositivo te va a recordar</div>
      <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{color:'var(--sub)',fontSize:12,fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',textAlign:'center',marginBottom:4}}>Quien sos?</div>
        {config.socios.map((s,i) => (
          <button key={i} onClick={()=>onLogin(i)} className="tap"
            style={{padding:'18px 24px',borderRadius:16,background:'var(--card)',border:'2px solid var(--border)',color:'var(--text)',fontSize:18,fontWeight:700,fontFamily:'Syne',display:'flex',alignItems:'center',gap:14}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=i===0?'var(--blue)':'var(--purple)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
            <div style={{width:42,height:42,borderRadius:'50%',background:i===0?'var(--blue)22':'var(--purple)22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
              {i===0?'🔵':'🟣'}
            </div>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Inicio ───────────────────────────────────────────────────────────────────
function PantallaInicio({socio,socioIdx,retiros,cierres,onSave,onCerrarMes}) {
  const [tipo,setTipo] = useState('efectivo');
  const [monto,setMonto] = useState('');
  const [desc,setDesc] = useState('');
  const [fecha,setFecha] = useState(today());
  const [confirm,setConfirm] = useState(null);
  const [loading,setLoading] = useState(false);

  const mesActual = monthKey(today());
  const SC = socioIdx===0?'var(--blue)':'var(--purple)';

  // Meses abiertos anteriores (no cerrados)
  const mesesCerrados = new Set(cierres.map(c=>c.mes));
  const mesesConRetiros = [...new Set(retiros.map(r=>monthKey(r.fecha)))].filter(m=>m!==mesActual).sort().reverse();
  const mesesPendientes = mesesConRetiros.filter(m=>!mesesCerrados.has(m));

  const retirosDelMes = mes => retiros.filter(r=>monthKey(r.fecha)===mes);
  const totalMes = mes => retirosDelMes(mes).reduce((a,r)=>a+r.monto,0);

  const handleGuardar = () => {
    if(!monto||parseFloat(monto)<=0) return;
    const confirmData = {'Tipo':tipo==='efectivo'?'Efectivo':'Billetera digital','Monto':fmt(parseFloat(monto)),'Fecha':fecha};
    if(desc) confirmData['Descripcion']=desc;
    setConfirm(confirmData);
  };

  const handleConfirm = async () => {
    setLoading(true);
    const nuevo={id:uid(),socio_idx:socioIdx,tipo,monto:parseFloat(monto),descripcion:desc,fecha,created_at:String(Date.now())};
    const ok = await onSave(nuevo);
    setLoading(false);
    if(ok){ setConfirm(null); setMonto(''); setDesc(''); setFecha(today()); }
  };

  const tipoIcon = t => t==='efectivo'?'💵':t==='billetera'?'📱':t==='tarjeta'?'💳':'📝';

  return (
    <div className="fade" style={{display:'flex',flexDirection:'column',gap:14}}>
      {confirm && <Confirm titulo="Confirmas este retiro?" data={confirm} onOk={handleConfirm} onCancel={()=>setConfirm(null)} loading={loading}/>}

      {/* Banner meses pendientes */}
      {mesesPendientes.length>0 && (
        <div style={{background:'var(--red)18',border:'1px solid var(--red)44',borderRadius:12,padding:'10px 14px'}}>
          <div style={{fontWeight:700,fontSize:13,color:'var(--red)',marginBottom:4}}>
            ⚠️ Tenes pendiente el cierre de {mesesPendientes.length===1?fmtMes(mesesPendientes[0]):mesesPendientes.length+' meses'}
          </div>
          <div style={{fontSize:12,color:'var(--sub)'}}>Andá a "Mis retiros" para cerrarlos</div>
        </div>
      )}

      {/* Formulario retiro */}
      <Card style={{border:'1.5px solid var(--accent)33'}}>
        <div style={{fontFamily:'Syne',fontSize:15,fontWeight:700,marginBottom:14,color:'var(--accent)'}}>Registrar retiro</div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          {[{v:'efectivo',l:'💵 Efectivo'},{v:'billetera',l:'📱 Billetera'}].map(t=>(
            <button key={t.v} onClick={()=>setTipo(t.v)} className="tap"
              style={{flex:1,padding:'11px 8px',borderRadius:10,border:'2px solid '+(tipo===t.v?'var(--accent)':'var(--border)'),background:tipo===t.v?'var(--accent)18':'var(--card2)',color:tipo===t.v?'var(--accent)':'var(--sub)',fontWeight:600,fontSize:14}}>
              {t.l}
            </button>
          ))}
        </div>
        <div style={{marginBottom:12}}>
          <Lbl>Monto</Lbl>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'var(--sub)',fontSize:16,fontWeight:600}}>$</span>
            <input type="number" placeholder="0" value={monto} onChange={e=>setMonto(e.target.value)} style={{paddingLeft:28,fontSize:22,fontFamily:'DM Mono',fontWeight:500}} inputMode="numeric"/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <Lbl>Descripcion (opcional)</Lbl>
          <input type="text" placeholder="Ej: Supermercado, nafta..." value={desc} onChange={e=>setDesc(e.target.value)}/>
        </div>
        <div style={{marginBottom:16}}>
          <Lbl>Fecha</Lbl>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
        </div>
        <Btn onClick={handleGuardar} disabled={!monto||parseFloat(monto)<=0} full
          style={{fontFamily:'Syne',fontSize:17,fontWeight:800,padding:16,borderRadius:14,
            background:monto&&parseFloat(monto)>0?'var(--accent)':'var(--muted)'}}>
          Guardar retiro →
        </Btn>
      </Card>

      {/* Mes actual */}
      {retirosDelMes(mesActual).length>0 && (
        <div>
          <div style={{fontSize:12,color:'var(--sub)',fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:8}}>
            {fmtMes(mesActual)} — {fmt(totalMes(mesActual))}
          </div>
          {retirosDelMes(mesActual).slice(0,5).map(r=>(
            <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div>
                <div style={{fontSize:14,fontWeight:500,marginBottom:2}}>{tipoIcon(r.tipo)} {r.descripcion||(r.tipo==='efectivo'?'Efectivo':r.tipo==='tarjeta'?'Tarjeta':r.tipo==='cheque'?'Cheque':'Billetera')}</div>
                <div style={{fontSize:12,color:'var(--sub)'}}>{r.fecha}</div>
              </div>
              <div style={{fontFamily:'DM Mono',color:'var(--accent)',fontSize:15}}>{fmt(r.monto)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mis Retiros ──────────────────────────────────────────────────────────────
function PantallaHistorial({retiros,cierres,socio,socioIdx,onDelete,onCerrarMes}) {
  const [confirmDel,setConfirmDel] = useState(null);
  const [loadingDel,setLoadingDel] = useState(false);
  const [confirmCierre,setConfirmCierre] = useState(null);
  const [loadingCierre,setLoadingCierre] = useState(false);
  const TIPO_C = {efectivo:'var(--green)',billetera:'var(--blue)',tarjeta:'var(--purple)',cheque:'var(--accent)'};

  const mesesCerrados = new Set(cierres.map(c=>c.mes));
  const meses = [...new Set(retiros.map(r=>monthKey(r.fecha)))].sort().reverse();
  const mesActual = monthKey(today());

  const exportCSV = () => {
    const rows=[['Fecha','Tipo','Monto','Descripcion'],...retiros.map(r=>[r.fecha,r.tipo,r.monto,r.descripcion||''])];
    const a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));
    a.download='retiros-'+socio+'.csv'; a.click();
  };

  const handleDelete = async () => {
    setLoadingDel(true);
    await onDelete(confirmDel);
    setLoadingDel(false);
    setConfirmDel(null);
  };

  const handleCierre = async () => {
    setLoadingCierre(true);
    await onCerrarMes(confirmCierre);
    setLoadingCierre(false);
    setConfirmCierre(null);
  };

  return (
    <div className="fade" style={{display:'flex',flexDirection:'column',gap:14}}>
      {confirmCierre && (
        <div style={{position:'fixed',inset:0,background:'#000b',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div className="fade" style={{background:'var(--card)',borderRadius:'20px 20px 0 0',padding:24,width:'100%',maxWidth:480,border:'1px solid var(--border)'}}>
            <div style={{fontFamily:'Syne',fontSize:17,fontWeight:700,marginBottom:8}}>Cerrar {fmtMes(confirmCierre.mes)}</div>
            <div style={{color:'var(--sub)',fontSize:13,marginBottom:16}}>Este mes quedara bloqueado. No se podran agregar mas retiros.</div>
            <Card style={{background:'var(--card2)',marginBottom:20}}>
              {Object.entries(confirmCierre.detalle||{}).map(([k,v])=>v>0?(
                <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{color:'var(--sub)',fontSize:13,textTransform:'capitalize'}}>{k}</span>
                  <span style={{fontFamily:'DM Mono',color:'var(--text)'}}>{fmt(v)}</span>
                </div>
              ):null)}
              <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)',paddingTop:8,marginTop:4}}>
                <span style={{fontWeight:700}}>Total</span>
                <span style={{fontFamily:'DM Mono',fontWeight:700,color:'var(--accent)'}}>{fmt(confirmCierre.total)}</span>
              </div>
            </Card>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setConfirmCierre(null)} disabled={loadingCierre} className="tap" style={{flex:1,padding:14,borderRadius:12,background:'var(--card2)',color:'var(--sub)',fontWeight:600,fontSize:15}}>Cancelar</button>
              <button onClick={handleCierre} disabled={loadingCierre} className="tap" style={{flex:2,padding:14,borderRadius:12,background:'var(--accent)',color:'#0d0f18',fontFamily:'Syne',fontWeight:800,fontSize:16}}>
                {loadingCierre?<Spinner/>:'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontFamily:'Syne',fontSize:20,fontWeight:700}}>Mis retiros</div>
        <button onClick={exportCSV} className="tap" style={{background:'var(--card2)',border:'1px solid var(--border)',color:'var(--sub)',padding:'7px 14px',borderRadius:10,fontSize:13,fontWeight:600}}>⬇ CSV</button>
      </div>

      {meses.length===0 && <div style={{textAlign:'center',color:'var(--sub)',padding:'40px 0'}}>Sin retiros aun.</div>}

      {meses.map(mes=>{
        const retirosDelMes = retiros.filter(r=>monthKey(r.fecha)===mes);
        const total = retirosDelMes.reduce((s,r)=>s+r.monto,0);
        const cerrado = mesesCerrados.has(mes);
        const esActual = mes===mesActual;
        const cierre = cierres.find(c=>c.mes===mes);
        const detalle = {
          efectivo: retirosDelMes.filter(r=>r.tipo==='efectivo').reduce((a,r)=>a+r.monto,0),
          billetera: retirosDelMes.filter(r=>r.tipo==='billetera').reduce((a,r)=>a+r.monto,0),
          cheque: retirosDelMes.filter(r=>r.tipo==='cheque').reduce((a,r)=>a+r.monto,0),
          tarjeta: retirosDelMes.filter(r=>r.tipo==='tarjeta').reduce((a,r)=>a+r.monto,0),
        };

        return (
          <div key={mes}>
            {/* Header del mes */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{fontFamily:'Syne',fontSize:16,fontWeight:700}}>{fmtMes(mes)}</div>
                {cerrado && <Pill color="var(--green)">Cerrado</Pill>}
                {esActual && <Pill color="var(--accent)">En curso</Pill>}
              </div>
              <div style={{fontFamily:'DM Mono',fontWeight:600,color:'var(--accent)',fontSize:16}}>{fmt(total)}</div>
            </div>

            {/* Detalle por tipo */}
            <Card style={{marginBottom:8,padding:'12px 16px'}}>
              {Object.entries(detalle).filter(([,v])=>v>0).map(([t,v])=>(
                <div key={t} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                  <span style={{color:'var(--sub)',textTransform:'capitalize'}}>{t==='efectivo'?'💵 Efectivo':t==='billetera'?'📱 Billetera':t==='cheque'?'📝 Cheques':'💳 Tarjeta'}</span>
                  <span style={{fontFamily:'DM Mono',color:TIPO_C[t]}}>{fmt(v)}</span>
                </div>
              ))}

              {/* Boton cerrar mes */}
              {!cerrado && !esActual && (
                <button onClick={()=>setConfirmCierre({mes,total,detalle})} className="tap"
                  style={{width:'100%',marginTop:12,padding:10,borderRadius:10,background:'var(--accent)',color:'#0d0f18',fontFamily:'Syne',fontSize:14,fontWeight:800}}>
                  Cerrar {fmtMes(mes)}
                </button>
              )}
            </Card>

            {/* Lista de retiros del mes */}
            {retirosDelMes.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(r=>(
              <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 4px',borderBottom:'1px solid var(--border)',opacity:cerrado?0.7:1}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <span style={{fontFamily:'DM Mono',fontSize:15,color:'var(--accent)'}}>{fmt(r.monto)}</span>
                    <Pill color={TIPO_C[r.tipo]||'var(--sub)'}>{r.tipo}</Pill>
                  </div>
                  <div style={{fontSize:12,color:r.descripcion?'var(--text)':'var(--sub)'}}>{r.descripcion||'Sin descripcion'} · {r.fecha}</div>
                </div>
                {!cerrado && (
                  confirmDel===r.id
                    ? <div style={{display:'flex',gap:6}}>
                        <button onClick={handleDelete} disabled={loadingDel} className="tap" style={{background:'var(--red)',color:'#fff',padding:'6px 10px',borderRadius:8,fontSize:12,fontWeight:700}}>
                          {loadingDel?<Spinner/>:'Si'}
                        </button>
                        <button onClick={()=>setConfirmDel(null)} className="tap" style={{background:'var(--card2)',color:'var(--sub)',padding:'6px 10px',borderRadius:8,fontSize:12}}>No</button>
                      </div>
                    : <button onClick={()=>setConfirmDel(r.id)} style={{background:'none',color:'var(--muted)',fontSize:14,padding:4}}>✕</button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Cheques ──────────────────────────────────────────────────────────────────
function PantallaCheques({cheques,onSaveCheque,config,socioIdx}) {
  const [vista,setVista] = useState('lista');
  const fileInputRef = useRef();
  const [capturada,setCapturada] = useState(null);
  const [capturadaMime,setCapturadaMime] = useState('image/jpeg');
  const [analizando,setAnalizando] = useState(false);
  const [ocrOk,setOcrOk] = useState(false);
  const [ocrErr,setOcrErr] = useState(null);
  const [numero,setNumero] = useState('');
  const [banco,setBanco] = useState('');
  const [monto,setMonto] = useState('');
  const [fechaCarga,setFechaCarga] = useState(today());
  const [fechaEmision,setFechaEmision] = useState('');
  const [fechaCobro,setFechaCobro] = useState('');
  const [destino,setDestino] = useState('ambos');
  const [destinatario,setDestinatario] = useState('');
  const [saving,setSaving] = useState(false);
  const [saved,setSaved] = useState(false);

  const {socios,destinatarios=[]} = config;
  const dColor = v=>v==='ambos'?'var(--accent)':v==='s0'?'var(--blue)':v==='s1'?'var(--purple)':'var(--muted)';
  const dLabel = v=>v==='ambos'?'Ambos':v==='s0'?socios[0]:v==='s1'?socios[1]:'Empresa';
  const pendientes = cheques.filter(c=>c.estado==='pendiente').sort((a,b)=>b.created_at-a.created_at);
  const acreditados = cheques.filter(c=>c.estado==='acreditado').sort((a,b)=>b.acreditado_en-a.acreditado_en).slice(0,10);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setOcrOk(false); setOcrErr(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1280;
        let w=img.width, h=img.height;
        if(w>MAX||h>MAX){ if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        const compressed = canvas.toDataURL('image/jpeg',0.7);
        setCapturada(compressed.split(',')[1]);
        setCapturadaMime('image/jpeg');
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const analizarFoto = async () => {
    setAnalizando(true); setOcrErr(null);
    try {
      const res = await fetch('/api/ocr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({b64:capturada,mime:capturadaMime})});
      const data = await res.json();
      if(!data.ok){ setOcrErr('No reconoci un cheque. Completa los datos manualmente.'); }
      else {
        setNumero(data.numero||''); setBanco(data.banco||'');
        setMonto(data.monto?String(data.monto):'');
        setFechaEmision(data.fecha_emision||data.fecha||'');
        setFechaCobro(data.fecha_cobro||data.fecha||'');
        setOcrOk(true);
      }
    } catch(e){ setOcrErr('Error al analizar. Completa manualmente.'); }
    setAnalizando(false);
    setVista('form');
  };

  const volver = () => {
    setCapturada(null); setOcrOk(false); setOcrErr(null);
    setNumero(''); setBanco(''); setMonto(''); setFechaCarga(today());
    setFechaEmision(''); setFechaCobro(''); setDestino('ambos'); setDestinatario('');
    setVista('lista');
  };

  const guardar = async () => {
    if(!numero||!monto||saving) return;
    setSaving(true);
    const nuevo = {
      id:uid(), numero, banco, monto:parseFloat(monto),
      fecha_carga:fechaCarga, fecha_emision:fechaEmision, fecha_cobro:fechaCobro,
      destino, destinatario, estado:'pendiente',
      cargado_por:socios[socioIdx], created_at:String(Date.now())
    };
    const ok = await onSaveCheque(nuevo);
    setSaving(false);
    if(ok){ setSaved(true); setTimeout(()=>{ setSaved(false); volver(); },1500); }
    else { setOcrErr('Error al guardar. Intenta de nuevo.'); }
  };

  const destOpts = [
    {v:'s0',label:socios[0],color:'var(--blue)'},
    {v:'ambos',label:'Ambos (50/50)',color:'var(--accent)'},
    {v:'s1',label:socios[1],color:'var(--purple)'},
    {v:'empresa',label:'Empresa',color:'var(--muted)'},
  ];

  return (
    <div className="fade" style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontFamily:'Syne',fontSize:20,fontWeight:700}}>Cheques</div>
        {vista==='lista'
          ? <button onClick={()=>setVista('camara')} className="tap" style={{background:'var(--accent)',color:'#0d0f18',padding:'8px 16px',borderRadius:10,fontWeight:700,fontSize:14}}>+ Nuevo</button>
          : <button onClick={volver} className="tap" style={{background:'var(--card2)',color:'var(--sub)',padding:'8px 16px',borderRadius:10,fontWeight:600,fontSize:14,border:'1px solid var(--border)'}}>← Volver</button>
        }
      </div>

      {vista==='camara' && (
        <Card style={{padding:12}}>
          {!capturada && (
            <div style={{textAlign:'center',padding:'20px 0 16px'}}>
              <div style={{fontSize:48,marginBottom:8}}>📷</div>
              <div style={{color:'var(--sub)',fontSize:14,marginBottom:20}}>Saca o elegí una foto del cheque</div>
              <label style={{display:'block',width:'100%',padding:15,borderRadius:14,background:'var(--accent)',color:'#0d0f18',fontFamily:'Syne',fontSize:16,fontWeight:800,textAlign:'center',cursor:'pointer',marginBottom:10}}>
                📸 Abrir camara
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{display:'none'}}/>
              </label>
              <label style={{display:'block',width:'100%',padding:13,borderRadius:14,background:'var(--card2)',color:'var(--sub)',fontFamily:'Syne',fontSize:15,fontWeight:600,textAlign:'center',cursor:'pointer',border:'1px solid var(--border)'}}>
                🖼 Elegir de la galeria
                <input type="file" accept="image/*" onChange={handleFileSelect} style={{display:'none'}}/>
              </label>
            </div>
          )}
          {capturada && (
            <>
              <img src={'data:'+capturadaMime+';base64,'+capturada} alt="cheque" style={{width:'100%',borderRadius:10,marginBottom:14,objectFit:'contain',maxHeight:220}}/>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setCapturada(null)} className="tap" style={{flex:1,padding:13,borderRadius:12,background:'var(--card2)',color:'var(--sub)',fontWeight:600,fontSize:14,border:'1px solid var(--border)'}}>🔄 Repetir</button>
                <button onClick={analizarFoto} disabled={analizando} className="tap" style={{flex:2,padding:13,borderRadius:12,background:'var(--blue)',color:'#fff',fontWeight:700,fontSize:15}}>
                  {analizando?<><Spinner/> Analizando...</>:'✨ Extraer con IA'}
                </button>
              </div>
              <button onClick={()=>setVista('form')} className="tap" style={{width:'100%',marginTop:10,padding:11,borderRadius:12,background:'var(--card2)',color:'var(--sub)',fontWeight:600,fontSize:13,border:'1px solid var(--border)'}}>
                Completar manualmente
              </button>
            </>
          )}
        </Card>
      )}

      {vista==='form' && (
        <Card>
          {ocrOk && <div style={{background:'var(--green)18',border:'1px solid var(--green)44',borderRadius:10,padding:'8px 12px',fontSize:13,color:'var(--green)',marginBottom:14}}>✓ Datos extraidos — revisa y corrige si hace falta</div>}
          {ocrErr && <div style={{background:'var(--red)18',border:'1px solid var(--red)44',borderRadius:10,padding:'8px 12px',fontSize:13,color:'var(--red)',marginBottom:14}}>{ocrErr}</div>}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <Lbl>Destinatario</Lbl>
              {destinatarios.length>0
                ? <select value={destinatario} onChange={e=>setDestinatario(e.target.value)}>
                    <option value=''>-- Seleccionar --</option>
                    {destinatarios.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                : <input type="text" placeholder="Carga destinatarios en Config" value={destinatario} onChange={e=>setDestinatario(e.target.value)}/>
              }
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><Lbl>Nro. cheque</Lbl><input type="text" placeholder="00012345" value={numero} onChange={e=>setNumero(e.target.value)}/></div>
              <div><Lbl>Banco</Lbl><input type="text" placeholder="Ej: ICBC" value={banco} onChange={e=>setBanco(e.target.value)}/></div>
            </div>
            <div>
              <Lbl>Importe ($)</Lbl>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'var(--sub)',fontWeight:600}}>$</span>
                <input type="number" placeholder="0" value={monto} onChange={e=>setMonto(e.target.value)} style={{paddingLeft:28,fontFamily:'DM Mono',fontSize:20}} inputMode="numeric"/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><Lbl>Fecha de emision</Lbl><input type="date" value={fechaEmision} onChange={e=>setFechaEmision(e.target.value)}/></div>
              <div><Lbl>Fecha de cobro</Lbl><input type="date" value={fechaCobro} onChange={e=>setFechaCobro(e.target.value)}/></div>
            </div>
            <div><Lbl>Fecha de carga</Lbl><input type="date" value={fechaCarga} onChange={e=>setFechaCarga(e.target.value)}/></div>
            <div>
              <Lbl>Este gasto es de...</Lbl>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {destOpts.map(o=>(
                  <button key={o.v} onClick={()=>setDestino(o.v)} className="tap"
                    style={{padding:'10px 4px',borderRadius:10,border:'2px solid '+(destino===o.v?o.color:'var(--border)'),background:destino===o.v?o.color+'22':'var(--card2)',color:destino===o.v?o.color:'var(--sub)',fontWeight:700,fontSize:12}}>
                    {o.label}
                  </button>
                ))}
              </div>
              {destino==='ambos'&&monto&&<div style={{fontSize:12,color:'var(--sub)',marginTop:6}}>{fmt(parseFloat(monto)/2||0)} para cada socio al acreditar</div>}
              {destino==='empresa'&&<div style={{fontSize:12,color:'var(--muted)',marginTop:6}}>No se computara como retiro</div>}
            </div>
            <button onClick={guardar} disabled={!numero||!monto||saving||saved} className="tap"
              style={{padding:15,borderRadius:12,background:saved?'var(--green)':'var(--accent)',color:'#0d0f18',fontFamily:'Syne',fontSize:16,fontWeight:800,opacity:(!numero||!monto)?.5:1}}>
              {saving?<Spinner/>:saved?'✓ Guardado':'Guardar cheque como pendiente'}
            </button>
          </div>
        </Card>
      )}

      {vista==='lista' && (
        <>
          <div style={{fontSize:12,color:'var(--sub)',fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase'}}>Pendientes ({pendientes.length})</div>
          {pendientes.length===0
            ? <div style={{color:'var(--sub)',fontSize:14,padding:'20px 0'}}>No hay cheques pendientes.</div>
            : pendientes.map(c=>(
              <Card key={c.id} style={{padding:'13px 16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontFamily:'DM Mono',fontSize:18,fontWeight:500,color:'var(--accent)',marginBottom:4}}>{fmt(c.monto)}</div>
                    <div style={{fontSize:13,fontWeight:600}}>#{c.numero} · {c.banco||'—'}</div>
                    {c.destinatario&&<div style={{fontSize:12,color:'var(--accent)',marginTop:2}}>Para: {c.destinatario}</div>}
                    <div style={{fontSize:12,color:'var(--sub)',marginTop:2}}>Emision: {c.fecha_emision||'—'} · Cobro: {c.fecha_cobro||'—'}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>por {c.cargado_por}</div>
                  </div>
                  <Pill color={dColor(c.destino)}>{dLabel(c.destino)}</Pill>
                </div>
              </Card>
            ))
          }
          {acreditados.length>0&&(
            <>
              <div style={{fontSize:12,color:'var(--sub)',fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',marginTop:10}}>Acreditados</div>
              {acreditados.map(c=>(
                <Card key={c.id} style={{padding:'12px 16px',opacity:.5}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <span style={{fontFamily:'DM Mono',color:'var(--green)',fontSize:16}}>{fmt(c.monto)}</span>
                      {c.destinatario&&<span style={{fontSize:12,color:'var(--sub)',marginLeft:8}}>Para: {c.destinatario}</span>}
                      <div style={{fontSize:12,color:'var(--sub)'}}>#{c.numero} · cobro: {c.fecha_cobro||'—'}</div>
                    </div>
                    <Pill color={dColor(c.destino)}>{dLabel(c.destino)}</Pill>
                  </div>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Cierre ───────────────────────────────────────────────────────────────────
function PantallaCierre({cheques,onAcreditar,config,onAddRetiros}) {
  const {socios} = config;
  const meses = [...new Set(cheques.filter(c=>c.estado==='pendiente').map(c=>monthKey(c.fecha_carga)))].sort().reverse();
  const [mes,setMes] = useState(meses[0]||monthKey(today()));
  const [sel,setSel] = useState({});
  const [filtroD,setFiltroD] = useState('');
  const [proc,setProc] = useState(false);
  const [done,setDone] = useState(false);
  const dColor = v=>v==='ambos'?'var(--accent)':v==='s0'?'var(--blue)':v==='s1'?'var(--purple)':'var(--muted)';
  const dLabel = v=>v==='ambos'?'Ambos':v==='s0'?socios[0]:v==='s1'?socios[1]:'Empresa';

  const todosD = [...new Set(cheques.filter(c=>c.estado==='pendiente'&&monthKey(c.fecha_carga)===mes).map(c=>c.destinatario).filter(Boolean))].sort();
  const pend = cheques.filter(c=>c.estado==='pendiente'&&monthKey(c.fecha_carga)===mes&&(!filtroD||c.destinatario===filtroD));
  const selItems = pend.filter(c=>sel[c.id]);
  const totS0 = selItems.filter(c=>c.destino==='s0').reduce((a,c)=>a+c.monto,0)+selItems.filter(c=>c.destino==='ambos').reduce((a,c)=>a+c.monto/2,0);
  const totS1 = selItems.filter(c=>c.destino==='s1').reduce((a,c)=>a+c.monto,0)+selItems.filter(c=>c.destino==='ambos').reduce((a,c)=>a+c.monto/2,0);

  const acreditar = async () => {
    if(!selItems.length||proc) return;
    setProc(true);
    const now = Date.now();
    const ret0=[], ret1=[];
    selItems.forEach(c=>{
      const base={tipo:'cheque',fecha:c.fecha_carga,descripcion:'Cheque #'+(c.numero||'')+(c.destinatario?' - '+c.destinatario:''),created_at:String(now)};
      if(c.destino==='ambos'){ret0.push({id:uid(),...base,monto:c.monto/2});ret1.push({id:uid(),...base,monto:c.monto/2});}
      else if(c.destino==='s0') ret0.push({id:uid(),...base,monto:c.monto});
      else if(c.destino==='s1') ret1.push({id:uid(),...base,monto:c.monto});
      // empresa: no genera retiro
    });
    const selIds = selItems.map(c=>c.id);
    await acreditarCheques(selIds, now);
    await onAddRetiros(ret0, ret1);
    setSel({}); setProc(false); setDone(true);
    setTimeout(()=>setDone(false),3000);
  };

  return (
    <div className="fade" style={{height:'calc(100vh - 130px)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{flexShrink:0,paddingBottom:10}}>
        <div style={{fontFamily:'Syne',fontSize:20,fontWeight:700,marginBottom:4}}>Cierre de cheques</div>
        <p style={{color:'var(--sub)',fontSize:13,marginBottom:10}}>Tilda los cheques a acreditar. Los retiros se asignan automaticamente.</p>
        <div style={{display:'flex',gap:8}}>
          <select value={mes} onChange={e=>{setMes(e.target.value);setSel({});setFiltroD('');}} style={{flex:1}}>
            {meses.map(m=><option key={m} value={m}>{fmtMes(m)}</option>)}
            {!meses.includes(mes)&&<option value={mes}>{fmtMes(mes)}</option>}
          </select>
          {todosD.length>0&&(
            <select value={filtroD} onChange={e=>{setFiltroD(e.target.value);setSel({});}} style={{flex:1}}>
              <option value=''>Todos</option>
              {todosD.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
      </div>

      {pend.length===0
        ? <div style={{textAlign:'center',color:'var(--sub)',padding:'40px 0',fontSize:14}}>{done?'✓ Cierre realizado!':'No hay cheques pendientes para este periodo.'}</div>
        : <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
          <div style={{flexShrink:0,background:'var(--bg)',paddingBottom:8}}>
            <div style={{background:'var(--card2)',border:'1px solid var(--border)',borderRadius:12,padding:'10px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{color:'var(--blue)',fontSize:13}}>{socios[0]}</span>
                <span style={{fontFamily:'DM Mono',color:'var(--blue)',fontSize:13}}>{fmt(totS0)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <span style={{color:'var(--purple)',fontSize:13}}>{socios[1]}</span>
                <span style={{fontFamily:'DM Mono',color:'var(--purple)',fontSize:13}}>{fmt(totS1)}</span>
              </div>
              <button onClick={acreditar} disabled={proc||done||selItems.length===0} className="tap"
                style={{width:'100%',padding:11,borderRadius:10,background:done?'var(--green)':selItems.length===0?'var(--muted)':'var(--accent)',color:'#0d0f18',fontFamily:'Syne',fontSize:14,fontWeight:800}}>
                {done?'✓ Acreditado':proc?<Spinner/>:selItems.length===0?'Selecciona cheques':'Acreditar '+selItems.length+' cheque'+(selItems.length!==1?'s':'')}
              </button>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={()=>{const a={};pend.forEach(c=>a[c.id]=true);setSel(a);}} className="tap" style={{background:'var(--card2)',border:'1px solid var(--border)',color:'var(--sub)',padding:'5px 12px',borderRadius:8,fontSize:12,fontWeight:600}}>Todos</button>
              <button onClick={()=>setSel({})} className="tap" style={{background:'var(--card2)',border:'1px solid var(--border)',color:'var(--sub)',padding:'5px 12px',borderRadius:8,fontSize:12,fontWeight:600}}>Ninguno</button>
              <span style={{fontSize:12,color:'var(--sub)',marginLeft:'auto'}}>{selItems.length}/{pend.length} seleccionados</span>
            </div>
          </div>
          <div style={{flex:1,overflowY:'auto',paddingBottom:16,display:'flex',flexDirection:'column',gap:8}}>
            {pend.map(c=>{
              const s=!!sel[c.id];
              return (
                <div key={c.id} onClick={()=>setSel(prev=>({...prev,[c.id]:!prev[c.id]}))}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'11px 12px',background:s?'var(--accent)10':'var(--card)',border:'1.5px solid '+(s?'var(--accent)55':'var(--border)'),borderRadius:12,cursor:'pointer',transition:'all .15s',flexShrink:0}}>
                  <div style={{width:20,height:20,borderRadius:5,border:'2px solid '+(s?'var(--accent)':'var(--border)'),background:s?'var(--accent)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {s&&<span style={{color:'#0d0f18',fontSize:11,fontWeight:800}}>✓</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontFamily:'DM Mono',fontSize:16,fontWeight:500}}>{fmt(c.monto)}</span>
                      <Pill color={dColor(c.destino)}>{dLabel(c.destino)}</Pill>
                    </div>
                    <div style={{fontSize:12,color:'var(--sub)',marginTop:2}}>
                      {c.destinatario&&<span style={{color:'var(--text)',marginRight:6}}>{c.destinatario} ·</span>}
                      #{c.numero||'—'} · cobro: {c.fecha_cobro||'—'}
                      {c.destino==='ambos'&&s&&<span style={{color:'var(--accent)',marginLeft:6}}>{fmt(c.monto/2)} c/u</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
    </div>
  );
}

// ─── Tarjeta ──────────────────────────────────────────────────────────────────
function PantallaTarjeta({onSave}) {
  const [monto,setMonto] = useState('');
  const [desc,setDesc] = useState('');
  const [fecha,setFecha] = useState(today());
  const [confirm,setConfirm] = useState(null);
  const [loading,setLoading] = useState(false);

  const handleGuardar = () => {
    if(!monto||parseFloat(monto)<=0) return;
    const d={'Monto':fmt(parseFloat(monto)),'Fecha':fecha};
    if(desc) d['Descripcion']=desc;
    setConfirm(d);
  };
  const handleConfirm = async () => {
    setLoading(true);
    const nuevo={id:uid(),tipo:'tarjeta',monto:parseFloat(monto),descripcion:desc,fecha,created_at:String(Date.now())};
    const ok = await onSave(nuevo);
    setLoading(false);
    if(ok){ setConfirm(null); setMonto(''); setDesc(''); setFecha(today()); }
  };

  return (
    <div className="fade" style={{display:'flex',flexDirection:'column',gap:14}}>
      {confirm&&<Confirm titulo="Confirmas el consumo de tarjeta?" data={confirm} onOk={handleConfirm} onCancel={()=>setConfirm(null)} loading={loading}/>}
      <div style={{fontFamily:'Syne',fontSize:20,fontWeight:700}}>Tarjeta de credito</div>
      <p style={{color:'var(--sub)',fontSize:13}}>Carga el total del resumen mensual de tu tarjeta.</p>
      <Card>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <Lbl>Total consumos ($)</Lbl>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'var(--sub)',fontWeight:600}}>$</span>
              <input type="number" placeholder="0" value={monto} onChange={e=>setMonto(e.target.value)} style={{paddingLeft:28,fontFamily:'DM Mono',fontSize:20}} inputMode="numeric"/>
            </div>
          </div>
          <div><Lbl>Descripcion / periodo</Lbl><input type="text" placeholder="Ej: Visa Marzo 2025" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div><Lbl>Fecha de cierre</Lbl><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
          <Btn onClick={handleGuardar} disabled={!monto||parseFloat(monto)<=0} full style={{fontFamily:'Syne',fontSize:16,fontWeight:800,padding:15}}>
            💳 Guardar consumo tarjeta
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────
function PantallaConfig({config,onSave,onLogout}) {
  const [empresa,setEmpresa] = useState(config.empresa);
  const [s0,setS0] = useState(config.socios[0]);
  const [s1,setS1] = useState(config.socios[1]);
  const [destinatarios,setDestinatarios] = useState(config.destinatarios||[]);
  const [nuevoD,setNuevoD] = useState('');
  const [saving,setSaving] = useState(false);
  const [saved,setSaved] = useState(false);

  const guardar = async () => {
    setSaving(true);
    await onSave({empresa,socios:[s0,s1],destinatarios});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  const agregarD = () => {
    const d=nuevoD.trim();
    if(!d||destinatarios.includes(d)) return;
    setDestinatarios(prev=>[...prev,d].sort()); setNuevoD('');
  };
  const eliminarD = d => setDestinatarios(prev=>prev.filter(x=>x!==d));

  return (
    <div className="fade" style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{fontFamily:'Syne',fontSize:20,fontWeight:700}}>Configuracion</div>
      <Card>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div><Lbl>Empresa</Lbl><input value={empresa} onChange={e=>setEmpresa(e.target.value)}/></div>
          <div><Lbl>Nombre Socio 1</Lbl><input value={s0} onChange={e=>setS0(e.target.value)}/></div>
          <div><Lbl>Nombre Socio 2</Lbl><input value={s1} onChange={e=>setS1(e.target.value)}/></div>
        </div>
      </Card>
      <Card>
        <Lbl>Destinatarios de cheques</Lbl>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <input type="text" placeholder="Ej: Colegio San Jose" value={nuevoD} onChange={e=>setNuevoD(e.target.value)} onKeyDown={e=>e.key==='Enter'&&agregarD()}/>
          <button onClick={agregarD} className="tap" style={{padding:'0 16px',borderRadius:10,background:'var(--accent)',color:'#0d0f18',fontWeight:700,fontSize:14,whiteSpace:'nowrap',flexShrink:0}}>+ Agregar</button>
        </div>
        {destinatarios.length===0
          ? <div style={{color:'var(--muted)',fontSize:13}}>No hay destinatarios cargados.</div>
          : destinatarios.map(d=>(
            <div key={d} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:14}}>{d}</span>
              <button onClick={()=>eliminarD(d)} style={{background:'none',color:'var(--red)',fontSize:14,padding:'4px 8px',fontWeight:600}}>✕</button>
            </div>
          ))
        }
      </Card>
      <Btn onClick={guardar} loading={saving} full style={{fontFamily:'Syne',fontSize:16,fontWeight:800,padding:15,background:saved?'var(--green)':'var(--accent)'}}>
        {saved?'✓ Guardado':'Guardar cambios'}
      </Btn>
      <Btn onClick={onLogout} variant="ghost" full style={{fontSize:15}}>Cambiar de socio</Btn>
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
const TABS=[{id:'inicio',icon:'💰',label:'Retiro'},{id:'historial',icon:'📋',label:'Mis retiros'},{id:'cheques',icon:'✉️',label:'Cheques'},{id:'cierre',icon:'✓',label:'Cierre'},{id:'config',icon:'⚙',label:'Config'}];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [config,setConfigState] = useState({empresa:'Mi Empresa',socios:['Socio A','Socio B'],destinatarios:[]});
  const [socioIdx,setSocioIdx] = useState(null);
  const [retiros,setRetiros] = useState([]);
  const [cierres,setCierres] = useState([]);
  const [cheques,setCheques] = useState([]);
  const [tab,setTab] = useState('inicio');
  const [booting,setBooting] = useState(true);

  useEffect(()=>{
    const init = async () => {
      const [cfg,chs] = await Promise.all([loadConfig(), loadCheques()]);
      setConfigState(cfg); setCheques(chs);
      const saved = localStorage.getItem('retiros-device-socio');
      if(saved!==null) {
        const idx = JSON.parse(saved);
        setSocioIdx(idx);
        const [rets,cierresData] = await Promise.all([loadRetiros(idx), loadCierres(idx)]);
        setRetiros(rets); setCierres(cierresData);
      }
      setBooting(false);
    };
    init();
  },[]);

  useEffect(()=>{
    const iv=setInterval(async()=>{
      try {
        const chs = await loadCheques();
        setCheques(chs);
        if(socioIdx!==null) {
          const rets = await loadRetiros(socioIdx);
          setRetiros(rets);
        }
      } catch(e){}
    },30000);
    return ()=>clearInterval(iv);
  },[socioIdx]);

  const handleLogin = async (idx) => {
    localStorage.setItem('retiros-device-socio', JSON.stringify(idx));
    setSocioIdx(idx);
    const [rets,cierresData] = await Promise.all([loadRetiros(idx), loadCierres(idx)]);
    setRetiros(rets); setCierres(cierresData);
  };

  const handleLogout = () => {
    localStorage.removeItem('retiros-device-socio');
    setSocioIdx(null); setRetiros([]); setCierres([]);
  };

  const handleSaveRetiro = async (nuevo) => {
    const ok = await insertRetiro({...nuevo, socio_idx:socioIdx});
    if(ok) setRetiros(prev=>[nuevo,...prev]);
    return ok;
  };

  const handleDeleteRetiro = async (id) => {
    await deleteRetiro(id);
    setRetiros(prev=>prev.filter(r=>r.id!==id));
  };

  const handleCerrarMes = async ({mes,total,detalle}) => {
    const cierre = {id:uid(), socio_idx:socioIdx, mes, total, detalle, cerrado_en:Date.now()};
    const ok = await insertCierre(cierre);
    if(ok) setCierres(prev=>[cierre,...prev]);
    return ok;
  };

  const handleSaveCheque = async (nuevo) => {
    try {
      const { error } = await supabase.from('cheques').insert({...nuevo, created_at:String(nuevo.created_at)});
      if(error){ console.error(error); return false; }
      setCheques(prev=>[nuevo,...prev]);
      return true;
    } catch(e){ return false; }
  };

  const handleAddRetiros = async (ret0, ret1) => {
    // Insertar retiros de cada socio
    if(ret0.length) {
      for(const r of ret0) await insertRetiro({...r, socio_idx:0});
    }
    if(ret1.length) {
      for(const r of ret1) await insertRetiro({...r, socio_idx:1});
    }
    // Recargar retiros del socio actual
    const rets = await loadRetiros(socioIdx);
    setRetiros(rets);
    // Recargar cheques
    const chs = await loadCheques();
    setCheques(chs);
  };

  const handleSaveConfig = async (cfg) => { setConfigState(cfg); await saveConfig(cfg); };

  const pendCheques = cheques.filter(c=>c.estado==='pendiente').length;
  const mesesCerrados = new Set(cierres.map(c=>c.mes));
  const mesesConRetiros = [...new Set(retiros.map(r=>monthKey(r.fecha)))].filter(m=>m!==monthKey(today()));
  const mesesPendRetiros = mesesConRetiros.filter(m=>!mesesCerrados.has(m)).length;

  if(booting) return <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><style>{G}</style><span className="spin" style={{fontSize:28,color:'var(--accent)'}}>⟳</span></div>;
  if(socioIdx===null) return <><style>{G}</style><PantallaLogin config={config} onLogin={handleLogin}/></>;

  const renderView = () => {
    switch(tab){
      case 'inicio': return <PantallaInicio socio={config.socios[socioIdx]} socioIdx={socioIdx} retiros={retiros} cierres={cierres} onSave={handleSaveRetiro} onCerrarMes={handleCerrarMes}/>;
      case 'historial': return <PantallaHistorial retiros={retiros} cierres={cierres} socio={config.socios[socioIdx]} socioIdx={socioIdx} onDelete={handleDeleteRetiro} onCerrarMes={handleCerrarMes}/>;
      case 'cheques': return <PantallaCheques cheques={cheques} onSaveCheque={handleSaveCheque} config={config} socioIdx={socioIdx}/>;
      case 'cierre': return <PantallaCierre cheques={cheques} onAcreditar={()=>{}} config={config} onAddRetiros={handleAddRetiros}/>;
      case 'tarjeta': return <PantallaTarjeta onSave={r=>handleSaveRetiro({...r,socio_idx:socioIdx})}/>;
      case 'config': return <PantallaConfig config={config} onSave={handleSaveConfig} onLogout={handleLogout}/>;
      default: return null;
    }
  };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',flexDirection:'column',maxWidth:520,margin:'0 auto'}}>
      <style>{G}</style>
      <div style={{padding:'16px 20px 8px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'var(--bg)',zIndex:50,borderBottom:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {tab!=='inicio'&&(
            <button onClick={()=>setTab('inicio')} className="tap" style={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--sub)',width:34,height:34,borderRadius:10,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
          )}
          <div>
            <div style={{fontFamily:'Syne',fontSize:11,fontWeight:600,color:'var(--sub)',letterSpacing:'0.08em',textTransform:'uppercase'}}>{config.empresa}</div>
            {tab==='inicio'
              ? <div style={{fontFamily:'Syne',fontSize:17,fontWeight:700,color:socioIdx===0?'var(--blue)':'var(--purple)'}}>Hola, {config.socios[socioIdx]} 👋</div>
              : <div style={{fontFamily:'Syne',fontSize:15,fontWeight:700,color:'var(--sub)'}}>{config.socios[socioIdx]}</div>
            }
          </div>
        </div>
        {tab==='inicio'&&(
          <button onClick={()=>setTab('tarjeta')} className="tap" style={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--sub)',padding:'8px 14px',borderRadius:10,fontSize:13,fontWeight:600}}>💳 Tarjeta</button>
        )}
      </div>
      <div style={{flex:1,padding:'12px 16px 90px',overflowY:tab==='cierre'?'hidden':'auto'}}>{renderView()}</div>
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:520,background:'var(--card)',borderTop:'1px solid var(--border)',display:'flex',zIndex:100,paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          const badge=(t.id==='cierre'&&pendCheques>0)||(t.id==='historial'&&mesesPendRetiros>0);
          const badgeNum = t.id==='cierre'?pendCheques:mesesPendRetiros;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:1,padding:'10px 4px 8px',background:'transparent',display:'flex',flexDirection:'column',alignItems:'center',gap:3,position:'relative'}}>
              <span style={{fontSize:18}}>{t.icon}</span>
              <span style={{fontSize:10,fontWeight:active?700:500,color:active?'var(--accent)':'var(--muted)'}}>{t.label}</span>
              {active&&<div style={{position:'absolute',top:0,left:'20%',right:'20%',height:2,background:'var(--accent)',borderRadius:2}}/>}
              {badge&&<div style={{position:'absolute',top:6,right:'18%',width:16,height:16,background:'var(--red)',borderRadius:'50%',fontSize:9,fontWeight:800,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>{badgeNum}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
