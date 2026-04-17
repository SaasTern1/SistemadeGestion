import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, setDoc, query, where, getDocs, arrayUnion, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyDdzCiachuhbE9jATz-TesPI2vUVIJrHjM", authDomain: "sistemadegestion-7400d.firebaseapp.com", projectId: "sistemadegestion-7400d", storageBucket: "sistemadegestion-7400d.firebasestorage.app", messagingSenderId: "709030283072", appId: "1:709030283072:web:5997837b36a448e9515ca5" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app); const appId = 'sgc-final-v6';

const EMAIL_SERVICE_ID = "service_vumxptj", EMAIL_TEMPLATE_ID = "template_z27y5yk", EMAIL_PUBLIC_KEY = "kWsovOfdi7dBqLMw2", EMAIL_ADMIN_SGC = "sistemadegestion@fcipty.com"; 
(function() { emailjs.init(EMAIL_PUBLIC_KEY); })();

const CLOUD_NAME = "df79cjklp", UPLOAD_PRESET = "fci_documentos", PASOS_NOMBRES = ["Pendiente Documentado", "Pendiente Verificado", "Pendiente Aprobación Gerencia", "Pendiente Aprobación SGC"];

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const setDisplay = (id, val) => { if($(id)) $(id).style.display = val; };
const setTxt = (id, txt) => { if($(id)) $(id).innerText = txt; };
const setVal = (id, val) => { if($(id)) $(id).value = val; };
const setHtml = (id, html) => { if($(id)) $(id).innerHTML = html; };

let currentUser = null, selectedId = null, selectedDocData = null, tempAction = "";
let allUsers = [], allDepartamentos = [], tiposDocumento = [], columnasMaestro = [], estatusMaestro = [], dataMaestro = [], editandoMaestroId = null;
let globalSolicitudes = [], globalAuditPlan = null, globalAllAuditorias = [], globalAuditorias = [], selectedAuditId = null, selectedAuditData = null, editandoAuditoriaId = null;
let currentAuditF020 = [], globalAllSacs = [], currentEditingSacId = null, currentEditingF020Ref = null;
let requisitosOEA = []; let manualOEA = { url: "", nombre: "" };

window.showLoading = () => setDisplay('loading-overlay', 'flex'); 
window.hideLoading = () => setDisplay('loading-overlay', 'none');
window.closeModal = () => setDisplay('modal', 'none'); 
window.cerrarModalAuditoria = () => setDisplay('modal-auditoria', 'none');
window.cerrarModalUsuario = () => setDisplay('modal-usuario', 'none');
window.abrirModalUsuario = () => { window.resetUserForm(); setDisplay('modal-usuario', 'flex'); };
window.toggleModPanel = v => setDisplay('panel-mod', v === 'Creación' ? 'none' : 'grid');

window.cambiarVista = (id, btn) => {
  $$('.section').forEach(s => s.classList.remove('active')); $$('.nav-link').forEach(l => l.classList.remove('active'));
  if($(id)) $(id).classList.add('active'); if(btn) btn.classList.add('active');
  if(window.innerWidth <= 768) { if($('sidebar')) $('sidebar').classList.remove('open'); if($('sidebar-overlay')) $('sidebar-overlay').classList.remove('active'); }
};
window.toggleMenu = () => { if($('sidebar')) $('sidebar').classList.toggle('open'); if($('sidebar-overlay')) $('sidebar-overlay').classList.toggle('active'); };

window.abrirDocumento = async (url, nombreOriginal) => {
  if (!url || url === "#") return;
  let safeName = nombreOriginal ? nombreOriginal.replace(/[^a-zA-Z0-9.\-_ ]/g, '_') : 'Documento';
  if (!safeName.includes('.')) { let extMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/); if(extMatch) safeName += "." + extMatch[1]; }
  if (url.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif)(\?|$)/)) {
    const win = window.open('', '_blank'); if (!win) return alert("Bloqueado.");
    win.document.write(`<html style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f8fafc;"><head><title>${safeName}</title></head><body><h2>Cargando documento...</h2></body></html>`);
    try { const r = await fetch(url); if(!r.ok) throw new Error(); const blob = await r.blob(); const bUrl = window.URL.createObjectURL(new File([blob], safeName, { type: blob.type })); win.location.href = bUrl; setTimeout(() => window.URL.revokeObjectURL(bUrl), 60000); } catch (e) { win.close(); alert("⚠️ Archivo no disponible."); }
  } else {
    window.showLoading();
    try { const r = await fetch(url); if(!r.ok) throw new Error(); const bUrl = window.URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.style.display = 'none'; a.href = bUrl; a.download = safeName; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(bUrl); document.body.removeChild(a); } catch (e) { alert("⚠️ Archivo no disponible."); }
    window.hideLoading();
  }
};

