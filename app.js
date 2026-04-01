import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, setDoc, query, where, getDocs, arrayUnion, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyDdzCiachuhbE9jATz-TesPI2vUVIJrHjM", authDomain: "sistemadegestion-7400d.firebaseapp.com", projectId: "sistemadegestion-7400d", storageBucket: "sistemadegestion-7400d.firebasestorage.app", messagingSenderId: "709030283072", appId: "1:709030283072:web:5997837b36a448e9515ca5" };
const app = initializeApp(firebaseConfig); 
const auth = getAuth(app); 
const db = getFirestore(app); 
const appId = 'sgc-final-v6';

const EMAIL_SERVICE_ID = "service_vumxptj"; 
const EMAIL_TEMPLATE_ID = "template_z27y5yk"; 
const EMAIL_PUBLIC_KEY = "kWsovOfdi7dBqLMw2"; 
const EMAIL_ADMIN_SGC = "sistemadegestion@fcipty.com"; 

(function() { emailjs.init(EMAIL_PUBLIC_KEY); })();

const CLOUD_NAME = "df79cjklp"; 
const UPLOAD_PRESET = "fci_documentos"; 
const PASOS_NOMBRES = ["Pendiente Documentado", "Pendiente Verificado", "Pendiente Aprobación Gerencia", "Pendiente Aprobación SGC"];

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const setDisplay = (id, val) => { const el = $(id); if (el) el.style.display = val; };

let currentUser = null, selectedId = null, selectedDocData = null, tempAction = "";
let allUsers = [], allDepartamentos = [], tiposDocumento = [], columnasMaestro = [], estatusMaestro = [], dataMaestro = [], editandoMaestroId = null;
let globalSolicitudes = [], globalAuditPlan = null, globalAllAuditorias = [], globalAuditorias = [], selectedAuditId = null, selectedAuditData = null, editandoAuditoriaId = null;
let currentAuditF020 = [], globalAllSacs = [], currentEditingSacId = null, currentEditingF020Ref = null;
let requisitosOEA = []; let manualOEA = { url: "", nombre: "" };

window.abrirDocumento = async (url, nombreOriginal) => {
  if (!url || url === "#") return;
  let safeName = nombreOriginal ? nombreOriginal.replace(/[^a-zA-Z0-9.\-_ ]/g, '_') : 'Documento';
  if (!safeName.includes('.')) { let extMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/); if(extMatch) safeName += "." + extMatch[1]; }
  let isViewable = url.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif)(\?|$)/);
  if (isViewable) {
    const nuevaPestana = window.open('', '_blank');
    if (!nuevaPestana) return alert("Bloqueado por el navegador. Permite las ventanas emergentes.");
    nuevaPestana.document.write(`<html style="font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; background:#f8fafc; color:#1e40af;"><head><title>Cargando: ${safeName}</title></head><body><h2>Preparando documento...</h2></body></html>`);
    try {
      const response = await fetch(url); if (!response.ok) throw new Error("Archivo borrado");
      const blob = await response.blob(); const fileObj = new File([blob], safeName, { type: blob.type });
      const blobUrl = window.URL.createObjectURL(fileObj); nuevaPestana.location.href = blobUrl; setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) { nuevaPestana.close(); alert("⚠️ El archivo ya no se encuentra disponible."); }
  } else {
    window.showLoading();
    try {
      const response = await fetch(url); if (!response.ok) throw new Error("Archivo borrado");
      const blob = await response.blob(); const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.style.display = 'none'; a.href = blobUrl; a.download = safeName; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(blobUrl); document.body.removeChild(a);
    } catch (e) { alert("⚠️ El archivo ya no se encuentra disponible."); }
    window.hideLoading();
  }
};

window.showLoading = () => setDisplay('loading-overlay', 'flex');
window.hideLoading = () => setDisplay('loading-overlay', 'none');

window.cambiarVista = (id, btn) => {
  $$('.section').forEach(s => s.classList.remove('active')); $$('.nav-link').forEach(l => l.classList.remove('active'));
  const section = $(id); if(section) section.classList.add('active'); if(btn) btn.classList.add('active');
  if(window.innerWidth <= 768) { const sidebar = $('sidebar'); if(sidebar) sidebar.classList.remove('open'); const overlay = $('sidebar-overlay'); if(overlay) overlay.classList.remove('active'); }
};

window.toggleMenu = () => { $('sidebar').classList.toggle('open'); $('sidebar-overlay').classList.toggle('active'); };
window.toggleModPanel = v => setDisplay('panel-mod', v === 'Creación' ? 'none' : 'grid');
window.closeModal = () => setDisplay('modal', 'none');
window.cerrarModalAuditoria = () => setDisplay('modal-auditoria', 'none');
window.abrirModalUsuario = () => { window.resetUserForm(); setDisplay('modal-usuario', 'flex'); };
window.cerrarModalUsuario = () => { setDisplay('modal-usuario', 'none'); };

window.del = async (c, id) => { if(confirm("¿Eliminar este registro?")) { window.showLoading(); await deleteDoc(doc(db, "artifacts", appId, "public", "data", c, id)); window.hideLoading(); } };
window.getDownloadUrl = (url) => url ? url : "#";
window.formatearFechaAbreviada = (fechaISO) => { if (!fechaISO) return ''; let f = fechaISO; if(f.length === 10) f += 'T12:00:00'; const fecha = new Date(f); if (isNaN(fecha)) return fechaISO; const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]; return `${fecha.getDate()}-${meses[fecha.getMonth()]}-${fecha.getFullYear()}`; };
window.getGCalFormat = (fechaStr, horaStr) => { let d = new Date(`${fechaStr}T${horaStr}:00`); return d.toISOString().replace(/-|:|\.\d+/g, ''); };
window.sendNotification = (destinatarios, subject, message) => { if (!destinatarios.to && !destinatarios.cc) return; const templateParams = { to_email: destinatarios.to, cc_email: destinatarios.cc || "", subject: subject, message: message }; emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, templateParams).catch((error) => console.error('Error notificando', error)); };

window.getDatosEnvio = async (solicitudData) => {
  let managerEmail = "";
  if(solicitudData.gerencia) { try { const q = query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("gerencias", "array-contains", solicitudData.gerencia), where("permisos.p_ger_apr", "==", true)); const snap = await getDocs(q); if(!snap.empty) managerEmail = snap.docs[0].data().email || ""; } catch(e) {} }
  const toEmails = new Set([EMAIL_ADMIN_SGC, solicitudData.solicitante_email]); if(solicitudData.involucrados) { solicitudData.involucrados.forEach(e => toEmails.add(e)); }
  return { to: Array.from(toEmails).join(','), cc: managerEmail };
};

window.uploadToCloudinary = async (file) => { const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET); try { const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: formData }); const data = await response.json(); return data.secure_url; } catch (error) { return null; } };
window.getNextFCI = async () => { const ref = doc(db, "artifacts", appId, "public", "data", "Contadores", "solicitudes"); let id = ""; await runTransaction(db, async (t) => { const snap = await t.get(ref); let count = 1; if (snap.exists()) count = snap.data().count + 1; t.set(ref, { count }); id = `FCI-SOL-${String(count).padStart(4, '0')}`; }); return id; };

window.checkDailyAlerts = async () => {
  if(!currentUser || (!currentUser.permisos.p_gest_sgc && !currentUser.permisos.admin)) return;
  const ref = doc(db, "artifacts", appId, "public", "data", "Configuracion", "EstadoAlertas"); const snap = await getDoc(ref); const today = new Date().toISOString().split('T')[0];
  if(!snap.exists() || snap.data().ultimaAlerta !== today) {
    let pendientes = globalSolicitudes.filter(s => { let est = (s.estado || "").toUpperCase(); return !est.includes('APROBADO FINAL') && est !== 'ANULADO' && est !== 'RECHAZADO'; });
    if(pendientes.length > 0) { window.sendNotification({to: EMAIL_ADMIN_SGC, cc: ""}, "🔔 Alerta Diaria SGC: Solicitudes Pendientes", `Hola Equipo SGC.\n\nHay ${pendientes.length} solicitudes pendientes.`); if(!snap.exists()) { await setDoc(ref, { ultimaAlerta: today }); } else { await updateDoc(ref, { ultimaAlerta: today }); } }
  }
};

window.verificarAlertasAuditoria = (auditoriasArray) => {
  if(!globalAuditPlan || !globalAuditPlan.correos || globalAuditPlan.correos.length === 0) return;
  const today = new Date(); today.setHours(0,0,0,0);
  auditoriasArray.forEach(a => {
    if(a.estado === "Completada" || !a.fecha) return; let f = a.fecha; if(f.length === 10) f += 'T12:00:00'; const auditDate = new Date(f); auditDate.setHours(0,0,0,0);
    const diffTime = auditDate - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); let asunto = "";
    if(diffDays === 30) asunto = "🚨 Recordatorio: 1 Mes para Auditoría";
    if(diffDays === 14) asunto = "⚠️ Recordatorio Urgente: 2 Semanas para Auditoría";
    if(asunto) { window.sendNotification({to: globalAuditPlan.correos.join(',')}, asunto, `Se aproxima auditoría el ${window.formatearFechaAbreviada(a.fecha)} en ${a.lugar}.\n\nRequisitos: ${a.requisitos}\nAuditados: ${a.auditado}\nAuditores: ${a.auditor}.`); }
  });
};

