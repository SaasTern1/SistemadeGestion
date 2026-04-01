import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, setDoc, query, where, getDocs, arrayUnion, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyDdzCiachuhbE9jATz-TesPI2vUVIJrHjM", authDomain: "sistemadegestion-7400d.firebaseapp.com", projectId: "sistemadegestion-7400d", storageBucket: "sistemadegestion-7400d.firebasestorage.app", messagingSenderId: "709030283072", appId: "1:709030283072:web:5997837b36a448e9515ca5" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app); const appId = 'sgc-final-v6';
const EMAIL_SERVICE_ID = "service_vumxptj", EMAIL_TEMPLATE_ID = "template_z27y5yk", EMAIL_PUBLIC_KEY = "kWsovOfdi7dBqLMw2", EMAIL_ADMIN_SGC = "sistemadegestion@fcipty.com"; 
(function() { emailjs.init(EMAIL_PUBLIC_KEY); })();
const CLOUD_NAME = "df79cjklp", UPLOAD_PRESET = "fci_documentos", PASOS_NOMBRES = ["Pendiente Documentado", "Pendiente Verificado", "Pendiente Aprobación Gerencia", "Pendiente Aprobación SGC"];
const $ = id => document.getElementById(id); const $$ = sel => document.querySelectorAll(sel); const setDisplay = (id, val) => { const el = $(id); if (el) el.style.display = val; };

let currentUser = null, selectedId = null, selectedDocData = null, tempAction = "";
let allUsers = [], allDepartamentos = [], tiposDocumento = [], columnasMaestro = [], estatusMaestro = [], dataMaestro = [], editandoMaestroId = null;
let globalSolicitudes = [], globalAuditPlan = null, globalAllAuditorias = [], globalAuditorias = [], selectedAuditId = null, selectedAuditData = null, editandoAuditoriaId = null;
let currentAuditF020 = [], globalAllSacs = [], currentEditingSacId = null, currentEditingF020Ref = null, requisitosOEA = [], manualOEA = { url: "", nombre: "" };

window.abrirDocumento = async (url, nombreOriginal) => {
    if (!url || url === "#") return;
    let safeName = nombreOriginal ? nombreOriginal.replace(/[^a-zA-Z0-9.\-_ ]/g, '_') : 'Documento';
    if (!safeName.includes('.')) { let extMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/); if(extMatch) safeName += "." + extMatch[1]; }
    let isViewable = url.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif)(\?|$)/);
    if (isViewable) {
        const win = window.open('', '_blank'); if (!win) return alert("Bloqueado por el navegador.");
        win.document.write(`<html style="display:flex; justify-content:center; align-items:center; height:100vh; background:#f8fafc;"><head><title>Cargando: ${safeName}</title></head><body><h2>Preparando documento...</h2></body></html>`);
        try { const r = await fetch(url); if(!r.ok) throw new Error(); const blob = await r.blob(); const fileObj = new File([blob], safeName, { type: blob.type }); const bUrl = window.URL.createObjectURL(fileObj); win.location.href = bUrl; setTimeout(() => window.URL.revokeObjectURL(bUrl), 60000);
        } catch(e) { win.close(); alert("⚠️ Archivo no disponible en la nube."); }
    } else {
        window.showLoading();
        try { const r = await fetch(url); if(!r.ok) throw new Error(); const blob = await r.blob(); const bUrl = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = bUrl; a.download = safeName; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(bUrl); document.body.removeChild(a);
        } catch(e) { alert("⚠️ Archivo no disponible en la nube."); } window.hideLoading();
    }
};

window.showLoading = () => setDisplay('loading-overlay', 'flex'); window.hideLoading = () => setDisplay('loading-overlay', 'none');
window.cambiarVista = (id, btn) => { $$('.section').forEach(s => s.classList.remove('active')); $$('.nav-link').forEach(l => l.classList.remove('active')); const sect = $(id); if(sect) sect.classList.add('active'); if(btn) btn.classList.add('active'); if(window.innerWidth <= 768) { const sb = $('sidebar'); if(sb) sb.classList.remove('open'); const ov = $('sidebar-overlay'); if(ov) ov.classList.remove('active'); } };
window.toggleMenu = () => { $('sidebar').classList.toggle('open'); $('sidebar-overlay').classList.toggle('active'); };
window.toggleModPanel = v => setDisplay('panel-mod', v === 'Creación' ? 'none' : 'grid'); window.closeModal = () => setDisplay('modal', 'none'); window.cerrarModalAuditoria = () => setDisplay('modal-auditoria', 'none'); window.abrirModalUsuario = () => { window.resetUserForm(); setDisplay('modal-usuario', 'flex'); }; window.cerrarModalUsuario = () => setDisplay('modal-usuario', 'none');
window.del = async (c, id) => { if(confirm("¿Eliminar este registro?")) { window.showLoading(); await deleteDoc(doc(db, "artifacts", appId, "public", "data", c, id)); window.hideLoading(); } };
window.getDownloadUrl = (url) => url ? url : "#";
window.formatearFechaAbreviada = (fechaISO) => { if (!fechaISO) return ''; let f = fechaISO; if(f.length === 10) f += 'T12:00:00'; const date = new Date(f); if (isNaN(date)) return fechaISO; const m = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; return `${date.getDate()}-${m[date.getMonth()]}-${date.getFullYear()}`; };
window.getGCalFormat = (fechaStr, horaStr) => { let d = new Date(`${fechaStr}T${horaStr}:00`); return d.toISOString().replace(/-|:|\.\d+/g, ''); };
window.sendNotification = (dest, sub, msg) => { if (!dest.to && !dest.cc) return; emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, { to_email: dest.to, cc_email: dest.cc || "", subject: sub, message: msg }).catch(e => console.log(e)); };
window.getDatosEnvio = async (sol) => { let mgrEmail = ""; if(sol.gerencia) { try { const q = query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("gerencias", "array-contains", sol.gerencia), where("permisos.p_ger_apr", "==", true)); const snap = await getDocs(q); if(!snap.empty) mgrEmail = snap.docs[0].data().email || ""; } catch(e) {} } const to = new Set([EMAIL_ADMIN_SGC, sol.solicitante_email]); if(sol.involucrados) sol.involucrados.forEach(e => to.add(e)); return { to: Array.from(to).join(','), cc: mgrEmail }; };
window.uploadToCloudinary = async (file) => { const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", UPLOAD_PRESET); try { const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd }); const d = await r.json(); return d.secure_url; } catch(e) { return null; } };
window.getNextFCI = async () => { const r = doc(db, "artifacts", appId, "public", "data", "Contadores", "solicitudes"); let id = ""; await runTransaction(db, async (t) => { const snap = await t.get(r); let count = 1; if (snap.exists()) count = snap.data().count + 1; t.set(r, { count }); id = `FCI-SOL-${String(count).padStart(4, '0')}`; }); return id; };

window.checkDailyAlerts = async () => {
    if(!currentUser || (!currentUser.permisos.p_gest_sgc && !currentUser.permisos.admin)) return;
    const r = doc(db, "artifacts", appId, "public", "data", "Configuracion", "EstadoAlertas"); const snap = await getDoc(r); const today = new Date().toISOString().split('T')[0];
    if(!snap.exists() || snap.data().ultimaAlerta !== today) {
        let p = globalSolicitudes.filter(s => { let est = (s.estado || "").toUpperCase(); return !est.includes('APROBADO FINAL') && est !== 'ANULADO' && est !== 'RECHAZADO'; });
        if(p.length > 0) { window.sendNotification({to: EMAIL_ADMIN_SGC, cc: ""}, "🔔 Alerta SGC", `Hay ${p.length} solicitudes pendientes.`); if(!snap.exists()) await setDoc(r, { ultimaAlerta: today }); else await updateDoc(r, { ultimaAlerta: today }); }
    }
};

window.verificarAlertasAuditoria = (arr) => {
    if(!globalAuditPlan || !globalAuditPlan.correos || globalAuditPlan.correos.length === 0) return;
    const today = new Date(); today.setHours(0,0,0,0);
    arr.forEach(a => {
        if(a.estado === "Completada" || !a.fecha) return; let f = a.fecha; if(f.length === 10) f += 'T12:00:00'; const d = new Date(f); d.setHours(0,0,0,0);
        const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24)); let sub = ""; if(diff === 30) sub = "🚨 1 Mes para Auditoría"; if(diff === 14) sub = "⚠️ 2 Semanas para Auditoría";
        if(sub) window.sendNotification({to: globalAuditPlan.correos.join(',')}, sub, `Auditoría: ${a.proceso} el ${window.formatearFechaAbreviada(a.fecha)} en ${a.lugar}. Req: ${a.requisitos}`);
    });
};

window.cargarDatosCentrales = () => {
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "Usuarios"), (snap) => {
        allUsers = []; let hu = "", cb = "", ou = "", oi = '<option value="">-- Seleccionar --</option>';
        snap.forEach(d => { 
            let u = d.data(); allUsers.push(u); let g = u.gerencias ? u.gerencias.join(', ') : (u.gerencia || 'N/A');
            hu += `<tr><td>${u.nombre} (${u.usuario})</td><td>${u.email||''}</td><td>${u.role||''} / <small>${g}</small></td><td class="no-export"><button class="btn btn-info" style="padding:4px;font-size:10px;" onclick="window.cargarUsuarioParaEditar('${u.usuario}')">Editar</button></td></tr>`;
            cb += `<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" value="${u.nombre}" data-email="${u.email}" style="margin:0;width:auto;flex-shrink:0;"> ${u.nombre} (${g})</label>`;
            ou += `<option value="${u.nombre}" data-email="${u.email}">${u.nombre} (${g})</option>`; if(u.email) oi += `<option value="${u.email}">${u.nombre} (${g})</option>`;
        });
        if ($('tbody-users')) $('tbody-users').innerHTML = hu; if ($('aud-auditado-list')) $('aud-auditado-list').innerHTML = cb; if ($('aud-auditor-list')) $('aud-auditor-list').innerHTML = cb; if ($('aud-formacion-list')) $('aud-formacion-list').innerHTML = cb; if ($('ah-auditor-list')) $('ah-auditor-list').innerHTML = cb; if ($('ah-lider')) $('ah-lider').innerHTML = '<option value="">-- Lider --</option>' + ou; if ($('sol-involucrado-sel')) $('sol-involucrado-sel').innerHTML = oi; if ($('m-new-involucrado-sel')) $('m-new-involucrado-sel').innerHTML = oi;
    });

    onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), (snap) => {
        if(snap.exists()) { const d = snap.data(); requisitosOEA = d.requisitos || []; manualOEA = { url: d.manual_url || "", nombre: d.manual_nombre || "" }; } else { requisitosOEA = []; manualOEA = { url: "", nombre: "" }; } window.renderNormaOEA();
    });

    onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), (snap) => {
        if(snap.exists()) { const d = snap.data(); tiposDocumento = d.tiposDoc || []; columnasMaestro = d.columnas || []; estatusMaestro = d.estatus || []; window.renderListasConfig(); }
    });

    onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"), (snap) => {
        let deps = [], gers = []; if(snap.exists()) { const d = snap.data(); deps = d.departamentos || []; gers = d.gerencias || []; } allDepartamentos = deps;
        let gh = ""; gers.forEach(g => gh += `<option value="${g}">${g}</option>`);
        if($('d-ger-sel')) $('d-ger-sel').innerHTML = gh; if($('sol-ger')) $('sol-ger').innerHTML = '<option value="">-- Seleccionar --</option>' + gh;
        if($('list-ger')) $('list-ger').innerHTML = gers.map((g, i) => `<div class="settings-item"><span>${g}</span><button class="btn-icon-danger" onclick="window.eliminarGerencia(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join('');
        if($('list-dep')) $('list-dep').innerHTML = deps.map((dp, i) => `<div class="settings-item"><span>${dp.nombre} <small>(${dp.gerencia})</small></span><button class="btn-icon-danger" onclick="window.eliminarDepartamento(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join('');
        if($('u-ger-list')) $('u-ger-list').innerHTML = gers.map(g => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;"><input type="checkbox" value="${g}" style="margin:0;width:auto;"> ${g}</label>`).join('');
    });

    onSnapshot(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), (snap) => { dataMaestro = []; snap.forEach(d => { let obj = d.data(); obj.docId = d.id; dataMaestro.push(obj); }); window.renderTablaMaestro(); });
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), (snap) => { globalSolicitudes = []; snap.forEach(d => { let obj = d.data(); obj.docId = d.id; globalSolicitudes.push(obj); }); window.renderTablasSolicitudes(); window.checkDailyAlerts(); });
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "Auditorias"), (snap) => { globalAllAuditorias = []; snap.forEach(d => { let obj = d.data(); obj.id = d.id; globalAllAuditorias.push(obj); }); let cy = new Date().getFullYear().toString(); let ys = $('aud-year-select'); if(ys && ys.options.length === 0) { ys.innerHTML = `<option value="${cy}">${cy}</option><option value="nuevo">+ Año</option>`; } window.loadAuditPlan(ys ? ys.value : cy); window.renderTablaAuditorias(ys ? ys.value : cy); });
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "AccionesCorrectivas"), (snap) => { globalAllSacs = []; snap.forEach(d => { let obj = d.data(); obj.sac_id = d.id; globalAllSacs.push(obj); }); window.renderF023Global(); });
};