window.descargarFicha = () => {
    const w = window.open('', '_blank');
    const content = document.getElementById('m-original-data').innerHTML;
    w.document.write(`<html><head><title>Ficha ${selectedDocData.customId}</title><link rel="stylesheet" href="styles.css"></head><body style="padding:40px; background:white;"><h2>Expediente: ${selectedDocData.customId} - ${selectedDocData.titulo}</h2>${content}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 1000);
};

window.del = async (c, id) => { if(confirm("¿Eliminar este registro?")) { window.showLoading(); await deleteDoc(doc(db, "artifacts", appId, "public", "data", c, id)); window.hideLoading(); } };
window.getDownloadUrl = (url) => url ? url : "#";
window.formatearFechaAbreviada = (fISO) => { if(!fISO) return ''; let f = fISO; if(f.length===10) f+='T12:00:00'; const d = new Date(f); if(isNaN(d)) return fISO; const m = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; return `${d.getDate()}-${m[d.getMonth()]}-${d.getFullYear()}`; };
window.sendNotification = (dest, sub, msg) => { if(dest.to || dest.cc) emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, {to_email: dest.to, cc_email: dest.cc || "", subject: sub, message: msg}).catch(e => console.error(e)); };

window.getDatosEnvio = async (sol) => {
  let cc = ""; if(sol.gerencia) { try { const q = query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("gerencias", "array-contains", sol.gerencia), where("permisos.p_ger_apr", "==", true)); const sn = await getDocs(q); if(!sn.empty) cc = sn.docs[0].data().email || ""; } catch(e){} }
  const to = new Set([EMAIL_ADMIN_SGC, sol.solicitante_email]); if(sol.involucrados) sol.involucrados.forEach(e => to.add(e));
  return { to: Array.from(to).join(','), cc: cc };
};

window.uploadToCloudinary = async (f) => { const fd = new FormData(); fd.append("file", f); fd.append("upload_preset", UPLOAD_PRESET); try { const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd }); const d = await r.json(); return d.secure_url; } catch(e){return null;} };
window.getNextFCI = async () => { const r = doc(db, "artifacts", appId, "public", "data", "Contadores", "solicitudes"); let id = ""; await runTransaction(db, async (t) => { const sn = await t.get(r); let c = 1; if(sn.exists()) c = sn.data().count + 1; t.set(r, {count:c}); id = `FCI-SOL-${String(c).padStart(4, '0')}`; }); return id; };

window.checkDailyAlerts = async () => {
  if(!currentUser || (!currentUser.permisos.p_gest_sgc && !currentUser.permisos.admin)) return;
  const ref = doc(db, "artifacts", appId, "public", "data", "Configuracion", "EstadoAlertas"); const sn = await getDoc(ref); const today = new Date().toISOString().split('T')[0];
  if(!sn.exists() || sn.data().ultimaAlerta !== today) {
    let p = globalSolicitudes.filter(s => { let e = String(s.estado||"").toUpperCase(); return !e.includes('FINAL') && e !== 'ANULADO' && e !== 'RECHAZADO'; });
    if(p.length > 0) { window.sendNotification({to:EMAIL_ADMIN_SGC}, "🔔 Alerta SGC", `Hay ${p.length} solicitudes pendientes.`); if(!sn.exists()) await setDoc(ref, {ultimaAlerta:today}); else await updateDoc(ref, {ultimaAlerta:today}); }
  }
};

window.verificarAlertasAuditoria = (arr) => {
  if(!globalAuditPlan || !globalAuditPlan.correos || globalAuditPlan.correos.length === 0) return;
  const today = new Date(); today.setHours(0,0,0,0);
  arr.forEach(a => {
    if(a.estado === "Completada" || !a.fecha) return; let f = a.fecha; if(f.length === 10) f += 'T12:00:00'; const d = new Date(f); d.setHours(0,0,0,0);
    const diff = Math.ceil((d - today) / 86400000); let sub = diff === 30 ? "🚨 1 Mes para Auditoría" : (diff === 14 ? "⚠️ 2 Semanas para Auditoría" : "");
    if(sub) window.sendNotification({to: globalAuditPlan.correos.join(',')}, sub, `Auditoría el ${window.formatearFechaAbreviada(a.fecha)} en ${a.lugar}. Req: ${a.requisitos}`);
  });
};

window.actualizarConteoPersonal = () => {
    if($('aud-personal')) {
        $('aud-personal').value = $$('#aud-auditado-list input:checked').length;
    }
};

window.cargarDatosCentrales = () => {
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "Usuarios"), (sn) => {
    allUsers = []; let hU = "", cbU = "", oU = "", oI = '<option value="">-- Seleccionar --</option>';
    sn.forEach(d => { 
      let u = d.data(); allUsers.push(u); let gs = u.gerencias ? u.gerencias.join(', ') : (u.gerencia || 'N/A');
      hU += `<tr><td>${u.nombre} (${u.usuario})</td><td>${u.email||''}</td><td>${u.role||''} / <small>${gs}</small></td><td class="no-export"><button class="btn btn-info" style="padding:4px 8px; font-size:10px;" onclick="window.cargarUsuarioParaEditar('${u.usuario}')">Editar</button> <button class="btn btn-danger" style="padding:4px 8px; font-size:10px;" onclick="window.eliminarUsuario('${u.usuario}')">Eliminar</button></td></tr>`;
      cbU += `<label style="display:flex; gap:8px; font-size:13px; margin-bottom:6px;"><input type="checkbox" value="${u.nombre}" data-email="${u.email}" style="margin:0; width:16px;" onchange="window.actualizarConteoPersonal()"> ${u.nombre} (${gs})</label>`;
      oU += `<option value="${u.nombre}" data-email="${u.email}">${u.nombre} (${gs})</option>`; if(u.email) oI += `<option value="${u.email}">${u.nombre} (${gs})</option>`;
    });
    setHtml('tbody-users', hU); setHtml('aud-auditado-list', cbU); setHtml('aud-auditor-list', cbU); setHtml('aud-formacion-list', cbU); setHtml('ah-auditor-list', cbU); 
    setHtml('ah-lider', '<option value="">-- Lider --</option>' + oU); setHtml('sol-involucrado-sel', oI); setHtml('m-new-involucrado-sel', oI);
  });

  onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), (sn) => {
    if(sn.exists()) { const d = sn.data(); requisitosOEA = d.requisitos || []; manualOEA = { url: d.manual_url || "", nombre: d.manual_nombre || "" }; } else { requisitosOEA = []; manualOEA = { url: "", nombre: "" }; } window.renderNormaOEA();
  });

  onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), (sn) => {
    if(sn.exists()) { const d = sn.data(); tiposDocumento = d.tiposDoc || []; columnasMaestro = d.columnas || []; estatusMaestro = d.estatus || []; window.renderListasConfig(); }
  });

  onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"), (sn) => {
    let dp = [], gr = []; if(sn.exists()) { const d = sn.data(); dp = d.departamentos || []; gr = d.gerencias || []; } allDepartamentos = dp;
    let gH = ""; gr.forEach(g => gH += `<option value="${g}">${g}</option>`);
    setHtml('d-ger-sel', gH); setHtml('sol-ger', '<option value="">-- Seleccionar --</option>' + gH);
    setHtml('list-ger', gr.map((g, i) => `<div class="settings-item"><span>${g}</span><button class="btn-icon-danger" onclick="window.eliminarGerencia(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join(''));
    setHtml('list-dep', dp.map((d, i) => `<div class="settings-item"><span>${d.nombre} <small>(${d.gerencia})</small></span><button class="btn-icon-danger" onclick="window.eliminarDepartamento(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join(''));
    setHtml('u-ger-list', gr.map(g => `<label style="display:flex; gap:8px; font-size:13px; margin-bottom:6px;"><input type="checkbox" value="${g}" style="margin:0; width:16px;"> ${g}</label>`).join(''));
  });

  onSnapshot(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), (sn) => { dataMaestro = []; sn.forEach(d => { let obj = d.data(); obj.docId = d.id; dataMaestro.push(obj); }); window.renderTablaMaestro(); });
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), (sn) => { globalSolicitudes = []; sn.forEach(d => { let obj = d.data(); obj.docId = d.id; globalSolicitudes.push(obj); }); window.renderTablasSolicitudes(); window.checkDailyAlerts(); });
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "Auditorias"), (sn) => {
    globalAllAuditorias = []; sn.forEach(d => { let obj = d.data(); obj.id = d.id; globalAllAuditorias.push(obj); });
    let cy = new Date().getFullYear().toString(); let ys = $('aud-year-select'); if(ys && ys.options.length === 0) ys.innerHTML = `<option value="${cy}">${cy}</option><option value="nuevo">+ Añadir Año</option>`;
    window.loadAuditPlan(ys ? ys.value : cy); window.renderTablaAuditorias(ys ? ys.value : cy);
  });
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "AccionesCorrectivas"), (sn) => { globalAllSacs = []; sn.forEach(d => { let obj = d.data(); obj.sac_id = d.id; globalAllSacs.push(obj); }); window.renderF023Global(); });
};

window.renderDashTable = (t) => {
  setDisplay('dash-table-container', 'block'); let d = globalSolicitudes;
  if(t==='pendientes') d = d.filter(s=>!String(s.estado||"").includes('Aprobado Final')&&s.estado!=='Anulado'&&s.estado!=='Rechazado'); else d = d.filter(s=>String(s.estado||"").includes('Aprobado Final')||s.estado==='Anulado'||s.estado==='Rechazado');
  d.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)); let h="";
  d.forEach(s=>{ 
      let bc=String(s.estado||"").includes('Aprobado')?'badge-success':(s.estado==='Anulado'||s.estado==='Rechazado'?'badge-danger':'badge-warning'); 
      let docIcon = s.documento_final ? `<span title="Documento Publicado">📄 Sí</span>` : '<span style="color:#94a3b8">No</span>';
      h+=`<tr><td><b>${s.customId}</b></td><td>${s.solicitante}</td><td>${s.titulo}</td><td><span class="badge ${bc}">${s.estado}</span></td><td style="text-align:center;">${docIcon}</td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Detalle</button></td></tr>`; 
  });
  setHtml('tbody-dash', h || "<tr><td colspan='6' style='text-align:center;'>No hay registros</td></tr>");
};

window.renderTablasSolicitudes = () => {
  let hH = "", hA = "", hG = "", sort = [...globalSolicitudes].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  let totalCerradas = 0, cerradasATiempo = 0;

  sort.forEach(s => {
    let es = s.estado || "Pendiente", c = es==='Anulado'||es==='Rechazado', apr = es.includes('Aprobado Final');
    let bc = apr ? 'badge-success' : (c ? 'badge-danger' : 'badge-warning'), ps = s.prioridad || "Normal", bp = ps==='Alta'?'badge-danger':(ps==='Básica'?'badge-info':'badge-dark'), et = PASOS_NOMBRES[s.idx] || '';
    let isM = (s.uid === currentUser.usuario) || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase()));
    
    let slaVisual = s.fecha_esperada_cierre ? window.formatearFechaAbreviada(s.fecha_esperada_cierre) : '<span style="color:#cbd5e1">-</span>';
    let docIcon = s.documento_final ? `<span title="Documento Publicado" style="font-size:16px;">📄</span>` : '<span style="color:#cbd5e1">-</span>';

    if(apr && s.fecha_esperada_cierre && s.fecha_final) {
        totalCerradas++; if(s.fecha_final <= s.fecha_esperada_cierre) cerradasATiempo++;
    }

    if(isM) hH += `<tr><td><b>${s.customId}</b><br><small style="color:#94a3b8">${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}</td><td>${s.titulo}<br><span class="badge ${bp}">${ps}</span></td><td><span class="badge ${bp}">${ps}</span></td><td><span class="badge ${bc}">${es}</span></td><td>${slaVisual}</td><td style="text-align:center;">${docIcon}</td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Ver / Gestionar</button></td></tr>`;
    hA += `<tr><td><b>${s.customId}</b><br><small style="color:#94a3b8">${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}<br><small>${s.gerencia}</small></td><td>${s.titulo}</td><td><span class="badge ${bp}">${ps}</span></td><td><span class="badge ${bc}">${es}</span><br><small>${et}</small></td><td>${slaVisual}</td><td style="text-align:center;">${docIcon}</td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Ver Detalle</button></td></tr>`;

    let act = !apr && !c, p = currentUser.permisos, esAdm = p.admin || p.p_gest_sgc;
    let pgS = act && ((s.idx===0 && (esAdm||p.p_paso1)) || (s.idx===1 && (esAdm||p.p_paso2)) || (s.idx===3 && (esAdm||p.p_paso4)));
    let pgG = act && s.idx===2 && p.p_ger_apr && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia);
    if(pgS || pgG) hG += `<tr><td><b>${s.customId}</b><br><small style="color:#94a3b8">${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}<br><small>${s.gerencia}</small></td><td>${s.titulo}<br><span class="badge ${bp}">${ps}</span></td><td><span class="badge badge-info">${et}</span></td><td>${slaVisual}</td><td style="text-align:center;">${docIcon}</td><td class="no-export"><button class="btn btn-warning" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Revisar / Firmar</button></td></tr>`;
  });

  setHtml('tbody-historial', hH); setHtml('tbody-all', hA); setHtml('tbody-gestionar', hG);

  if($('dash-mis-tot')) {
    let ms = sort.filter(s => s.uid === currentUser.usuario || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase())));
    setTxt('dash-mis-tot', ms.length); setTxt('dash-mis-pend', ms.filter(s => !String(s.estado||"").includes('Aprobado Final') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length);
    setTxt('dash-mis-ok', ms.filter(s => String(s.estado||"").includes('Aprobado Final')).length); setTxt('dash-mis-rech', ms.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length);
  }
  
  if($('dash-glob-tot') && currentUser.permisos && (currentUser.permisos.admin || currentUser.permisos.p_gest_sgc)) {
    setDisplay('dash-admin-section', 'block'); setTxt('dash-glob-tot', sort.length);
    setTxt('dash-glob-pend', sort.filter(s => !String(s.estado||"").includes('Aprobado Final') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length);
    setTxt('dash-glob-ok', sort.filter(s => String(s.estado||"").includes('Aprobado Final')).length); 
    
    let slaPer = totalCerradas > 0 ? Math.round((cerradasATiempo / totalCerradas) * 100) : 0;
    setTxt('dash-sla-percent', `${slaPer}%`);
  }
};

window.completarLoginUI = () => {
  setDisplay('login-screen', 'none'); setDisplay('sidebar', 'flex'); setDisplay('main', 'block');
  setTxt('curr-name', currentUser.nombre || 'Usuario'); setTxt('curr-ger', currentUser.gerencias ? currentUser.gerencias.join(', ') : (currentUser.gerencia || 'Sin Gerencia'));

  const p = currentUser.permisos || {}; const isAdm = p.admin || false;
  const canDash = isAdm || p.p_gest_sgc || p.p_paso1 || p.p_paso2 || p.p_paso4;
  setDisplay('nav-dash', canDash ? 'flex' : 'none'); setDisplay('nav-hist', (p.p_ver_propias || isAdm) ? 'flex' : 'none'); setDisplay('nav-all', (p.p_ver_todas || p.p_ver_ger || isAdm) ? 'flex' : 'none'); setDisplay('nav-crear', (p.can_solicit || isAdm) ? 'flex' : 'none'); setDisplay('nav-gest', (p.p_gest_sgc || p.p_ger_apr || p.p_paso1 || p.p_paso2 || p.p_paso4 || isAdm) ? 'flex' : 'none'); setDisplay('nav-listado', (p.p_ver_listado || isAdm) ? 'flex' : 'none');
  
  const canAud = p.p_audit_ver || p.p_audit_admin || p.p_audit_auditor || p.p_audit_dueno || isAdm; 
  setDisplay('nav-audit-group', canAud ? 'block' : 'none'); setDisplay('nav-norma', canAud ? 'flex' : 'none'); setDisplay('nav-audit', canAud ? 'flex' : 'none'); setDisplay('nav-noconf', (p.p_audit_admin || p.p_gest_sgc || p.p_audit_auditor || p.p_audit_dueno || isAdm) ? 'flex' : 'none');
  
  const canRoot = p.p_users || p.p_struct || isAdm; 
  setDisplay('admin-only', canRoot ? 'block' : 'none'); setDisplay('nav-users', (p.p_users || isAdm) ? 'flex' : 'none'); setDisplay('nav-struct', (p.p_struct || isAdm) ? 'flex' : 'none');
  
  let isAdAud = p.p_audit_admin || p.p_gest_sgc || isAdm;
  setDisplay('btn-config-plan', isAdAud ? 'inline-flex' : 'none'); setDisplay('btn-nueva-aud', isAdAud ? 'inline-flex' : 'none');
  
  window.cargarDatosCentrales();
  
  if (p.p_gest_sgc || isAdm) window.cambiarVista('sec-all', $('nav-all')); else if (p.can_solicit) window.cambiarVista('sec-crear', $('nav-crear')); else if (p.p_ver_propias) window.cambiarVista('sec-hist', $('nav-hist')); else if (canDash) window.cambiarVista('sec-dash', $('nav-dash')); else if (canAud) window.cambiarVista('sec-audit', $('nav-audit'));
};

window.logout = () => { localStorage.removeItem('sgc_session_user'); currentUser = null; setDisplay('sidebar', 'none'); setDisplay('main', 'none'); setDisplay('login-screen', 'flex'); setVal('login-user', ''); setVal('login-pass', ''); };

window.iniciarSesion = async () => {
  const u = $('login-user').value.toLowerCase().trim(); const p = $('login-pass').value.trim();
  if (!u || !p) return alert("Por favor, ingresa tu usuario y contraseña."); window.showLoading();
  try {
    if(u === 'admin' && p === '1130') {
      const adminRef = doc(db, "artifacts", appId, "public", "data", "Usuarios", "admin"); const snapAdmin = await getDoc(adminRef);
      if(!snapAdmin.exists()) { await setDoc(adminRef, { nombre: "Admin Maestro", usuario: "admin", pass: "1130", gerencias: ["SGC"], gerencia: "SGC", email: EMAIL_ADMIN_SGC, permisos: { can_solicit:true, p_gest_sgc:true, p_ger_apr:true, p_ver_propias:true, p_ver_ger:true, p_ver_all:true, p_ver_todas:true, p_users:true, p_struct:true, p_ver_listado:true, p_audit_admin:true, p_audit_ver:true, admin:true, p_paso1:true, p_paso2:true, p_paso4:true } }); }
    }
    const qs = await getDocs(query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("usuario", "==", u), where("pass", "==", p)));
    if(!qs.empty) { localStorage.setItem('sgc_session_user', u); currentUser = qs.docs[0].data(); window.completarLoginUI(); } else alert("Credenciales incorrectas.");
  } catch (error) { alert("Error de red."); } finally { window.hideLoading(); }
};

window.cargarUsuarioParaEditar = (id) => {
  const u = allUsers.find(x => x.usuario === id); if(!u) return;
  setHtml('user-form-title', `<span class="material-icons-round">edit</span> Editando Usuario: ${u.usuario}`);
  setVal('u-nom', u.nombre || ''); setVal('u-usr', u.usuario || ''); if($('u-usr')) $('u-usr').disabled = true; setVal('u-pas', u.pass || ''); setVal('u-rol', u.role || ''); setVal('u-email', u.email || '');
  let gs = u.gerencias || []; if(!u.gerencias && u.gerencia) gs = [u.gerencia]; $$('#u-ger-list input[type="checkbox"]').forEach(cb => { cb.checked = gs.includes(cb.value); });
  const p = u.permisos || {};
  ['p-solicitar','p-ver-propias','p-ver-ger','p-ver-todas','p-paso1','p-paso2','p-paso4','p-gest-sgc','p-ger-apr','p-users','p-struct','p-ver-listado','p-audit-ver','p-audit-admin','p-audit-auditor','p-audit-dueno'].forEach(i => { let k = i.replace(/-/g,'_'); if(k==='p_solicitar')k='can_solicit'; if($(i)) $(i).checked = p[k]||false; });
  if($('p-admin')) $('p-admin').checked = p.admin||false; setTxt('btnSaveUser', "ACTUALIZAR USUARIO"); setDisplay('modal-usuario', 'flex');
};

window.eliminarUsuario = async (uid) => {
    if(!confirm(`¿Estás seguro de ELIMINAR el acceso al usuario ${uid}? Esta acción es irreversible.`)) return;
    window.showLoading();
    try { await deleteDoc(doc(db, "artifacts", appId, "public", "data", "Usuarios", uid)); alert("Usuario eliminado correctamente del sistema."); }
    catch(e) { alert("Error al eliminar el usuario."); console.error(e); }
    window.hideLoading();
};

window.resetUserForm = () => {
  setHtml('user-form-title', `<span class="material-icons-round">person_add</span> Registrar / Editar Usuario`);
  setVal('u-nom', ''); setVal('u-usr', ''); if($('u-usr')) $('u-usr').disabled = false; setVal('u-pas', '123'); setVal('u-rol', ''); setVal('u-email', '');
  $$('#u-ger-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  ['p-solicitar','p-ver-propias','p-ver-ger','p-ver-todas','p-paso1','p-paso2','p-paso4','p-gest-sgc','p-ger-apr','p-users','p-struct','p-ver-listado','p-audit-ver','p-audit-admin','p-audit-auditor','p-audit-dueno','p-admin'].forEach(i => { if($(i)) $(i).checked=false; });
  if($('btnSaveUser')) $('btnSaveUser').innerText = "GUARDAR USUARIO"; 
};

window.guardarUsuario = async () => {
  const n = $('u-nom').value.trim(), u = $('u-usr').value.toLowerCase().trim(), p = $('u-pas').value.trim(), r = $('u-rol').value.trim(), e = $('u-email').value.trim().toLowerCase(), gs = []; $$('#u-ger-list input:checked').forEach(cb => { gs.push(cb.value); });
  if(!n || !u || !p || gs.length === 0) return alert("Nombre, Usuario, Contraseña y al menos 1 Gerencia son obligatorios.");
  const pm = { can_solicit: $('p-solicitar').checked, p_ver_propias: $('p-ver-propias').checked, p_ver_ger: $('p-ver-ger').checked, p_ver_todas: $('p-ver-todas').checked, p_paso1: $('p-paso1').checked, p_paso2: $('p-paso2').checked, p_paso4: $('p-paso4').checked, p_gest_sgc: $('p-gest-sgc').checked, p_ger_apr: $('p-ger-apr').checked, p_users: $('p-users').checked, p_struct: $('p-struct').checked, p_ver_listado: $('p-ver-listado').checked, p_audit_ver: $('p-audit-ver').checked, p_audit_admin: $('p-audit-admin').checked, p_audit_auditor: $('p-audit-auditor').checked, p_audit_dueno: $('p-audit-dueno').checked, admin: $('p-admin').checked };
  window.showLoading(); const docRef = doc(db, "artifacts", appId, "public", "data", "Usuarios", u); const snap = await getDoc(docRef);
  if(snap.exists() && $('user-form-title').innerText.includes("Registrar")) { window.hideLoading(); return alert("Ese ID de usuario ya existe."); }
  await setDoc(docRef, { nombre: n, usuario: u, pass: p, gerencias: gs, gerencia: gs[0], role: r, email: e, permisos: pm });
  window.cerrarModalUsuario(); window.hideLoading(); alert("Usuario guardado exitosamente.");
};

window.exportarExcelUsuarios = () => {
  if(allUsers.length === 0) return;
  let dE = allUsers.map(u => ({ "Nombre": u.nombre, "Usuario ID": u.usuario, "Email": u.email || '', "Rol": u.role || '', "Gerencias": u.gerencias ? u.gerencias.join(', ') : (u.gerencia || ''), "Admin": u.permisos.admin ? 'Sí' : 'No', "Gestor SGC": u.permisos.p_gest_sgc ? 'Sí' : 'No', "Auditor": u.permisos.p_audit_auditor ? 'Sí' : 'No' }));
  let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dE), "Usuarios_Registrados"); XLSX.writeFile(wb, "Reporte_Usuarios_SGC.xlsx");
};

window.agregarGerencia = async () => { let val = $('g-nom').value.trim().toUpperCase(); if(!val) return; window.showLoading(); let gers = []; const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); if(snap.exists() && snap.data().gerencias) gers = snap.data().gerencias; if(gers.includes(val)) { window.hideLoading(); return alert("Esa Gerencia ya existe."); } gers.push(val); await setDoc(docRef, { gerencias: gers }, {merge: true}); setVal('g-nom', ''); window.hideLoading(); };
window.eliminarGerencia = async (idx) => { if(!confirm("¿Eliminar Gerencia?")) return; window.showLoading(); const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); let gers = snap.data().gerencias; gers.splice(idx, 1); await setDoc(docRef, { gerencias: gers }, {merge: true}); window.hideLoading(); };
window.agregarDepartamento = async () => { let ger = $('d-ger-sel').value; let nom = $('d-nom').value.trim(); if(!ger || !nom) return alert("Seleccione Gerencia y Depto."); window.showLoading(); let deps = []; const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); if(snap.exists() && snap.data().departamentos) deps = snap.data().departamentos; deps.push({ nombre: nom, gerencia: ger }); await setDoc(docRef, { departamentos: deps }, {merge: true}); setVal('d-nom', ''); window.hideLoading(); };
window.eliminarDepartamento = async (idx) => { if(!confirm("¿Eliminar Departamento?")) return; window.showLoading(); const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); let deps = snap.data().departamentos; deps.splice(idx, 1); await setDoc(docRef, { departamentos: deps }, {merge: true}); window.hideLoading(); };

window.renderListasConfig = () => {
  let hCol = ""; columnasMaestro.forEach((c, idx) => { let cName = typeof c === 'string' ? c : c.nombre; let cType = typeof c === 'string' ? 'text' : c.tipo; hCol += `<div class="settings-item"><span>${cName} <small style="color:#94a3b8; font-size:10px;">(${cType})</small></span><button class="btn-icon-danger" onclick="window.eliminarColumna(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); setHtml('list-columnas', hCol);
  
  let hEst = ""; estatusMaestro.forEach((e, idx) => { hEst += `<div class="settings-item"><span>${e}</span><button class="btn-icon-danger" onclick="window.eliminarEstatus(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); setHtml('list-estatus', hEst);
  
  let hTipos = ""; tiposDocumento.forEach((t, idx) => { hTipos += `<div class="settings-item"><span>${t}</span><button class="btn-icon-danger" onclick="window.eliminarTipoDoc(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); setHtml('list-tipos-doc', hTipos);
  
  let htmlTiposSol = '<option value="">-- Seleccione --</option>'; tiposDocumento.forEach(t => htmlTiposSol += `<option value="${t}">${t}</option>`);
  setHtml('sol-tipo-doc', htmlTiposSol); 
  setHtml('sac-tipo-doc-afectado', '<option value="">-- No aplica / Ninguno --</option>' + tiposDocumento.map(t => `<option value="${t}">${t}</option>`).join(''));
};

window.agregarTipoDoc = async () => { let val = $('doc-tipo-nom').value.trim(); if(!val) return; if(tiposDocumento.includes(val)) return alert("Ya existe."); tiposDocumento.push(val); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true}); setVal('doc-tipo-nom', ''); };
window.eliminarTipoDoc = async (idx) => { if(!confirm("¿Eliminar?")) return; tiposDocumento.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true}); };
window.agregarColumna = async () => { let val = $('col-nom').value.trim(); let tipo = $('col-tipo').value; if(!val) return; if (columnasMaestro.some(c => (typeof c === 'string' ? c : c.nombre) === val)) return alert("Ya existe."); columnasMaestro.push({nombre: val, tipo: tipo}); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true}); setVal('col-nom', ''); };
window.eliminarColumna = async (idx) => { if(!confirm("¿Eliminar columna?")) return; columnasMaestro.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true}); };
window.agregarEstatus = async () => { let val = $('est-nom').value.trim(); if(!val) return; if (estatusMaestro.includes(val)) return alert("Ya existe."); estatusMaestro.push(val); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true}); setVal('est-nom', ''); };
window.eliminarEstatus = async (idx) => { if(!confirm("¿Eliminar?")) return; estatusMaestro.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true}); };