window.cargarDatosCentrales = () => {
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "Usuarios"), (snap) => {
    allUsers = []; let htmlUsers = ""; let cbUsers = ""; let optUsers = ""; let optInvolucrados = '<option value="">-- Seleccionar --</option>';
    snap.forEach(doc => { 
      let u = doc.data(); allUsers.push(u); let gers = u.gerencias ? u.gerencias.join(', ') : (u.gerencia || 'N/A');
      htmlUsers += `<tr><td>${u.nombre} (${u.usuario})</td><td>${u.email||''}</td><td>${u.role||''} / <small>${gers}</small></td><td class="no-export"><button class="btn btn-info" style="padding:4px 8px; font-size:10px;" onclick="window.cargarUsuarioParaEditar('${u.usuario}')">Editar</button></td></tr>`;
      cbUsers += `<label style="display:flex; align-items:center; justify-content:flex-start; gap:8px; font-size:13px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" value="${u.nombre}" data-email="${u.email}" style="margin:0; width:auto; flex-shrink:0;"> ${u.nombre} (${gers})</label>`;
      optUsers += `<option value="${u.nombre}" data-email="${u.email}">${u.nombre} (${gers})</option>`;
      if(u.email) { optInvolucrados += `<option value="${u.email}">${u.nombre} (${gers})</option>`; }
    });
    if ($('tbody-users')) $('tbody-users').innerHTML = htmlUsers;
    if ($('aud-auditado-list')) $('aud-auditado-list').innerHTML = cbUsers;
    if ($('aud-auditor-list')) $('aud-auditor-list').innerHTML = cbUsers;
    if ($('aud-formacion-list')) $('aud-formacion-list').innerHTML = cbUsers;
    if ($('ah-auditor-list')) $('ah-auditor-list').innerHTML = cbUsers;
    if ($('ah-lider')) $('ah-lider').innerHTML = '<option value="">-- Seleccione Auditor Líder --</option>' + optUsers;
    if ($('sol-involucrado-sel')) $('sol-involucrado-sel').innerHTML = optInvolucrados;
    if ($('m-new-involucrado-sel')) $('m-new-involucrado-sel').innerHTML = optInvolucrados;
  });

  onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), (docSnap) => {
    if(docSnap.exists()) { const d = docSnap.data(); requisitosOEA = d.requisitos || []; manualOEA = { url: d.manual_url || "", nombre: d.manual_nombre || "" }; } else { requisitosOEA = []; manualOEA = { url: "", nombre: "" }; } window.renderNormaOEA();
  });

  onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), (docSnap) => {
    if(docSnap.exists()) { const d = docSnap.data(); tiposDocumento = d.tiposDoc || []; columnasMaestro = d.columnas || []; estatusMaestro = d.estatus || []; window.renderListasConfig(); }
  });

  onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"), (docSnap) => {
    let deps = []; let gers = [];
    if(docSnap.exists()) { const d = docSnap.data(); deps = d.departamentos || []; gers = d.gerencias || []; }
    allDepartamentos = deps; let gHtml = ""; gers.forEach(g => gHtml += `<option value="${g}">${g}</option>`);
    if($('d-ger-sel')) $('d-ger-sel').innerHTML = gHtml; if($('sol-ger')) $('sol-ger').innerHTML = '<option value="">-- Seleccionar --</option>' + gHtml;
    if($('list-ger')) $('list-ger').innerHTML = gers.map((g, idx) => `<div class="settings-item"><span>${g}</span><button class="btn-icon-danger" onclick="window.eliminarGerencia(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join('');
    if($('list-dep')) $('list-dep').innerHTML = deps.map((dep, idx) => `<div class="settings-item"><span>${dep.nombre} <small>(${dep.gerencia})</small></span><button class="btn-icon-danger" onclick="window.eliminarDepartamento(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join('');
    if($('u-ger-list')) $('u-ger-list').innerHTML = gers.map(g => `<label style="display:flex; align-items:center; justify-content:flex-start; gap:8px; font-size:13px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" value="${g}" style="margin:0; width:auto;"> ${g}</label>`).join('');
  });

  onSnapshot(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), (snap) => { dataMaestro = []; snap.forEach(doc => { let d = doc.data(); d.docId = doc.id; dataMaestro.push(d); }); window.renderTablaMaestro(); });
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), (snap) => { globalSolicitudes = []; snap.forEach(doc => { let d = doc.data(); d.docId = doc.id; globalSolicitudes.push(d); }); window.renderTablasSolicitudes(); window.checkDailyAlerts(); });
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "Auditorias"), (snap) => {
    globalAllAuditorias = []; snap.forEach(doc => { let d = doc.data(); d.id = doc.id; globalAllAuditorias.push(d); });
    let currentYear = new Date().getFullYear().toString(); let yearSelect = $('aud-year-select');
    if(yearSelect && yearSelect.options.length === 0) { yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option><option value="nuevo">+ Añadir Año</option>`; }
    window.loadAuditPlan(yearSelect ? yearSelect.value : currentYear); window.renderTablaAuditorias(yearSelect ? yearSelect.value : currentYear);
  });
  onSnapshot(collection(db, "artifacts", appId, "public", "data", "AccionesCorrectivas"), (snap) => { globalAllSacs = []; snap.forEach(doc => { let d = doc.data(); d.sac_id = doc.id; globalAllSacs.push(d); }); window.renderF023Global(); });
};

window.renderDashTable = (t) => {
  setDisplay('dash-table-container', 'block'); let d = globalSolicitudes;
  if(t==='pendientes') d = d.filter(s=>!s.estado.includes('Aprobado Final')&&s.estado!=='Anulado'&&s.estado!=='Rechazado'); else d = d.filter(s=>s.estado.includes('Aprobado Final')||s.estado==='Anulado'||s.estado==='Rechazado');
  d.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)); let h="";
  d.forEach(s=>{ let bc=s.estado.includes('Aprobado')?'badge-success':(s.estado==='Anulado'||s.estado==='Rechazado'?'badge-danger':'badge-warning'); h+=`<tr><td><b>${s.customId}</b></td><td>${s.solicitante}</td><td>${s.titulo}</td><td><span class="badge ${bc}">${s.estado}</span></td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Detalle</button></td></tr>`; });
  if($('tbody-dash')) $('tbody-dash').innerHTML = h || "<tr><td colspan='5' style='text-align:center;'>No hay registros</td></tr>";
};

window.renderTablasSolicitudes = () => {
  let htmlHist = "", htmlAll = "", htmlGest = "";
  let sorted = [...globalSolicitudes].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  sorted.forEach(s => {
    let estadoStr = s.estado || "Pendiente"; let isCancelado = estadoStr === 'Anulado' || estadoStr === 'Rechazado'; let isAprobado = estadoStr.includes('Aprobado Final');
    let badgeClass = isAprobado ? 'badge-success' : (isCancelado ? 'badge-danger' : 'badge-warning');
    let pStr = s.prioridad || "Normal"; let bPr = pStr === 'Alta' ? 'badge-danger' : (pStr === 'Básica' ? 'badge-info' : 'badge-dark');
    let etapa = PASOS_NOMBRES[s.idx] || '';

    let isMine = (s.uid === currentUser.usuario) || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase()));
    
    if(isMine) { htmlHist += `<tr><td><b>${s.customId}</b><br><small style="color:#94a3b8">${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}</td><td>${s.titulo}<br><span class="badge ${bPr}">${pStr}</span></td><td><span class="badge ${badgeClass}">${estadoStr}</span></td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Ver / Gestionar</button></td></tr>`; }
    htmlAll += `<tr><td><b>${s.customId}</b><br><small style="color:#94a3b8">${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}<br><small>${s.gerencia}</small></td><td>${s.titulo}</td><td><span class="badge ${bPr}">${pStr}</span></td><td><span class="badge ${badgeClass}">${estadoStr}</span><br><small>${etapa}</small></td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Ver Detalle</button></td></tr>`;

    let activo = !isAprobado && !isCancelado;
    let esAdminSGC = currentUser.permisos.admin || currentUser.permisos.p_gest_sgc;
    let puedeGestionarSGC = activo && ((s.idx === 0 && (esAdminSGC || currentUser.permisos.p_paso1)) || (s.idx === 1 && (esAdminSGC || currentUser.permisos.p_paso2)) || (s.idx === 3 && (esAdminSGC || currentUser.permisos.p_paso4)));
    let puedeGestionarGerente = activo && s.idx === 2 && currentUser.permisos.p_ger_apr && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia);

    if(puedeGestionarSGC || puedeGestionarGerente) {
      htmlGest += `<tr><td><b>${s.customId}</b><br><small style="color:#94a3b8">${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}<br><small>${s.gerencia}</small></td><td>${s.titulo}<br><span class="badge ${bPr}">${pStr}</span></td><td><span class="badge badge-info">${etapa}</span></td><td class="no-export"><button class="btn btn-warning" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Revisar / Firmar</button></td></tr>`;
    }
  });

  if($('tbody-historial')) $('tbody-historial').innerHTML = htmlHist;
  if($('tbody-all')) $('tbody-all').innerHTML = htmlAll;
  if($('tbody-gestionar')) $('tbody-gestionar').innerHTML = htmlGest;

  if($('dash-mis-tot')) {
    let misSol = sorted.filter(s => s.uid === currentUser.usuario || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase())));
    $('dash-mis-tot').innerText = misSol.length;
    $('dash-mis-pend').innerText = misSol.filter(s => !(s.estado||"").includes('Aprobado Final') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length;
    $('dash-mis-ok').innerText = misSol.filter(s => (s.estado||"").includes('Aprobado Final')).length;
    $('dash-mis-rech').innerText = misSol.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length;
  }
  
  if($('dash-glob-tot') && currentUser.permisos && (currentUser.permisos.admin || currentUser.permisos.p_gest_sgc)) {
    setDisplay('dash-admin-section', 'block'); 
    $('dash-glob-tot').innerText = sorted.length;
    $('dash-glob-pend').innerText = sorted.filter(s => !(s.estado||"").includes('Aprobado Final') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length;
    $('dash-glob-ok').innerText = sorted.filter(s => (s.estado||"").includes('Aprobado Final')).length;
    $('dash-glob-rech').innerText = sorted.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length;
  }
};

window.completarLoginUI = () => {
  setDisplay('login-screen', 'none'); setDisplay('sidebar', 'flex'); setDisplay('main', 'block');
  
  if($('curr-name')) $('curr-name').innerText = currentUser.nombre || 'Usuario';
  if($('curr-ger')) $('curr-ger').innerText = currentUser.gerencias ? currentUser.gerencias.join(', ') : (currentUser.gerencia || 'Sin Gerencia');

  const p = currentUser.permisos || {}; const isAdm = p.admin || false;
  
  const canDash = isAdm || p.p_gest_sgc || p.p_paso1 || p.p_paso2 || p.p_paso4;
  setDisplay('nav-dash', canDash ? 'flex' : 'none');
  setDisplay('nav-hist', (p.p_ver_propias || isAdm) ? 'flex' : 'none'); 
  setDisplay('nav-all', (p.p_ver_todas || p.p_ver_ger || isAdm) ? 'flex' : 'none'); 
  setDisplay('nav-crear', (p.can_solicit || isAdm) ? 'flex' : 'none'); 
  setDisplay('nav-gest', (p.p_gest_sgc || p.p_ger_apr || p.p_paso1 || p.p_paso2 || p.p_paso4 || isAdm) ? 'flex' : 'none'); 
  setDisplay('nav-listado', (p.p_ver_listado || isAdm) ? 'flex' : 'none');
  
  const canAud = p.p_audit_ver || p.p_audit_admin || p.p_audit_auditor || p.p_audit_dueno || isAdm; 
  setDisplay('nav-audit-group', canAud ? 'block' : 'none'); 
  setDisplay('nav-norma', canAud ? 'flex' : 'none'); 
  setDisplay('nav-audit', canAud ? 'flex' : 'none'); 
  setDisplay('nav-noconf', (p.p_audit_admin || p.p_gest_sgc || p.p_audit_auditor || p.p_audit_dueno || isAdm) ? 'flex' : 'none');
  
  const canRoot = p.p_users || p.p_struct || isAdm; 
  setDisplay('admin-only', canRoot ? 'block' : 'none'); 
  setDisplay('nav-users', (p.p_users || isAdm) ? 'flex' : 'none'); 
  setDisplay('nav-struct', (p.p_struct || isAdm) ? 'flex' : 'none');
  
  let isAdAud = p.p_audit_admin || p.p_gest_sgc || isAdm;
  setDisplay('btn-config-plan', isAdAud ? 'inline-flex' : 'none'); 
  setDisplay('btn-nueva-aud', isAdAud ? 'inline-flex' : 'none');
  
  window.cargarDatosCentrales();
  
  if (p.p_gest_sgc || isAdm) window.cambiarVista('sec-all', $('nav-all')); 
  else if (p.can_solicit) window.cambiarVista('sec-crear', $('nav-crear')); 
  else if (p.p_ver_propias) window.cambiarVista('sec-hist', $('nav-hist')); 
  else if (canDash) window.cambiarVista('sec-dash', $('nav-dash'));
  else if (canAud) window.cambiarVista('sec-audit', $('nav-audit'));
};

window.logout = () => {
  localStorage.removeItem('sgc_session_user'); currentUser = null;
  setDisplay('sidebar', 'none'); setDisplay('main', 'none'); setDisplay('login-screen', 'flex');
  if($('login-user')) $('login-user').value = '';
  if($('login-pass')) $('login-pass').value = '';
};

window.iniciarSesion = async () => {
  const u = $('login-user').value.toLowerCase().trim(); const p = $('login-pass').value.trim();
  if (!u || !p) { alert("Por favor, ingresa tu usuario y contraseña."); return; }
  window.showLoading();
  try {
    if(u === 'admin' && p === '1130') {
      const adminRef = doc(db, "artifacts", appId, "public", "data", "Usuarios", "admin"); const snapAdmin = await getDoc(adminRef);
      if(!snapAdmin.exists()) {
        await setDoc(adminRef, {
          nombre: "Admin Maestro", usuario: "admin", pass: "1130", gerencias: ["SGC"], gerencia: "SGC", email: EMAIL_ADMIN_SGC,
          permisos: { can_solicit:true, p_gest_sgc:true, p_ger_apr:true, p_ver_propias:true, p_ver_ger:true, p_ver_all:true, p_ver_todas:true, p_users:true, p_struct:true, p_ver_listado:true, p_audit_admin:true, p_audit_ver:true, admin:true, p_paso1:true, p_paso2:true, p_paso4:true }
        });
      }
    }
    const q = query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("usuario", "==", u), where("pass", "==", p));
    const querySnapshot = await getDocs(q);
    if(!querySnapshot.empty) { localStorage.setItem('sgc_session_user', u); currentUser = querySnapshot.docs[0].data(); window.completarLoginUI(); } 
    else { alert("Credenciales incorrectas."); }
  } catch (error) { alert("Error al conectar con la base de datos."); } finally { window.hideLoading(); }
};

window.cargarUsuarioParaEditar = (usuarioId) => {
  const u = allUsers.find(x => x.usuario === usuarioId); if(!u) return;
  if($('user-form-title')) $('user-form-title').innerHTML = `<span class="material-icons-round">edit</span> Editando Usuario: ${u.usuario}`;
  
  if($('u-nom')) $('u-nom').value = u.nombre || ''; 
  if($('u-usr')) { $('u-usr').value = u.usuario || ''; $('u-usr').disabled = true; }
  if($('u-pas')) $('u-pas').value = u.pass || ''; 
  if($('u-rol')) $('u-rol').value = u.role || ''; 
  if($('u-email')) $('u-email').value = u.email || '';
  
  let gers = u.gerencias || []; if(!u.gerencias && u.gerencia) gers = [u.gerencia];
  $$('#u-ger-list input[type="checkbox"]').forEach(cb => { cb.checked = gers.includes(cb.value); });
  
  const p = u.permisos || {};
  ['p-solicitar','p-ver-propias','p-ver-ger','p-ver-todas','p-paso1','p-paso2','p-paso4','p-gest-sgc','p-ger-apr','p-users','p-struct','p-ver-listado','p-audit-ver','p-audit-admin','p-audit-auditor','p-audit-dueno'].forEach(i => { let k = i.replace(/-/g,'_'); if(k==='p_solicitar')k='can_solicit'; if($(i)) $(i).checked = p[k]||false; });
  if($('p-admin')) $('p-admin').checked = p.admin||false; 
  
  if($('btnSaveUser')) $('btnSaveUser').innerText = "ACTUALIZAR USUARIO"; 
  setDisplay('modal-usuario', 'flex');
};

window.resetUserForm = () => {
  if($('user-form-title')) $('user-form-title').innerHTML = `<span class="material-icons-round">person_add</span> Registrar / Editar Usuario`;
  
  if($('u-nom')) $('u-nom').value = ""; 
  if($('u-usr')) { $('u-usr').value = ""; $('u-usr').disabled = false; }
  if($('u-pas')) $('u-pas').value = "123"; 
  if($('u-rol')) $('u-rol').value = ""; 
  if($('u-email')) $('u-email').value = "";
  
  $$('#u-ger-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  ['p-solicitar','p-ver-propias','p-ver-ger','p-ver-todas','p-paso1','p-paso2','p-paso4','p-gest-sgc','p-ger-apr','p-users','p-struct','p-ver-listado','p-audit-ver','p-audit-admin','p-audit-auditor','p-audit-dueno','p-admin'].forEach(i => { if($(i)) $(i).checked=false; });
  
  if($('btnSaveUser')) $('btnSaveUser').innerText = "GUARDAR USUARIO"; 
};

window.guardarUsuario = async () => {
  const nom = $('u-nom').value.trim(); const usr = $('u-usr').value.toLowerCase().trim(); const pas = $('u-pas').value.trim(); const rol = $('u-rol').value.trim(); const email = $('u-email').value.trim().toLowerCase();
  const gerenciasSel = []; $$('#u-ger-list input:checked').forEach(cb => { gerenciasSel.push(cb.value); });
  
  if(!nom || !usr || !pas || gerenciasSel.length === 0) return alert("Nombre, Usuario, Contraseña y al menos 1 Gerencia son obligatorios.");
  const permisos = { can_solicit: $('p-solicitar').checked, p_ver_propias: $('p-ver-propias').checked, p_ver_ger: $('p-ver-ger').checked, p_ver_todas: $('p-ver-todas').checked, p_paso1: $('p-paso1').checked, p_paso2: $('p-paso2').checked, p_paso4: $('p-paso4').checked, p_gest_sgc: $('p-gest-sgc').checked, p_ger_apr: $('p-ger-apr').checked, p_users: $('p-users').checked, p_struct: $('p-struct').checked, p_ver_listado: $('p-ver-listado').checked, p_audit_ver: $('p-audit-ver').checked, p_audit_admin: $('p-audit-admin').checked, p_audit_auditor: $('p-audit-auditor').checked, p_audit_dueno: $('p-audit-dueno').checked, admin: $('p-admin').checked };
  
  window.showLoading();
  const docRef = doc(db, "artifacts", appId, "public", "data", "Usuarios", usr); const snap = await getDoc(docRef);
  if(snap.exists() && $('user-form-title').innerText.includes("Registrar")) { window.hideLoading(); return alert("Ese ID de usuario ya existe."); }
  
  await setDoc(docRef, { nombre: nom, usuario: usr, pass: pas, gerencias: gerenciasSel, gerencia: gerenciasSel[0], role: rol, email: email, permisos: permisos });
  window.cerrarModalUsuario(); window.hideLoading(); alert("Usuario guardado exitosamente.");
};

window.exportarExcelUsuarios = () => {
  if(allUsers.length === 0) return;
  let dataExport = allUsers.map(u => { return { "Nombre": u.nombre, "Usuario ID": u.usuario, "Email": u.email || '', "Rol": u.role || '', "Gerencias": u.gerencias ? u.gerencias.join(', ') : (u.gerencia || ''), "Permiso Admin": u.permisos.admin ? 'Sí' : 'No', "Permiso Gestor SGC": u.permisos.p_gest_sgc ? 'Sí' : 'No', "Permiso Auditor": u.permisos.p_audit_auditor ? 'Sí' : 'No' }; });
  let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "Usuarios_Registrados"); XLSX.writeFile(wb, "Reporte_Usuarios_SGC.xlsx");
};

window.agregarGerencia = async () => { let val = $('g-nom').value.trim().toUpperCase(); if(!val) return; window.showLoading(); let gers = []; const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); if(snap.exists() && snap.data().gerencias) gers = snap.data().gerencias; if(gers.includes(val)) { window.hideLoading(); return alert("Esa Gerencia ya existe."); } gers.push(val); await setDoc(docRef, { gerencias: gers }, {merge: true}); $('g-nom').value = ""; window.hideLoading(); };
window.eliminarGerencia = async (idx) => { if(!confirm("¿Eliminar Gerencia?")) return; window.showLoading(); const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); let gers = snap.data().gerencias; gers.splice(idx, 1); await setDoc(docRef, { gerencias: gers }, {merge: true}); window.hideLoading(); };
window.agregarDepartamento = async () => { let ger = $('d-ger-sel').value; let nom = $('d-nom').value.trim(); if(!ger || !nom) return alert("Seleccione una Gerencia y escriba el nombre del Depto."); window.showLoading(); let deps = []; const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); if(snap.exists() && snap.data().departamentos) deps = snap.data().departamentos; deps.push({ nombre: nom, gerencia: ger }); await setDoc(docRef, { departamentos: deps }, {merge: true}); $('d-nom').value = ""; window.hideLoading(); };
window.eliminarDepartamento = async (idx) => { if(!confirm("¿Eliminar Departamento?")) return; window.showLoading(); const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef); let deps = snap.data().departamentos; deps.splice(idx, 1); await setDoc(docRef, { departamentos: deps }, {merge: true}); window.hideLoading(); };

window.actualizarSelectTiposDoc = () => {
  let html = '<option value="">-- Seleccione --</option>'; tiposDocumento.forEach(t => html += `<option value="${t}">${t}</option>`);
  if($('sol-tipo-doc')) $('sol-tipo-doc').innerHTML = html;
  if($('sac-tipo-doc-afectado')) $('sac-tipo-doc-afectado').innerHTML = '<option value="">-- No aplica / Ninguno --</option>' + tiposDocumento.map(t => `<option value="${t}">${t}</option>`).join('');
};

window.renderListasConfig = () => {
  let hCol = ""; columnasMaestro.forEach((c, idx) => { let cName = typeof c === 'string' ? c : c.nombre; let cType = typeof c === 'string' ? 'text' : c.tipo; hCol += `<div class="settings-item"><span>${cName} <small style="color:#94a3b8; font-size:10px;">(${cType})</small></span><button class="btn-icon-danger" onclick="window.eliminarColumna(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); if($('list-columnas')) $('list-columnas').innerHTML = hCol;
  let hEst = ""; estatusMaestro.forEach((e, idx) => { hEst += `<div class="settings-item"><span>${e}</span><button class="btn-icon-danger" onclick="window.eliminarEstatus(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); if($('list-estatus')) $('list-estatus').innerHTML = hEst;
  let hTipos = ""; tiposDocumento.forEach((t, idx) => { hTipos += `<div class="settings-item"><span>${t}</span><button class="btn-icon-danger" onclick="window.eliminarTipoDoc(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); if($('list-tipos-doc')) $('list-tipos-doc').innerHTML = hTipos;
  window.actualizarSelectTiposDoc();
};

window.agregarTipoDoc = async () => { let val = $('doc-tipo-nom').value.trim(); if(!val) return; if(tiposDocumento.includes(val)) return alert("Ya existe."); tiposDocumento.push(val); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true}); $('doc-tipo-nom').value = ""; };
window.eliminarTipoDoc = async (idx) => { if(!confirm("¿Eliminar?")) return; tiposDocumento.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true}); };
window.agregarColumna = async () => { let val = $('col-nom').value.trim(); let tipo = $('col-tipo').value; if(!val) return; if (columnasMaestro.some(c => (typeof c === 'string' ? c : c.nombre) === val)) return alert("Ya existe."); columnasMaestro.push({nombre: val, tipo: tipo}); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true}); $('col-nom').value = ""; };
window.eliminarColumna = async (idx) => { if(!confirm("¿Eliminar columna?")) return; columnasMaestro.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true}); };
window.agregarEstatus = async () => { let val = $('est-nom').value.trim(); if(!val) return; if (estatusMaestro.includes(val)) return alert("Ya existe."); estatusMaestro.push(val); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true}); $('est-nom').value = ""; };
window.eliminarEstatus = async (idx) => { if(!confirm("¿Eliminar?")) return; estatusMaestro.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true}); };