window.renderDashTable = (t) => {
    setDisplay('dash-table-container', 'block'); let d = globalSolicitudes;
    if(t==='pendientes') d = d.filter(s=>!s.estado.includes('Aprobado Final')&&s.estado!=='Anulado'&&s.estado!=='Rechazado'); else d = d.filter(s=>s.estado.includes('Aprobado Final')||s.estado==='Anulado'||s.estado==='Rechazado');
    d.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)); let h="";
    d.forEach(s=>{ let bc=s.estado.includes('Aprobado')?'badge-success':(s.estado==='Anulado'||s.estado==='Rechazado'?'badge-danger':'badge-warning'); h+=`<tr><td><b>${s.customId}</b></td><td>${s.solicitante}</td><td>${s.titulo}</td><td><span class="badge ${bc}">${s.estado}</span></td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verDetalle('${s.docId}')">Detalle</button></td></tr>`; });
    if($('tbody-dash')) $('tbody-dash').innerHTML = h || "<tr><td colspan='5' style='text-align:center;'>No hay registros</td></tr>";
};

window.renderTablasSolicitudes = () => {
    let ht = "", ha = "", hg = ""; let sorted = [...globalSolicitudes].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    sorted.forEach(s => {
        let es = s.estado || "", canc = es==='Anulado' || es==='Rechazado', ok = es.includes('Aprobado Final'); let bc = ok ? 'badge-success' : (canc ? 'badge-danger' : 'badge-warning');
        let ps = s.prioridad || "Normal", bP = ps==='Alta'?'badge-danger':(ps==='Básica'?'badge-info':'badge-dark'), et = PASOS_NOMBRES[s.idx]||'';
        let isM = (s.uid === currentUser.usuario) || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase()));
        if(isM) ht += `<tr><td><b>${s.customId}</b><br><small>${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}</td><td>${s.titulo}</td><td><span class="badge ${bc}">${es}</span></td><td class="no-export"><button class="btn btn-primary" onclick="window.verDetalle('${s.docId}')">Ver</button></td></tr>`;
        ha += `<tr><td><b>${s.customId}</b><br><small>${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}</td><td>${s.titulo}</td><td><span class="badge ${bc}">${es}</span></td><td class="no-export"><button class="btn btn-primary" onclick="window.verDetalle('${s.docId}')">Ver</button></td></tr>`;
        let act = !ok && !canc, ca = currentUser.permisos, esAdm = ca.admin || ca.p_gest_sgc;
        let pg = act && ((s.idx===0 && (esAdm||ca.p_paso1)) || (s.idx===1 && (esAdm||ca.p_paso2)) || (s.idx===3 && (esAdm||ca.p_paso4)));
        let pG = act && s.idx===2 && ca.p_ger_apr && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia);
        if(pg || pG) hg += `<tr><td><b>${s.customId}</b><br><small>${window.formatearFechaAbreviada(s.fecha)}</small></td><td>${s.solicitante}</td><td>${s.titulo}</td><td><span class="badge badge-info">${et}</span></td><td class="no-export"><button class="btn btn-warning" onclick="window.verDetalle('${s.docId}')">Revisar</button></td></tr>`;
    });
    if($('tbody-historial')) $('tbody-historial').innerHTML = ht; if($('tbody-all')) $('tbody-all').innerHTML = ha; if($('tbody-gestionar')) $('tbody-gestionar').innerHTML = hg;
    if($('dash-mis-tot')) {
        let m = sorted.filter(s => s.uid === currentUser.usuario || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase())));
        $('dash-mis-tot').innerText = m.length; $('dash-mis-pend').innerText = m.filter(s => !s.estado.includes('Aprobado Final') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length; $('dash-mis-ok').innerText = m.filter(s => s.estado.includes('Aprobado Final')).length; $('dash-mis-rech').innerText = m.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length;
    }
    if($('dash-glob-tot') && currentUser.permisos && (currentUser.permisos.admin || currentUser.permisos.p_gest_sgc)) {
        setDisplay('dash-admin-section', 'block'); $('dash-glob-tot').innerText = sorted.length; $('dash-glob-pend').innerText = sorted.filter(s => !s.estado.includes('Aprobado Final') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length; $('dash-glob-ok').innerText = sorted.filter(s => s.estado.includes('Aprobado Final')).length; $('dash-glob-rech').innerText = sorted.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length;
    }
};

window.completarLoginUI = () => {
    setDisplay('login-screen', 'none'); setDisplay('sidebar', 'flex'); setDisplay('main', 'block');
    if($('curr-name')) $('curr-name').innerText = currentUser.nombre || 'Usuario'; if($('curr-ger')) $('curr-ger').innerText = currentUser.gerencias ? currentUser.gerencias.join(', ') : '';
    const p = currentUser.permisos || {}; const isAdm = p.admin || false;
    setDisplay('nav-hist', (p.p_ver_propias || isAdm) ? 'flex' : 'none'); setDisplay('nav-all', (p.p_ver_todas || p.p_ver_ger || isAdm) ? 'flex' : 'none'); setDisplay('nav-crear', (p.can_solicit || isAdm) ? 'flex' : 'none'); setDisplay('nav-gest', (p.p_gest_sgc || p.p_ger_apr || p.p_paso1 || p.p_paso2 || p.p_paso4 || isAdm) ? 'flex' : 'none'); setDisplay('nav-listado', (p.p_ver_listado || isAdm) ? 'flex' : 'none');
    const canAud = p.p_audit_ver || p.p_audit_admin || p.p_audit_auditor || p.p_audit_dueno || isAdm; setDisplay('nav-audit-group', canAud ? 'block' : 'none'); setDisplay('nav-norma', canAud ? 'flex' : 'none'); setDisplay('nav-audit', canAud ? 'flex' : 'none'); setDisplay('nav-noconf', (p.p_audit_admin || p.p_gest_sgc || p.p_audit_auditor || p.p_audit_dueno || isAdm) ? 'flex' : 'none');
    const canRoot = p.p_users || p.p_struct || isAdm; setDisplay('admin-only', canRoot ? 'block' : 'none'); setDisplay('nav-users', (p.p_users || isAdm) ? 'flex' : 'none'); setDisplay('nav-struct', (p.p_struct || isAdm) ? 'flex' : 'none');
    setDisplay('btn-config-plan', (p.p_audit_admin || p.p_gest_sgc || isAdm) ? 'inline-flex' : 'none'); setDisplay('btn-nueva-aud', (p.p_audit_admin || p.p_gest_sgc || isAdm) ? 'inline-flex' : 'none');
    window.cargarDatosCentrales();
    if (p.p_gest_sgc || isAdm) window.cambiarVista('sec-all', $('nav-all')); else if (p.can_solicit) window.cambiarVista('sec-crear', $('nav-crear')); else if (p.p_ver_propias) window.cambiarVista('sec-hist', $('nav-hist')); else window.cambiarVista('sec-dash', $('nav-dash'));
};

window.logout = () => { localStorage.removeItem('sgc_session_user'); currentUser = null; setDisplay('sidebar', 'none'); setDisplay('main', 'none'); setDisplay('login-screen', 'flex'); if($('login-user')) $('login-user').value = ''; if($('login-pass')) $('login-pass').value = ''; };

window.iniciarSesion = async () => {
    const u = $('login-user').value.toLowerCase().trim(); const p = $('login-pass').value.trim(); if (!u || !p) return alert("Ingresa credenciales."); window.showLoading();
    try {
        if(u === 'admin' && p === '1130') {
            const r = doc(db, "artifacts", appId, "public", "data", "Usuarios", "admin"); const sn = await getDoc(r);
            if(!sn.exists()) await setDoc(r, { nombre: "Admin", usuario: "admin", pass: "1130", gerencias: ["SGC"], gerencia: "SGC", email: EMAIL_ADMIN_SGC, permisos: { can_solicit:true, p_gest_sgc:true, p_ger_apr:true, p_ver_propias:true, p_ver_ger:true, p_ver_all:true, p_ver_todas:true, p_users:true, p_struct:true, p_ver_listado:true, p_audit_admin:true, p_audit_ver:true, admin:true, p_paso1:true, p_paso2:true, p_paso4:true } });
        }
        const qs = await getDocs(query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("usuario", "==", u), where("pass", "==", p)));
        if(!qs.empty) { localStorage.setItem('sgc_session_user', u); currentUser = qs.docs[0].data(); window.completarLoginUI(); } else alert("Credenciales incorrectas.");
    } catch(e) { alert("Error de red."); } finally { window.hideLoading(); }
};

window.cargarUsuarioParaEditar = (id) => {
    const u = allUsers.find(x => x.usuario === id); if(!u) return; if($('user-form-title')) $('user-form-title').innerHTML = `<span class="material-icons-round">edit</span> Editando: ${u.usuario}`;
    if($('u-nom'))$('u-nom').value=u.nombre||''; if($('u-usr')){ $('u-usr').value=u.usuario||''; $('u-usr').disabled=true; } if($('u-pas'))$('u-pas').value=u.pass||''; if($('u-rol'))$('u-rol').value=u.role||''; if($('u-email'))$('u-email').value=u.email||'';
    let gs = u.gerencias||[]; $$('#u-ger-list input').forEach(cb => cb.checked = gs.includes(cb.value)); const p = u.permisos||{};
    ['p-solicitar','p-ver-propias','p-ver-ger','p-ver-todas','p-paso1','p-paso2','p-paso4','p-gest-sgc','p-ger-apr','p-users','p-struct','p-ver-listado','p-audit-ver','p-audit-admin','p-audit-auditor','p-audit-dueno'].forEach(i => { let k = i.replace(/-/g,'_'); if(k==='p_solicitar')k='can_solicit'; if($(i)) $(i).checked = p[k]||false; });
    if($('p-admin')) $('p-admin').checked = p.admin||false; if($('btnSaveUser')) $('btnSaveUser').innerText = "ACTUALIZAR"; setDisplay('modal-usuario', 'flex');
};

window.resetUserForm = () => {
    if($('user-form-title')) $('user-form-title').innerHTML = `<span class="material-icons-round">person_add</span> Nuevo Usuario`;
    if($('u-nom'))$('u-nom').value=""; if($('u-usr')){$('u-usr').value=""; $('u-usr').disabled=false;} if($('u-pas'))$('u-pas').value="123"; if($('u-rol'))$('u-rol').value=""; if($('u-email'))$('u-email').value="";
    $$('#u-ger-list input').forEach(cb => cb.checked=false);
    ['p-solicitar','p-ver-propias','p-ver-ger','p-ver-todas','p-paso1','p-paso2','p-paso4','p-gest-sgc','p-ger-apr','p-users','p-struct','p-ver-listado','p-audit-ver','p-audit-admin','p-audit-auditor','p-audit-dueno','p-admin'].forEach(i => { if($(i)) $(i).checked=false; });
    if($('p-ver-propias')) $('p-ver-propias').checked=true; if($('btnSaveUser')) $('btnSaveUser').innerText = "GUARDAR"; 
};