window.renderNormaOEA = () => {
  const p = currentUser ? currentUser.permisos || {} : {}; let isAdm = p.admin || p.p_audit_admin || p.p_gest_sgc;
  if($('oea-manual-link')) $('oea-manual-link').innerHTML = manualOEA.url ? `<a href="#" onclick="window.abrirDocumento('${manualOEA.url}', '${manualOEA.nombre}'); return false;" class="btn btn-info" style="font-size:14px; text-decoration:none;"><span class="material-icons-round" style="font-size:16px; margin-right:5px;">visibility</span> Ver ${manualOEA.nombre}</a>` : "No hay manual subido.";
  setDisplay('oea-manual-upload-box', isAdm ? 'flex' : 'none'); setDisplay('oea-req-upload-box', isAdm ? 'flex' : 'none');
  
  if($('oea-req-list-container')) {
      $('oea-req-list-container').innerHTML = requisitosOEA.map((r, idx) => {
          let nom = typeof r === 'string' ? r : r.nombre; let desc = typeof r === 'string' ? '' : (r.descripcion || '');
          return `<div class="settings-item" style="flex-direction:column; align-items:flex-start; cursor:pointer;" onclick="window.abrirPuntoOEA(${idx})">
              <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                  <span style="font-weight:700; color:var(--primary);"><span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:5px;">touch_app</span> ${nom}</span>
                  ${isAdm ? `<button class="btn-icon-danger" onclick="event.stopPropagation(); window.eliminarRequisitoOEA(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button>` : ''}
              </div>
              ${desc ? `<div style="font-size:11px; color:var(--text-muted); margin-top:5px;">${desc.substring(0, 60)}...</div>` : ''}
          </div>`;
      }).join('');
  }
  
  let htmlOpts = requisitosOEA.map(r => { let n = typeof r === 'string' ? r : r.nombre; return `<label style="display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" value="${n}" style="margin:0; width:auto; flex-shrink:0;"> ${n}</label>`; }).join('');
  setHtml('aud-req-list', htmlOpts); setHtml('oea-req-list-dl', requisitosOEA.map(r => `<option value="${typeof r === 'string' ? r : r.nombre}">`).join(''));
};

window.abrirPuntoOEA = (idx) => {
  const req = requisitosOEA[idx]; if(!req) return;
  let nom = typeof req === 'string' ? req : req.nombre; let desc = typeof req === 'string' ? '' : req.descripcion; let link = typeof req === 'string' ? '' : req.link;
  let msg = `PUNTO: ${nom}\n\n`; if(desc) msg += `DESCRIPCIÓN:\n${desc}\n\n`;
  if(link && manualOEA.url) { if(confirm(msg + `¿Abrir el manual de referencia (Ref: ${link})?`)) { let url = manualOEA.url; if(!isNaN(link)) url += `#page=${link}`; else if(link.startsWith('http')) url = link; window.open(url, '_blank'); }
  } else { alert(msg + "(No hay enlace directo configurado para este punto)."); }
};

window.subirManualOEA = async () => { const f = $('oea-file').files[0]; if(!f) return alert("Selecciona el documento."); window.showLoading(); let url = await window.uploadToCloudinary(f); if(!url) { window.hideLoading(); return alert("Error al subir."); } await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { manual_url: url, manual_nombre: f.name }, {merge: true}); setVal('oea-file', ''); window.hideLoading(); alert("Manual Oficial actualizado."); };

window.agregarRequisitoOEA = async () => { 
  const n = $('oea-req-input').value.trim(); const d = $('oea-req-desc').value.trim(); const l = $('oea-req-link').value.trim();
  if(!n) return alert("El nombre del punto es obligatorio."); 
  if(requisitosOEA.some(r => (typeof r === 'string' ? r : r.nombre) === n)) return alert("Ese requisito ya está en la lista."); 
  requisitosOEA.push({ nombre: n, descripcion: d, link: l }); 
  await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { requisitos: requisitosOEA }, {merge: true}); 
  setVal('oea-req-input', ''); setVal('oea-req-desc', ''); setVal('oea-req-link', ''); 
};

window.eliminarRequisitoOEA = async (idx) => { if(!confirm("¿Eliminar este requisito?")) return; requisitosOEA.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { requisitos: requisitosOEA }, {merge: true}); };

window.renderTablaMaestro = () => {
if(!$('thead-listado-maestro')) return;
let headHTML = "<tr>"; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; headHTML += `<th>${cName}</th>`; }); 
if(currentUser && currentUser.permisos && (currentUser.permisos.p_gest_sgc || currentUser.permisos.admin)) { headHTML += `<th class="no-export">Acción</th>`; } headHTML += "</tr>"; setHtml('thead-listado-maestro', headHTML);
let dataSort = [...dataMaestro]; if(columnasMaestro.length > 0) { let firstCol = typeof columnasMaestro[0] === 'string' ? columnasMaestro[0] : columnasMaestro[0].nombre; dataSort.sort((a,b) => (a[firstCol]||"").toString().localeCompare((b[firstCol]||"").toString())); }
let tbodyHtml = "";
dataSort.forEach(item => {
  let rowHTML = "<tr>";
  columnasMaestro.forEach(col => {
    let cName = typeof col === 'string' ? col : col.nombre; let cType = typeof col === 'string' ? 'text' : col.tipo; let val = item[cName] || "";
    if(cType === 'url' || val.toString().startsWith("http")) { let dUrl = window.getDownloadUrl(val); let fName = item['Nombre del documento'] || item['Título'] || "Documento_Maestro"; rowHTML += `<td><a href="#" onclick="window.abrirDocumento('${dUrl}', '${fName}'); return false;" class="file-link">📁 ${fName}</a></td>`; } 
    else if(cName.toLowerCase().includes('estatus') || cName.toLowerCase().includes('estado')) { let badge = val.toLowerCase().includes('vigente') || val.toLowerCase().includes('activo') ? 'badge-success' : (val.toLowerCase().includes('obsoleto') || val.toLowerCase().includes('inactivo') ? 'badge-danger' : 'badge-warning'); rowHTML += `<td><span class="badge ${badge}">${val}</span></td>`; } 
    else if(cType === 'date' || cName.toLowerCase().includes('fecha')) { rowHTML += `<td>${window.formatearFechaAbreviada(val)}</td>`; } else { rowHTML += `<td>${val}</td>`; }
  });
  if(currentUser && currentUser.permisos && (currentUser.permisos.p_gest_sgc || currentUser.permisos.admin)) { let btnAcciones = `<button class="btn btn-info" style="padding:5px; font-size:10px; margin-right:5px;" onclick="window.abrirModalListadoMaestro('${item.docId}')">EDITAR</button>`; btnAcciones += `<button class="btn btn-danger" style="padding:5px 8px; font-size:10px;" onclick="window.del('ListadoMaestro','${item.docId}')">X</button>`; rowHTML += `<td class="no-export">${btnAcciones}</td>`; }
  rowHTML += "</tr>"; tbodyHtml += rowHTML;
});
setHtml('tbody-listado-maestro', tbodyHtml);
};

window.abrirModalListadoMaestro = (docId = null) => {
editandoMaestroId = docId; setTxt('lm-modal-title', docId ? "Editar Documento Maestro" : "Nuevo Documento Maestro");
let datosEdit = {}; if(docId) { const item = dataMaestro.find(x => x.docId === docId); if(item) datosEdit = item; }
let formHtml = "";
columnasMaestro.forEach(col => {
  let cName = typeof col === 'string' ? col : col.nombre; let cType = typeof col === 'string' ? 'text' : col.tipo; let val = datosEdit[cName] || ""; let html = `<div><label for="in_dyn_${cName}">${cName}</label>`;
  if(cName.toLowerCase().includes('estatus') || cName.toLowerCase().includes('estado')) { html += `<select id="in_dyn_${cName}"><option value="">-- Seleccionar --</option>`; estatusMaestro.forEach(est => { html += `<option value="${est}" ${val===est?'selected':''}>${est}</option>`; }); html += `</select>`; } 
  else if(cType === 'date' || cName.toLowerCase().includes('fecha')) { html += `<input type="date" id="in_dyn_${cName}" value="${val}">`; } 
  else if(cType === 'number') { html += `<input type="number" id="in_dyn_${cName}" value="${val}" placeholder="0">`; } else { html += `<input type="text" id="in_dyn_${cName}" value="${val}" placeholder="Escribe aquí...">`; }
  html += `</div>`; formHtml += html;
});
setHtml('dinamic-form-maestro', formHtml); setDisplay('modal-form-listado', 'flex');
};

window.guardarRegistroMaestro = async () => {
let data = {}; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; let inEl = $(`in_dyn_${cName}`); if(inEl) data[cName] = inEl.value; }); window.showLoading();
if(editandoMaestroId) { await updateDoc(doc(db, "artifacts", appId, "public", "data", "ListadoMaestro", editandoMaestroId), data); } 
else { data.registrado_por = currentUser.nombre; data.fecha_registro = new Date().toISOString(); await addDoc(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), data); }
window.hideLoading(); setDisplay('modal-form-listado', 'none');
};

window.exportarExcelListado = () => {
if(dataMaestro.length === 0) return alert("No hay registros en el Listado Maestro para exportar.");
let dataExport = dataMaestro.map(item => { let rowObj = {}; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; rowObj[cName] = item[cName] || ""; }); return rowObj; });
let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "Listado_Maestro"); XLSX.writeFile(wb, "Listado_Maestro_SGC.xlsx");
};

window.actualizarGerenteSelect = (gSelected) => {
const gerentes = allUsers.filter(u => u.gerencias && u.gerencias.includes(gSelected) && u.permisos && u.permisos.p_ger_apr === true);
if (gerentes && gerentes.length > 0) { setVal('sol-gerente-display', gerentes.map(g => g.nombre).join(', ')); setVal('sol-email-gerente', gerentes.map(g => g.email || '').filter(e=>e).join(', ') || "Sin Email"); } 
else { setVal('sol-gerente-display', "No asignado"); setVal('sol-email-gerente', ""); }
const depSelect = $('sol-dep'); let depHtml = "<option value=''>-- Seleccionar Departamento --</option>";
const depsFiltrados = allDepartamentos.filter(d => d.gerencia === gSelected); depsFiltrados.forEach(d => { depHtml += `<option value="${d.nombre}">${d.nombre}</option>`; }); depSelect.innerHTML = depHtml;
};

window.crearSolicitud = async () => {
const tit = $('sol-tit').value; const gerTarget = $('sol-ger').value; if(!tit) return alert("Título obligatorio"); window.showLoading(); const f = $('sol-file'); let fileName = f.files[0] ? f.files[0].name : ""; let url = null; 
if (f.files[0]) { url = await window.uploadToCloudinary(f.files[0]); if (!url) { window.hideLoading(); return alert("Error al subir archivo."); } }
let extraEmails = []; if(selectedDocData && selectedDocData.involucrados) extraEmails = selectedDocData.involucrados; const fci = await window.getNextFCI(); const gerenteEmailVisible = $('sol-email-gerente').value; const now = new Date().toISOString();
const data = { customId: fci, titulo: tit, accion: $('sol-accion').value, tipoDoc: $('sol-tipo-doc').value, prioridad: $('sol-prioridad').value, gerencia: gerTarget, departamento: $('sol-dep').value, motivo: $('sol-motivo').value, cod_ref: $('sol-cod-prev').value, ver_ref: $('sol-ver-prev').value, fecha_ref: $('sol-fecha-prev').value, solicitante: currentUser.nombre, solicitante_email: currentUser.email, uid: currentUser.usuario, involucrados: extraEmails, idx: 0, estado: "Pendiente Documentado", fase_0_ini: now, adjunto: url, adjunto_nombre: fileName, chat: [{u: "SISTEMA", m: "Solicitud creada exitosamente.", t: new Date().toLocaleString()}], fecha: now };
await addDoc(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), data); 

if($('form-crear-solicitud')) $('form-crear-solicitud').reset();
setHtml('lista-involucrados-tags', ""); 
$('sol-gerente-display').value = ''; $('sol-email-gerente').value = ''; $('sol-dep').innerHTML = '<option value="">-- Seleccione Gerencia Primero --</option>';

const toEmails = new Set([EMAIL_ADMIN_SGC, currentUser.email, ...extraEmails]); const destinatarios = { to: Array.from(toEmails).join(','), cc: gerenteEmailVisible }; 
window.sendNotification(destinatarios, "Nueva Solicitud Creada", `El usuario ${currentUser.nombre} ha creado la solicitud ${fci} con prioridad ${data.prioridad}.`);
window.hideLoading(); alert("Solicitud Creada: " + fci); window.cambiarVista('sec-hist', $('nav-hist'));
};