window.renderNormaOEA = () => {
  const p = currentUser ? currentUser.permisos || {} : {}; let isAdminAudit = p.admin || p.p_audit_admin || p.p_gest_sgc;
  const linkCont = $('oea-manual-link');
  if(linkCont) { if(manualOEA.url) { linkCont.innerHTML = `<a href="#" onclick="window.abrirDocumento('${manualOEA.url}', '${manualOEA.nombre}'); return false;" class="btn btn-info" style="font-size:14px; text-decoration:none;"><span class="material-icons-round" style="font-size:16px; margin-right:5px;">visibility</span> Ver ${manualOEA.nombre}</a>`; } else { linkCont.innerHTML = "No hay manual subido actualmente."; } }
  setDisplay('oea-manual-upload-box', isAdminAudit ? 'flex' : 'none'); setDisplay('oea-req-upload-box', isAdminAudit ? 'flex' : 'none');
  const listCont = $('oea-req-list-container'); if(listCont) listCont.innerHTML = requisitosOEA.map((r, idx) => `<div class="settings-item"><span>${r}</span>${isAdminAudit ? `<button class="btn-icon-danger" onclick="window.eliminarRequisitoOEA(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button>` : ''}</div>`).join('');
  const reqList = $('aud-req-list'); if(reqList) reqList.innerHTML = requisitosOEA.map(r => `<label style="display:flex; align-items:center; justify-content:flex-start; gap:8px; font-size:13px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" value="${r}" style="margin:0; width:auto; flex-shrink:0;"> ${r}</label>`).join('');
  const dl = $('oea-req-list-dl'); if(dl) dl.innerHTML = requisitosOEA.map(r => `<option value="${r}">`).join('');
};

window.subirManualOEA = async () => { const f = $('oea-file').files[0]; if(!f) return alert("Selecciona el documento."); window.showLoading(); let url = await window.uploadToCloudinary(f); if(!url) { window.hideLoading(); return alert("Error al subir."); } await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { manual_url: url, manual_nombre: f.name }, {merge: true}); $('oea-file').value = ""; window.hideLoading(); alert("Manual Oficial actualizado."); };
window.agregarRequisitoOEA = async () => { const v = $('oea-req-input').value.trim(); if(!v) return; if(requisitosOEA.includes(v)) return alert("Ese requisito ya está en la lista."); requisitosOEA.push(v); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { requisitos: requisitosOEA }, {merge: true}); $('oea-req-input').value = ""; };
window.eliminarRequisitoOEA = async (idx) => { if(!confirm("¿Eliminar este requisito?")) return; requisitosOEA.splice(idx, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { requisitos: requisitosOEA }, {merge: true}); };