window.guardarUsuario = async () => {
    const n = $('u-nom').value.trim(), u = $('u-usr').value.toLowerCase().trim(), p = $('u-pas').value.trim(), r = $('u-rol').value.trim(), e = $('u-email').value.trim().toLowerCase(), gs = []; $$('#u-ger-list input:checked').forEach(cb => gs.push(cb.value));
    if(!n||!u||!p||gs.length===0) return alert("Faltan datos clave.");
    const pm = { can_solicit: $('p-solicitar').checked, p_ver_propias: $('p-ver-propias').checked, p_ver_ger: $('p-ver-ger').checked, p_ver_todas: $('p-ver-todas').checked, p_paso1: $('p-paso1').checked, p_paso2: $('p-paso2').checked, p_paso4: $('p-paso4').checked, p_gest_sgc: $('p-gest-sgc').checked, p_ger_apr: $('p-ger-apr').checked, p_users: $('p-users').checked, p_struct: $('p-struct').checked, p_ver_listado: $('p-ver-listado').checked, p_audit_ver: $('p-audit-ver').checked, p_audit_admin: $('p-audit-admin').checked, p_audit_auditor: $('p-audit-auditor').checked, p_audit_dueno: $('p-audit-dueno').checked, admin: $('p-admin').checked };
    window.showLoading(); const dRef = doc(db, "artifacts", appId, "public", "data", "Usuarios", u); const sn = await getDoc(dRef);
    if(sn.exists() && $('user-form-title').innerText.includes("Nuevo")) { window.hideLoading(); return alert("Usuario ID en uso."); }
    await setDoc(dRef, { nombre:n, usuario:u, pass:p, gerencias:gs, gerencia:gs[0], role:r, email:e, permisos:pm }); window.cerrarModalUsuario(); window.hideLoading(); alert("Guardado!");
};

window.exportarExcelUsuarios = () => {
    if(allUsers.length === 0) return;
    let dEx = allUsers.map(u => ({ "Nombre": u.nombre, "Usuario ID": u.usuario, "Email": u.email, "Rol": u.role, "Gerencias": u.gerencias?u.gerencias.join(', '):'', "Admin": u.permisos.admin?'Sí':'No', "Gestor SGC": u.permisos.p_gest_sgc?'Sí':'No', "Auditor": u.permisos.p_audit_auditor?'Sí':'No' }));
    let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dEx), "Usuarios"); XLSX.writeFile(wb, "Usuarios_SGC.xlsx");
};

window.agregarGerencia = async () => { let v = $('g-nom').value.trim().toUpperCase(); if(!v) return; window.showLoading(); let g = []; const r = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const sn = await getDoc(r); if(sn.exists() && sn.data().gerencias) g = sn.data().gerencias; if(!g.includes(v)) { g.push(v); await setDoc(r, { gerencias: g }, {merge: true}); } $('g-nom').value = ""; window.hideLoading(); };
window.eliminarGerencia = async (i) => { if(!confirm("?")) return; window.showLoading(); const r = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const sn = await getDoc(r); let g = sn.data().gerencias; g.splice(i, 1); await setDoc(r, { gerencias: g }, {merge: true}); window.hideLoading(); };
window.agregarDepartamento = async () => { let g = $('d-ger-sel').value, n = $('d-nom').value.trim(); if(!g || !n) return; window.showLoading(); let dp = []; const r = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const sn = await getDoc(r); if(sn.exists() && sn.data().departamentos) dp = sn.data().departamentos; dp.push({ nombre: n, gerencia: g }); await setDoc(r, { departamentos: dp }, {merge: true}); $('d-nom').value = ""; window.hideLoading(); };
window.eliminarDepartamento = async (i) => { if(!confirm("?")) return; window.showLoading(); const r = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const sn = await getDoc(r); let dp = sn.data().departamentos; dp.splice(i, 1); await setDoc(r, { departamentos: dp }, {merge: true}); window.hideLoading(); };

window.actualizarSelectTiposDoc = () => { let h = '<option value="">-- Seleccione --</option>'; tiposDocumento.forEach(t => h += `<option value="${t}">${t}</option>`); if($('sol-tipo-doc')) $('sol-tipo-doc').innerHTML = h; if($('sac-tipo-doc-afectado')) $('sac-tipo-doc-afectado').innerHTML = '<option value="">-- No aplica --</option>' + h; };
window.renderListasConfig = () => { 
    let hC = ""; columnasMaestro.forEach((c, i) => { let n = typeof c === 'string' ? c : c.nombre, t = typeof c === 'string' ? 'text' : c.tipo; hC += `<div class="settings-item"><span>${n} <small>(${t})</small></span><button class="btn-icon-danger" onclick="window.eliminarColumna(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); if($('list-columnas')) $('list-columnas').innerHTML = hC;
    let hE = ""; estatusMaestro.forEach((e, i) => { hE += `<div class="settings-item"><span>${e}</span><button class="btn-icon-danger" onclick="window.eliminarEstatus(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); if($('list-estatus')) $('list-estatus').innerHTML = hE;
    let hT = ""; tiposDocumento.forEach((t, i) => { hT += `<div class="settings-item"><span>${t}</span><button class="btn-icon-danger" onclick="window.eliminarTipoDoc(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; }); if($('list-tipos-doc')) $('list-tipos-doc').innerHTML = hT;
    window.actualizarSelectTiposDoc(); 
};
window.agregarTipoDoc = async () => { let v = $('doc-tipo-nom').value.trim(); if(!v||tiposDocumento.includes(v)) return; tiposDocumento.push(v); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true}); $('doc-tipo-nom').value = ""; };
window.eliminarTipoDoc = async (i) => { if(!confirm("?")) return; tiposDocumento.splice(i, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true}); };
window.agregarColumna = async () => { let v = $('col-nom').value.trim(), t = $('col-tipo').value; if(!v) return; if (columnasMaestro.some(c => (typeof c === 'string' ? c : c.nombre) === val)) return alert("Ya existe."); columnasMaestro.push({nombre: v, tipo: t}); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true}); $('col-nom').value = ""; };
window.eliminarColumna = async (i) => { if(!confirm("?")) return; columnasMaestro.splice(i, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true}); };
window.agregarEstatus = async () => { let v = $('est-nom').value.trim(); if(!v||estatusMaestro.includes(v)) return; estatusMaestro.push(v); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true}); $('est-nom').value = ""; };
window.eliminarEstatus = async (i) => { if(!confirm("?")) return; estatusMaestro.splice(i, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true}); };

window.renderNormaOEA = () => {
    const p = currentUser ? currentUser.permisos || {} : {}, isAdm = p.admin || p.p_audit_admin || p.p_gest_sgc, lnk = $('oea-manual-link');
    if(lnk) lnk.innerHTML = manualOEA.url ? `<a href="#" onclick="window.abrirDocumento('${manualOEA.url}', '${manualOEA.nombre}'); return false;" class="btn btn-info"><span class="material-icons-round" style="font-size:16px;">visibility</span> Ver ${manualOEA.nombre}</a>` : "No hay manual.";
    setDisplay('oea-manual-upload-box', isAdm ? 'flex' : 'none'); setDisplay('oea-req-upload-box', isAdm ? 'flex' : 'none');
    if($('oea-req-list-container')) $('oea-req-list-container').innerHTML = requisitosOEA.map((r, i) => `<div class="settings-item"><span>${r}</span>${isAdm ? `<button class="btn-icon-danger" onclick="window.eliminarRequisitoOEA(${i})"><span class="material-icons-round" style="font-size:16px;">delete</span></button>` : ''}</div>`).join('');
    if($('aud-req-list')) $('aud-req-list').innerHTML = requisitosOEA.map(r => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;"><input type="checkbox" value="${r}" style="margin:0;width:auto;flex-shrink:0;"> ${r}</label>`).join('');
    if($('oea-req-list-dl')) $('oea-req-list-dl').innerHTML = requisitosOEA.map(r => `<option value="${r}">`).join('');
};
window.subirManualOEA = async () => { const f = $('oea-file').files[0]; if(!f) return; window.showLoading(); let u = await window.uploadToCloudinary(f); if(u) await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { manual_url: u, manual_nombre: f.name }, {merge: true}); $('oea-file').value = ""; window.hideLoading(); };
window.agregarRequisitoOEA = async () => { const v = $('oea-req-input').value.trim(); if(!v||requisitosOEA.includes(v)) return; requisitosOEA.push(v); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { requisitos: requisitosOEA }, {merge: true}); $('oea-req-input').value = ""; };
window.eliminarRequisitoOEA = async (i) => { if(!confirm("?")) return; requisitosOEA.splice(i, 1); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "NormaOEA"), { requisitos: requisitosOEA }, {merge: true}); };

window.renderTablaMaestro = () => {
    if(!$('thead-listado-maestro')) return; let hH = "<tr>"; columnasMaestro.forEach(c => hH += `<th>${typeof c==='string'?c:c.nombre}</th>`); if(currentUser.permisos.p_gest_sgc || currentUser.permisos.admin) hH += `<th>Acción</th>`; hH += "</tr>"; $('thead-listado-maestro').innerHTML = hH;
    let dS = [...dataMaestro]; if(columnasMaestro.length > 0) dS.sort((a,b) => (a[typeof columnasMaestro[0]==='string'?columnasMaestro[0]:columnasMaestro[0].nombre]||"").toString().localeCompare((b[typeof columnasMaestro[0]==='string'?columnasMaestro[0]:columnasMaestro[0].nombre]||"").toString()));
    let tb = ""; dS.forEach(i => { let r = "<tr>"; columnasMaestro.forEach(c => { let n = typeof c==='string'?c:c.nombre, t = typeof c==='string'?'text':c.tipo, v = i[n]||""; if(t==='url'||v.toString().startsWith("http")) r += `<td><a href="#" onclick="window.abrirDocumento('${v}', '${i['Nombre del documento']||i['Título']||"Doc"}'); return false;" class="file-link">📁 ${i['Nombre del documento']||i['Título']||"Doc"}</a></td>`; else if(n.toLowerCase().includes('estatus')||n.toLowerCase().includes('estado')) { let bd = v.toLowerCase().includes('vige')||v.toLowerCase().includes('acti')?'badge-success':(v.toLowerCase().includes('obs')||v.toLowerCase().includes('inac')?'badge-danger':'badge-warning'); r += `<td><span class="badge ${bd}">${v}</span></td>`; } else if(t==='date'||n.toLowerCase().includes('fecha')) r += `<td>${window.formatearFechaAbreviada(v)}</td>`; else r += `<td>${v}</td>`; }); if(currentUser.permisos.p_gest_sgc || currentUser.permisos.admin) r += `<td><button class="btn btn-info" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.abrirModalListadoMaestro('${i.docId}')">Editar</button><button class="btn btn-danger" style="padding:4px;font-size:10px;" onclick="window.del('ListadoMaestro','${i.docId}')">X</button></td>`; r += "</tr>"; tb += r; });
    $('tbody-listado-maestro').innerHTML = tb;
};

window.abrirModalListadoMaestro = (id = null) => {
    editandoMaestroId = id; if($('lm-modal-title')) $('lm-modal-title').innerText = id ? "Editar" : "Nuevo"; let dE = {}; if(id) { let f = dataMaestro.find(x => x.docId === id); if(f) dE = f; }
    let fH = ""; columnasMaestro.forEach(c => { let n = typeof c==='string'?c:c.nombre, t = typeof c==='string'?'text':c.tipo, v = dE[n]||""; let h = `<div><label>${n}</label>`; if(n.toLowerCase().includes('estatus')||n.toLowerCase().includes('estado')) { h += `<select id="in_dyn_${n}"><option value="">-- Sel --</option>`; estatusMaestro.forEach(e => h+=`<option value="${e}" ${v===e?'selected':''}>${e}</option>`); h += `</select>`; } else if(t==='date') h += `<input type="date" id="in_dyn_${n}" value="${v}">`; else if(t==='number') h += `<input type="number" id="in_dyn_${n}" value="${v}">`; else h += `<input type="text" id="in_dyn_${n}" value="${v}">`; h += `</div>`; fH += h; });
    if($('dinamic-form-maestro')) $('dinamic-form-maestro').innerHTML = fH; setDisplay('modal-form-listado', 'flex');
};
window.guardarRegistroMaestro = async () => { let d = {}; columnasMaestro.forEach(c => { let n = typeof c==='string'?c:c.nombre; if($(`in_dyn_${n}`)) d[n] = $(`in_dyn_${n}`).value; }); window.showLoading(); if(editandoMaestroId) await updateDoc(doc(db, "artifacts", appId, "public", "data", "ListadoMaestro", editandoMaestroId), d); else { d.registrado_por = currentUser.nombre; d.fecha_registro = new Date().toISOString(); await addDoc(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), d); } window.hideLoading(); setDisplay('modal-form-listado', 'none'); };
window.subirArchivoGenericoLM = async () => { const f = $('lm-generic-file').files[0]; if(!f) return; window.showLoading(); let u = await window.uploadToCloudinary(f); if(u) { const inp = Array.from($$("#dinamic-form-maestro input")).find(e => e.id.toLowerCase().includes('ubicaci')||e.id.toLowerCase().includes('archivo')); if(inp) inp.value = u; alert("Subido"); } window.hideLoading(); };
window.exportarExcelListado = () => { if(dataMaestro.length === 0) return; let de = dataMaestro.map(i => { let r={}; columnasMaestro.forEach(c=>{ let n=typeof c==='string'?c:c.nombre; r[n]=i[n]||"";}); return r; }); let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(de), "Listado"); XLSX.writeFile(wb, "Listado_SGC.xlsx"); };