window.verDetalle = async (id) => {
try {
    window.showLoading();
    selectedId = id; setHtml('m-extra-input', ""); setHtml('m-comentario-libre', "");
    
    const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", id)); 
    if(!docSnap.exists()) { window.hideLoading(); return alert("La solicitud ya no existe."); }
    
    selectedDocData = docSnap.data(); const s = selectedDocData || {}; const p = currentUser.permisos || {};
    
    setTxt('m-id', s.customId || "N/A"); setTxt('m-tit', s.titulo || "N/A"); setTxt('m-sol', s.solicitante || "N/A");
    
    let est = String(s.estado || "Pendiente").toUpperCase(); let apr = est.includes('APROBADO FINAL'); let cnc = est === 'ANULADO' || est === 'RECHAZADO';
    if($('m-est')) { $('m-est').innerText = apr ? 'APROBADO FINAL' : (s.estado || 'PENDIENTE'); $('m-est').className = `badge ${apr ? 'badge-success' : (cnc ? 'badge-danger' : 'badge-warning')}`; }
    
    setTxt('m-ger', s.gerencia || "N/A"); setTxt('m-tipo', s.tipoDoc || "N/A"); 
    setTxt('m-accion', s.accion || "N/A"); setTxt('m-jus', s.motivo || s.justificacion || "Sin justificación");
    
    const esAdminSGC = p.admin || p.p_gest_sgc; let gerenciasUsuario = currentUser.gerencias || [];
    let userEmailLowerCase = (currentUser.email || "").toLowerCase(); let isInv = s.involucrados && s.involucrados.some(e => e.toLowerCase() === userEmailLowerCase); 
    const esDuenio = s.uid === currentUser.usuario || isInv;
    let stepIdx = parseInt(s.idx) || 0; const activo = !apr && !cnc;

    let pr = String(s.prioridad || "Normal"); 
    if(esAdminSGC && activo) {
        setHtml('m-prioridad-container', `<select onchange="window.cambiarPrioridad(this.value)" style="padding:4px 8px; font-size:12px; border-radius:6px; background:#fff; font-weight:bold; border:1px solid var(--border); color:var(--text-main);"><option value="Normal" ${pr==='Normal'?'selected':''}>NORMAL</option><option value="Básica" ${pr==='Básica'?'selected':''}>BÁSICA</option><option value="Alta" ${pr==='Alta'?'selected':''}>ALTA (URGENTE)</option></select>`);
    } else {
        setHtml('m-prioridad-container', `<span class="badge ${pr === 'Alta' ? 'badge-danger' : (pr === 'Básica' ? 'badge-info' : 'badge-dark')}">${pr.toUpperCase()}</span>`);
    }

    let adjOrigName = s.adjunto_nombre || "Archivo Adjunto"; let dlUrl = s.adjunto ? window.getDownloadUrl(s.adjunto) : "#"; 
    if (stepIdx >= 2 && !esDuenio && !esAdminSGC) { 
        setHtml('m-file-link', `<span style="color:#64748b; font-size:13px; font-style:italic;"><span class="material-icons-round" style="font-size:14px; vertical-align:middle;">lock</span> Documento original bloqueado por confidencialidad.</span>`);
    } else {
        setHtml('m-file-link', s.adjunto ? `<a href="#" onclick="window.abrirDocumento('${dlUrl}', '${adjOrigName}'); return false;" class="file-link">📎 ${adjOrigName}</a>` : "Sin archivo");
    }
    
    if(s.accion !== 'Creación') { setDisplay('m-extra-panel', 'block'); setTxt('m-cod', s.cod_ref || "N/A"); setTxt('m-ver', s.ver_ref || "N/A"); setTxt('m-fecha-ult', window.formatearFechaAbreviada(s.fecha_ref)); } else { setDisplay('m-extra-panel', 'none'); }

    for(let i=1; i<=4; i++) { const st = $('s'+i); if(st) { st.className = 'step'; if(cnc) continue; if(i <= stepIdx) st.classList.add('completed'); if(i === stepIdx + 1 && !apr) st.classList.add('active'); } }

    const esGer = p.p_ger_apr && gerenciasUsuario.includes(s.gerencia); 
    
    let invHTML = "No hay personas extras añadidas.";
    if(s.involucrados && s.involucrados.length > 0) { 
        invHTML = s.involucrados.map(email => { 
            let userFound = allUsers.find(u => (u.email || "").toLowerCase() === email.toLowerCase()); let dispName = userFound ? `${userFound.nombre} (${email})` : email; 
            let btnDel = (activo && (esAdminSGC || esDuenio)) ? ` <span class="material-icons-round" style="font-size:14px; cursor:pointer; color:var(--danger); vertical-align:middle; margin-left:5px;" onclick="window.eliminarInvolucrado('${email}')" title="Quitar">close</span>` : '';
            return `<div style="display:inline-flex; align-items:center; background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:10px; font-size:11px; margin-right:5px; margin-bottom:5px;"><b>${dispName}</b> ${btnDel}</div>`;
        }).join(''); 
    }
    setHtml('m-involucrados-list', invHTML);

    const fDiff = (ini, fin) => { if(!ini || !fin) return "-"; let ms = new Date(fin) - new Date(ini); if(ms < 0) return "-"; let d = Math.floor(ms / 86400000); let h = Math.floor((ms % 86400000) / 3600000); return `${d}d ${h}h`; };
    if ($('m-tiempos-panel')) {
        if(esAdminSGC) {
            setDisplay('m-tiempos-panel', 'block');
            setHtml('m-tiempos-grid', `<div><div class="custom-label" style="color:var(--primary);">Fase 1 (Doc)</div><span style="font-size:11px;">${fDiff(s.fase_0_ini, s.fase_0_fin)}</span></div><div><div class="custom-label" style="color:var(--primary);">Fase 2 (Verif)</div><span style="font-size:11px;">${fDiff(s.fase_1_ini, s.fase_1_fin)}</span></div><div><div class="custom-label" style="color:var(--primary);">Fase 3 (Gerencia)</div><span style="font-size:11px;">${fDiff(s.fase_2_ini, s.fase_2_fin)}</span></div><div><div class="custom-label" style="color:var(--primary);">Fase 4 (SGC Final)</div><span style="font-size:11px;">${fDiff(s.fase_3_ini, s.fecha_final || s.fase_3_fin)}</span></div>`);
        } else { setDisplay('m-tiempos-panel', 'none'); }
    }

    let puedeGestionarSGC = false; 
    if(activo) { if (stepIdx === 0 && (p.p_gest_sgc || p.p_paso1 || p.admin)) puedeGestionarSGC = true; if (stepIdx === 1 && (p.p_gest_sgc || p.p_paso2 || p.admin)) puedeGestionarSGC = true; if (stepIdx === 3 && (p.p_gest_sgc || p.p_paso4 || p.admin)) puedeGestionarSGC = true; }
    let puedeGestionarGerente = esGer && stepIdx === 2 && activo; 

    setDisplay('btn-reabrir', (esAdminSGC && !activo) ? 'inline-flex' : 'none'); setDisplay('m-add-involucrado-section', activo ? 'flex' : 'none'); setDisplay('m-actions', (puedeGestionarSGC || puedeGestionarGerente) ? 'block' : 'none'); setDisplay('applicant-actions', (esDuenio && activo) ? 'block' : 'none'); setDisplay('m-input-area', 'none');
    
    const puedeDevolver = (puedeGestionarSGC || puedeGestionarGerente) && stepIdx > 0 && activo; 
    setDisplay('btn-devolver-paso', puedeDevolver ? 'inline-block' : 'none'); setDisplay('btn-anular', ((puedeGestionarSGC || esDuenio) && activo) ? 'inline-block' : 'none'); 

    if(s.fecha_esperada_cierre) { setDisplay('m-admin-sla', 'block'); setVal('m-sla-date', s.fecha_esperada_cierre); if($('m-sla-date')) $('m-sla-date').disabled = !esAdminSGC; setDisplay('btn-save-sla', esAdminSGC ? 'inline-block' : 'none'); } 
    else if (esAdminSGC && activo) { setDisplay('m-admin-sla', 'block'); setVal('m-sla-date', ''); if($('m-sla-date')) $('m-sla-date').disabled = false; setDisplay('btn-save-sla', 'inline-block'); } 
    else { setDisplay('m-admin-sla', 'none'); }
    
    setDisplay('m-panel-final-sgc', 'none'); setDisplay('m-panel-update-sgc', 'none'); setDisplay('m-display-final', 'none'); 
    setDisplay('btn-firma-next', 'inline-block');
    if($('m-original-data')) $('m-original-data').classList.remove('locked-data'); 

    if ((esAdminSGC || p.p_paso2) && stepIdx === 1 && activo) { setDisplay('m-panel-update-sgc', 'block'); setVal('m-upd-tit', s.titulo || ''); setVal('m-upd-cod', s.cod_ref || ''); setVal('m-upd-ver', s.ver_ref || ''); }
    
    if (stepIdx === 3 && puedeGestionarSGC && activo) {
        setDisplay('m-panel-final-sgc', 'block'); setVal('m-final-cod', s.cod_ref || "");
        setDisplay('m-actions', 'none'); 
    }

    if (apr) {
        if (s.version_final) {
            if($('m-original-data')) $('m-original-data').classList.add('locked-data'); setDisplay('m-display-final', 'block');
            setTxt('m-disp-cod', s.codigo_final || s.cod_ref || "N/A"); setTxt('m-disp-ver', s.version_final); setTxt('m-disp-fecha', s.fecha_final ? window.formatearFechaAbreviada(s.fecha_final) : "N/A"); 
            let finName = s.documento_final_nombre || "Documento Oficial"; let finUrl = s.documento_final ? window.getDownloadUrl(s.documento_final) : "#"; 
            setHtml('m-disp-file', s.documento_final ? `<a href="#" onclick="window.abrirDocumento('${finUrl}', '${finName}'); return false;" class="btn btn-success" style="padding:10px 15px; border-radius:8px;">⬇️ Descargar Oficial</a>` : "N/A");
            if(esAdminSGC) setDisplay('btn-edit-final', 'inline-block');
        }
    }
    
    if(activo && stepIdx !== 3) setTxt('btn-firma-next', `Aprobar Etapa (${PASOS_NOMBRES[stepIdx]})`);
    
    setHtml('chat-box', s.chat ? s.chat.map(c => {
        let calBtn = "";
        if(c.fR) {
            try {
                let d1 = new Date(c.fR);
                let start = d1.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
                let d2 = new Date(d1.getTime() + 3600000); 
                let end = d2.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
                let text = encodeURIComponent(`Reunión SGC: ${s.customId} - ${s.titulo}`);
                let details = encodeURIComponent(`Tema / Detalles:\n${c.tema}\n\nConvocado por: ${c.u}`);
                calBtn = `<br><a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}" target="_blank" class="btn btn-info" style="padding:6px 10px; font-size:10px; margin-top:8px; display:inline-flex; background:#ea4335;"><span class="material-icons-round" style="font-size:14px; margin-right:4px;">event</span> Agendar en Google Calendar</a>`;
            }catch(e){}
        }
        return `<div class="chat-msg" style="border-left-color:${c.u===currentUser.nombre?'var(--primary)':'#cbd5e1'}"><b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${window.getDownloadUrl(c.archivo)}', '${c.archivo_nombre || 'Evidencia_Adjunta'}'); return false;" style="font-size:10px;color:blue;font-weight:600;text-decoration:none;">📎 ${c.archivo_nombre || 'Ver Adjunto'}</a>` : ''}${calBtn}</div>`;
    }).join('') : '');
    
    setDisplay('modal', 'flex');
} catch(e) { console.error("Error abriendo detalle:", e); alert("Hubo un error al abrir la solicitud."); } finally { window.hideLoading(); }
};

window.cambiarPrioridad = async (nuevaPrioridad) => {
    if(!confirm(`¿Cambiar la prioridad a ${nuevaPrioridad}?`)) return window.verDetalle(selectedId);
    window.showLoading();
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { prioridad: nuevaPrioridad, chat: arrayUnion({u: currentUser.nombre, m: `⚙️ <b>Cambio de Prioridad:</b> a ${nuevaPrioridad}`, t: new Date().toLocaleString()}) });
    window.hideLoading(); window.verDetalle(selectedId);
};

window.habilitarEdicionFinal = () => {
    setDisplay('m-panel-final-sgc', 'block');
    $('m-final-cod').value = selectedDocData.codigo_final || '';
    $('m-final-ver').value = selectedDocData.version_final || '';
    $('m-final-fecha').value = selectedDocData.fecha_final || '';
};

window.actualizarDatosSGC = async () => {
const tit = $('m-upd-tit').value; const cod = $('m-upd-cod').value; const ver = $('m-upd-ver').value; const f = $('m-upd-file'); if(!tit) return alert("El título es obligatorio."); window.showLoading();
let updateData = { titulo: tit, cod_ref: cod, ver_ref: ver }; let msjChat = `SGC actualizó los datos pre-aprobación. Título: ${tit}, Cód: ${cod}, Ver: ${ver}.`;
if(f.files[0]) { let fileUrl = await window.uploadToCloudinary(f.files[0]); if(!fileUrl) { window.hideLoading(); return alert("Error subiendo archivo."); } updateData.adjunto = fileUrl; updateData.adjunto_nombre = f.files[0].name; msjChat += ` (Nuevo adjunto subido: ${f.files[0].name})`; }
await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { ...updateData, chat: arrayUnion({u: currentUser.nombre, m: `✏️ ${msjChat}`, t: new Date().toLocaleString()}) });
window.hideLoading(); alert("Datos actualizados correctamente."); window.closeModal();
};

window.guardarSLA = async () => {
const dateSLA = $('m-sla-date').value; if(!dateSLA) return alert("Selecciona una fecha válida."); window.showLoading();
await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { fecha_esperada_cierre: dateSLA, chat: arrayUnion({u: currentUser.nombre, m: `⏱️ <b>FECHA LÍMITE (SLA) ESTABLECIDA:</b> ${window.formatearFechaAbreviada(dateSLA)}`, t: new Date().toLocaleString()}) }); window.hideLoading(); alert("Fecha límite actualizada."); window.verDetalle(selectedId);
};

window.devolverPaso = async () => {
if(!selectedDocData || selectedDocData.idx <= 0) return; if(!confirm("¿Estás seguro de devolver esta solicitud a la etapa anterior?")) return;
let motivo = prompt("Motivo para devolver la solicitud:"); if(!motivo) return alert("El motivo es obligatorio."); window.showLoading();
const nIdx = selectedDocData.idx - 1; const nEst = PASOS_NOMBRES[nIdx]; const faseActual = PASOS_NOMBRES[selectedDocData.idx]; const now = new Date().toISOString();
let updates = { idx: nIdx, estado: nEst, [`fase_${selectedDocData.idx}_fin`]: now, [`fase_${nIdx}_ini`]: now, chat: arrayUnion({u: currentUser.nombre, m: `⏪ <b>DEVUELTO A ETAPA ANTERIOR</b><br>De: ${faseActual} -> A: ${nEst}<br><b>Motivo:</b> ${motivo}`, t: new Date().toLocaleString()}) };
await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), updates);
const dest = await window.getDatosEnvio(selectedDocData); window.sendNotification(dest, `Retroceso de Etapa: ${selectedDocData.customId}`, `La solicitud ha sido devuelta a: ${nEst}.\nMotivo: ${motivo}`); window.hideLoading(); window.closeModal();
};

window.reabrirSolicitud = async () => {
if(!confirm("⚠️ ¿Estás seguro de REABRIR esta solicitud?")) return; let motivo = prompt("Describe el motivo de la reapertura:"); if(!motivo) return alert("Se requiere un motivo."); window.showLoading();
const now = new Date().toISOString(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { estado: "Pendiente Documentado", idx: 0, fase_0_ini: now, chat: arrayUnion({u: currentUser.nombre, m: `<b style="color:var(--danger);">⚠️ REAPERTURA DE SOLICITUD POR ADMINISTRACIÓN</b><br><b>Motivo:</b> ${motivo}`, t: new Date().toLocaleString()}) });
const dest = await window.getDatosEnvio(selectedDocData); window.sendNotification(dest, `Solicitud Reabierta: ${selectedDocData.customId}`, `Motivo: ${motivo}`); window.hideLoading(); alert("Solicitud reabierta."); window.closeModal();
};

window.gestionar = (tipo) => { tempAction = tipo; setDisplay('m-input-area', 'block'); if(tipo === 'Reunión') { setDisplay('reunion-container', 'block'); if($('m-extra-input')) $('m-extra-input').setAttribute('data-placeholder', 'Tema de la reunión...'); } else { setDisplay('reunion-container', 'none'); if($('m-extra-input')) $('m-extra-input').setAttribute('data-placeholder', 'Motivo / Consulta / Detalle...'); } };
window.responderSolicitante = () => { tempAction = "Respuesta"; setDisplay('m-input-area', 'block'); if($('m-extra-input')) $('m-extra-input').setAttribute('data-placeholder', 'Detalla tu corrección...'); setDisplay('reunion-container', 'none'); };
window.rechazar = () => { tempAction = 'Rechazado'; setDisplay('m-input-area', 'block'); setDisplay('reunion-container', 'none'); };

window.guardarGestion = async () => {
    const f = $('m-file-gestion'); let fileUrl=null, fileName=null;
    if(f.files[0]) { window.showLoading(); fileUrl = await window.uploadToCloudinary(f.files[0]); fileName = f.files[0].name; if(!fileUrl){ window.hideLoading(); return alert("Error de subida");} }
    
    const txtHTML = $('m-extra-input').innerHTML; const txtPlain = $('m-extra-input').innerText.trim();
    if(!txtPlain && !fileUrl) return alert("Escribe un detalle o adjunta un archivo.");
    window.showLoading();
    
    let payload = {u: currentUser.nombre, t: new Date().toLocaleString()};
    let emTitle = "", emBody = "";
    
    if(tempAction === 'Reunión') {
        const fR = $('m-date-meeting').value; if(!fR) {window.hideLoading(); return alert("Fecha y hora de reunión obligatoria.");}
        let dateFmt = new Date(fR).toLocaleString();
        
        payload.fR = fR;
        payload.tema = txtPlain;
        payload.m = `📅 <b>REUNIÓN AGENDADA:</b> ${dateFmt}<br><b>Tema:</b><br>${txtHTML}`;
        emTitle = `📅 Reunión Agendada: ${selectedDocData.customId}`;
        
        emBody = `Se ha agendado una reunión oficial para revisar el expediente <b>${selectedDocData.customId}</b>.<br><br>
        <div style="padding: 15px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px; line-height: 1.6;">
            <b>Fecha y Hora:</b> ${dateFmt}<br>
            <b>Expediente:</b> ${selectedDocData.customId} - ${selectedDocData.titulo}<br>
            <b>Convocado por:</b> ${currentUser.nombre}<br><br>
            <b>Temas a tratar / Detalles:</b><br>${txtHTML}
        </div>
        <br><i>Por favor, verificar y confirmar la agenda en el sistema SGC.</i>`;
        
    } else {
        payload.m = `🗣️ <b>${tempAction.toUpperCase()}:</b><br>${txtHTML}`;
        emTitle = `Nueva ${tempAction}: ${selectedDocData.customId}`;
        emBody = `<b>${currentUser.nombre}</b> ha registrado una nueva ${tempAction} en el expediente.<br><br><div style="padding: 12px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px;">${txtHTML}</div>`;
    }
    
    if(fileUrl) { payload.archivo = fileUrl; payload.archivo_nombre = fileName; emBody += `<br><br><i>📎 Adjunto: <b>${fileName}</b></i>`; }
    
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { chat: arrayUnion(payload) });
    const dest = await window.getDatosEnvio(selectedDocData);
    window.sendNotification(dest, emTitle, emBody);
    
    $('m-input-area').style.display='none'; $('m-extra-input').innerHTML=''; $('m-date-meeting').value=''; f.value='';
    window.hideLoading(); window.verDetalle(selectedId);
};

window.firmarPaso = async () => {
const s = selectedDocData; const nIdx = s.idx + 1; const nEst = nIdx < 4 ? PASOS_NOMBRES[nIdx] : "Aprobado Final"; const faseAprobada = PASOS_NOMBRES[s.idx]; const now = new Date().toISOString();
let updates = { idx: nIdx, estado: nEst, [`fase_${s.idx}_fin`]: now, [`fase_${nIdx}_ini`]: now, chat: arrayUnion({u: currentUser.nombre, m: `✅ FASE COMPLETADA: ${faseAprobada}`, t: new Date().toLocaleString()}) };
await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), updates);
const dest = await window.getDatosEnvio(s); window.sendNotification(dest, `Avance: ${s.customId}`, `La solicitud avanzó a: ${nEst}.`); window.closeModal();
};

window.enviarComentarioLibre = async () => {
    const box = $('m-comentario-libre'); const txtHTML = box.innerHTML; const txtPlain = box.innerText.trim(); const f = $('m-file-comentario');
    if(!txtPlain && !f.files[0] && txtHTML.replace(/<[^>]*>?/gm, '').trim() === '') return alert("Escribe un mensaje o adjunta un archivo."); window.showLoading(); let fileUrl = null; let fileName = null;
    if (f.files[0]) { fileUrl = await window.uploadToCloudinary(f.files[0]); if (!fileUrl) { window.hideLoading(); return alert("Error de red."); } fileName = f.files[0].name; }
    let chatPayload = {u: currentUser.nombre, m: `💬 <b>Comentario Libre:</b><br>${txtHTML}`, t: new Date().toLocaleString()}; 
    if (fileUrl) { chatPayload.archivo = fileUrl; chatPayload.archivo_nombre = fileName; } 
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { chat: arrayUnion(chatPayload) });
    const dest = await window.getDatosEnvio(selectedDocData); 
    let mensajeCorreo = `<b>${currentUser.nombre}</b> ha dejado un comentario en el expediente:<br><br><div style="padding: 12px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px;">${txtHTML}</div>`;
    if (fileName) { mensajeCorreo += `<br><br><i>📎 Además, adjuntó un archivo: <b>${fileName}</b></i>`; }
    window.sendNotification(dest, `Nuevo Comentario: ${selectedDocData.customId}`, mensajeCorreo);
    box.innerHTML = ""; f.value = ""; window.hideLoading(); window.closeModal();
};

window.guardarCierreFinal = async () => {
const codFinal = $('m-final-cod').value; const ver = $('m-final-ver').value; const fecha = $('m-final-fecha').value; const com = $('m-final-comentario').value; const f = $('m-final-file');
let fileUrl = selectedDocData.documento_final || null; let fileName = selectedDocData.documento_final_nombre || null;
if(!ver || !fecha) return alert("Versión Final y Fecha son obligatorios."); 
if(f.files[0]) { window.showLoading(); fileUrl = await window.uploadToCloudinary(f.files[0]); if (!fileUrl) { window.hideLoading(); return alert("Error al subir."); } fileName = f.files[0].name; }
else if(!fileUrl) { return alert("Debes subir el documento final oficial."); }

window.showLoading();
const now = new Date().toISOString(); 
let chatPayload = {u: "SISTEMA (SGC)", m: `🏁 <b>SOLICITUD PUBLICADA / CERRADA.</b><br>Ver: ${ver}. Obs: ${com}`, t: new Date().toLocaleString(), archivo: fileUrl, archivo_nombre: fileName};
let updates = { estado: "Aprobado Final", codigo_final: codFinal, version_final: ver, fecha_final: fecha, comentario_final: com, documento_final: fileUrl, documento_final_nombre: fileName, chat: arrayUnion(chatPayload) };
if(selectedDocData.idx === 3) { updates.idx = 4; updates.fase_3_fin = now; updates.fase_4_ini = now; }

await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), updates);

let dataMaestro = { estatus: "Vigente", registrado_por: "Sistema (Automático)", fecha_registro: new Date().toISOString() };
columnasMaestro.forEach(c => { let cName = typeof c === 'string' ? c : c.nombre; let low = cName.toLowerCase(); if(low.includes('código') || low === 'codigo') dataMaestro[cName] = codFinal || selectedDocData.cod_ref || "POR_ASIGNAR"; else if(low.includes('gerencia')) dataMaestro[cName] = selectedDocData.gerencia; else if(low.includes('departamento')) dataMaestro[cName] = selectedDocData.departamento; else if(low.includes('tipo')) dataMaestro[cName] = selectedDocData.tipoDoc; else if(low.includes('nombre')) dataMaestro[cName] = selectedDocData.titulo; else if(low.includes('vers')) dataMaestro[cName] = ver; else if(low.includes('ubicaci') || low.includes('archivo') || low.includes('documento')) dataMaestro[cName] = fileUrl; else if(low.includes('fecha última') || low.includes('fecha ultima') || low === 'fecha') dataMaestro[cName] = fecha; });
await addDoc(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), dataMaestro);

const dest = await window.getDatosEnvio(selectedDocData); window.sendNotification(dest, `✅ Documento Oficial Publicado: ${selectedDocData.customId}`, `El documento versión ${ver} ha sido publicado oficialmente en el sistema.`); window.hideLoading(); window.closeModal();
};

window.anularSolicitud = async () => {
    if(!confirm("⚠️ ¿Estás seguro de anular esta solicitud?")) return; let motivo = prompt("Motivo de anulación:"); if(!motivo) return; window.showLoading();
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { estado: "Anulado", chat: arrayUnion({u: currentUser.nombre, m: `🚫 <b>SOLICITUD ANULADA</b><br>Motivo: ${motivo}`, t: new Date().toLocaleString()}) });
    const dest = await window.getDatosEnvio(selectedDocData); 
    let mensajeCorreo = `La solicitud fue <b>ANULADA</b> por ${currentUser.nombre}.<br><br><div style="padding: 12px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px;"><b>Motivo:</b> ${motivo}</div>`;
    window.sendNotification(dest, `Cancelación: ${selectedDocData.customId}`, mensajeCorreo); 
    window.hideLoading(); window.closeModal();
};

window.addInvolucradoList = () => {
const sel = $('sol-involucrado-sel'); const email = sel.value; const name = sel.options[sel.selectedIndex].text; if(!email) return alert("Seleccione un usuario válido.");
const existingTags = Array.from($$('.involucrado-item')); if(existingTags.some(el => el.dataset.email === email)) { return alert("El usuario ya está en la lista."); }
const div = document.createElement('div'); div.className = 'involucrado-item badge badge-info'; div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '5px'; div.style.fontSize = '12px'; div.style.padding = '6px 12px'; div.dataset.email = email; div.innerHTML = `${name} <span class="material-icons-round" style="font-size:14px; cursor:pointer; color:var(--danger);" onclick="this.parentElement.remove()">close</span>`;
$('lista-involucrados-tags').appendChild(div); sel.value = "";
};

window.guardarNuevoInvolucrado = async () => {
const sel = $('m-new-involucrado-sel'); const newEmail = sel.value; const newName = sel.options[sel.selectedIndex].text; if(!newEmail || !newEmail.includes('@')) return alert('Selecciona un usuario válido.'); window.showLoading();
let currentInv = selectedDocData.involucrados || []; if(currentInv.includes(newEmail)) { window.hideLoading(); return alert('El usuario ya está en la lista de involucrados.'); } 
currentInv.push(newEmail); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { involucrados: currentInv, chat: arrayUnion({u: currentUser.nombre, m: `👥 Añadió a ${newName} a la lista de involucrados.`, t: new Date().toLocaleString()}) });
setVal('m-new-involucrado-sel', ''); window.hideLoading(); window.verDetalle(selectedId);
};

window.eliminarInvolucrado = async (emailToRemove) => {
if(!confirm("¿Estás seguro de eliminar a este usuario de los involucrados?")) return; window.showLoading();
let currentInv = selectedDocData.involucrados || []; currentInv = currentInv.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { involucrados: currentInv, chat: arrayUnion({u: currentUser.nombre, m: `👥 Removió a ${emailToRemove} de la lista de involucrados.`, t: new Date().toLocaleString()}) });
window.hideLoading(); window.verDetalle(selectedId);
};

window.filtrarTabla = (inputId, tbodyId) => {
const input = $(inputId); if (!input) return; const filter = input.value.toLowerCase(); const tbody = $(tbodyId); if (!tbody) return; const trs = tbody.getElementsByTagName('tr');
for (let i = 0; i < trs.length; i++) { let rowText = trs[i].textContent || trs[i].innerText; if (rowText.toLowerCase().indexOf(filter) > -1) { trs[i].style.display = ""; } else { trs[i].style.display = "none"; } }
};

window.descargarExcelFiltrado = (origen = 'hist') => {
let elDesde = $(`${origen}-f-desde`), elHasta = $(`${origen}-f-hasta`), elEstado = $(`${origen}-f-estado`);
let desde = elDesde ? elDesde.value : ""; 
let hasta = elHasta ? elHasta.value : ""; 
let estado = elEstado ? elEstado.value : ""; 
let esAdminSGC = currentUser.permisos.admin || currentUser.permisos.p_gest_sgc;

let datosFiltrados = globalSolicitudes.filter(s => {
    if (origen !== 'all' && !esAdminSGC) { let isMine = (s.uid === currentUser.usuario) || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase())); if (origen === 'hist' && !isMine) return false; if (origen === 'gest') { const p = currentUser.permisos; let ver = p.p_ver_all || (p.p_ver_ger && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia)) || isMine; if(!ver) return false; } }
    if (desde && s.fecha < desde) return false; if (hasta && s.fecha > hasta + "T23:59:59") return false;
    if (estado) { let eStr = (s.estado || "").toUpperCase(); if (estado === 'Pendiente' && (eStr.includes('APROBADO FINAL') || eStr === 'ANULADO' || eStr === 'RECHAZADO')) return false; if (estado === 'Aprobado Final' && !eStr.includes('APROBADO FINAL')) return false; if (estado === 'Cancelado' && eStr !== 'ANULADO' && eStr !== 'RECHAZADO') return false; }
    return true;
});

if(datosFiltrados.length === 0) return alert("No hay datos que coincidan con estos filtros para exportar.");

const formatearDiferencia = (ini, fin) => { if(!ini || !fin) return "N/A"; const ms = new Date(fin) - new Date(ini); if(ms < 0) return "N/A"; const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); const m = Math.floor((ms % 3600000) / 60000); if (d > 0) return `${d}d ${h}h ${m}m`; if (h > 0) return `${h}h ${m}m`; return `${m}m`; };

let dataExport = datosFiltrados.map(s => {
    let p = PASOS_NOMBRES[s.idx] || ''; let estadoFormat = s.estado === 'Aprobado Final' ? 'Aprobado Final' : (s.estado === 'Anulado' || s.estado === 'Rechazado' ? s.estado : `${s.estado} (${p})`);
    let baseObj = { "ID Solicitud": s.customId, "Solicitante": s.solicitante || '', "Email Solicitante": s.solicitante_email || '', "Gerencia": s.gerencia || '', "Departamento": s.departamento || '', "Acción": s.accion || '', "Prioridad": s.prioridad || 'Normal', "Tipo Documento": s.tipoDoc || '', "Título Documento": s.titulo || '', "Estado Actual": estadoFormat, "Fecha Límite (SLA)": s.fecha_esperada_cierre || 'No definida', "Fecha de Creación": s.fecha ? new Date(s.fecha).toLocaleString() : '', "Código Ref. Original": s.cod_ref || '', "Versión Original": s.ver_ref || '', "Código Final Asignado": s.codigo_final || '', "Versión Final Asignada": s.version_final || '', "Fecha Final": s.fecha_final || '' };
    
    if (esAdminSGC) { 
        baseObj["Tiempo Fase 1 (Documentado)"] = formatearDiferencia(s.fase_0_ini, s.fase_0_fin); 
        baseObj["Tiempo Fase 2 (Verificado)"] = formatearDiferencia(s.fase_1_ini, s.fase_1_fin); 
        baseObj["Tiempo Fase 3 (Aprob. Gerencia)"] = formatearDiferencia(s.fase_2_ini, s.fase_2_fin); 
        baseObj["Tiempo Fase 4 (Aprob. SGC)"] = formatearDiferencia(s.fase_3_ini, s.fase_3_fin); 
        baseObj["TIEMPO TOTAL DEL FLUJO"] = formatearDiferencia(s.fase_0_ini, s.fecha_final || s.fase_3_fin || s.fase_2_fin || s.fase_1_fin || s.fase_0_fin); 
    }
    return baseObj;
});

let nameF = esAdminSGC ? "Reporte_SGC_Completo_Con_Tiempos" : "Reporte_Solicitudes"; 
let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "Datos_Exportados"); XLSX.writeFile(wb, `${nameF}.xlsx`);
};

window.switchAuditTab = (id) => { $$('.tab-btn').forEach(b=>b.classList.remove('active')); $$('.tab-content').forEach(c=>c.classList.remove('active')); if($(`btn-tab-${id}`)) $(`btn-tab-${id}`).classList.add('active'); if($(`tab-${id}`)) $(`tab-${id}`).classList.add('active'); };

window.abrirModalPlan = () => {
setTxt('edit-year-label', $('aud-year-select').value); $$('#ah-auditor-list input').forEach(cb=>cb.checked=false);
if(globalAuditPlan) {
    setVal('ah-obj', globalAuditPlan.objetivo || ''); setVal('ah-alcance', globalAuditPlan.alcance || ''); setVal('ah-tecnica', globalAuditPlan.tecnica || ''); setVal('ah-criterios', globalAuditPlan.criterios || ''); setVal('ah-ref', globalAuditPlan.referencia || ''); setVal('ah-fecha', globalAuditPlan.fecha_elab || ''); setVal('ah-tec', globalAuditPlan.recursos_tec || ''); setVal('ah-rrhh', globalAuditPlan.recursos_hh || ''); setVal('ah-extra-emails', (globalAuditPlan.extra_correos || []).join(', '));
    let liderSel = $('ah-lider'); for(let i=0; i<liderSel.options.length; i++){ if(liderSel.options[i].value === globalAuditPlan.lider) liderSel.selectedIndex = i; }
    let auditoresGuardados = globalAuditPlan.auditor_nombres || []; $$('#ah-auditor-list input').forEach(cb => { cb.checked = auditoresGuardados.includes(cb.value); });
} else {
    setVal('ah-obj', ''); setVal('ah-alcance', ''); setVal('ah-tecnica', ''); setVal('ah-criterios', ''); setVal('ah-ref', ''); setVal('ah-fecha', ''); setVal('ah-tec', ''); setVal('ah-rrhh', ''); setVal('ah-extra-emails', ''); if($('ah-lider')) $('ah-lider').selectedIndex = 0; 
}
setDisplay('modal-plan', 'flex');
};
window.cerrarModalPlan = () => setDisplay('modal-plan', 'none');

window.saveAuditPlan = async () => {
const y = $('aud-year-select').value; const docId = `Plan_${y}`;
let motivo = "Creación inicial"; if(globalAuditPlan) { motivo = prompt("Motivo de la modificación del Plan Anual:"); if(!motivo) return alert("El motivo es obligatorio para editar."); }
const liderSel = $('ah-lider'); const liderName = liderSel.options[liderSel.selectedIndex]?.value || ""; const liderEmail = liderSel.options[liderSel.selectedIndex]?.getAttribute('data-email') || "";
const audNombres = []; const audEmails = []; $$('#ah-auditor-list input:checked').forEach(cb => { audNombres.push(cb.value); audEmails.push(cb.getAttribute('data-email')); });
const extraEmails = $('ah-extra-emails').value.split(',').map(e => e.trim().toLowerCase()).filter(e=>e.includes('@'));
let todosLosCorreos = new Set([...audEmails, ...extraEmails]); if(liderEmail) todosLosCorreos.add(liderEmail);
const data = { year: y, objetivo: $('ah-obj').value, alcance: $('ah-alcance').value, tecnica: $('ah-tecnica').value, criterios: $('ah-criterios').value, referencia: $('ah-ref').value, fecha_elab: $('ah-fecha').value, lider: liderName, auditor: audNombres.join(', '), auditor_nombres: audNombres, recursos_tec: $('ah-tec').value, recursos_hh: $('ah-rrhh').value, extra_correos: extraEmails, correos: Array.from(todosLosCorreos), modificado_por: currentUser.nombre, ultima_modif: new Date().toISOString() };

window.showLoading();
if(globalAuditPlan) { await updateDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), { ...data, historial: arrayUnion({ fecha: new Date().toISOString(), usuario: currentUser.nombre, motivo: motivo }) }); } 
else { await setDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), { ...data, historial: [{ fecha: new Date().toISOString(), usuario: currentUser.nombre, motivo: motivo }] }); }
window.hideLoading(); alert("Plan Anual actualizado."); window.cerrarModalPlan();
};

window.cambiarAnioAuditoria = (val) => {
if(val === 'nuevo') { let nYear = prompt("Ingrese el nuevo año a registrar (ej: 2028):"); if(nYear && !isNaN(nYear)) { let opt = document.createElement('option'); opt.value = nYear; opt.text = nYear; opt.selected = true; $('aud-year-select').add(opt, $('aud-year-select').options[1]); val = nYear; } else { setVal('aud-year-select', new Date().getFullYear().toString()); return; } }
window.loadAuditPlan(val); window.renderTablaAuditorias(val);
};

window.loadAuditPlan = (year) => {
const docId = `Plan_${year}`; setTxt('view-year-label', year);
onSnapshot(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), s => {
    if(s.exists()) {
        globalAuditPlan = s.data(); setDisplay('audit-header-view', 'block'); 
        setTxt('view-ah-obj', globalAuditPlan.objetivo || '-'); setTxt('view-ah-alcance', globalAuditPlan.alcance || '-'); setTxt('view-ah-tecnica', globalAuditPlan.tecnica || '-'); setTxt('view-ah-criterios', globalAuditPlan.criterios || '-'); setTxt('view-ah-ref', globalAuditPlan.referencia || '-'); setTxt('view-ah-fecha', window.formatearFechaAbreviada(globalAuditPlan.fecha_elab) || '-'); setTxt('view-ah-lider', globalAuditPlan.lider || '-'); setTxt('view-ah-auditor', globalAuditPlan.auditor || '-'); setTxt('view-ah-tec', globalAuditPlan.recursos_tec || '-'); setTxt('view-ah-rrhh', globalAuditPlan.recursos_hh || '-');
        let modInfo = `Por: ${globalAuditPlan.modificado_por || '-'} el ${window.formatearFechaAbreviada(globalAuditPlan.ultima_modif)}`; 
        if(globalAuditPlan.historial && globalAuditPlan.historial.length > 0) { let ultimoMotivo = globalAuditPlan.historial[globalAuditPlan.historial.length-1].motivo; modInfo += ` (Motivo: ${ultimoMotivo})`; } 
        setTxt('view-ah-mod-info', modInfo);
    } else { globalAuditPlan = null; setDisplay('audit-header-view', 'none'); }
});
};

window.abrirNuevaAuditoria = () => { window.cancelarEdicionAuditoria(); setDisplay('modal-nueva-aud', 'flex'); };

window.cargarAuditoriaParaEditar = async (id) => {
const au = globalAllAuditorias.find(x => x.id === id); if(!au) return; 
editandoAuditoriaId = id; 
if($('titulo-form-auditoria')) $('titulo-form-auditoria').innerText = "Editar Auditoría Programada"; 

setVal('aud-fecha', au.fecha || ''); setVal('aud-h-ini', au.hora_inicio || ''); setVal('aud-h-fin', au.hora_fin || ''); setVal('aud-lugar', au.lugar || ''); setVal('aud-obs', au.observacion || ''); setVal('aud-org', au.organizacion || ''); setVal('aud-dir', au.direccion || ''); setVal('aud-sitios', au.sitios || ''); setVal('aud-personal', au.personal || ''); setVal('aud-turnos', au.turnos || '');

let aa = au.auditado ? au.auditado.split(', ') : []; $$('#aud-auditado-list input[type="checkbox"]').forEach(cb => { cb.checked = aa.includes(cb.value); });
let aua = au.auditor ? au.auditor.split(', ') : []; $$('#aud-auditor-list input[type="checkbox"]').forEach(cb => { cb.checked = aua.includes(cb.value); });
let ar = au.requisitos ? au.requisitos.split(', ') : []; $$('#aud-req-list input[type="checkbox"]').forEach(cb => { cb.checked = ar.includes(cb.value); });
let af = au.auditores_formacion ? au.auditores_formacion.split(', ') : []; $$('#aud-formacion-list input[type="checkbox"]').forEach(cb => { cb.checked = af.includes(cb.value); });

setTxt('btn-guardar-aud', "ACTUALIZAR AUDITORÍA"); 
setDisplay('btn-cancelar-aud', 'inline-block'); setDisplay('modal-nueva-aud', 'flex');
};

window.cancelarEdicionAuditoria = () => {
editandoAuditoriaId = null; 
if($('titulo-form-auditoria')) $('titulo-form-auditoria').innerText = "Programar Nueva Auditoría"; 

['aud-fecha', 'aud-h-ini', 'aud-h-fin', 'aud-lugar', 'aud-obs', 'aud-org', 'aud-dir', 'aud-sitios', 'aud-personal', 'aud-turnos'].forEach(i => { if($(i)) $(i).value = ''; });

$$('#aud-auditado-list input[type="checkbox"]').forEach(c => c.checked = false); 
$$('#aud-auditor-list input[type="checkbox"]').forEach(c => c.checked = false); 
$$('#aud-req-list input[type="checkbox"]').forEach(c => c.checked = false); 
$$('#aud-formacion-list input[type="checkbox"]').forEach(c => c.checked = false);

if($('btn-guardar-aud')) $('btn-guardar-aud').innerText = "GENERAR AUDITORÍA Y NOTIFICAR"; 
setDisplay('btn-cancelar-aud', 'none'); setDisplay('modal-nueva-aud', 'none');
};

window.guardarAuditoria = async () => {
const f = $('aud-fecha').value; 
const reqN = []; $$('#aud-req-list input:checked').forEach(c => reqN.push(c.value)); 
const r = reqN.join(', ');

if(!f || !r) return alert("Fecha y Puntos son obligatorios.");

const an = [], ae = []; $$('#aud-auditado-list input:checked').forEach(c => { an.push(c.value); ae.push(c.getAttribute('data-email')); });
const aun = [], aue = []; $$('#aud-auditor-list input:checked').forEach(c => { aun.push(c.value); aue.push(c.getAttribute('data-email')); });
const fn = []; $$('#aud-formacion-list input:checked').forEach(c => fn.push(c.value));

let dt = { fecha: f, hora_inicio: $('aud-h-ini').value, hora_fin: $('aud-h-fin').value, lugar: $('aud-lugar').value, proceso: r, requisitos: r, auditado: an.join(', '), auditado_emails: ae, auditor: aun.join(', '), auditor_emails: aue, observacion: $('aud-obs').value, organizacion: $('aud-org').value, direccion: $('aud-dir').value, sitios: $('aud-sitios').value, personal: $('aud-personal').value, turnos: $('aud-turnos').value, auditores_formacion: fn.join(', ') };

window.showLoading();

try {
    if(editandoAuditoriaId) { 
        dt.modificado_por = currentUser.nombre; 
        dt.ultima_modificacion = new Date().toISOString();
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", editandoAuditoriaId), dt); 
    } else {
        let aNum = ""; 
        await runTransaction(db, async(t) => { 
            const sn = await t.get(doc(db, "artifacts", appId, "public", "data", "Contadores", "auditorias")); 
            let c = 1; if(sn.exists()) c = sn.data().count + 1; 
            t.set(doc(db, "artifacts", appId, "public", "data", "Contadores", "auditorias"), { count: c }); 
            aNum = `QSHE-${new Date().getFullYear()}-${c}`; 
        });
        dt.audit_num = aNum; dt.estado = "Programada"; dt.creado_por = currentUser.nombre; dt.timestamp = new Date().toISOString(); dt.bitacora = []; dt.lista_verificacion = []; dt.reporte_auditoria = { conclusiones: '' }; dt.rondas = 1;
        await addDoc(collection(db, "artifacts", appId, "public", "data", "Auditorias"), dt);
        
        let gM = Array.from(new Set([...ae, ...aue])); 
        if(globalAuditPlan && globalAuditPlan.correos) globalAuditPlan.correos.forEach(x => gM.push(x)); 
        gM.push(EMAIL_ADMIN_SGC);
        
        let msgAuditoria = `Se ha programado una nueva Auditoría Interna (<b>${aNum}</b>). A continuación, los detalles:<br><br>
        <div style="padding: 15px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px; line-height: 1.6;">
            <b>Fecha:</b> ${window.formatearFechaAbreviada(f)}<br>
            <b>Horario:</b> ${dt.hora_inicio || 'N/A'} - ${dt.hora_fin || 'N/A'}<br>
            <b>Lugar:</b> ${dt.lugar || 'N/A'}<br>
            <b>Proceso / Área:</b> ${r || 'N/A'}<br>
            <b>Requisitos:</b> ${r || 'N/A'}<br>
            <b>Auditado(s):</b> ${dt.auditado || 'N/A'}<br>
            <b>Auditor(es):</b> ${dt.auditor || 'N/A'}<br>
            <b>Observaciones:</b> ${dt.observacion || 'Ninguna'}
        </div>
        <br><i>Por favor, verificar y confirmar la agenda en el sistema SGC.</i>`;
        
        window.sendNotification({to: gM.join(',')}, `Auditoría Programada: ${aNum}`, msgAuditoria);
        alert(`Auditoría ${aNum} programada.`);
    }
    window.cancelarEdicionAuditoria(); 
} catch(e) {
    console.error(e);
    alert("Error guardando auditoria.");
} finally {
    window.hideLoading();
}
};

window.renderTablaAuditorias = (yf) => {
if(!$('tbody-auditorias')) return; 
let isAdm = currentUser.permisos.p_audit_admin || currentUser.permisos.admin || currentUser.permisos.p_gest_sgc;

globalAuditorias = globalAllAuditorias.filter(a => { 
    if(a.fecha && !a.fecha.startsWith(yf)) return false; 
    return isAdm || (a.auditado && a.auditado.includes(currentUser.nombre)) || (a.auditor && a.auditor.includes(currentUser.nombre)); 
});

globalAuditorias.sort((a,b) => new Date(a.fecha) - new Date(b.fecha)); 
let h = "";

globalAuditorias.forEach(a => {
    let e = String(a.estado || 'Programada'); 
    let b = e === 'Completada' ? 'badge-success' : (e === 'En Progreso' ? 'badge-info' : (e === 'Pausada' ? 'badge-dark' : 'badge-warning'));
    let btn = `<button class="btn btn-primary" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.verModalAuditoria('${a.id}')">Ver</button>`;
    let roundLabel = a.rondas > 1 ? ` (R${a.rondas})` : '';
    
    const isAuditor = a.auditor && a.auditor.includes(currentUser.nombre); 
    const canControl = isAdm || isAuditor;
    
    if (canControl) { 
        if (e === 'Programada') btn += `<button class="btn btn-success" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.iniciarAuditoriaDirecto('${a.id}')">Iniciar</button>`; 
        else if (e === 'En Progreso') {
            btn += `<button class="btn btn-warning" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.pausarAuditoriaDirecto('${a.id}')">Pausar</button>`; 
            btn += `<button class="btn btn-danger" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.finalizarAuditoriaDirecto('${a.id}')">Fin</button>`;
        } else if (e === 'Pausada') {
            btn += `<button class="btn btn-success" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.reanudarAuditoriaDirecto('${a.id}')">Reanudar</button>`; 
            btn += `<button class="btn btn-danger" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.finalizarAuditoriaDirecto('${a.id}')">Fin</button>`;
        }
        btn += `<button class="btn btn-info" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.cargarAuditoriaParaEditar('${a.id}')">Ed</button>`;
    }
    
    if(isAdm) btn += `<button class="btn-icon-danger" onclick="window.del('Auditorias','${a.id}')">X</button>`;
    
    h += `<tr><td><b>${a.audit_num || '-'}</b></td><td><b>${window.formatearFechaAbreviada(a.fecha)}</b><br><small>${a.hora_inicio || ''} - ${a.hora_fin || ''}</small></td><td>${a.requisitos ? a.requisitos.substring(0,30) + '...' : '-'}</td><td>${a.auditado || '-'}</td><td>${a.auditor || '-'}</td><td><span class="badge ${b}">${e}${roundLabel}</span></td><td class="no-export">${btn}</td></tr>`;
});
setHtml('tbody-auditorias', h); 
if(isAdm) window.verificarAlertasAuditoria(globalAuditorias);
};

window.iniciarAuditoriaDirecto = async (id) => { if(!confirm("¿Iniciar auditoría?")) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"En Progreso", hora_real_inicio:new Date().toISOString(), rondas: 1}); window.hideLoading(); };
window.finalizarAuditoriaDirecto = async (id) => { if(!confirm("¿Finalizar definitivamente?")) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"Completada", hora_real_fin:new Date().toISOString()}); window.hideLoading(); };
window.pausarAuditoriaDirecto = async (id) => { 
    if(!confirm("¿Pausar auditoría para una nueva ronda?")) return; 
    window.showLoading(); 
    const sn = await getDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id)); 
    let r = sn.data().rondas || 1; 
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"Pausada", rondas: r + 1}); 
    window.hideLoading(); 
};
window.reanudarAuditoriaDirecto = async (id) => { if(!confirm("¿Reanudar auditoría?")) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"En Progreso"}); window.hideLoading(); };