window.renderTablaMaestro = () => {
  const thead = $('thead-listado-maestro'); const tbody = $('tbody-listado-maestro'); if(!thead || !tbody) return;
  let headHTML = "<tr>"; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; headHTML += `<th>${cName}</th>`; }); 
  if(currentUser && currentUser.permisos && (currentUser.permisos.p_gest_sgc || currentUser.permisos.admin)) { headHTML += `<th class="no-export">Acción</th>`; } headHTML += "</tr>"; thead.innerHTML = headHTML;
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
  tbody.innerHTML = tbodyHtml;
};

window.abrirModalListadoMaestro = (docId = null) => {
  editandoMaestroId = docId; const titleEl = $('lm-modal-title'); if (titleEl) titleEl.innerText = docId ? "Editar Documento Maestro" : "Nuevo Documento Maestro";
  const container = $('dinamic-form-maestro'); let datosEdit = {}; if(docId) { const item = dataMaestro.find(x => x.docId === docId); if(item) datosEdit = item; }
  let formHtml = "";
  columnasMaestro.forEach(col => {
    let cName = typeof col === 'string' ? col : col.nombre; let cType = typeof col === 'string' ? 'text' : col.tipo; let val = datosEdit[cName] || ""; let html = `<div><label>${cName}</label>`;
    if(cName.toLowerCase().includes('estatus') || cName.toLowerCase().includes('estado')) { html += `<select id="in_dyn_${cName}"><option value="">-- Seleccionar --</option>`; estatusMaestro.forEach(est => { html += `<option value="${est}" ${val===est?'selected':''}>${est}</option>`; }); html += `</select>`; } 
    else if(cType === 'date' || cName.toLowerCase().includes('fecha')) { html += `<input type="date" id="in_dyn_${cName}" value="${val}">`; } 
    else if(cType === 'number') { html += `<input type="number" id="in_dyn_${cName}" value="${val}" placeholder="0">`; } else { html += `<input type="text" id="in_dyn_${cName}" value="${val}" placeholder="Escribe aquí...">`; }
    html += `</div>`; formHtml += html;
  });
  if(container) container.innerHTML = formHtml; setDisplay('modal-form-listado', 'flex');
};

window.guardarRegistroMaestro = async () => {
  let data = {}; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; let inEl = $(`in_dyn_${cName}`); if(inEl) data[cName] = inEl.value; }); window.showLoading();
  if(editandoMaestroId) { await updateDoc(doc(db, "artifacts", appId, "public", "data", "ListadoMaestro", editandoMaestroId), data); } 
  else { data.registrado_por = currentUser.nombre; data.fecha_registro = new Date().toISOString(); await addDoc(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), data); }
  window.hideLoading(); setDisplay('modal-form-listado', 'none');
};

window.subirArchivoGenericoLM = async () => {
  const f = $('lm-generic-file').files[0]; if(!f) return alert("Selecciona un archivo primero."); window.showLoading(); let url = await window.uploadToCloudinary(f); if(!url) { window.hideLoading(); return alert("Hubo un error al subir el archivo."); } window.hideLoading();
  const inputs = Array.from($$("#dinamic-form-maestro input")); const targetInput = inputs.find(el => el.id.toLowerCase().includes('ubicaci') || el.id.toLowerCase().includes('archivo'));
  if(targetInput) { targetInput.value = url; alert("Archivo subido y enlace colocado."); } else { alert("Archivo subido. Copia este enlace:\n" + url); } $('lm-generic-file').value = "";
};

window.exportarExcelListado = () => {
  if(dataMaestro.length === 0) return alert("No hay registros en el Listado Maestro para exportar.");
  let dataExport = dataMaestro.map(item => { let rowObj = {}; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; rowObj[cName] = item[cName] || ""; }); return rowObj; });
  let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "Listado_Maestro"); XLSX.writeFile(wb, "Listado_Maestro_SGC.xlsx");
};

window.actualizarGerenteSelect = (gSelected) => {
  const gerentes = allUsers.filter(u => u.gerencias && u.gerencias.includes(gSelected) && u.permisos && u.permisos.p_ger_apr === true);
  if (gerentes && gerentes.length > 0) { $('sol-gerente-display').value = gerentes.map(g => g.nombre).join(', '); $('sol-email-gerente').value = gerentes.map(g => g.email || '').filter(e=>e).join(', ') || "Sin Email"; } 
  else { $('sol-gerente-display').value = "No asignado"; $('sol-email-gerente').value = ""; }
  const depSelect = $('sol-dep'); let depHtml = "<option value=''>-- Seleccionar Departamento --</option>";
  const depsFiltrados = allDepartamentos.filter(d => d.gerencia === gSelected); depsFiltrados.forEach(d => { depHtml += `<option value="${d.nombre}">${d.nombre}</option>`; }); depSelect.innerHTML = depHtml;
};