window.actualizarGerenteSelect = (g) => { const grs = allUsers.filter(u => u.gerencias && u.gerencias.includes(g) && u.permisos && u.permisos.p_ger_apr); if (grs.length > 0) { $('sol-gerente-display').value = grs.map(x=>x.nombre).join(', '); $('sol-email-gerente').value = grs.map(x=>x.email).join(', '); } else { $('sol-gerente-display').value = "N/A"; $('sol-email-gerente').value = ""; } const ds = $('sol-dep'); let dh = "<option value=''>-- Sel --</option>"; allDepartamentos.filter(d => d.gerencia === g).forEach(d => dh += `<option value="${d.nombre}">${d.nombre}</option>`); ds.innerHTML = dh; };

window.crearSolicitud = async () => {
    const t = $('sol-tit').value, gt = $('sol-ger').value; if(!t) return alert("Título req."); window.showLoading(); const f = $('sol-file'); let fn = f.files[0]?f.files[0].name:"", u = null; if(f.files[0]) { u = await window.uploadToCloudinary(f.files[0]); if(!u){window.hideLoading(); return;} }
    let exE = []; if(selectedDocData && selectedDocData.involucrados) exE = selectedDocData.involucrados; const fci = await window.getNextFCI(), gev = $('sol-email-gerente').value, now = new Date().toISOString();
    const d = { customId: fci, titulo: t, accion: $('sol-accion').value, tipoDoc: $('sol-tipo-doc').value, prioridad: $('sol-prioridad').value, gerencia: gt, departamento: $('sol-dep').value, motivo: $('sol-motivo').value, cod_ref: $('sol-cod-prev').value, ver_ref: $('sol-ver-prev').value, fecha_ref: $('sol-fecha-prev').value, solicitante: currentUser.nombre, solicitante_email: currentUser.email, uid: currentUser.usuario, involucrados: exE, idx: 0, estado: "Pendiente Documentado", fase_0_ini: now, adjunto: u, adjunto_nombre: fn, chat: [{u: "SISTEMA", m: "Creada", t: new Date().toLocaleString()}], fecha: now };
    await addDoc(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), d); if($('lista-involucrados-tags')) $('lista-involucrados-tags').innerHTML = ""; const to = new Set([EMAIL_ADMIN_SGC, currentUser.email, ...exE]); window.sendNotification({to: Array.from(to).join(','), cc: gev}, "Nueva Solicitud", `Creada: ${fci}`); window.hideLoading(); alert("Creada."); window.cambiarVista('sec-hist', $('nav-hist'));
};