window.verModalAuditoria = async (id) => {
try {
    window.showLoading();
    selectedAuditId = id; 
    const sn = await getDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id)); 
    if(!sn.exists()) { window.hideLoading(); return alert("Auditoría no encontrada."); }
    
    selectedAuditData = sn.data(); 
    const a = selectedAuditData || {};
    
    ['ma-num','ma-proceso','ma-fecha','ma-hora','ma-lugar','ma-auditado','ma-auditor','ma-req','ma-obs','rep-num','rep-org','rep-dir','rep-sitios','rep-fechas','rep-personal','rep-turnos','rep-lider','rep-adicionales','rep-formacion','rep-alcance'].forEach(i => { 
        if($(i)) $(i).innerText = a[i.replace('ma-','').replace('rep-','')] || (globalAuditPlan ? globalAuditPlan[i.replace('rep-','')] : '') || '-'; 
    });
    
    if($('ma-fecha')) $('ma-fecha').innerText = window.formatearFechaAbreviada(a.fecha); 
    if($('ma-hora')) $('ma-hora').innerText = `${a.hora_inicio || ''} a ${a.hora_fin || ''}`; 
    if($('ma-req')) $('ma-req').innerText = a.requisitos || ''; 
    if($('rep-fechas')) $('rep-fechas').innerText = window.formatearFechaAbreviada(a.fecha); 
    if($('rep-lider')) $('rep-lider').innerText = globalAuditPlan ? globalAuditPlan.lider : ''; 
    if($('rep-adicionales')) $('rep-adicionales').innerText = a.auditor || ''; 
    if($('rep-formacion')) $('rep-formacion').innerText = a.auditores_formacion || ''; 
    if($('rep-alcance')) $('rep-alcance').innerText = globalAuditPlan ? globalAuditPlan.alcance : '';
    
    let e = String(a.estado || 'Programada'); 
    if($('ma-estado-badge')) {
        $('ma-estado-badge').className = `badge ${e === 'Completada' ? 'badge-success' : (e === 'En Progreso' ? 'badge-info' : (e === 'Pausada' ? 'badge-dark' : 'badge-warning'))}`; 
        $('ma-estado-badge').innerText = e.toUpperCase() + (a.rondas && a.rondas > 1 ? ` (RONDA ${a.rondas})` : '');
    }
    
    if($('ma-inicio-real')) $('ma-inicio-real').innerText = a.hora_real_inicio ? new Date(a.hora_real_inicio).toLocaleString() : '---'; 
    if($('ma-fin-real')) $('ma-fin-real').innerText = a.hora_real_fin ? new Date(a.hora_real_fin).toLocaleString() : '---';
    
    if(a.hora_real_inicio && a.hora_real_fin && $('ma-duracion')) { 
        let m = new Date(a.hora_real_fin) - new Date(a.hora_real_inicio); 
        $('ma-duracion').innerText = `${Math.floor(m/3600000)}h ${Math.floor((m%3600000)/60000)}m`; 
    }
    
    const isAdm = currentUser.permisos.admin || currentUser.permisos.p_audit_admin;
    const isAud = a.auditor && a.auditor.includes(currentUser.nombre);
    
    const canEd = (isAdm || isAud) && e !== 'Completada'; 
    const canEdReporte = (isAdm || isAud); 
    
    setDisplay('btn-comenzar-auditoria', (isAdm || isAud) && (e === 'Programada' || e === 'Pausada') ? 'inline-block' : 'none'); 
    if($('btn-comenzar-auditoria')) $('btn-comenzar-auditoria').innerText = e === 'Pausada' ? '▶️ REANUDAR AUDITORÍA' : '▶️ COMENZAR AUDITORÍA';
    setDisplay('btn-pausar-auditoria', (isAdm || isAud) && e === 'En Progreso' ? 'inline-block' : 'none');
    setDisplay('btn-finalizar-auditoria', (isAdm || isAud) && (e === 'En Progreso' || e === 'Pausada') ? 'inline-block' : 'none');
    
    if($('chat-box-audit')) $('chat-box-audit').innerHTML = a.bitacora ? a.bitacora.map(c => `<div class="chat-msg"><b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${c.archivo}','${c.archivo_nombre}');return false;" style="font-size:10px;color:blue;">📎 Ver</a>` : ''}</div>`).join('') : '';
    
    currentAuditF020 = a.lista_verificacion || []; window.renderF020();
    
    ['f003-conclusiones','f003-n-proceso','f003-n-personal','f003-n-cargo','f003-n-req','f003-n-doc','f003-n-evidencia'].forEach(i => { if($(i)) $(i).disabled = !canEdReporte; });
    if(a.reporte_auditoria) { ['conclusiones','n_proceso','n_personal','n_cargo','n_req','n_doc','n_evidencia'].forEach(k => { if($('f003-'+k)) $('f003-'+k).value = a.reporte_auditoria[k] || ""; }); }
    
    window.actualizarMetricasF003(canEdReporte); window.renderAuditSACs();
    
    setDisplay('btn-tab-f020', (isAdm || isAud) ? 'inline-block' : 'none'); 
    setDisplay('btn-add-f020', canEd ? 'inline-block' : 'none'); 
    setDisplay('btn-save-f020', canEd ? 'inline-block' : 'none'); 
    setDisplay('btn-submit-f020', canEd ? 'inline-block' : 'none'); 
    setDisplay('btn-save-f003', canEdReporte ? 'inline-block' : 'none'); 
    setDisplay('btn-add-sac-manual', canEdReporte ? 'inline-block' : 'none');
    
    window.switchAuditTab('info'); setDisplay('modal-auditoria', 'flex');
} catch(e) {
    console.error("Error abriendo auditoría:", e);
} finally {
    window.hideLoading();
}
};

window.comenzarAuditoria = async () => { 
    if(selectedAuditData.estado === 'Pausada') { await window.reanudarAuditoriaDirecto(selectedAuditId); } 
    else { await window.iniciarAuditoriaDirecto(selectedAuditId); }
    window.verModalAuditoria(selectedAuditId); 
};
window.pausarAuditoria = async () => { await window.pausarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.finalizarAuditoria = async () => { await window.finalizarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.enviarComentarioAuditoria = async () => { const b = $('ma-comentario-libre'); const th = b.innerHTML; const f = $('ma-file-comentario'); if(!b.innerText.trim() && !f.files[0]) return; window.showLoading(); let u = null, fn = null; if(f.files[0]) { u = await window.uploadToCloudinary(f.files[0]); fn = f.files[0].name; } await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId), {bitacora: arrayUnion({u:currentUser.nombre, m:`💬 ${th}`, t:new Date().toLocaleString(), archivo:u, archivo_nombre:fn})}); b.innerHTML=""; f.value=""; window.hideLoading(); window.verModalAuditoria(selectedAuditId); };

window.sincronizarF020DOM = () => {
    let dA = [];
    $$('#tbody-f020 tr').forEach(tr => {
        let inps = tr.querySelectorAll('.table-input, .table-select');
        if(inps.length >= 7) {
            dA.push({
                id: tr.dataset.id,
                pregunta: inps[0].value,
                requisito: inps[1].value,
                comentarios: inps[2].value,
                auditado: inps[3].value,
                nc: inps[4].value,
                observacion: inps[5].value,
                fortaleza: inps[6].value
            });
        }
    });
    currentAuditF020 = dA;
};

window.renderF020 = () => {
    if(!$('tbody-f020')) return; 
    let canEd = selectedAuditData && String(selectedAuditData.estado||"") !== 'Completada' && (currentUser.permisos.admin || currentUser.permisos.p_audit_admin || (selectedAuditData.auditor && selectedAuditData.auditor.includes(currentUser.nombre))); 
    
    let h = "";
    let rqs = selectedAuditData && selectedAuditData.requisitos ? selectedAuditData.requisitos.split(', ') : [];
    let aOps = `<option value="">-- Sel --</option>` + (selectedAuditData && selectedAuditData.auditado ? selectedAuditData.auditado.split(', ').map(a => `<option value="${a}">${a}</option>`).join('') : '');

    currentAuditF020.forEach((i, idx) => {
        let dis = canEd ? '' : 'disabled';
        let rOpt = `<option value="">-- Sel --</option>` + rqs.map(r => `<option value="${r}" ${i.requisito === r ? 'selected' : ''}>${r}</option>`).join('');
        let aOpt = `<option value="${i.auditado || ''}" selected>${i.auditado || '-- Sel --'}</option>` + aOps;
        let nOpt = `<option value="N/A" ${i.nc==='N/A'||!i.nc?'selected':''}>N/A</option><option value="NC Menor" ${i.nc==='NC Menor'?'selected':''}>NC Menor</option><option value="NC Mayor" ${i.nc==='NC Mayor'?'selected':''}>NC Mayor</option><option value="OM" ${i.nc==='OM'?'selected':''}>OM</option>`;
        let fOpt = `<option value="N/A" ${i.fortaleza==='N/A'||!i.fortaleza?'selected':''}>N/A</option><option value="Sí" ${i.fortaleza==='Sí'?'selected':''}>Sí</option>`;
        
        h += `<tr data-id="${i.id}">
            <td>${idx+1}</td>
            <td><textarea class="table-input" rows="2" ${dis}>${i.pregunta||''}</textarea></td>
            <td><select class="table-select" ${dis}>${rOpt}</select></td>
            <td><textarea class="table-input" rows="2" ${dis}>${i.comentarios||''}</textarea></td>
            <td><select class="table-select" ${dis}>${aOpt}</select></td>
            <td><select class="table-select hallazgo-sel" ${dis}>${nOpt}</select></td>
            <td><textarea class="table-input" rows="2" ${dis}>${i.observacion||''}</textarea></td>
            <td><select class="table-select" ${dis}>${fOpt}</select></td>
            <td class="f020-action-col">${canEd ? `<button class="btn-icon-danger" onclick="window.eliminarF020('${i.id}')"><span class="material-icons-round">delete</span></button>` : ''}</td>
        </tr>`;
    }); 
    
    setHtml('tbody-f020', h); 
    $$('.f020-action-col').forEach(e => e.style.display = canEd ? '' : 'none');
};

window.agregarFilaF020 = () => { 
    window.sincronizarF020DOM(); 
    currentAuditF020.push({ id:'f020_'+Date.now(), pregunta:'', requisito:'', comentarios:'', auditado:'', nc:'N/A', observacion:'', fortaleza:'N/A' }); 
    window.renderF020(); 
};

window.eliminarF020 = (id) => { 
    if(!confirm("¿Eliminar este ítem de la lista?")) return; 
    window.sincronizarF020DOM(); 
    currentAuditF020 = currentAuditF020.filter(x => x.id !== id); 
    window.renderF020(); 
};

window.guardarF020 = async (notificar=false) => { 
    window.sincronizarF020DOM(); 
    window.showLoading(); 
    await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId), {lista_verificacion: currentAuditF020}); 
    if(notificar) { 
        window.sendNotification({to: EMAIL_ADMIN_SGC}, "F-020 Actualizado", `Auditor ${currentUser.nombre} subió F-020 para la auditoría ${selectedAuditData.audit_num}.`); 
        alert("Guardado y Notificado a SGC"); 
    } else { 
        alert("Lista de Verificación (F-020) Guardada exitosamente."); 
    } 
    window.hideLoading(); 
    window.verModalAuditoria(selectedAuditId); 
};
window.enviarPreguntasSGC = () => window.guardarF020(true);

window.generarBloqueNCDinamico = (i, idx, t, canEd) => {
let d = selectedAuditData.reporte_auditoria?.detalles_nc?.[i.id] || {}; let dis = canEd ? '' : 'disabled';
return `<div style="border:1px solid #ccc;font-size:12px;margin-bottom:15px;" class="f003-hallazgo-block" data-id="${i.id}"><div style="display:grid;grid-template-columns:150px 1fr;"><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">No. de ${t}</div><div style="padding:8px;border:1px solid #ccc;">${idx}</div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Dpto/Función</div><div style="padding:0;border:1px solid #ccc;"><input type="text" class="h-dep" value="${d.departamento||i.auditado||''}" ${dis} style="border:none;width:100%;height:100%;"></div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Doc Ref</div><div style="padding:0;border:1px solid #ccc;"><input type="text" class="h-doc" value="${d.doc_ref||''}" ${dis} style="border:none;width:100%;height:100%;"></div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Requisito Afectado</div><div style="padding:0;border:1px solid #ccc;"><input type="text" class="h-req" value="${d.requisito||i.requisito||''}" ${dis} style="border:none;width:100%;height:100%;"></div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Detalle</div><div style="padding:0;border:1px solid #ccc;"><textarea class="h-det" ${dis} style="border:none;width:100%;height:100%;min-height:40px;padding:8px;">${d.detalle||i.comentarios||i.pregunta||''}</textarea></div></div></div>`;
};