window.crearSolicitud = async () => {
  const tit = $('sol-tit').value; const gerTarget = $('sol-ger').value; if(!tit) return alert("Título obligatorio"); window.showLoading(); const f = $('sol-file'); let fileName = f.files[0] ? f.files[0].name : ""; let url = null; 
  if (f.files[0]) { url = await window.uploadToCloudinary(f.files[0]); if (!url) { window.hideLoading(); return alert("Error al subir archivo."); } }
  let extraEmails = []; if(selectedDocData && selectedDocData.involucrados) extraEmails = selectedDocData.involucrados; const fci = await window.getNextFCI(); const gerenteEmailVisible = $('sol-email-gerente').value; const now = new Date().toISOString();
  const data = { customId: fci, titulo: tit, accion: $('sol-accion').value, tipoDoc: $('sol-tipo-doc').value, prioridad: $('sol-prioridad').value, gerencia: gerTarget, departamento: $('sol-dep').value, motivo: $('sol-motivo').value, cod_ref: $('sol-cod-prev').value, ver_ref: $('sol-ver-prev').value, fecha_ref: $('sol-fecha-prev').value, solicitante: currentUser.nombre, solicitante_email: currentUser.email, uid: currentUser.usuario, involucrados: extraEmails, idx: 0, estado: "Pendiente Documentado", fase_0_ini: now, adjunto: url, adjunto_nombre: fileName, chat: [{u: "SISTEMA", m: "Solicitud creada exitosamente.", t: new Date().toLocaleString()}], fecha: now };
  await addDoc(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), data); 
  if($('lista-involucrados-tags')) $('lista-involucrados-tags').innerHTML = ""; 
  const toEmails = new Set([EMAIL_ADMIN_SGC, currentUser.email, ...extraEmails]); const destinatarios = { to: Array.from(toEmails).join(','), cc: gerenteEmailVisible }; 
  window.sendNotification(destinatarios, "Nueva Solicitud Creada", `El usuario ${currentUser.nombre} ha creado la solicitud ${fci} con prioridad ${data.prioridad}.`);
  window.hideLoading(); alert("Solicitud Creada: " + fci); window.cambiarVista('sec-hist', $('nav-hist'));
};