window.verDetalle = async (id) => {
    selectedId = id; if($('m-extra-input')) $('m-extra-input').innerHTML = ""; if($('m-comentario-libre')) $('m-comentario-libre').innerHTML = "";
    const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", id)); selectedDocData = docSnap.data(); const s = selectedDocData, p = currentUser.permisos;
    if($('m-id')) $('m-id').innerText = s.customId; if($('m-tit')) $('m-tit').innerText = s.titulo; if($('m-sol')) $('m-sol').innerText = s.solicitante;
    let est = (s.estado || "").toUpperCase(), apr = est.includes('APROBADO FINAL'), cnc = est==='ANULADO'||est==='RECHAZADO';
    if($('m-est')) { $('m-est').innerText = apr?'APROBADO FINAL':s.estado; $('m-est').className = `badge ${apr?'badge-success':(cnc?'badge-danger':'badge-warning')}`; }
    if($('m-ger')) $('m-ger').innerText = s.gerencia; if($('m-tipo')) $('m-tipo').innerText = s.tipoDoc || "N/A"; 
    let pr = s.prioridad || "Normal"; if($('m-prioridad')) { $('m-prioridad').innerText = pr.toUpperCase(); $('m-prioridad').className = `badge ${pr==='Alta'?'badge-danger':(pr==='Básica'?'badge-info':'badge-dark')}`; }
    if($('m-accion')) $('m-accion').innerText = s.accion; if($('m-jus')) $('m-jus').innerText = s.motivo || "N/A";
    let dlUrl = s.adjunto ? window.getDownloadUrl(s.adjunto) : "#", an = s.adjunto_nombre || "Adjunto"; if($('m-file-link')) $('m-file-link').innerHTML = s.adjunto ? `<a href="#" onclick="window.abrirDocumento('${dlUrl}', '${an}'); return false;" class="file-link">📎 ${an}</a>` : "N/A";
    if(s.accion !== 'Creación') { setDisplay('m-extra-panel', 'block'); if($('m-cod')) $('m-cod').innerText = s.cod_ref; if($('m-ver')) $('m-ver').innerText = s.ver_ref; if($('m-fecha-ult')) $('m-fecha-ult').innerText = window.formatearFechaAbreviada(s.fecha_ref); } else setDisplay('m-extra-panel', 'none');
    for(let i=1; i<=4; i++) { const st = $('s'+i); if(st) { st.className = 'step'; if(!cnc) { if(i <= s.idx) st.classList.add('completed'); if(i === s.idx + 1 && !apr) st.classList.add('active'); } } }
    const esAdm = p.admin || p.p_gest_sgc, esGer = p.p_ger_apr && currentUser.gerencias.includes(s.gerencia), act = !apr && !cnc, esD = s.uid === currentUser.usuario || (s.involucrados && s.involucrados.includes(currentUser.email.toLowerCase()));
    
    let iH = "Ninguno."; if(s.involucrados && s.involucrados.length > 0) { iH = s.involucrados.map(e => { let uf = allUsers.find(x=>x.email===e); let bn = (act&&(esAdm||esD)) ? `<span class="material-icons-round" style="font-size:14px;cursor:pointer;color:var(--danger);" onclick="window.eliminarInvolucrado('${e}')">close</span>` : ''; return `<div style="display:inline-flex;align-items:center;background:#e0f2fe;padding:4px 10px;border-radius:10px;font-size:11px;margin-right:5px;"><b>${uf?uf.nombre:e}</b> ${bn}</div>`; }).join(''); } if($('m-involucrados-list')) $('m-involucrados-list').innerHTML = iH;
    
    const fd = (i, f) => { if(!i||!f)return"-";let m=new Date(f)-new Date(i);if(m<0)return"-";return`${Math.floor(m/86400000)}d ${Math.floor((m%86400000)/3600000)}h`; };
    if($('m-tiempos-panel')) { if(esAdm) { setDisplay('m-tiempos-panel','block'); $('m-tiempos-grid').innerHTML=`<div style="background:#fff;padding:10px;border-radius:8px;font-size:11px;text-align:center;border:1px solid #ccc;"><b style="color:var(--primary);">Fase 1</b><br>${fd(s.fase_0_ini,s.fase_0_fin)}</div><div style="background:#fff;padding:10px;border-radius:8px;font-size:11px;text-align:center;border:1px solid #ccc;"><b style="color:var(--primary);">Fase 2</b><br>${fd(s.fase_1_ini,s.fase_1_fin)}</div><div style="background:#fff;padding:10px;border-radius:8px;font-size:11px;text-align:center;border:1px solid #ccc;"><b style="color:var(--primary);">Fase 3</b><br>${fd(s.fase_2_ini,s.fase_2_fin)}</div><div style="background:#fff;padding:10px;border-radius:8px;font-size:11px;text-align:center;border:1px solid #ccc;"><b style="color:var(--primary);">Fase 4</b><br>${fd(s.fase_3_ini,s.fecha_final||s.fase_3_fin)}</div>`; } else setDisplay('m-tiempos-panel','none'); }
    
    let pSGC = act && ((s.idx===0 && (esAdm||p.p_paso1))||(s.idx===1 && (esAdm||p.p_paso2))||(s.idx===3 && (esAdm||p.p_paso4))), pGer = esGer && s.idx===2 && act;
    setDisplay('btn-reabrir', esAdm && !act ? 'inline-flex' : 'none'); setDisplay('m-add-involucrado-section', act ? 'flex' : 'none'); setDisplay('m-actions', pSGC||pGer ? 'block' : 'none'); setDisplay('applicant-actions', esD&&act ? 'block' : 'none'); setDisplay('m-input-area', 'none'); setDisplay('general-comment-area', !cnc ? 'block' : 'none');
    setDisplay('btn-devolver-paso', (pSGC||pGer)&&s.idx>0&&act ? 'inline-block' : 'none'); setDisplay('btn-anular', (pSGC||esD)&&act ? 'inline-block' : 'none');
    if(s.fecha_esperada_cierre) { setDisplay('m-admin-sla','block'); if($('m-sla-date')) { $('m-sla-date').value=s.fecha_esperada_cierre; $('m-sla-date').disabled=!esAdm; setDisplay('btn-save-sla',esAdm?'inline-block':'none'); } } else if(esAdm&&act) { setDisplay('m-admin-sla','block'); if($('m-sla-date')) { $('m-sla-date').value=''; $('m-sla-date').disabled=false; setDisplay('btn-save-sla','inline-block'); } } else setDisplay('m-admin-sla','none');
    setDisplay('m-panel-final-sgc', 'none'); setDisplay('m-panel-update-sgc', 'none'); setDisplay('m-display-final', 'none'); if($('m-original-data')) $('m-original-data').classList.remove('locked-data');
    if((esAdm||p.p_paso2) && s.idx===1 && act) { setDisplay('m-panel-update-sgc','block'); if($('m-upd-tit')) $('m-upd-tit').value=s.titulo; if($('m-upd-cod')) $('m-upd-cod').value=s.cod_ref||''; if($('m-upd-ver')) $('m-upd-ver').value=s.ver_ref||''; }
    if(apr) { if(s.version_final) { if($('m-original-data')) $('m-original-data').classList.add('locked-data'); setDisplay('m-display-final','block'); if($('m-disp-cod')) $('m-disp-cod').innerText=s.codigo_final||s.cod_ref; if($('m-disp-ver')) $('m-disp-ver').innerText=s.version_final; if($('m-disp-fecha')) $('m-disp-fecha').innerText=window.formatearFechaAbreviada(s.fecha_final); if($('m-disp-file')) $('m-disp-file').innerHTML=s.documento_final?`<a href="#" onclick="window.abrirDocumento('${s.documento_final}', '${s.documento_final_nombre||'Doc'}');return false;" class="file-link">📄 ${s.documento_final_nombre}</a>`:"N/A"; } else if(esAdm||p.p_paso4) { setDisplay('m-panel-final-sgc','block'); if($('m-final-cod')) $('m-final-cod').value=s.cod_ref||''; } }
    if(act && $('btn-firma-next')) $('btn-firma-next').innerText = `Aprobar (${PASOS_NOMBRES[s.idx]})`;
    if($('chat-box')) $('chat-box').innerHTML = s.chat ? s.chat.map(c => `<div class="chat-msg" style="border-left-color:${c.u===currentUser.nombre?'var(--primary)':'#cbd5e1'}"><b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${c.archivo}', '${c.archivo_nombre||'Adjunto'}');return false;" style="font-size:10px;color:blue;font-weight:600;">📎 ${c.archivo_nombre||'Adjunto'}</a>` : ''}</div>`).join('') : '';
    setDisplay('modal', 'flex');
};

window.actualizarDatosSGC = async () => { const t=$('m-upd-tit').value, c=$('m-upd-cod').value, v=$('m-upd-ver').value, f=$('m-upd-file'); if(!t) return; window.showLoading(); let d = {titulo:t, cod_ref:c, ver_ref:v}, msg = `SGC actualizó. Tít: ${t}, Cód: ${c}, Ver: ${v}.`; if(f.files[0]) { let u=await window.uploadToCloudinary(f.files[0]); if(u){d.adjunto=u; d.adjunto_nombre=f.files[0].name; msg+=` (Nuevo adjunto subido)`;} } await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { ...d, chat: arrayUnion({u:currentUser.nombre,m:`✏️ ${msg}`,t:new Date().toLocaleString()})}); window.hideLoading(); window.closeModal(); };
window.guardarSLA = async () => { const d = $('m-sla-date').value; if(!d) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { fecha_esperada_cierre: d, chat: arrayUnion({u:currentUser.nombre, m:`⏱️ SLA: ${d}`, t:new Date().toLocaleString()}) }); window.hideLoading(); window.verDetalle(selectedId); };
window.devolverPaso = async () => { if(selectedDocData.idx<=0) return; let m=prompt("Motivo:"); if(!m) return; window.showLoading(); const ni = selectedDocData.idx-1, ne = PASOS_NOMBRES[ni], now=new Date().toISOString(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { idx: ni, estado: ne, [`fase_${selectedDocData.idx}_fin`]:now, [`fase_${ni}_ini`]:now, chat: arrayUnion({u:currentUser.nombre,m:`⏪ Devuelto a ${ne}. Motivo: ${m}`,t:new Date().toLocaleString()})}); window.hideLoading(); window.closeModal(); };
window.reabrirSolicitud = async () => { let m=prompt("Motivo:"); if(!m) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { estado: "Pendiente Documentado", idx: 0, fase_0_ini: new Date().toISOString(), chat: arrayUnion({u:currentUser.nombre, m:`⚠️ REABIERTA. Motivo: ${m}`, t:new Date().toLocaleString()})}); window.hideLoading(); window.closeModal(); };
window.gestionar = (t) => { tempAction = t; setDisplay('m-input-area', 'block'); setDisplay('reunion-container', t==='Reunión'?'block':'none'); $('m-extra-input').setAttribute('data-placeholder', 'Detalle...'); };
window.responderSolicitante = () => { tempAction = "Respuesta"; setDisplay('m-input-area', 'block'); $('m-extra-input').setAttribute('data-placeholder', 'Respuesta...'); setDisplay('reunion-container', 'none'); };
window.rechazar = () => { tempAction = 'Rechazado'; setDisplay('m-input-area', 'block'); setDisplay('reunion-container', 'none'); };
window.firmarPaso = async () => { const s=selectedDocData, ni=s.idx+1, ne=ni<4?PASOS_NOMBRES[ni]:"Aprobado Final", now=new Date().toISOString(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { idx: ni, estado: ne, [`fase_${s.idx}_fin`]:now, [`fase_${ni}_ini`]:now, chat:arrayUnion({u:currentUser.nombre,m:`✅ FASE COMPLETADA`,t:new Date().toLocaleString()})}); window.closeModal(); };
window.enviarComentarioLibre = async () => { const b=$('m-comentario-libre'), th=b.innerHTML, tp=b.innerText.trim(), f=$('m-file-comentario'); if(!tp && !f.files[0]) return; window.showLoading(); let u=null, fn=null; if(f.files[0]){ u=await window.uploadToCloudinary(f.files[0]); if(u) fn=f.files[0].name; } let p = {u:currentUser.nombre,m:`💬 Comentario:<br>${th}`,t:new Date().toLocaleString()}; if(u){p.archivo=u;p.archivo_nombre=fn;} await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), {chat:arrayUnion(p)}); b.innerHTML=""; f.value=""; window.hideLoading(); window.closeModal(); };
window.guardarCierreFinal = async () => { const cf=$('m-final-cod').value, vf=$('m-final-ver').value, ff=$('m-final-fecha').value, cm=$('m-final-comentario').value, f=$('m-final-file'); if(!vf||!ff||!f.files[0]) return alert("Faltan datos."); window.showLoading(); let u=await window.uploadToCloudinary(f.files[0]); if(!u) return window.hideLoading(); const now=new Date().toISOString(), fn=f.files[0].name; await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { estado:"Aprobado Final", codigo_final:cf, version_final:vf, fecha_final:ff, comentario_final:cm, documento_final:u, documento_final_nombre:fn, fase_3_fin:now, chat:arrayUnion({u:"SISTEMA",m:`🏁 APROBADA FINAL. Ver: ${vf}. Obs: ${cm}`,t:new Date().toLocaleString(),archivo:u,archivo_nombre:fn})}); let dm = { estatus:"Vigente", registrado_por:"Sistema", fecha_registro:now }; columnasMaestro.forEach(c => { let n=typeof c==='string'?c:c.nombre, low=n.toLowerCase(); if(low.includes('códig')) dm[n]=cf||selectedDocData.cod_ref||""; else if(low.includes('gerencia')) dm[n]=selectedDocData.gerencia; else if(low.includes('departamento')) dm[n]=selectedDocData.departamento; else if(low.includes('tipo')) dm[n]=selectedDocData.tipoDoc; else if(low.includes('nombre')) dm[n]=selectedDocData.titulo; else if(low.includes('vers')) dm[n]=vf; else if(low.includes('ubic')||low.includes('doc')) dm[n]=u; else if(low.includes('fecha')) dm[n]=ff; }); await addDoc(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), dm); window.hideLoading(); window.closeModal(); };
window.anularSolicitud = async () => { let m=prompt("Motivo:"); if(!m) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { estado:"Anulado", chat:arrayUnion({u:currentUser.nombre,m:`🚫 ANULADA. Motivo: ${m}`,t:new Date().toLocaleString()})}); window.hideLoading(); window.closeModal(); };
window.addInvolucradoList = () => { const sel=$('sol-involucrado-sel'), e=sel.value, n=sel.options[sel.selectedIndex].text; if(!e) return; const tgs=Array.from($$('.involucrado-item')); if(tgs.some(el=>el.dataset.email===e)) return; const d=document.createElement('div'); d.className='involucrado-item badge badge-info'; d.style='display:flex;align-items:center;gap:5px;font-size:12px;padding:6px;'; d.dataset.email=e; d.innerHTML=`${n} <span class="material-icons-round" style="font-size:14px;cursor:pointer;color:var(--danger);" onclick="this.parentElement.remove()">close</span>`; $('lista-involucrados-tags').appendChild(d); sel.value=""; };
window.guardarNuevoInvolucrado = async () => { const sel=$('m-new-involucrado-sel'), e=sel.value, n=sel.options[sel.selectedIndex].text; if(!e) return; window.showLoading(); let inv=selectedDocData.involucrados||[]; if(!inv.includes(e)){ inv.push(e); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), {involucrados:inv, chat:arrayUnion({u:currentUser.nombre,m:`👥 Añadió a ${n}`,t:new Date().toLocaleString()})}); } sel.value=''; window.hideLoading(); window.verDetalle(selectedId); };
window.eliminarInvolucrado = async (e) => { if(!confirm("?")) return; window.showLoading(); let inv=selectedDocData.involucrados||[]; inv=inv.filter(x=>x!==e); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), {involucrados:inv, chat:arrayUnion({u:currentUser.nombre,m:`👥 Removió a ${e}`,t:new Date().toLocaleString()})}); window.hideLoading(); window.verDetalle(selectedId); };
window.filtrarTabla = (iId, tbId) => { const val=$(iId).value.toLowerCase(), trs=$(tbId).getElementsByTagName('tr'); for(let i=0;i<trs.length;i++) { trs[i].style.display = (trs[i].innerText.toLowerCase().indexOf(val)>-1) ? "" : "none"; } };
window.setFilterGest = (v) => { const f=v.toLowerCase(), trs=$('tbody-gestionar').getElementsByTagName('tr'); for(let i=0;i<trs.length;i++) { let td=trs[i].getElementsByTagName('td')[3]; if(td) trs[i].style.display = (f===""||td.innerText.toLowerCase().includes(f)) ? "" : "none"; } };

window.descargarExcelFiltrado = (origen = 'hist') => {
    let d=$(origen+'-f-desde').value, h=$(origen+'-f-hasta').value, est=$(origen+'-f-estado').value, isA = currentUser.permisos.admin||currentUser.permisos.p_gest_sgc;
    let filt = globalSolicitudes.filter(s => {
        if(origen!=='all'&&!isA){ let isM = s.uid===currentUser.usuario || (s.involucrados&&s.involucrados.includes(currentUser.email)); if(origen==='hist'&&!isM) return false; if(origen==='gest') { const p=currentUser.permisos; if(!(p.p_ver_all || (p.p_ver_ger&&currentUser.gerencias.includes(s.gerencia)) || isM)) return false; } }
        if(d && s.fecha<d) return false; if(h && s.fecha>h+"T23:59:59") return false;
        if(est) { let eS = (s.estado||"").toUpperCase(); if(est==='Pendiente'&& (eS.includes('FINAL')||eS==='ANULADO'||eS==='RECHAZADO')) return false; if(est==='Aprobado Final'&&!eS.includes('FINAL')) return false; if(est==='Cancelado'&&eS!=='ANULADO'&&eS!=='RECHAZADO') return false; }
        return true;
    });
    if(filt.length===0) return;
    const fd = (i, f) => { if(!i||!f)return"N/A";let ms=new Date(f)-new Date(i);if(ms<0)return"N/A";return`${Math.floor(ms/86400000)}d ${Math.floor((ms%86400000)/3600000)}h`; };
    let dx = filt.map(s => { let b = { "ID":s.customId, "Sol":s.solicitante, "Ger":s.gerencia, "Acc":s.accion, "Doc":s.tipoDoc, "Tit":s.titulo, "Est":s.estado, "SLA":s.fecha_esperada_cierre }; if(isA) { b["F1"]=fd(s.fase_0_ini,s.fase_0_fin); b["F2"]=fd(s.fase_1_ini,s.fase_1_fin); b["F3"]=fd(s.fase_2_ini,s.fase_2_fin); b["F4"]=fd(s.fase_3_ini,s.fase_3_fin); b["Tot"]=fd(s.fase_0_ini,s.fecha_final||s.fase_3_fin); } return b; });
    let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dx), "Filtrados"); XLSX.writeFile(wb, "Reporte.xlsx");
};

// ==========================================
// 8. MÓDULO DE AUDITORÍAS Y NORMA OEA
// ==========================================
window.switchAuditTab = (id) => { $$('.tab-btn').forEach(b=>b.classList.remove('active')); $$('.tab-content').forEach(c=>c.classList.remove('active')); $(`btn-tab-${id}`).classList.add('active'); $(`tab-${id}`).classList.add('active'); };
window.abrirModalPlan = () => {
    $('edit-year-label').innerText = $('aud-year-select').value; $$('#ah-auditor-list input').forEach(cb=>cb.checked=false);
    if(globalAuditPlan) { $('ah-obj').value=globalAuditPlan.objetivo||''; $('ah-alcance').value=globalAuditPlan.alcance||''; $('ah-tecnica').value=globalAuditPlan.tecnica||''; $('ah-criterios').value=globalAuditPlan.criterios||''; $('ah-ref').value=globalAuditPlan.referencia||''; $('ah-fecha').value=globalAuditPlan.fecha_elab||''; $('ah-tec').value=globalAuditPlan.recursos_tec||''; $('ah-rrhh').value=globalAuditPlan.recursos_hh||''; $('ah-extra-emails').value=(globalAuditPlan.extra_correos||[]).join(', '); let ls=$('ah-lider'); for(let i=0;i<ls.options.length;i++)if(ls.options[i].value===globalAuditPlan.lider)ls.selectedIndex=i; $$('#ah-auditor-list input').forEach(cb=>cb.checked=(globalAuditPlan.auditor_nombres||[]).includes(cb.value)); } 
    else { $('ah-obj').value=''; $('ah-alcance').value=''; $('ah-tecnica').value=''; $('ah-criterios').value=''; $('ah-ref').value=''; $('ah-fecha').value=''; $('ah-tec').value=''; $('ah-rrhh').value=''; $('ah-extra-emails').value=''; $('ah-lider').selectedIndex=0; }
    setDisplay('modal-plan', 'flex');
};
window.cerrarModalPlan = () => setDisplay('modal-plan', 'none');
window.saveAuditPlan = async () => {
    const y=$('aud-year-select').value, dI=`Plan_${y}`; let m="Inicial"; if(globalAuditPlan) { m=prompt("Motivo:"); if(!m)return; }
    const ls=$('ah-lider'), ln=ls.options[ls.selectedIndex]?.value||"", le=ls.options[ls.selectedIndex]?.getAttribute('data-email')||"";
    const an=[], ae=[]; $$('#ah-auditor-list input:checked').forEach(cb=>{an.push(cb.value); ae.push(cb.getAttribute('data-email'));});
    const ee=$('ah-extra-emails').value.split(',').map(e=>e.trim().toLowerCase()).filter(e=>e.includes('@')); let tc=new Set([...ae, ...ee]); if(le)tc.add(le);
    const dt = { year:y, objetivo:$('ah-obj').value, alcance:$('ah-alcance').value, tecnica:$('ah-tecnica').value, criterios:$('ah-criterios').value, referencia:$('ah-ref').value, fecha_elab:$('ah-fecha').value, lider:ln, auditor:an.join(', '), auditor_nombres:an, recursos_tec:$('ah-tec').value, recursos_hh:$('ah-rrhh').value, extra_correos:ee, correos:Array.from(tc), modificado_por:currentUser.nombre, ultima_modif:new Date().toISOString() };
    window.showLoading(); if(globalAuditPlan) await updateDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", dI), { ...dt, historial: arrayUnion({fecha:new Date().toISOString(), u:currentUser.nombre, m:m})}); else await setDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", dI), { ...dt, historial: [{fecha:new Date().toISOString(), u:currentUser.nombre, m:m}]});
    window.hideLoading(); window.cerrarModalPlan();
};
window.cambiarAnioAuditoria = (val) => { if(val==='nuevo'){ let ny=prompt("Año:"); if(ny&&!isNaN(ny)){ let o=document.createElement('option'); o.value=ny; o.text=ny; o.selected=true; $('aud-year-select').add(o, $('aud-year-select').options[1]); val=ny; }else{ $('aud-year-select').value=new Date().getFullYear().toString(); return; } } window.loadAuditPlan(val); window.renderTablaAuditorias(val); };
window.loadAuditPlan = (y) => { const dI=`Plan_${y}`; $('view-year-label').innerText=y; onSnapshot(doc(db, "artifacts", appId, "public", "data", "AuditPlans", dI), s => { if(s.exists()) { globalAuditPlan=s.data(); setDisplay('audit-header-view','block'); $('view-ah-obj').innerText=globalAuditPlan.objetivo||'-'; $('view-ah-alcance').innerText=globalAuditPlan.alcance||'-'; $('view-ah-tecnica').innerText=globalAuditPlan.tecnica||'-'; $('view-ah-criterios').innerText=globalAuditPlan.criterios||'-'; $('view-ah-ref').innerText=globalAuditPlan.referencia||'-'; $('view-ah-fecha').innerText=window.formatearFechaAbreviada(globalAuditPlan.fecha_elab)||'-'; $('view-ah-lider').innerText=globalAuditPlan.lider||'-'; $('view-ah-auditor').innerText=globalAuditPlan.auditor||'-'; $('view-ah-tec').innerText=globalAuditPlan.recursos_tec||'-'; $('view-ah-rrhh').innerText=globalAuditPlan.recursos_hh||'-'; } else { globalAuditPlan=null; setDisplay('audit-header-view','none'); } }); };

window.abrirNuevaAuditoria = () => { window.cancelarEdicionAuditoria(); setDisplay('modal-nueva-aud', 'flex'); };
window.cargarAuditoriaParaEditar = async (id) => {
    const au = globalAllAuditorias.find(x=>x.id===id); if(!au) return; editandoAuditoriaId = id; $('titulo-form-auditoria').innerText = "Editar Auditoría"; 
    $('aud-fecha').value=au.fecha||''; $('aud-h-ini').value=au.hora_inicio||''; $('aud-h-fin').value=au.hora_fin||''; $('aud-lugar').value=au.lugar||''; $('aud-obs').value=au.observacion||''; $('aud-org').value=au.organizacion||''; $('aud-dir').value=au.direccion||''; $('aud-sitios').value=au.sitios||''; $('aud-personal').value=au.personal||''; $('aud-turnos').value=au.turnos||'';
    let aa=au.auditado?au.auditado.split(', '):[]; $$('#aud-auditado-list input').forEach(cb=>cb.checked=aa.includes(cb.value));
    let aua=au.auditor?au.auditor.split(', '):[]; $$('#aud-auditor-list input').forEach(cb=>cb.checked=aua.includes(cb.value));
    let ar=au.requisitos?au.requisitos.split(', '):[]; $$('#aud-req-list input').forEach(cb=>cb.checked=ar.includes(cb.value));
    let af=au.auditores_formacion?au.auditores_formacion.split(', '):[]; $$('#aud-formacion-list input').forEach(cb=>cb.checked=af.includes(cb.value));
    $('btn-guardar-aud').innerText="ACTUALIZAR AUDITORÍA"; setDisplay('btn-cancelar-aud','inline-block'); setDisplay('modal-nueva-aud','flex');
};
window.cancelarEdicionAuditoria = () => {
    editandoAuditoriaId=null; $('titulo-form-auditoria').innerText="Programar Auditoría"; 
    ['aud-fecha','aud-h-ini','aud-h-fin','aud-lugar','aud-obs','aud-org','aud-dir','aud-sitios','aud-personal','aud-turnos'].forEach(i=>$(i).value='');
    $$('#aud-auditado-list input').forEach(c=>c.checked=false); $$('#aud-auditor-list input').forEach(c=>c.checked=false); $$('#aud-req-list input').forEach(c=>c.checked=false); $$('#aud-formacion-list input').forEach(c=>c.checked=false);
    $('btn-guardar-aud').innerText="GENERAR AUDITORÍA"; setDisplay('btn-cancelar-aud','none'); setDisplay('modal-nueva-aud','none');
};
$$('#aud-auditado-list').forEach(el => { el.addEventListener('change', () => { let c = $$('#aud-auditado-list input:checked').length; if($('aud-personal')) $('aud-personal').value = c; }); });

window.guardarAuditoria = async () => {
    const f=$('aud-fecha').value, reqN=[]; $$('#aud-req-list input:checked').forEach(c=>reqN.push(c.value)); const r=reqN.join(', ');
    if(!f||!r) return alert("Fecha y Puntos son obligatorios.");
    const an=[], ae=[]; $$('#aud-auditado-list input:checked').forEach(c=>{an.push(c.value); ae.push(c.getAttribute('data-email'));});
    const aun=[], aue=[]; $$('#aud-auditor-list input:checked').forEach(c=>{aun.push(c.value); aue.push(c.getAttribute('data-email'));});
    const fn=[]; $$('#aud-formacion-list input:checked').forEach(c=>fn.push(c.value));
    let dt = { fecha:f, hora_inicio:$('aud-h-ini').value, hora_fin:$('aud-h-fin').value, lugar:$('aud-lugar').value, proceso:r, requisitos:r, auditado:an.join(', '), auditado_emails:ae, auditor:aun.join(', '), auditor_emails:aue, observacion:$('aud-obs').value, organizacion:$('aud-org').value, direccion:$('aud-dir').value, sitios:$('aud-sitios').value, personal:$('aud-personal').value, turnos:$('aud-turnos').value, auditores_formacion:fn.join(', ') };
    window.showLoading();
    if(editandoAuditoriaId) { await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", editandoAuditoriaId), dt); } 
    else {
        let aNum = ""; await runTransaction(db, async(t)=>{const sn=await t.get(doc(db,"artifacts",appId,"public","data","Contadores","auditorias"));let c=1;if(sn.exists())c=sn.data().count+1;t.set(doc(db,"artifacts",appId,"public","data","Contadores","auditorias"),{count:c});aNum=`QSHE-${new Date().getFullYear()}-${c}`;});
        dt.audit_num=aNum; dt.estado="Programada"; dt.creado_por=currentUser.nombre; dt.timestamp=new Date().toISOString(); dt.bitacora=[]; dt.lista_verificacion=[]; dt.reporte_auditoria={conclusiones:''};
        await addDoc(collection(db, "artifacts", appId, "public", "data", "Auditorias"), dt);
        let gM = Array.from(new Set([...ae, ...aue])); if(globalAuditPlan) globalAuditPlan.correos.forEach(x=>gM.push(x)); gM.push(EMAIL_ADMIN_SGC);
        window.sendNotification({to: gM.join(',')}, "Auditoría Programada", `Auditoría ${aNum} programada el ${window.formatearFechaAbreviada(f)}. Req: ${r}`);
        alert(`Auditoría ${aNum} programada.`);
    }
    window.cancelarEdicionAuditoria(); window.hideLoading();
};
window.renderTablaAuditorias = (yf) => {
    if(!$('tbody-auditorias')) return; let isAdm = currentUser.permisos.p_audit_admin||currentUser.permisos.admin||currentUser.permisos.p_gest_sgc;
    globalAuditorias = globalAllAuditorias.filter(a => { if(a.fecha&&!a.fecha.startsWith(yf)) return false; return isAdm || (a.auditado&&a.auditado.includes(currentUser.nombre)) || (a.auditor&&a.auditor.includes(currentUser.nombre)); });
    globalAuditorias.sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)); let h="";
    globalAuditorias.forEach(a => {
        let e=a.estado||'Programada', b=e==='Completada'?'badge-success':(e==='En Progreso'?'badge-info':'badge-warning');
        let btn=`<button class="btn btn-primary" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.verModalAuditoria('${a.id}')">Ver</button>`;
        const isAuditor = a.auditor && a.auditor.includes(currentUser.nombre); const canControl = isAdm || isAuditor;
        if (canControl) { 
            if (e==='Programada') btn+=`<button class="btn btn-success" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.iniciarAuditoriaDirecto('${a.id}')">Iniciar</button>`; 
            else if (e==='En Progreso') btn+=`<button class="btn btn-warning" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.finalizarAuditoriaDirecto('${a.id}')">Fin</button>`; btn+=`<button class="btn btn-info" style="padding:4px;font-size:10px;margin-right:5px;" onclick="window.cargarAuditoriaParaEditar('${a.id}')">Ed</button>`;
        }
        if(isAdm) btn+=`<button class="btn-icon-danger" onclick="window.del('Auditorias','${a.id}')">X</button>`;
        h+=`<tr><td><b>${a.audit_num||'-'}</b></td><td><b>${window.formatearFechaAbreviada(a.fecha)}</b><br><small>${a.hora_inicio||''} - ${a.hora_fin||''}</small></td><td>${a.requisitos?a.requisitos.substring(0,30)+'...':'-'}</td><td>${a.auditado||'-'}</td><td>${a.auditor||'-'}</td><td><span class="badge ${b}">${e}</span></td><td class="no-export">${btn}</td></tr>`;
    });
    $('tbody-auditorias').innerHTML = h; if(isAdm) window.verificarAlertasAuditoria(globalAuditorias);
};
window.iniciarAuditoriaDirecto = async (id) => { if(!confirm("?")) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"En Progreso", hora_real_inicio:new Date().toISOString()}); window.hideLoading(); };
window.finalizarAuditoriaDirecto = async (id) => { if(!confirm("?")) return; window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), {estado:"Completada", hora_real_fin:new Date().toISOString()}); window.hideLoading(); };