window.actualizarMetricasF003 = (canEd) => {
let nM = 0, nm = 0, om = 0, hM = "", hm = "", ho = ""; 
currentAuditF020.forEach(i => { if(i.nc === 'NC Mayor'){nM++; hM += window.generarBloqueNCDinamico(i,nM,'NC Mayor',canEd);} if(i.nc === 'NC Menor'){nm++; hm += window.generarBloqueNCDinamico(i,nm,'NC Menor',canEd);} if(i.nc === 'OM'){om++; ho += window.generarBloqueNCDinamico(i,om,'OM',canEd);} });
if($('f003-nc-mayor')) $('f003-nc-mayor').innerText = nM; if($('f003-nc-menor')) $('f003-nc-menor').innerText = nm; if($('f003-om')) $('f003-om').innerText = om;
if($('container-nc-menor')) $('container-nc-menor').innerHTML = hm || "<p style='font-size:11px;color:#94a3b8;'>Ninguna.</p>"; if($('container-nc-mayor')) $('container-nc-mayor').innerHTML = hM || "<p style='font-size:11px;color:#94a3b8;'>Ninguna.</p>"; if($('container-om')) $('container-om').innerHTML = ho || "<p style='font-size:11px;color:#94a3b8;'>Ninguna.</p>";
};