window.verDetalle = async (id) => {
  try {
    window.showLoading();
    selectedId = id; 
    if($('m-extra-input')) $('m-extra-input').innerHTML = ""; 
    if($('m-comentario-libre')) $('m-comentario-libre').innerHTML = "";
    
    const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", id)); 
    if(!docSnap.exists()) { window.hideLoading(); return alert("La solicitud ya no existe."); }
    
    selectedDocData = docSnap.data(); 
    const s = selectedDocData || {}; 
    const p = currentUser.permisos || {};
    
    if($('m-id')) $('m-id').innerText = s.customId || "N/A"; 
    if($('m-tit')) $('m-tit').innerText = s.titulo || "N/A"; 
    if($('m-sol')) $('m-sol').innerText = s.solicitante || "N/A";
    
    let est = String(s.estado || "Pendiente").toUpperCase(); 
    let apr = est.includes('APROBADO FINAL'); 
    let cnc = est === 'ANULADO' || est === 'RECHAZADO';
    
    if($('m-est')) { 
        $('m-est').innerText = apr ? 'APROBADO FINAL' : (s.estado || 'PENDIENTE'); 
        $('m-est').className = `badge ${apr ? 'badge-success' : (cnc ? 'badge-danger' : 'badge-warning')}`; 
    }
    
    if($('m-ger')) $('m-ger').innerText = s.gerencia || "N/A"; 
    if($('m-tipo')) $('m-tipo').innerText = s.tipoDoc || "N/A"; 
    
    let pr = String(s.prioridad || "Normal"); 
    if($('m-prioridad')) { 
        $('m-prioridad').innerText = pr.toUpperCase(); 
        $('m-prioridad').className = `badge ${pr === 'Alta' ? 'badge-danger' : (pr === 'Básica' ? 'badge-info' : 'badge-dark')}`; 
    }
    
    if($('m-accion')) $('m-accion').innerText = s.accion || "N/A"; 
    if($('m-jus')) $('m-jus').innerText = s.motivo || s.justificacion || "Sin justificación";
    
    let adjOrigName = s.adjunto_nombre || "Archivo Adjunto"; let dlUrl = s.adjunto ? window.getDownloadUrl(s.adjunto) : "#"; 
    if($('m-file-link')) $('m-file-link').innerHTML = s.adjunto ? `<a href="#" onclick="window.abrirDocumento('${dlUrl}', '${adjOrigName}'); return false;" class="file-link">📎 ${adjOrigName}</a>` : "Sin archivo";
    
    if(s.accion !== 'Creación') { 
        setDisplay('m-extra-panel', 'block'); 
        if($('m-cod')) $('m-cod').innerText = s.cod_ref || "N/A"; 
        if($('m-ver')) $('m-ver').innerText = s.ver_ref || "N/A"; 
        if($('m-fecha-ult')) $('m-fecha-ult').innerText = window.formatearFechaAbreviada(s.fecha_ref); 
    } else { setDisplay('m-extra-panel', 'none'); }

    let stepIdx = parseInt(s.idx) || 0;
    for(let i=1; i<=4; i++) { 
        const st = $('s'+i); 
        if(st) { 
            st.className = 'step'; 
            if(cnc) continue; 
            if(i <= stepIdx) st.classList.add('completed'); 
            if(i === stepIdx + 1 && !apr) st.classList.add('active'); 
        } 
    }

    const esAdminSGC = p.admin || p.p_gest_sgc; 
    let gerenciasUsuario = currentUser.gerencias || [];
    const esGer = p.p_ger_apr && gerenciasUsuario.includes(s.gerencia); 
    const activo = !apr && !cnc;
    
    let userEmailLowerCase = (currentUser.email || "").toLowerCase();
    let isInv = s.involucrados && s.involucrados.some(e => e.toLowerCase() === userEmailLowerCase);
    const esDuenio = s.uid === currentUser.usuario || isInv; 

    let invHTML = "No hay personas extras añadidas.";
    if(s.involucrados && s.involucrados.length > 0) { 
        invHTML = s.involucrados.map(email => { 
            let userFound = allUsers.find(u => (u.email || "").toLowerCase() === email.toLowerCase()); 
            let dispName = userFound ? `${userFound.nombre} (${email})` : email; 
            let btnDel = (activo && (esAdminSGC || esDuenio)) ? ` <span class="material-icons-round" style="font-size:14px; cursor:pointer; color:var(--danger); vertical-align:middle; margin-left:5px;" onclick="window.eliminarInvolucrado('${email}')" title="Quitar">close</span>` : '';
            return `<div style="display:inline-flex; align-items:center; background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:10px; font-size:11px; margin-right:5px; margin-bottom:5px;"><b>${dispName}</b> ${btnDel}</div>`;
        }).join(''); 
    }
    if($('m-involucrados-list')) $('m-involucrados-list').innerHTML = invHTML;

    const fDiff = (ini, fin) => { if(!ini || !fin) return "-"; let ms = new Date(fin) - new Date(ini); if(ms < 0) return "-"; let d = Math.floor(ms / 86400000); let h = Math.floor((ms % 86400000) / 3600000); return `${d}d ${h}h`; };
    if ($('m-tiempos-panel')) {
        if(esAdminSGC) {
            setDisplay('m-tiempos-panel', 'block');
            if($('m-tiempos-grid')) $('m-tiempos-grid').innerHTML = `<div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 1 (Doc)</b><br>${fDiff(s.fase_0_ini, s.fase_0_fin)}</div><div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 2 (Verif)</b><br>${fDiff(s.fase_1_ini, s.fase_1_fin)}</div><div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 3 (Gerencia)</b><br>${fDiff(s.fase_2_ini, s.fase_2_fin)}</div><div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 4 (SGC Final)</b><br>${fDiff(s.fase_3_ini, s.fecha_final || s.fase_3_fin)}</div>`;
        } else { setDisplay('m-tiempos-panel', 'none'); }
    }

    let puedeGestionarSGC = false; 
    if(activo) { 
        if (stepIdx === 0 && (p.p_gest_sgc || p.p_paso1 || p.admin)) puedeGestionarSGC = true; 
        if (stepIdx === 1 && (p.p_gest_sgc || p.p_paso2 || p.admin)) puedeGestionarSGC = true; 
        if (stepIdx === 3 && (p.p_gest_sgc || p.p_paso4 || p.admin)) puedeGestionarSGC = true; 
    }
    let puedeGestionarGerente = esGer && stepIdx === 2 && activo; 

    setDisplay('btn-reabrir', (esAdminSGC && !activo) ? 'inline-flex' : 'none'); 
    setDisplay('m-add-involucrado-section', activo ? 'flex' : 'none'); 
    setDisplay('m-actions', (puedeGestionarSGC || puedeGestionarGerente) ? 'block' : 'none'); 
    setDisplay('applicant-actions', (esDuenio && activo) ? 'block' : 'none'); 
    setDisplay('m-input-area', 'none'); 
    setDisplay('general-comment-area', !cnc ? 'block' : 'none');
    
    const puedeDevolver = (puedeGestionarSGC || puedeGestionarGerente) && stepIdx > 0 && activo; 
    setDisplay('btn-devolver-paso', puedeDevolver ? 'inline-block' : 'none'); 
    setDisplay('btn-anular', ((puedeGestionarSGC || esDuenio) && activo) ? 'inline-block' : 'none'); 

    if(s.fecha_esperada_cierre) { 
        setDisplay('m-admin-sla', 'block'); 
        if($('m-sla-date')) { $('m-sla-date').value = s.fecha_esperada_cierre; $('m-sla-date').disabled = !esAdminSGC; } 
        setDisplay('btn-save-sla', esAdminSGC ? 'inline-block' : 'none'); 
    } else if (esAdminSGC && activo) { 
        setDisplay('m-admin-sla', 'block'); 
        if($('m-sla-date')) { $('m-sla-date').value = ''; $('m-sla-date').disabled = false; } 
        setDisplay('btn-save-sla', 'inline-block'); 
    } else { setDisplay('m-admin-sla', 'none'); }
    
    setDisplay('m-panel-final-sgc', 'none'); setDisplay('m-panel-update-sgc', 'none'); setDisplay('m-display-final', 'none'); 
    if($('m-original-data')) $('m-original-data').classList.remove('locked-data'); 

    if ((esAdminSGC || p.p_paso2) && stepIdx === 1 && activo) { 
        setDisplay('m-panel-update-sgc', 'block'); 
        if($('m-upd-tit')) $('m-upd-tit').value = s.titulo || ''; 
        if($('m-upd-cod')) $('m-upd-cod').value = s.cod_ref || ''; 
        if($('m-upd-ver')) $('m-upd-ver').value = s.ver_ref || ''; 
    }
    
    if (apr) {
        if (s.version_final) {
            if($('m-original-data')) $('m-original-data').classList.add('locked-data'); 
            setDisplay('m-display-final', 'block');
            if($('m-disp-cod')) $('m-disp-cod').innerText = s.codigo_final || s.cod_ref || "N/A"; 
            if($('m-disp-ver')) $('m-disp-ver').innerText = s.version_final; 
            if($('m-disp-fecha')) $('m-disp-fecha').innerText = s.fecha_final ? window.formatearFechaAbreviada(s.fecha_final) : "N/A"; 
            let finName = s.documento_final_nombre || "Documento Oficial"; 
            let finUrl = s.documento_final ? window.getDownloadUrl(s.documento_final) : "#"; 
            if($('m-disp-file')) $('m-disp-file').innerHTML = s.documento_final ? `<a href="#" onclick="window.abrirDocumento('${finUrl}', '${finName}'); return false;" class="file-link">📄 ${finName}</a>` : "N/A";
        } else if (esAdminSGC || p.p_paso4) { 
            setDisplay('m-panel-final-sgc', 'block'); 
            if($('m-final-cod')) $('m-final-cod').value = s.cod_ref || ""; 
        }
    }
    
    if(activo && $('btn-firma-next')) $('btn-firma-next').innerText = `Aprobar Etapa (${PASOS_NOMBRES[stepIdx] || 'Final'})`;
    
    const cb = $('chat-box'); 
    if(cb) { 
        cb.innerHTML = s.chat ? s.chat.map(c => `<div class="chat-msg" style="border-left-color:${c.u===currentUser.nombre?'var(--primary)':'#cbd5e1'}"><b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${window.getDownloadUrl(c.archivo)}', '${c.archivo_nombre || 'Evidencia_Adjunta'}'); return false;" style="font-size:10px;color:blue;font-weight:600;text-decoration:none;">📎 ${c.archivo_nombre || 'Ver Adjunto'}</a>` : ''}</div>`).join('') : ''; 
    }
    
    setDisplay('modal', 'flex');
  } catch(e) {
    console.error("Error abriendo detalle:", e);
    alert("Hubo un error al abrir la solicitud.");
  } finally {
    window.hideLoading();
  }
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

window.gestionar = (tipo) => { tempAction = tipo; setDisplay('m-input-area', 'block'); if(tipo === 'Reunión') { setDisplay('reunion-container', 'block'); $('m-extra-input').setAttribute('data-placeholder', 'Tema de la reunión...'); } else { setDisplay('reunion-container', 'none'); $('m-extra-input').setAttribute('data-placeholder', 'Motivo / Consulta / Comentario...'); } };
window.responderSolicitante = () => { tempAction = "Respuesta"; setDisplay('m-input-area', 'block'); $('m-extra-input').setAttribute('data-placeholder', 'Detalla tu corrección...'); setDisplay('reunion-container', 'none'); };
window.rechazar = () => { tempAction = 'Rechazado'; setDisplay('m-input-area', 'block'); setDisplay('reunion-container', 'none'); };

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
  let chatPayload = {u: currentUser.nombre, m: `💬 <b>Comentario:</b><br>${txtHTML}`, t: new Date().toLocaleString()}; 
  if (fileUrl) { chatPayload.archivo = fileUrl; chatPayload.archivo_nombre = fileName; } 
  await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { chat: arrayUnion(chatPayload) });
  const dest = await window.getDatosEnvio(selectedDocData); window.sendNotification(dest, `Nuevo Comentario: ${selectedDocData.customId}`, `${currentUser.nombre} dejó un comentario.`); box.innerHTML = ""; f.value = ""; window.hideLoading(); window.closeModal();
};

window.guardarCierreFinal = async () => {
  const codFinal = $('m-final-cod').value; const ver = $('m-final-ver').value; const fecha = $('m-final-fecha').value; const com = $('m-final-comentario').value; const f = $('m-final-file');
  if(!ver || !fecha || !f.files[0]) return alert("Versión Final, Fecha y Documento son obligatorios."); window.showLoading(); let fileUrl = await window.uploadToCloudinary(f.files[0]); if (!fileUrl) { window.hideLoading(); return alert("Error al subir."); }
  const now = new Date().toISOString(); let fileName = f.files[0].name; let chatPayload = {u: "SISTEMA (SGC)", m: `🏁 <b>SOLICITUD APROBADA FINALMENTE.</b><br>Ver: ${ver}. Obs: ${com}`, t: new Date().toLocaleString(), archivo: fileUrl, archivo_nombre: fileName};
  await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { estado: "Aprobado Final", codigo_final: codFinal, version_final: ver, fecha_final: fecha, comentario_final: com, documento_final: fileUrl, documento_final_nombre: fileName, fase_3_fin: now, chat: arrayUnion(chatPayload) });
  let dataMaestro = { estatus: "Vigente", registrado_por: "Sistema (Automático)", fecha_registro: new Date().toISOString() };
  columnasMaestro.forEach(c => { let cName = typeof c === 'string' ? c : c.nombre; let low = cName.toLowerCase(); if(low.includes('código') || low === 'codigo') dataMaestro[cName] = codFinal || selectedDocData.cod_ref || "POR_ASIGNAR"; else if(low.includes('gerencia')) dataMaestro[cName] = selectedDocData.gerencia; else if(low.includes('departamento')) dataMaestro[cName] = selectedDocData.departamento; else if(low.includes('tipo')) dataMaestro[cName] = selectedDocData.tipoDoc; else if(low.includes('nombre')) dataMaestro[cName] = selectedDocData.titulo; else if(low.includes('vers')) dataMaestro[cName] = ver; else if(low.includes('ubicaci') || low.includes('archivo') || low.includes('documento')) dataMaestro[cName] = fileUrl; else if(low.includes('fecha última') || low.includes('fecha ultima') || low === 'fecha') dataMaestro[cName] = fecha; });
  await addDoc(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), dataMaestro);
  const dest = await window.getDatosEnvio(selectedDocData); window.sendNotification(dest, `Cierre Exitoso: ${selectedDocData.customId}`, `Documento versión ${ver} publicado.`); window.hideLoading(); window.closeModal();
};

window.anularSolicitud = async () => {
  if(!confirm("⚠️ ¿Estás seguro de anular esta solicitud?")) return; let motivo = prompt("Motivo de anulación:"); if(!motivo) return; window.showLoading();
  await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { estado: "Anulado", chat: arrayUnion({u: currentUser.nombre, m: `🚫 <b>SOLICITUD ANULADA</b><br>Motivo: ${motivo}`, t: new Date().toLocaleString()}) });
  const dest = await window.getDatosEnvio(selectedDocData); window.sendNotification(dest, `Cancelación: ${selectedDocData.customId}`, `ANULADA por ${currentUser.nombre}.`); window.hideLoading(); window.closeModal();
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
  sel.value = ''; window.hideLoading(); window.verDetalle(selectedId);
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

window.setFilterGest = (filterText) => {
  const tbody = $('tbody-gestionar'); if (!tbody) return; const trs = tbody.getElementsByTagName('tr'); const filter = filterText.toLowerCase();
  for (let i = 0; i < trs.length; i++) { let statusCell = trs[i].getElementsByTagName('td')[3]; if (statusCell) { let text = statusCell.textContent || statusCell.innerText; if (filter === "" || text.toLowerCase().includes(filter)) { trs[i].style.display = ""; } else { trs[i].style.display = "none"; } } }
};

window.descargarExcelFiltrado = (origen = 'hist') => {
  let desde = $(`${origen}-f-desde`).value; let hasta = $(`${origen}-f-hasta`).value; let estado = $(`${origen}-f-estado`).value; let esAdminSGC = currentUser.permisos.admin || currentUser.permisos.p_gest_sgc;
  let datosFiltrados = globalSolicitudes.filter(s => {
      if (origen !== 'all' && !esAdminSGC) { let isMine = (s.uid === currentUser.usuario) || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase())); if (origen === 'hist' && !isMine) return false; if (origen === 'gest') { const p = currentUser.permisos; let ver = p.p_ver_all || (p.p_ver_ger && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia)) || isMine; if(!ver) return false; } }
      if (desde && s.fecha < desde) return false; if (hasta && s.fecha > hasta + "T23:59:59") return false;
      if (estado) { let eStr = (s.estado || "").toUpperCase(); if (estado === 'Pendiente' && (eStr.includes('APROBADO FINAL') || eStr === 'ANULADO' || eStr === 'RECHAZADO')) return false; if (estado === 'Aprobado Final' && !eStr.includes('APROBADO FINAL')) return false; if (estado === 'Cancelado' && eStr !== 'ANULADO' && eStr !== 'RECHAZADO') return false; }
      return true;
  });
  if(datosFiltrados.length === 0) return alert("No hay datos que coincidan con estos filtros.");
  const formatearDiferencia = (ini, fin) => { if(!ini || !fin) return "N/A"; const ms = new Date(fin) - new Date(ini); if(ms < 0) return "N/A"; const m = Math.floor(ms / 60000); const h = Math.floor(m / 60); const d = Math.floor(h / 24); if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`; if (h > 0) return `${h}h ${m % 60}m`; return `${m}m`; };
  let dataExport = datosFiltrados.map(s => {
      let p = PASOS_NOMBRES[s.idx] || ''; let estadoFormat = s.estado === 'Aprobado Final' ? 'Aprobado Final' : (s.estado === 'Anulado' || s.estado === 'Rechazado' ? s.estado : `${s.estado} (${p})`);
      let baseObj = { "ID Solicitud": s.customId, "Solicitante": s.solicitante || '', "Email Solicitante": s.solicitante_email || '', "Gerencia": s.gerencia || '', "Departamento": s.departamento || '', "Acción": s.accion || '', "Prioridad": s.prioridad || 'Normal', "Tipo Documento": s.tipoDoc || '', "Título Documento": s.titulo || '', "Estado Actual": estadoFormat, "Fecha Límite (SLA)": s.fecha_esperada_cierre || 'No definida', "Fecha de Creación": s.fecha ? new Date(s.fecha).toLocaleString() : '', "Código Ref. Original": s.cod_ref || '', "Versión Original": s.ver_ref || '', "Código Final Asignado": s.codigo_final || '', "Versión Final Asignada": s.version_final || '', "Fecha Final": s.fecha_final || '' };
      if (esAdminSGC) { baseObj["Tiempo Fase 1 (Documentado)"] = formatearDiferencia(s.fase_0_ini, s.fase_0_fin); baseObj["Tiempo Fase 2 (Verificado)"] = formatearDiferencia(s.fase_1_ini, s.fase_1_fin); baseObj["Tiempo Fase 3 (Aprob. Gerencia)"] = formatearDiferencia(s.fase_2_ini, s.fase_2_fin); baseObj["Tiempo Fase 4 (Aprob. SGC)"] = formatearDiferencia(s.fase_3_ini, s.fase_3_fin); baseObj["TIEMPO TOTAL DEL FLUJO"] = formatearDiferencia(s.fase_0_ini, s.fecha_final || s.fase_3_fin || s.fase_2_fin || s.fase_1_fin || s.fase_0_fin); }
      return baseObj;
  });
  let nameF = esAdminSGC ? "Reporte_SGC_Completo" : "Reporte_Solicitudes"; let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "Datos_Filtrados"); XLSX.writeFile(wb, `${nameF}.xlsx`);
};