window.verModalAuditoria = async (id) => {
    selectedAuditId = id; const sn = await getDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id)); if(!sn.exists()) return; selectedAuditData = sn.data(); const a = selectedAuditData;
    ['ma-num','ma-proceso','ma-fecha','ma-hora','ma-lugar','ma-auditado','ma-auditor','ma-req','ma-obs','rep-num','rep-org','rep-dir','rep-sitios','rep-fechas','rep-personal','rep-turnos','rep-lider','rep-adicionales','rep-formacion','rep-alcance'].forEach(i => { if($(i)) $(i).innerText = a[i.replace('ma-','').replace('rep-','')] || (globalAuditPlan?globalAuditPlan[i.replace('rep-','')]:'') || '-'; });
    $('ma-fecha').innerText = window.formatearFechaAbreviada(a.fecha); $('ma-hora').innerText = `${a.hora_inicio} a ${a.hora_fin}`; $('ma-req').innerText = a.requisitos; $('rep-fechas').innerText = window.formatearFechaAbreviada(a.fecha); $('rep-lider').innerText = globalAuditPlan?globalAuditPlan.lider:''; $('rep-adicionales').innerText = a.auditor; $('rep-formacion').innerText = a.auditores_formacion||''; $('rep-alcance').innerText = globalAuditPlan?globalAuditPlan.alcance:'';
    
    let e = a.estado||'Programada'; $('ma-estado-badge').className=`badge ${e==='Completada'?'badge-success':(e==='En Progreso'?'badge-info':'badge-warning')}`; $('ma-estado-badge').innerText=e.toUpperCase();
    $('ma-inicio-real').innerText=a.hora_real_inicio?new Date(a.hora_real_inicio).toLocaleString():'---'; $('ma-fin-real').innerText=a.hora_real_fin?new Date(a.hora_real_fin).toLocaleString():'---';
    if(a.hora_real_inicio && a.hora_real_fin) { let m=new Date(a.hora_real_fin)-new Date(a.hora_real_inicio); $('ma-duracion').innerText=`${Math.floor(m/3600000)}h ${Math.floor((m%3600000)/60000)}m`; }
    
    const isAdm = currentUser.permisos.admin || currentUser.permisos.p_audit_admin, isAud = a.auditor&&a.auditor.includes(currentUser.nombre), canEd = (isAdm||isAud)&&e!=='Completada';
    setDisplay('btn-comenzar-auditoria', (isAdm||isAud)&&e==='Programada'?'inline-block':'none'); setDisplay('btn-finalizar-auditoria', (isAdm||isAud)&&e==='En Progreso'?'inline-block':'none');
    if($('chat-box-audit')) $('chat-box-audit').innerHTML = a.bitacora?a.bitacora.map(c=>`<div class="chat-msg"><b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}${c.archivo?`<br><a href="#" onclick="window.abrirDocumento('${c.archivo}','${c.archivo_nombre}');return false;" style="font-size:10px;color:blue;">📎 Ver</a>`:''}</div>`).join(''):'';
    
    currentAuditF020 = a.lista_verificacion||[]; window.renderF020();
    ['f003-conclusiones','f003-n-proceso','f003-n-personal','f003-n-cargo','f003-n-req','f003-n-doc','f003-n-evidencia'].forEach(i=>{if($(i))$(i).disabled=!canEd;});
    if(a.reporte_auditoria) { ['conclusiones','n_proceso','n_personal','n_cargo','n_req','n_doc','n_evidencia'].forEach(k=>{ if($('f003-'+k)) $('f003-'+k).value=a.reporte_auditoria[k]||""; }); }
    
    window.actualizarMetricasF003(canEd); window.renderAuditSACs();
    setDisplay('btn-tab-f020', (isAdm||isAud)?'inline-block':'none'); setDisplay('btn-add-f020', canEd?'inline-block':'none'); setDisplay('btn-save-f020', canEd?'inline-block':'none'); setDisplay('btn-submit-f020', canEd?'inline-block':'none'); setDisplay('btn-save-f003', canEd?'inline-block':'none'); setDisplay('btn-add-sac-manual', canEd?'inline-block':'none');
    window.switchAuditTab('info'); setDisplay('modal-auditoria', 'flex');
};