window.guardarF003 = async () => { 
window.showLoading(); let dN = {}; $$('.f003-hallazgo-block').forEach(b => dN[b.dataset.id] = {departamento:b.querySelector('.h-dep').value, doc_ref:b.querySelector('.h-doc').value, requisito:b.querySelector('.h-req').value, detalle:b.querySelector('.h-det').value}); 
let rD = { conclusiones:$('f003-conclusiones').value, n_proceso:$('f003-n-proceso').value, n_personal:$('f003-n-personal').value, n_cargo:$('f003-n-cargo').value, n_req:$('f003-n-req').value, n_doc:$('f003-n-doc').value, n_evidencia:$('f003-n-evidencia').value, detalles_nc:dN }; 
await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId),{reporte_auditoria:rD}); window.hideLoading(); alert("Reporte F-003 guardado."); 
};

window.renderAuditSACs = () => {
const tb = $('tbody-audit-sacs'); if(!tb) return; let hs = currentAuditF020.filter(i => i.nc === 'NC Mayor' || i.nc === 'NC Menor' || i.nc === 'OM');
if(hs.length === 0) { tb.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No hay NC/OM.</td></tr>"; return; } let ht = "";
hs.forEach((h, idx) => {
    let sac = globalAllSacs.find(s => s.f020_id === h.id), bd = '', es = 'SIN GENERAR', btn = '', cb = h.nc === 'NC Mayor' ? 'badge-danger' : (h.nc === 'NC Menor' ? 'badge-warning' : 'badge-info');
    if(sac) { 
        es = String(sac.estado || ''); let bs = es.includes('Abierta') ? 'badge-danger' : (es === 'En Seguimiento' ? 'badge-warning' : 'badge-success'); 
        bd = `<span class="badge ${bs}">${es.toUpperCase()}</span><br><small>${sac.sac_num}</small>`; btn = `<button class="btn btn-primary" style="padding:4px;font-size:10px;" onclick="window.verSAC('${sac.sac_id}')">VER</button>`; 
    } else { 
        bd = `<span class="badge badge-dark">NO CREADA</span>`; 
        if(currentUser.permisos.p_audit_auditor || currentUser.permisos.admin || (selectedAuditData && selectedAuditData.auditor && selectedAuditData.auditor.includes(currentUser.nombre))) btn = `<button class="btn btn-info" style="padding:4px;font-size:10px;" onclick="window.abrirCrearSAC('${h.id}')">CREAR SAC</button>`; 
    }
    ht += `<tr><td><b>Ref. ${idx+1}</b><br><small>${(h.pregunta || "").substring(0,30)}...</small></td><td>${h.comentarios || ""}</td><td><span class="badge ${cb}">${h.nc}</span></td><td>${bd}</td><td>${btn}</td></tr>`;
}); tb.innerHTML = ht;
};

window.addPlanRow = (d="", r="", i="", f="") => { const tb = $('tbody-plan-accion'); let tr = document.createElement('tr'); tr.innerHTML = `<td style="border:1px solid #ccc;">${tb.children.length+1}</td><td style="padding:0;"><input type="text" value="${d}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="text" value="${r}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="date" value="${i}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="date" value="${f}" style="width:100%;border:none;margin:0;"></td><td style="text-align:center;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round">delete</span></button></td>`; tb.appendChild(tr); };
window.addSeguimientoRow = (res="", r="", f="") => { const tb = $('tbody-seguimiento'); let tr = document.createElement('tr'); tr.innerHTML = `<td style="border:1px solid #ccc;">${tb.children.length+1}</td><td style="padding:0;"><input type="text" value="${res}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="text" value="${r}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="date" value="${f}" style="width:100%;border:none;margin:0;"></td><td style="text-align:center;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round">delete</span></button></td>`; tb.appendChild(tr); };

window.abrirCrearSAC = (id) => {
let h = currentAuditF020.find(i => i.id === id); if(!h) return; currentEditingSacId = null; currentEditingF020Ref = h;
if($('sac-num')) $('sac-num').innerText = "POR ASIGNAR"; 
if($('sac-estado-badge')) { $('sac-estado-badge').innerText = "NUEVA"; $('sac-estado-badge').className = "badge badge-info"; }
if($('sac-fecha')) $('sac-fecha').value = new Date().toISOString().split('T')[0];
if($('sac-proceso')) $('sac-proceso').value = h.requisito || ""; 
if($('sac-tipo')) $('sac-tipo').value = h.nc || "";

if($('sac-tipo-doc-afectado')) { $('sac-tipo-doc-afectado').innerHTML = '<option value="">-- No aplica --</option>' + tiposDocumento.map(t => `<option value="${t}">${t}</option>`).join(''); $('sac-tipo-doc-afectado').value = ""; }
if($('sac-fuente')) $('sac-fuente').value = "Auditoría Interna"; if($('sac-fuente-otro')) $('sac-fuente-otro').value = ""; if($('sac-detalle')) $('sac-detalle').value = h.comentarios || h.pregunta || ""; if($('sac-beneficio')) $('sac-beneficio').value = ""; if($('sac-causa')) $('sac-causa').value = ""; if($('sac-accion')) $('sac-accion').value = "";
if($('tbody-plan-accion')) $('tbody-plan-accion').innerHTML = ""; if($('sac-fecha-aprob-plan')) $('sac-fecha-aprob-plan').value = ""; if($('tbody-seguimiento')) $('tbody-seguimiento').innerHTML = ""; if($('sac-resp-cierre')) $('sac-resp-cierre').value = ""; if($('sac-fecha-cierre')) $('sac-fecha-cierre').value = ""; if($('sac-check-cerrar')) $('sac-check-cerrar').checked = false;

let auds = selectedAuditData?.auditado ? selectedAuditData.auditado.split(', ') : []; 
let op = '<option value="">-- Responsable --</option>';
allUsers.forEach(u => { op += `<option value="${u.usuario}">${auds.includes(u.nombre) ? '⭐ ' : ''}${u.nombre}</option>`; }); 
if($('sac-dueno')) $('sac-dueno').innerHTML = op; 

setDisplay('modal-sac', 'flex');
};

window.abrirCrearSACManual = () => {
currentEditingSacId = null; currentEditingF020Ref = null;
if($('sac-num')) $('sac-num').innerText = "POR ASIGNAR"; 
if($('sac-estado-badge')) { $('sac-estado-badge').innerText = "NUEVA"; $('sac-estado-badge').className = "badge badge-info"; }
if($('sac-fecha')) $('sac-fecha').value = new Date().toISOString().split('T')[0];
if($('sac-proceso')) $('sac-proceso').value = selectedAuditData?.requisitos || ""; 
if($('sac-tipo')) $('sac-tipo').value = "OM";

if($('sac-tipo-doc-afectado')) { $('sac-tipo-doc-afectado').innerHTML = '<option value="">-- No aplica --</option>' + tiposDocumento.map(t => `<option value="${t}">${t}</option>`).join(''); $('sac-tipo-doc-afectado').value = ""; }
if($('sac-fuente')) $('sac-fuente').value = "Auditoría Interna"; if($('sac-fuente-otro')) $('sac-fuente-otro').value = ""; if($('sac-detalle')) $('sac-detalle').value = ""; if($('sac-beneficio')) $('sac-beneficio').value = ""; if($('sac-causa')) $('sac-causa').value = ""; if($('sac-accion')) $('sac-accion').value = "";
if($('tbody-plan-accion')) $('tbody-plan-accion').innerHTML = ""; if($('sac-fecha-aprob-plan')) $('sac-fecha-aprob-plan').value = ""; if($('tbody-seguimiento')) $('tbody-seguimiento').innerHTML = ""; if($('sac-resp-cierre')) $('sac-resp-cierre').value = ""; if($('sac-fecha-cierre')) $('sac-fecha-cierre').value = ""; if($('sac-check-cerrar')) $('sac-check-cerrar').checked = false;

let auds = selectedAuditData?.auditado ? selectedAuditData.auditado.split(', ') : []; 
let op = '<option value="">-- Responsable --</option>';
allUsers.forEach(u => { op += `<option value="${u.usuario}">${auds.includes(u.nombre) ? '⭐ ' : ''}${u.nombre}</option>`; }); 
if($('sac-dueno')) $('sac-dueno').innerHTML = op; 

setDisplay('modal-sac', 'flex');
};

window.verSAC = (id) => {
let sac = globalAllSacs.find(s => s.sac_id === id); if(!sac) return; currentEditingSacId = id;
if($('sac-num')) $('sac-num').innerText = sac.sac_num || ""; 
let es = String(sac.estado || ""); let bs = es.includes('Abierta') ? 'badge-danger' : (es === 'En Seguimiento' ? 'badge-warning' : 'badge-success'); 
if($('sac-estado-badge')) { $('sac-estado-badge').innerText = es.toUpperCase(); $('sac-estado-badge').className = `badge ${bs}`; }

if($('sac-fecha')) $('sac-fecha').value = sac.fecha_registro || (sac.fecha_apertura ? sac.fecha_apertura.split('T')[0] : ""); 
if($('sac-proceso')) $('sac-proceso').value = sac.proceso || ""; 
if($('sac-tipo')) $('sac-tipo').value = sac.tipo_hallazgo || "";

if($('sac-tipo-doc-afectado')) { $('sac-tipo-doc-afectado').innerHTML = '<option value="">-- No aplica --</option>' + tiposDocumento.map(t => `<option value="${t}">${t}</option>`).join(''); $('sac-tipo-doc-afectado').value = sac.tipo_doc_afectado || ""; }

if($('sac-fuente')) $('sac-fuente').value = sac.fuente_nc || "Auditoría Interna"; if($('sac-fuente-otro')) $('sac-fuente-otro').value = sac.fuente_otro || ""; if($('sac-detalle')) $('sac-detalle').value = sac.detalle_nc || ""; if($('sac-beneficio')) $('sac-beneficio').value = sac.beneficio_esperado || ""; if($('sac-causa')) $('sac-causa').value = sac.causa_raiz || ""; if($('sac-accion')) $('sac-accion').value = sac.accion_implementar || "";

let auds = selectedAuditData?.auditado ? selectedAuditData.auditado.split(', ') : []; 
let op = '<option value="">-- Responsable --</option>';
allUsers.forEach(u => { op += `<option value="${u.usuario}" ${sac.dueno_uid === u.usuario ? 'selected' : ''}>${auds.includes(u.nombre) ? '⭐ ' : ''}${u.nombre}</option>`; }); 
if($('sac-dueno')) $('sac-dueno').innerHTML = op;

if($('tbody-plan-accion')) { $('tbody-plan-accion').innerHTML = ""; if(sac.plan_accion) sac.plan_accion.forEach(p => window.addPlanRow(p.detalle, p.resp, p.inicio, p.fin)); }
if($('sac-fecha-aprob-plan')) $('sac-fecha-aprob-plan').value = sac.fecha_aprobacion_plan || "";
if($('tbody-seguimiento')) { $('tbody-seguimiento').innerHTML = ""; if(sac.seguimiento) sac.seguimiento.forEach(s => window.addSeguimientoRow(s.resultado, s.resp, s.fecha)); }

if($('sac-resp-cierre')) $('sac-resp-cierre').value = sac.cerrado_por || ""; 
if($('sac-fecha-cierre')) $('sac-fecha-cierre').value = sac.fecha_cierre ? sac.fecha_cierre.split('T')[0] : ""; 
if($('sac-check-cerrar')) $('sac-check-cerrar').checked = es === 'Cerrada'; 

setDisplay('modal-sac', 'flex');
};

window.guardarSAC = async () => {
window.showLoading(); let pA = [], sA = []; 
$$('#tbody-plan-accion tr').forEach(tr => { let i = tr.querySelectorAll('input'); if(i[0].value.trim()) pA.push({detalle: i[0].value, resp: i[1].value, inicio: i[2].value, fin: i[3].value}); });
$$('#tbody-seguimiento tr').forEach(tr => { let i = tr.querySelectorAll('input'); if(i[0].value.trim()) sA.push({resultado: i[0].value, resp: i[1].value, fecha: i[2].value}); });

let es = "Abierta (En Plan)"; if($('sac-fecha-aprob-plan') && $('sac-fecha-aprob-plan').value) es = "En Seguimiento"; if($('sac-check-cerrar') && $('sac-check-cerrar').checked) es = "Cerrada";
let tipoDocAfectado = $('sac-tipo-doc-afectado') ? $('sac-tipo-doc-afectado').value : "";

let dt = { fecha_registro: $('sac-fecha')?$('sac-fecha').value:'', proceso: $('sac-proceso')?$('sac-proceso').value:'', tipo_doc_afectado: tipoDocAfectado, fuente_nc: $('sac-fuente')?$('sac-fuente').value:'', fuente_otro: $('sac-fuente-otro')?$('sac-fuente-otro').value:'', beneficio_esperado: $('sac-beneficio')?$('sac-beneficio').value:'', causa_raiz: $('sac-causa')?$('sac-causa').value:'', accion_implementar: $('sac-accion')?$('sac-accion').value:'', dueno_uid: $('sac-dueno')?$('sac-dueno').value:'', plan_accion: pA, fecha_aprobacion_plan: $('sac-fecha-aprob-plan')?$('sac-fecha-aprob-plan').value:'', seguimiento: sA, fecha_cierre: $('sac-fecha-cierre')?$('sac-fecha-cierre').value:'', cerrado_por: $('sac-check-cerrar')&&$('sac-check-cerrar').checked ? currentUser.nombre : "", estado: es };

try {
    if(!currentEditingSacId) {
        let nS = ""; 
        await runTransaction(db, async(t) => { 
            const sn = await t.get(doc(db,"artifacts",appId,"public","data","Contadores","sacs")); 
            let c = 1; if(sn.exists()) c = sn.data().count + 1; 
            t.set(doc(db,"artifacts",appId,"public","data","Contadores","sacs"), {count: c}); 
            nS = `SAC-${new Date().getFullYear()}-${String(c).padStart(3,'0')}`; 
        });
        dt.sac_num = nS; dt.audit_id = selectedAuditId || "N/A"; dt.f020_id = currentEditingF020Ref ? currentEditingF020Ref.id : "MANUAL"; dt.tipo_hallazgo = currentEditingF020Ref ? currentEditingF020Ref.nc : ($('sac-tipo')?$('sac-tipo').value:''); dt.detalle_nc = $('sac-detalle')?$('sac-detalle').value:''; dt.fecha_apertura = new Date().toISOString(); dt.auditor_nombre = currentUser.nombre;
        await addDoc(collection(db, "artifacts", appId, "public", "data", "AccionesCorrectivas"), dt); 
        alert(`SAC ${nS} Generada.`);
    } else { 
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "AccionesCorrectivas", currentEditingSacId), dt); 
        alert("SAC Actualizada."); 
    }
    setDisplay('modal-sac', 'none'); 
    if(selectedAuditId) window.verModalAuditoria(selectedAuditId);
} catch(e) {
    console.error(e);
    alert("Error al guardar SAC.");
} finally {
    window.hideLoading();
}
};