// ==========================================
// 8. MÓDULO DE AUDITORÍAS Y NORMA OEA
// ==========================================
window.switchAuditTab = (id) => { $$('.tab-btn').forEach(b=>b.classList.remove('active')); $$('.tab-content').forEach(c=>c.classList.remove('active')); $(`btn-tab-${id}`).classList.add('active'); $(`tab-${id}`).classList.add('active'); };

window.abrirModalPlan = () => {
  $('edit-year-label').innerText = $('aud-year-select').value; $$('#ah-auditor-list input').forEach(cb=>cb.checked=false);
  if(globalAuditPlan) {
      $('ah-obj').value = globalAuditPlan.objetivo || ''; $('ah-alcance').value = globalAuditPlan.alcance || ''; $('ah-tecnica').value = globalAuditPlan.tecnica || ''; $('ah-criterios').value = globalAuditPlan.criterios || ''; $('ah-ref').value = globalAuditPlan.referencia || ''; $('ah-fecha').value = globalAuditPlan.fecha_elab || ''; $('ah-tec').value = globalAuditPlan.recursos_tec || ''; $('ah-rrhh').value = globalAuditPlan.recursos_hh || ''; $('ah-extra-emails').value = (globalAuditPlan.extra_correos || []).join(', ');
      let liderSel = $('ah-lider'); for(let i=0; i<liderSel.options.length; i++){ if(liderSel.options[i].value === globalAuditPlan.lider) liderSel.selectedIndex = i; }
      let auditoresGuardados = globalAuditPlan.auditor_nombres || []; $$('#ah-auditor-list input').forEach(cb => { cb.checked = auditoresGuardados.includes(cb.value); });
  } else {
      $('ah-obj').value = ''; $('ah-alcance').value = ''; $('ah-tecnica').value = ''; $('ah-criterios').value = ''; $('ah-ref').value = ''; $('ah-fecha').value = ''; $('ah-tec').value = ''; $('ah-rrhh').value = ''; $('ah-extra-emails').value = ''; $('ah-lider').selectedIndex = 0; 
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
  if(val === 'nuevo') { let nYear = prompt("Ingrese el nuevo año a registrar (ej: 2028):"); if(nYear && !isNaN(nYear)) { let opt = document.createElement('option'); opt.value = nYear; opt.text = nYear; opt.selected = true; $('aud-year-select').add(opt, $('aud-year-select').options[1]); val = nYear; } else { $('aud-year-select').value = new Date().getFullYear().toString(); return; } }
  window.loadAuditPlan(val); window.renderTablaAuditorias(val);
};

window.loadAuditPlan = (year) => {
  const docId = `Plan_${year}`; $('view-year-label').innerText = year;
  onSnapshot(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), s => {
      if(s.exists()) {
          globalAuditPlan = s.data(); setDisplay('audit-header-view', 'block'); 
          if($('view-ah-obj')) $('view-ah-obj').innerText = globalAuditPlan.objetivo || '-'; 
          if($('view-ah-alcance')) $('view-ah-alcance').innerText = globalAuditPlan.alcance || '-'; 
          if($('view-ah-tecnica')) $('view-ah-tecnica').innerText = globalAuditPlan.tecnica || '-'; 
          if($('view-ah-criterios')) $('view-ah-criterios').innerText = globalAuditPlan.criterios || '-'; 
          if($('view-ah-ref')) $('view-ah-ref').innerText = globalAuditPlan.referencia || '-'; 
          if($('view-ah-fecha')) $('view-ah-fecha').innerText = window.formatearFechaAbreviada(globalAuditPlan.fecha_elab) || '-'; 
          if($('view-ah-lider')) $('view-ah-lider').innerText = globalAuditPlan.lider || '-'; 
          if($('view-ah-auditor')) $('view-ah-auditor').innerText = globalAuditPlan.auditor || '-'; 
          if($('view-ah-tec')) $('view-ah-tec').innerText = globalAuditPlan.recursos_tec || '-'; 
          if($('view-ah-rrhh')) $('view-ah-rrhh').innerText = globalAuditPlan.recursos_hh || '-';
          let modInfo = `Por: ${globalAuditPlan.modificado_por || '-'} el ${window.formatearFechaAbreviada(globalAuditPlan.ultima_modif)}`; 
          if(globalAuditPlan.historial && globalAuditPlan.historial.length > 0) { let ultimoMotivo = globalAuditPlan.historial[globalAuditPlan.historial.length-1].motivo; modInfo += ` (Motivo: ${ultimoMotivo})`; } 
          if($('view-ah-mod-info')) $('view-ah-mod-info').innerText = modInfo;
      } else { globalAuditPlan = null; setDisplay('audit-header-view', 'none'); }
  });
};

window.abrirNuevaAuditoria = () => { window.cancelarEdicionAuditoria(); setDisplay('modal-nueva-aud', 'flex'); };

window.cargarAuditoriaParaEditar = async (id) => {
  const au = globalAllAuditorias.find(x => x.id === id); if(!au) return; 
  editandoAuditoriaId = id; 
  if($('titulo-form-auditoria')) $('titulo-form-auditoria').innerText = "Editar Auditoría Programada"; 
  
  if($('aud-fecha')) $('aud-fecha').value = au.fecha || ''; 
  if($('aud-h-ini')) $('aud-h-ini').value = au.hora_inicio || ''; 
  if($('aud-h-fin')) $('aud-h-fin').value = au.hora_fin || ''; 
  if($('aud-lugar')) $('aud-lugar').value = au.lugar || ''; 
  if($('aud-obs')) $('aud-obs').value = au.observacion || ''; 
  if($('aud-org')) $('aud-org').value = au.organizacion || ''; 
  if($('aud-dir')) $('aud-dir').value = au.direccion || ''; 
  if($('aud-sitios')) $('aud-sitios').value = au.sitios || ''; 
  if($('aud-personal')) $('aud-personal').value = au.personal || ''; 
  if($('aud-turnos')) $('aud-turnos').value = au.turnos || '';
  
  let aa = au.auditado ? au.auditado.split(', ') : []; $$('#aud-auditado-list input[type="checkbox"]').forEach(cb => { cb.checked = aa.includes(cb.value); });
  let aua = au.auditor ? au.auditor.split(', ') : []; $$('#aud-auditor-list input[type="checkbox"]').forEach(cb => { cb.checked = aua.includes(cb.value); });
  let ar = au.requisitos ? au.requisitos.split(', ') : []; $$('#aud-req-list input[type="checkbox"]').forEach(cb => { cb.checked = ar.includes(cb.value); });
  let af = au.auditores_formacion ? au.auditores_formacion.split(', ') : []; $$('#aud-formacion-list input[type="checkbox"]').forEach(cb => { cb.checked = af.includes(cb.value); });
  
  if($('btn-guardar-aud')) $('btn-guardar-aud').innerText = "ACTUALIZAR AUDITORÍA"; 
  setDisplay('btn-cancelar-aud', 'inline-block'); 
  setDisplay('modal-nueva-aud', 'flex');
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
  setDisplay('btn-cancelar-aud', 'none'); 
  setDisplay('modal-nueva-aud', 'none');
};

$$('#aud-auditado-list').forEach(el => { 
  el.addEventListener('change', () => { 
      let c = $$('#aud-auditado-list input:checked').length; 
      if($('aud-personal')) $('aud-personal').value = c; 
  }); 
});

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
          dt.audit_num = aNum; dt.estado = "Programada"; dt.creado_por = currentUser.nombre; dt.timestamp = new Date().toISOString(); dt.bitacora = []; dt.lista_verificacion = []; dt.reporte_auditoria = { conclusiones: '' };
          await addDoc(collection(db, "artifacts", appId, "public", "data", "Auditorias"), dt);
          
          let gM = Array.from(new Set([...ae, ...aue])); 
          if(globalAuditPlan && globalAuditPlan.correos) globalAuditPlan.correos.forEach(x => gM.push(x)); 
          gM.push(EMAIL_ADMIN_SGC);
          
          window.sendNotification({to: gM.join(',')}, "Auditoría Programada", `Auditoría ${aNum} programada el ${window.formatearFechaAbreviada(f)}. Req: ${r}`);
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
      let e = a.estado || 'Programada'; 
      let b = e === 'Completada' ? 'badge-success' : (e === 'En Progreso' ? 'badge-info' : 'badge-warning');
      let btn = `<button class="btn btn-primary" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.verModalAuditoria('${a.id}')">Ver</button>`;
      
      const isAuditor = a.auditor && a.auditor.includes(currentUser.nombre); 
      const canControl = isAdm || isAuditor;
      
      if (canControl) { 
          if (e === 'Programada') btn += `<button class="btn btn-success" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.iniciarAuditoriaDirecto('${a.id}')">Iniciar</button>`; 
          else if (e === 'En Progreso') btn += `<button class="btn btn-warning" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.finalizarAuditoriaDirecto('${a.id}')">Fin</button>`; 
          btn += `<button class="btn btn-info" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.cargarAuditoriaParaEditar('${a.id}')">Ed</button>`;
      }
      
      if(isAdm) btn += `<button class="btn-icon-danger" onclick="window.del('Auditorias','${a.id}')">X</button>`;
      
      h += `<tr><td><b>${a.audit_num || '-'}</b></td><td><b>${window.formatearFechaAbreviada(a.fecha)}</b><br><small>${a.hora_inicio || ''} - ${a.hora_fin || ''}</small></td><td>${a.requisitos ? a.requisitos.substring(0,30) + '...' : '-'}</td><td>${a.auditado || '-'}</td><td>${a.auditor || '-'}</td><td><span class="badge ${b}">${e}</span></td><td class="no-export">${btn}</td></tr>`;
  });
  $('tbody-auditorias').innerHTML = h; 
  if(isAdm) window.verificarAlertasAuditoria(globalAuditorias);
};