window.comenzarAuditoria = async () => { await window.iniciarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.finalizarAuditoria = async () => { await window.finalizarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.enviarComentarioAuditoria = async () => { const b=$('ma-comentario-libre'), th=b.innerHTML, f=$('ma-file-comentario'); if(!b.innerText.trim()&&!f.files[0])return; window.showLoading(); let u=null, fn=null; if(f.files[0]){u=await window.uploadToCloudinary(f.files[0]); fn=f.files[0].name;} await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId),{bitacora:arrayUnion({u:currentUser.nombre,m:`💬 ${th}`,t:new Date().toLocaleString(),archivo:u,archivo_nombre:fn})}); b.innerHTML=""; f.value=""; window.hideLoading(); window.verModalAuditoria(selectedAuditId); };

window.renderF020 = () => {
    if(!$('tbody-f020')) return; let canEd = selectedAuditData.estado!=='Completada' && (currentUser.permisos.admin||currentUser.permisos.p_audit_admin||(selectedAuditData.auditor&&selectedAuditData.auditor.includes(currentUser.nombre))); let h="";
    let rqs = selectedAuditData.requisitos ? selectedAuditData.requisitos.split(', ') : [];
    let aOps = `<option value="">-- Sel --</option>` + (selectedAuditData.auditado?selectedAuditData.auditado.split(', ').map(a=>`<option value="${a}">${a}</option>`).join(''):'');
    currentAuditF020.forEach((i, idx) => {
        let dis=canEd?'':'disabled', rOpt=`<option value="">-- Sel --</option>`+rqs.map(r=>`<option value="${r}" ${i.requisito===r?'selected':''}>${r}</option>`).join('');
        let aOpt=`<option value="${i.auditado||''}" selected>${i.auditado||'-- Sel --'}</option>`+aOps;
        let nOpt=`<option value="N/A" ${i.nc==='N/A'||!i.nc?'selected':''}>N/A</option><option value="NC Menor" ${i.nc==='NC Menor'?'selected':''}>NC Menor</option><option value="NC Mayor" ${i.nc==='NC Mayor'?'selected':''}>NC Mayor</option><option value="OM" ${i.nc==='OM'?'selected':''}>OM</option>`;
        let fOpt=`<option value="N/A" ${i.fortaleza==='N/A'||!i.fortaleza?'selected':''}>N/A</option><option value="Sí" ${i.fortaleza==='Sí'?'selected':''}>Sí</option>`;
        h+=`<tr data-id="${i.id}"><td>${idx+1}</td><td><textarea class="table-input" rows="2" ${dis}>${i.pregunta||''}</textarea></td><td><select class="table-select" ${dis}>${rOpt}</select></td><td><textarea class="table-input" rows="2" ${dis}>${i.comentarios||''}</textarea></td><td><select class="table-select" ${dis}>${aOpt}</select></td><td><select class="table-select hallazgo-sel" ${dis}>${nOpt}</select></td><td><textarea class="table-input" rows="2" ${dis}>${i.observacion||''}</textarea></td><td><select class="table-select" ${dis}>${fOpt}</select></td><td class="f020-action-col">${canEd?`<button class="btn-icon-danger" onclick="window.eliminarF020('${i.id}')"><span class="material-icons-round">delete</span></button>`:''}</td></tr>`;
    }); $('tbody-f020').innerHTML = h; $$('.f020-action-col').forEach(e=>e.style.display=canEd?'':'none');
};
window.agregarFilaF020 = () => { currentAuditF020.push({ id:'f020_'+Date.now(), pregunta:'', requisito:'', comentarios:'', auditado:'', nc:'N/A', observacion:'', fortaleza:'N/A' }); window.renderF020(); };
window.eliminarF020 = (id) => { if(!confirm("?"))return; currentAuditF020=currentAuditF020.filter(x=>x.id!==id); window.renderF020(); };
window.guardarF020 = async (notificar=false) => { let dA=[]; $$('#tbody-f020 tr').forEach(tr=>{let inps=tr.querySelectorAll('.table-input, .table-select'); dA.push({id:tr.dataset.id, pregunta:inps[0].value, requisito:inps[1].value, comentarios:inps[2].value, auditado:inps[3].value, nc:inps[4].value, observacion:inps[5].value, fortaleza:inps[6].value});}); window.showLoading(); await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId),{lista_verificacion:dA}); if(notificar) { window.sendNotification({to: EMAIL_ADMIN_SGC}, "F-020 Actualizado", `Auditor ${currentUser.nombre} subió F-020.`); alert("Guardado y Notificado"); } else { alert("F-020 Guardado."); } window.hideLoading(); window.verModalAuditoria(selectedAuditId); };
window.enviarPreguntasSGC = () => window.guardarF020(true);

window.generarBloqueNCDinamico = (i, idx, t, canEd) => {
    let d = selectedAuditData.reporte_auditoria?.detalles_nc?.[i.id] || {}; let dis=canEd?'':'disabled';
    return `<div style="border:1px solid #ccc;font-size:12px;margin-bottom:15px;" class="f003-hallazgo-block" data-id="${i.id}"><div style="display:grid;grid-template-columns:150px 1fr;"><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">No. de ${t}</div><div style="padding:8px;border:1px solid #ccc;">${idx}</div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Dpto/Función</div><div style="padding:0;border:1px solid #ccc;"><input type="text" class="h-dep" value="${d.departamento||i.auditado||''}" ${dis} style="border:none;width:100%;height:100%;"></div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Doc Ref</div><div style="padding:0;border:1px solid #ccc;"><input type="text" class="h-doc" value="${d.doc_ref||''}" ${dis} style="border:none;width:100%;height:100%;"></div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Requisito Afectado</div><div style="padding:0;border:1px solid #ccc;"><input type="text" class="h-req" value="${d.requisito||i.requisito||''}" ${dis} style="border:none;width:100%;height:100%;"></div><div style="padding:8px;background:#f1f5f9;border:1px solid #ccc;">Detalle</div><div style="padding:0;border:1px solid #ccc;"><textarea class="h-det" ${dis} style="border:none;width:100%;height:100%;min-height:40px;padding:8px;">${d.detalle||i.comentarios||i.pregunta||''}</textarea></div></div></div>`;
};
window.actualizarMetricasF003 = (canEd) => {
    let nM=0, nm=0, om=0, hM="", hm="", ho=""; currentAuditF020.forEach(i => { if(i.nc==='NC Mayor'){nM++;hM+=window.generarBloqueNCDinamico(i,nM,'NC Mayor',canEd);} if(i.nc==='NC Menor'){nm++;hm+=window.generarBloqueNCDinamico(i,nm,'NC Menor',canEd);} if(i.nc==='OM'){om++;ho+=window.generarBloqueNCDinamico(i,om,'OM',canEd);} });
    if($('f003-nc-mayor')) $('f003-nc-mayor').innerText=nM; if($('f003-nc-menor')) $('f003-nc-menor').innerText=nm; if($('f003-om')) $('f003-om').innerText=om;
    if($('container-nc-menor')) $('container-nc-menor').innerHTML=hm||"<p style='font-size:11px;color:#94a3b8;'>Ninguna.</p>"; if($('container-nc-mayor')) $('container-nc-mayor').innerHTML=hM||"<p style='font-size:11px;color:#94a3b8;'>Ninguna.</p>"; if($('container-om')) $('container-om').innerHTML=ho||"<p style='font-size:11px;color:#94a3b8;'>Ninguna.</p>";
};
window.guardarF003 = async () => { window.showLoading(); let dN={}; $$('.f003-hallazgo-block').forEach(b => dN[b.dataset.id] = {departamento:b.querySelector('.h-dep').value, doc_ref:b.querySelector('.h-doc').value, requisito:b.querySelector('.h-req').value, detalle:b.querySelector('.h-det').value}); let rD = { conclusiones:$('f003-conclusiones').value, n_proceso:$('f003-n-proceso').value, n_personal:$('f003-n-personal').value, n_cargo:$('f003-n-cargo').value, n_req:$('f003-n-req').value, n_doc:$('f003-n-doc').value, n_evidencia:$('f003-n-evidencia').value, detalles_nc:dN }; await updateDoc(doc(db,"artifacts",appId,"public","data","Auditorias",selectedAuditId),{reporte_auditoria:rD}); window.hideLoading(); alert("Reporte F-003 guardado."); };

window.renderAuditSACs = () => {
    const tb = $('tbody-audit-sacs'); if(!tb) return; let hs = currentAuditF020.filter(i=>i.nc==='NC Mayor'||i.nc==='NC Menor'||i.nc==='OM');
    if(hs.length===0) return tb.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No hay NC/OM.</td></tr>"; let ht="";
    hs.forEach((h, idx) => {
        let sac = globalAllSacs.find(s=>s.f020_id===h.id), bd='', es='SIN GENERAR', btn='', cb=h.nc==='NC Mayor'?'badge-danger':(h.nc==='NC Menor'?'badge-warning':'badge-info');
        if(sac) { es=sac.estado||''; let bs=es.includes('Abierta')?'badge-danger':(es==='En Seguimiento'?'badge-warning':'badge-success'); bd=`<span class="badge ${bs}">${es.toUpperCase()}</span><br><small>${sac.sac_num}</small>`; btn=`<button class="btn btn-primary" style="padding:4px;font-size:10px;" onclick="window.verSAC('${sac.sac_id}')">VER</button>`; }
        else { bd=`<span class="badge badge-dark">NO CREADA</span>`; if(currentUser.permisos.p_audit_auditor||currentUser.permisos.admin||(selectedAuditData&&selectedAuditData.auditor&&selectedAuditData.auditor.includes(currentUser.nombre))) btn=`<button class="btn btn-info" style="padding:4px;font-size:10px;" onclick="window.abrirCrearSAC('${h.id}')">CREAR SAC</button>`; }
        ht += `<tr><td><b>Ref. ${idx+1}</b><br><small>${h.pregunta.substring(0,30)}...</small></td><td>${h.comentarios}</td><td><span class="badge ${cb}">${h.nc}</span></td><td>${bd}</td><td>${btn}</td></tr>`;
    }); tb.innerHTML = ht;
};

window.addPlanRow = (d="", r="", i="", f="") => { const tb=$('tbody-plan-accion'); let tr=document.createElement('tr'); tr.innerHTML=`<td style="border:1px solid #ccc;">${tb.children.length+1}</td><td style="padding:0;"><input type="text" value="${d}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="text" value="${r}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="date" value="${i}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="date" value="${f}" style="width:100%;border:none;margin:0;"></td><td style="text-align:center;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round">delete</span></button></td>`; tb.appendChild(tr); };
window.addSeguimientoRow = (res="", r="", f="") => { const tb=$('tbody-seguimiento'); let tr=document.createElement('tr'); tr.innerHTML=`<td style="border:1px solid #ccc;">${tb.children.length+1}</td><td style="padding:0;"><input type="text" value="${res}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="text" value="${r}" style="width:100%;border:none;margin:0;"></td><td style="padding:0;"><input type="date" value="${f}" style="width:100%;border:none;margin:0;"></td><td style="text-align:center;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round">delete</span></button></td>`; tb.appendChild(tr); };