window.renderF023Global = () => {
const tb = $('tbody-noconf'); if(!tb) return; 
let hs = "", fs = [...globalAllSacs], sE = $('filter-noconf-estado'); 
if(sE && sE.value) fs = fs.filter(s => s.estado === sE.value);
if(!currentUser.permisos.admin && !currentUser.permisos.p_gest_sgc && !currentUser.permisos.p_audit_admin) fs = fs.filter(s => s.dueno_uid === currentUser.usuario || s.auditor_nombre === currentUser.nombre);
fs.sort((a,b) => b.sac_num > a.sac_num ? -1 : 1);
fs.forEach(s => {
    let es = String(s.estado || ''), bs = es.includes('Abierta') ? 'badge-danger' : (es === 'En Seguimiento' ? 'badge-warning' : 'badge-success'); 
    let uD = allUsers.find(u => u.usuario === s.dueno_uid);
    hs += `<tr><td><b>${s.sac_num}</b></td><td>${s.proceso}</td><td><b style="${s.tipo_hallazgo === 'NC Mayor' ? 'color:var(--danger)' : 'color:var(--warning)'}">${s.tipo_hallazgo}</b></td><td>${uD ? uD.nombre : s.dueno_uid}</td><td><div style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.detalle_nc}">${s.detalle_nc}</div></td><td>${window.formatearFechaAbreviada(s.fecha_registro || s.fecha_apertura)}</td><td><span class="badge ${bs}">${es}</span></td><td>${s.fecha_cierre ? window.formatearFechaAbreviada(s.fecha_cierre) : '-'}</td><td class="no-export"><button class="btn btn-primary" style="padding:4px;font-size:10px;" onclick="window.verSACGlobal('${s.sac_id}', '${s.audit_id || 'N/A'}')">Revisar</button></td></tr>`;
}); 
if($('tbody-noconf')) $('tbody-noconf').innerHTML = hs;
};

window.setFilterGestNC = () => window.renderF023Global();

window.verSACGlobal = async (sId, aId) => { 
selectedAuditData = null; selectedAuditId = null; 
if(aId && aId !== "N/A" && aId !== "undefined") { 
    try { 
        const sn = await getDoc(doc(db,"artifacts",appId,"public","data","Auditorias",aId)); 
        if(sn.exists()) { selectedAuditData = sn.data(); selectedAuditId = aId; } 
    } catch(e) {} 
} 
window.verSAC(sId); 
};

window.exportarExcelNoConf = () => {
if(globalAllSacs.length === 0) return alert("No hay registros SAC para exportar."); 
let dE = globalAllSacs.map(s => { 
    let u = allUsers.find(x => x.usuario === s.dueno_uid); 
    return { "N° SAC": s.sac_num, "Req": s.proceso, "Tipo Doc": s.tipo_doc_afectado || 'N/A', "Tipo": s.tipo_hallazgo, "Resp": u ? u.nombre : s.dueno_uid, "Detalle": s.detalle_nc, "Apertura": s.fecha_apertura ? new Date(s.fecha_apertura).toLocaleString() : '', "Causa": s.causa_raiz || '', "Acción": s.accion_implementar || '', "Estado": s.estado, "Cierre": s.fecha_cierre ? new Date(s.fecha_cierre).toLocaleString() : '', "Cerrado Por": s.cerrado_por || '' }; 
});
let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dE); XLSX.utils.book_append_sheet(wb, ws, "F-023"); XLSX.writeFile(wb, "F-023_Control_NC.xlsx");
};

// ==========================================
// FUNCIÓN DE DESCANSO VISUAL (MODO OSCURO)
// ==========================================
window.toggleDarkMode = () => {
    const body = document.body;
    body.classList.toggle('dark-theme');
    
    // Guardar preferencia para futuras sesiones
    const isDark = body.classList.contains('dark-theme');
    localStorage.setItem('sgc_dark_mode', isDark);
    
    // Actualizar el icono y texto del botón
    const icon = document.getElementById('dark-mode-icon');
    const text = document.getElementById('dark-mode-text');
    if (icon && text) {
        icon.innerText = isDark ? 'light_mode' : 'dark_mode';
        text.innerText = isDark ? 'Claro' : 'Descanso';
    }
};
// ==========================================


const inicializarApp = async () => {
window.hideLoading(); const su = localStorage.getItem('sgc_session_user');
if (su) {
    window.showLoading();
    try { 
        const qs = await getDocs(query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("usuario", "==", su)));
        if (!qs.empty) { currentUser = qs.docs[0].data(); window.completarLoginUI(); } else window.logout();
    } catch(e) { window.logout(); } 
    window.hideLoading();
} else { setDisplay('login-screen', 'flex'); }
};

document.addEventListener("DOMContentLoaded", inicializarApp);