window.iniciarAuditoriaDirecto = async (id) => { if(!confirm("?")) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"En Progreso", hora_real_inicio:new Date().toISOString()}); window.hideLoading(); };
window.finalizarAuditoriaDirecto = async (id) => { if(!confirm("?")) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"Completada", hora_real_fin:new Date().toISOString()}); window.hideLoading(); };

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
      
      let e = a.estado || 'Programada'; 
      if($('ma-estado-badge')) {
          $('ma-estado-badge').className = `badge ${e === 'Completada' ? 'badge-success' : (e === 'En Progreso' ? 'badge-info' : 'badge-warning')}`; 
          $('ma-estado-badge').innerText = e.toUpperCase();
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
      
      setDisplay('btn-comenzar-auditoria', (isAdm || isAud) && e === 'Programada' ? 'inline-block' : 'none'); 
      setDisplay('btn-finalizar-auditoria', (isAdm || isAud) && e === 'En Progreso' ? 'inline-block' : 'none');
      
      if($('chat-box-audit')) $('chat-box-audit').innerHTML = a.bitacora ? a.bitacora.map(c => `<div class="chat-msg"><b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${c.archivo}','${c.archivo_nombre}');return false;" style="font-size:10px;color:blue;">📎 Ver</a>` : ''}</div>`).join('') : '';
      
      currentAuditF020 = a.lista_verificacion || []; window.renderF020();
      
      ['f003-conclusiones','f003-n-proceso','f003-n-personal','f003-n-cargo','f003-n-req','f003-n-doc','f003-n-evidencia'].forEach(i => { if($(i)) $(i).disabled = !canEd; });
      if(a.reporte_auditoria) { ['conclusiones','n_proceso','n_personal','n_cargo','n_req','n_doc','n_evidencia'].forEach(k => { if($('f003-'+k)) $('f003-'+k).value = a.reporte_auditoria[k] || ""; }); }
      
      window.actualizarMetricasF003(canEd); window.renderAuditSACs();
      
      setDisplay('btn-tab-f020', (isAdm || isAud) ? 'inline-block' : 'none'); 
      setDisplay('btn-add-f020', canEd ? 'inline-block' : 'none'); 
      setDisplay('btn-save-f020', canEd ? 'inline-block' : 'none'); 
      setDisplay('btn-submit-f020', canEd ? 'inline-block' : 'none'); 
      setDisplay('btn-save-f003', canEd ? 'inline-block' : 'none'); 
      setDisplay('btn-add-sac-manual', canEd ? 'inline-block' : 'none');
      
      window.switchAuditTab('info'); setDisplay('modal-auditoria', 'flex');
  } catch(e) {
      console.error("Error abriendo auditoría:", e);
  } finally {
      window.hideLoading();
  }
};

window.comenzarAuditoria = async () => { await window.iniciarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.finalizarAuditoria = async () => { await window.finalizarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.enviarComentarioAuditoria = async () => { const b = $('ma-comentario-libre'); const th = b.innerHTML; const f = $('ma-file-comentario'); if(!b.innerText.trim() && !f.files[0]) return; window.showLoading(); let u = null, fn = null; if(f.files[0]) { u = await window.uploadToCloudinary(f.files[0]); fn = f.files[0].name; } await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId), {bitacora: arrayUnion({u:currentUser.nombre, m:`💬 ${th}`, t:new Date().toLocaleString(), archivo:u, archivo_nombre:fn})}); b.innerHTML=""; f.value=""; window.hideLoading(); window.verModalAuditoria(selectedAuditId); };

window.renderF020 = () => {
  if(!$('tbody-f020')) return; 
  let canEd = selectedAuditData && selectedAuditData.estado !== 'Completada' && (currentUser.permisos.admin || currentUser.permisos.p_audit_admin || (selectedAuditData.auditor && selectedAuditData.auditor.includes(currentUser.nombre))); 
  let h = "";
  let rqs = selectedAuditData && selectedAuditData.requisitos ? selectedAuditData.requisitos.split(', ') : [];
  let aOps = `<option value="">-- Sel --</option>` + (selectedAuditData && selectedAuditData.auditado ? selectedAuditData.auditado.split(', ').map(a => `<option value="${a}">${a}</option>`).join('') : '');
  
  currentAuditF020.forEach((i, idx) => {
      let dis = canEd ? '' : 'disabled';
      let rOpt = `<option value="">-- Sel --</option>` + rqs.map(r => `<option value="${r}" ${i.requisito === r ? 'selected' : ''}>${r}</option>`).join('');
      let aOpt = `<option value="${i.auditado || ''}" selected>${i.auditado || '-- Sel --'}</option>` + aOps;
      let nOpt = `<option value="N/A" ${i.nc==='N/A'||!i.nc?'selected':''}>N/A</option><option value="NC Menor" ${i.nc==='NC Menor'?'selected':''}>NC Menor</option><option value="NC Mayor" ${i.nc==='NC Mayor'?'selected':''}>NC Mayor</option><option value="OM" ${i.nc==='OM'?'selected':''}>OM</option>`;
      let fOpt = `<option value="N/A" ${i.fortaleza==='N/A'||!i.fortaleza?'selected':''}>N/A</option><option value="Sí" ${i.fortaleza==='Sí'?'selected':''}>Sí</option>`;
      h += `<tr data-id="${i.id}"><td>${idx+1}</td><td><textarea class="table-input" rows="2" ${dis}>${i.pregunta||''}</textarea></td><td><select class="table-select" ${dis}>${rOpt}</select></td><td><textarea class="table-input" rows="2" ${dis}>${i.comentarios||''}</textarea></td><td><select class="table-select" ${dis}>${aOpt}</select></td><td><select class="table-select hallazgo-sel" ${dis}>${nOpt}</select></td><td><textarea class="table-input" rows="2" ${dis}>${i.observacion||''}</textarea></td><td><select class="table-select" ${dis}>${fOpt}</select></td><td class="f020-action-col">${canEd?`<button class="btn-icon-danger" onclick="window.eliminarF020('${i.id}')"><span class="material-icons-round">delete</span></button>`:''}</td></tr>`;
  }); 
  $('tbody-f020').innerHTML = h; 
  $$('.f020-action-col').forEach(e => e.style.display = canEd ? '' : 'none');
};

window.agregarFilaF020 = () => { currentAuditF020.push({ id:'f020_'+Date.now(), pregunta:'', requisito:'', comentarios:'', auditado:'', nc:'N/A', observacion:'', fortaleza:'N/A' }); window.renderF020(); };
window.eliminarF020 = (id) => { if(!confirm("?")) return; currentAuditF020 = currentAuditF020.filter(x => x.id !== id); window.renderF020(); };
window.guardarF020 = async (notificar=false) => { 
  let dA = []; 
  $$('#tbody-f020 tr').forEach(tr => { let inps = tr.querySelectorAll('.table-input, .table-select'); dA.push({id: tr.dataset.id, pregunta: inps[0].value, requisito: inps[1].value, comentarios: inps[2].value, auditado: inps[3].value, nc: inps[4].value, observacion: inps[5].value, fortaleza: inps[6].value}); }); 
  window.showLoading(); 
  await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId), {lista_verificacion: dA}); 
  if(notificar) { window.sendNotification({to: EMAIL_ADMIN_SGC}, "F-020 Actualizado", `Auditor ${currentUser.nombre} subió F-020 para la auditoría ${selectedAuditData.audit_num}.`); alert("Guardado y Notificado a SGC"); } else { alert("F-020 Guardado."); } 
  window.hideLoading(); window.verModalAuditoria(selectedAuditId); 
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
          es = sac.estado || ''; let bs = es.includes('Abierta') ? 'badge-danger' : (es === 'En Seguimiento' ? 'badge-warning' : 'badge-success'); 
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
  let es = sac.estado || ""; let bs = es.includes('Abierta') ? 'badge-danger' : (es === 'En Seguimiento' ? 'badge-warning' : 'badge-success'); 
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
  
  let dt = { fecha_registro: $('sac-fecha')?$('sac-fecha').value:'', proceso: $('sac-proceso')?$('sac-proceso').value:'', tipo_doc_afectado: $('sac-tipo-doc-afectado')?$('sac-tipo-doc-afectado').value:'', fuente_nc: $('sac-fuente')?$('sac-fuente').value:'', fuente_otro: $('sac-fuente-otro')?$('sac-fuente-otro').value:'', beneficio_esperado: $('sac-beneficio')?$('sac-beneficio').value:'', causa_raiz: $('sac-causa')?$('sac-causa').value:'', accion_implementar: $('sac-accion')?$('sac-accion').value:'', dueno_uid: $('sac-dueno')?$('sac-dueno').value:'', plan_accion: pA, fecha_aprobacion_plan: $('sac-fecha-aprob-plan')?$('sac-fecha-aprob-plan').value:'', seguimiento: sA, fecha_cierre: $('sac-fecha-cierre')?$('sac-fecha-cierre').value:'', cerrado_por: $('sac-check-cerrar')&&$('sac-check-cerrar').checked ? currentUser.nombre : "", estado: es };

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
  if(!currentUser.permisos.admin && !currentUser.permisos.p_gest_sgc) fs = fs.filter(s => s.dueno_uid === currentUser.usuario || s.auditor_nombre === currentUser.nombre);
  fs.sort((a,b) => b.sac_num > a.sac_num ? -1 : 1);
  fs.forEach(s => {
      let es = s.estado || '', bs = es.includes('Abierta') ? 'badge-danger' : (es === 'En Seguimiento' ? 'badge-warning' : 'badge-success'); 
      let uD = allUsers.find(u => u.usuario === s.dueno_uid);
      hs += `<tr><td><b>${s.sac_num}</b></td><td>${s.proceso}</td><td><b style="${s.tipo_hallazgo === 'NC Mayor' ? 'color:var(--danger)' : 'color:var(--warning)'}">${s.tipo_hallazgo}</b></td><td>${uD ? uD.nombre : s.dueno_uid}</td><td><div style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.detalle_nc}">${s.detalle_nc}</div></td><td>${window.formatearFechaAbreviada(s.fecha_registro || s.fecha_apertura)}</td><td><span class="badge ${bs}">${es}</span></td><td>${s.fecha_cierre ? window.formatearFechaAbreviada(s.fecha_cierre) : '-'}</td><td class="no-export"><button class="btn btn-primary" style="padding:4px;font-size:10px;" onclick="window.verSACGlobal('${s.sac_id}', '${s.audit_id || 'N/A'}')">Revisar</button></td></tr>`;
  }); 
  tb.innerHTML = hs;
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
  if(globalAllSacs.length === 0) return; 
  let dE = globalAllSacs.map(s => { 
      let u = allUsers.find(x => x.usuario === s.dueno_uid); 
      return { "N° SAC": s.sac_num, "Req": s.proceso, "Tipo Doc": s.tipo_doc_afectado || 'N/A', "Tipo": s.tipo_hallazgo, "Resp": u ? u.nombre : s.dueno_uid, "Detalle": s.detalle_nc, "Apertura": s.fecha_apertura ? new Date(s.fecha_apertura).toLocaleString() : '', "Causa": s.causa_raiz || '', "Acción": s.accion_implementar || '', "Estado": s.estado, "Cierre": s.fecha_cierre ? new Date(s.fecha_cierre).toLocaleString() : '', "Cerrado Por": s.cerrado_por || '' }; 
  });
  let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dE), "F-023"); XLSX.writeFile(wb, "F-023_Control_NC.xlsx");
};

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

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicializarApp); 
else inicializarApp();