window.abrirCrearSAC = (id) => {
    let h = currentAuditF020.find(i=>i.id===id); if(!h) return; currentEditingSacId = null; currentEditingF020Ref = h;
    $('sac-num').innerText = "POR ASIGNAR"; $('sac-estado-badge').innerText = "NUEVA"; $('sac-estado-badge').className = "badge badge-info"; $('sac-fecha').value = new Date().toISOString().split('T')[0];
    $('sac-proceso').value = h.requisito||""; $('sac-tipo').value = h.nc||"";
    $('sac-tipo-doc-afectado').innerHTML='<option value="">-- No aplica --</option>'+tiposDocumento.map(t=>`<option value="${t}">${t}</option>`).join(''); $('sac-tipo-doc-afectado').value="";
    $('sac-fuente').value="Auditoría Interna"; $('sac-fuente-otro').value=""; $('sac-detalle').value=h.comentarios||h.pregunta; $('sac-beneficio').value=""; $('sac-causa').value=""; $('sac-accion').value="";
    $('tbody-plan-accion').innerHTML=""; $('sac-fecha-aprob-plan').value=""; $('tbody-seguimiento').innerHTML=""; $('sac-resp-cierre').value=""; $('sac-fecha-cierre').value=""; $('sac-check-cerrar').checked=false;
    let auds=selectedAuditData?.auditado?selectedAuditData.auditado.split(', '):[], op='<option value="">-- Responsable --</option>';
    allUsers.forEach(u=>{op+=`<option value="${u.usuario}">${auds.includes(u.nombre)?'⭐ ':''}${u.nombre}</option>`;}); $('sac-dueno').innerHTML=op; setDisplay('modal-sac', 'flex');
};

window.abrirCrearSACManual = () => {
    currentEditingSacId = null; currentEditingF020Ref = null;
    $('sac-num').innerText = "POR ASIGNAR"; $('sac-estado-badge').innerText = "NUEVA"; $('sac-estado-badge').className = "badge badge-info"; $('sac-fecha').value = new Date().toISOString().split('T')[0];
    $('sac-proceso').value = selectedAuditData?.requisitos||""; $('sac-tipo').value = "OM";
    $('sac-tipo-doc-afectado').innerHTML='<option value="">-- No aplica --</option>'+tiposDocumento.map(t=>`<option value="${t}">${t}</option>`).join(''); $('sac-tipo-doc-afectado').value="";
    $('sac-fuente').value="Auditoría Interna"; $('sac-fuente-otro').value=""; $('sac-detalle').value=""; $('sac-beneficio').value=""; $('sac-causa').value=""; $('sac-accion').value="";
    $('tbody-plan-accion').innerHTML=""; $('sac-fecha-aprob-plan').value=""; $('tbody-seguimiento').innerHTML=""; $('sac-resp-cierre').value=""; $('sac-fecha-cierre').value=""; $('sac-check-cerrar').checked=false;
    let auds=selectedAuditData?.auditado?selectedAuditData.auditado.split(', '):[], op='<option value="">-- Responsable --</option>';
    allUsers.forEach(u=>{op+=`<option value="${u.usuario}">${auds.includes(u.nombre)?'⭐ ':''}${u.nombre}</option>`;}); $('sac-dueno').innerHTML=op; setDisplay('modal-sac', 'flex');
};

window.verSAC = (id) => {
    let sac = globalAllSacs.find(s=>s.sac_id===id); if(!sac) return; currentEditingSacId = id;
    $('sac-num').innerText=sac.sac_num; let es=sac.estado||"", bs=es.includes('Abierta')?'badge-danger':(es==='En Seguimiento'?'badge-warning':'badge-success'); $('sac-estado-badge').innerText=es.toUpperCase(); $('sac-estado-badge').className=`badge ${bs}`;
    $('sac-fecha').value=sac.fecha_registro||(sac.fecha_apertura?sac.fecha_apertura.split('T')[0]:""); $('sac-proceso').value=sac.proceso||""; $('sac-tipo').value=sac.tipo_hallazgo||"";
    $('sac-tipo-doc-afectado').innerHTML='<option value="">-- No aplica --</option>'+tiposDocumento.map(t=>`<option value="${t}">${t}</option>`).join(''); $('sac-tipo-doc-afectado').value=sac.tipo_doc_afectado||"";
    $('sac-fuente').value=sac.fuente_nc||"Auditoría Interna"; $('sac-fuente-otro').value=sac.fuente_otro||""; $('sac-detalle').value=sac.detalle_nc||""; $('sac-beneficio').value=sac.beneficio_esperado||""; $('sac-causa').value=sac.causa_raiz||""; $('sac-accion').value=sac.accion_implementar||"";
    let auds=selectedAuditData?.auditado?selectedAuditData.auditado.split(', '):[], op='<option value="">-- Responsable --</option>';
    allUsers.forEach(u=>{op+=`<option value="${u.usuario}" ${sac.dueno_uid===u.usuario?'selected':''}>${auds.includes(u.nombre)?'⭐ ':''}${u.nombre}</option>`;}); $('sac-dueno').innerHTML=op;
    $('tbody-plan-accion').innerHTML=""; if(sac.plan_accion) sac.plan_accion.forEach(p=>window.addPlanRow(p.detalle,p.resp,p.inicio,p.fin)); $('sac-fecha-aprob-plan').value=sac.fecha_aprobacion_plan||"";
    $('tbody-seguimiento').innerHTML=""; if(sac.seguimiento) sac.seguimiento.forEach(s=>window.addSeguimientoRow(s.resultado,s.resp,s.fecha));
    $('sac-resp-cierre').value=sac.cerrado_por||""; $('sac-fecha-cierre').value=sac.fecha_cierre?sac.fecha_cierre.split('T')[0]:""; $('sac-check-cerrar').checked=es==='Cerrada'; setDisplay('modal-sac', 'flex');
};

window.guardarSAC = async () => {
    window.showLoading(); let pA=[], sA=[]; 
    $$('#tbody-plan-accion tr').forEach(tr=>{let i=tr.querySelectorAll('input'); if(i[0].value.trim()) pA.push({detalle:i[0].value, resp:i[1].value, inicio:i[2].value, fin:i[3].value});});
    $$('#tbody-seguimiento tr').forEach(tr=>{let i=tr.querySelectorAll('input'); if(i[0].value.trim()) sA.push({resultado:i[0].value, resp:i[1].value, fecha:i[2].value});});
    let es="Abierta (En Plan)"; if($('sac-fecha-aprob-plan').value)es="En Seguimiento"; if($('sac-check-cerrar').checked)es="Cerrada";
    let dt = { fecha_registro:$('sac-fecha').value, proceso:$('sac-proceso').value, tipo_doc_afectado:$('sac-tipo-doc-afectado').value||"", fuente_nc:$('sac-fuente').value, fuente_otro:$('sac-fuente-otro').value, beneficio_esperado:$('sac-beneficio').value, causa_raiz:$('sac-causa').value, accion_implementar:$('sac-accion').value, dueno_uid:$('sac-dueno').value, plan_accion:pA, fecha_aprobacion_plan:$('sac-fecha-aprob-plan').value, seguimiento:sA, fecha_cierre:$('sac-fecha-cierre').value, cerrado_por:$('sac-check-cerrar').checked?currentUser.nombre:"", estado:es };

    if(!currentEditingSacId) {
        let nS = ""; await runTransaction(db, async(t)=>{const sn=await t.get(doc(db,"artifacts",appId,"public","data","Contadores","sacs"));let c=1;if(sn.exists())c=sn.data().count+1;t.set(doc(db,"artifacts",appId,"public","data","Contadores","sacs"),{count:c});nS=`SAC-${new Date().getFullYear()}-${String(c).padStart(3,'0')}`;});
        dt.sac_num=nS; dt.audit_id=selectedAuditId||"N/A"; dt.f020_id=currentEditingF020Ref?currentEditingF020Ref.id:"MANUAL"; dt.tipo_hallazgo=currentEditingF020Ref?currentEditingF020Ref.nc:$('sac-tipo').value; dt.detalle_nc=$('sac-detalle').value; dt.fecha_apertura=new Date().toISOString(); dt.auditor_nombre=currentUser.nombre;
        await addDoc(collection(db, "artifacts", appId, "public", "data", "AccionesCorrectivas"), dt); alert(`Generada.`);
    } else { await updateDoc(doc(db, "artifacts", appId, "public", "data", "AccionesCorrectivas", currentEditingSacId), dt); alert("Actualizada."); }
    setDisplay('modal-sac', 'none'); window.hideLoading(); if(selectedAuditId) window.verModalAuditoria(selectedAuditId);
};

window.renderF023Global = () => {
    const tb=$('tbody-noconf'); if(!tb) return; let hs="", fs=[...globalAllSacs], sE=$('filter-noconf-estado'); if(sE&&sE.value)fs=fs.filter(s=>s.estado===sE.value);
    if(!currentUser.permisos.admin&&!currentUser.permisos.p_gest_sgc) fs=fs.filter(s=>s.dueno_uid===currentUser.usuario||s.auditor_nombre===currentUser.nombre);
    fs.sort((a,b)=>b.sac_num>a.sac_num?-1:1);
    fs.forEach(s => {
        let es=s.estado||'', bs=es.includes('Abierta')?'badge-danger':(es==='En Seguimiento'?'badge-warning':'badge-success'); let uD=allUsers.find(u=>u.usuario===s.dueno_uid);
        hs+=`<tr><td><b>${s.sac_num}</b></td><td>${s.proceso}</td><td><b style="${s.tipo_hallazgo==='NC Mayor'?'color:var(--danger)':'color:var(--warning)'}">${s.tipo_hallazgo}</b></td><td>${uD?uD.nombre:s.dueno_uid}</td><td><div style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.detalle_nc}">${s.detalle_nc}</div></td><td>${window.formatearFechaAbreviada(s.fecha_registro||s.fecha_apertura)}</td><td><span class="badge ${bs}">${es}</span></td><td>${s.fecha_cierre?window.formatearFechaAbreviada(s.fecha_cierre):'-'}</td><td class="no-export"><button class="btn btn-primary" style="padding:4px;font-size:10px;" onclick="window.verSACGlobal('${s.sac_id}', '${s.audit_id||'N/A'}')">Revisar</button></td></tr>`;
    }); tb.innerHTML=hs;
};

window.setFilterGestNC = () => window.renderF023Global();
window.verSACGlobal = async (sId, aId) => { selectedAuditData=null; selectedAuditId=null; if(aId&&aId!=="N/A"&&aId!=="undefined") { try{const sn=await getDoc(doc(db,"artifacts",appId,"public","data","Auditorias",aId)); if(sn.exists()){selectedAuditData=sn.data();selectedAuditId=aId;}}catch(e){} } window.verSAC(sId); };

window.exportarExcelNoConf = () => {
    if(globalAllSacs.length===0) return; let dE=globalAllSacs.map(s=>{let u=allUsers.find(x=>x.usuario===s.dueno_uid); return {"N° SAC":s.sac_num, "Req":s.proceso, "Tipo Doc":s.tipo_doc_afectado||'N/A', "Tipo":s.tipo_hallazgo, "Resp":u?u.nombre:s.dueno_uid, "Detalle":s.detalle_nc, "Apertura":s.fecha_apertura?new Date(s.fecha_apertura).toLocaleString():'', "Causa":s.causa_raiz||'', "Acción":s.accion_implementar||'', "Estado":s.estado, "Cierre":s.fecha_cierre?new Date(s.fecha_cierre).toLocaleString():'', "Cerrado Por":s.cerrado_por||'' }; });
    let wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dE), "F-023"); XLSX.writeFile(wb, "F-023_Control_NC.xlsx");
};

const inicializarApp = async () => {
    window.hideLoading(); const su = localStorage.getItem('sgc_session_user');
    if (su) {
        window.showLoading();
        try { const qs = await getDocs(query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("usuario", "==", su)));
              if (!qs.empty) { currentUser = qs.docs[0].data(); window.completarLoginUI(); } else window.logout();
        } catch(e) { window.logout(); } window.hideLoading();
    } else { setDisplay('login-screen', 'flex'); }
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicializarApp); else inicializarApp();
