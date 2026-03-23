import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, setDoc, query, where, getDocs, arrayUnion, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDdzCiachuhbE9jATz-TesPI2vUVIJrHjM",
    authDomain: "sistemadegestion-7400d.firebaseapp.com",
    projectId: "sistemadegestion-7400d",
    storageBucket: "sistemadegestion-7400d.firebasestorage.app",
    messagingSenderId: "709030283072",
    appId: "1:709030283072:web:5997837b36a448e9515ca5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'sgc-final-v6';

const EMAIL_SERVICE_ID = "service_vumxptj"; 
const EMAIL_TEMPLATE_ID = "template_z27y5yk"; 
const EMAIL_PUBLIC_KEY = "kWsovOfdi7dBqLMw2"; 
const EMAIL_ADMIN_SGC = "sistemadegestion@fcipty.com"; 

(function() { emailjs.init(EMAIL_PUBLIC_KEY); })();

const CLOUD_NAME = "df79cjklp"; const UPLOAD_PRESET = "fci_documentos";
const PASOS_NOMBRES = ["Pendiente Documentado", "Pendiente Verificado", "Pendiente Aprobación Gerencia", "Pendiente Aprobación SGC"];

let currentUser = null, selectedId = null, selectedDocData = null, tempAction = "";
let allUsers = [], allDepartamentos = [], tiposDocumento = [], columnasMaestro = [], estatusMaestro = [], dataMaestro = [];
let globalSolicitudes = [], globalAuditPlan = null, globalAllAuditorias = [], globalAuditorias = [];
let selectedAuditId = null, selectedAuditData = null, editandoAuditoriaId = null;
let currentAuditF020 = [], globalAllSacs = [], currentEditingSacId = null, currentEditingF020Ref = null;

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
            const response = await fetch(url);
            if (!response.ok) throw new Error("Error de red");
            const blob = await response.blob(); const fileObj = new File([blob], safeName, { type: blob.type });
            const blobUrl = window.URL.createObjectURL(fileObj);
            nuevaPestana.location.href = blobUrl; setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
        } catch (e) { nuevaPestana.location.href = url; }
    } else {
        window.showLoading();
        try {
            const response = await fetch(url); const blob = await response.blob(); const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = blobUrl; a.download = safeName; document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(blobUrl); document.body.removeChild(a);
        } catch (e) { window.open(url, '_blank'); }
        window.hideLoading();
    }
};

window.cargarDatosCentrales = () => {
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "Usuarios"), (snap) => {
        allUsers = []; let htmlUsers = ""; let optUsers = "";
        snap.forEach(doc => { 
            let u = doc.data(); allUsers.push(u); let gers = u.gerencias ? u.gerencias.join(', ') : (u.gerencia || 'N/A');
            htmlUsers += `<tr><td>${u.nombre} (${u.usuario})</td><td>${u.email||''}</td><td>${u.role||''} / <small>${gers}</small></td><td class="no-export"><button class="btn btn-info" style="padding:4px 8px; font-size:10px;" onclick="window.cargarUsuarioParaEditar('${u.usuario}')">Editar</button></td></tr>`;
            optUsers += `<option value="${u.nombre}" data-email="${u.email}">${u.nombre} (${gers})</option>`;
        });
        if (document.getElementById('tbody-users')) document.getElementById('tbody-users').innerHTML = htmlUsers;
        if (document.getElementById('aud-auditado-sel')) document.getElementById('aud-auditado-sel').innerHTML = optUsers;
        if (document.getElementById('aud-auditor-sel')) document.getElementById('aud-auditor-sel').innerHTML = optUsers;
        if (document.getElementById('ah-auditor-list')) document.getElementById('ah-auditor-list').innerHTML = optUsers;
    });

    onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), (docSnap) => {
        if(docSnap.exists()) {
            const d = docSnap.data(); tiposDocumento = d.tiposDoc || []; columnasMaestro = d.columnas || []; estatusMaestro = d.estatus || []; window.renderListasConfig();
        }
    });

    onSnapshot(doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"), (docSnap) => {
        let deps = []; let gers = [];
        if(docSnap.exists()) { const d = docSnap.data(); deps = d.departamentos || []; gers = d.gerencias || []; }
        allDepartamentos = deps;
        let gHtml = ""; gers.forEach(g => gHtml += `<option value="${g}">${g}</option>`);
        if(document.getElementById('d-ger-sel')) document.getElementById('d-ger-sel').innerHTML = gHtml;
        if(document.getElementById('sol-ger')) document.getElementById('sol-ger').innerHTML = '<option value="">-- Seleccionar --</option>' + gHtml;
        if(document.getElementById('list-ger')) document.getElementById('list-ger').innerHTML = gers.map((g, idx) => `<div class="settings-item"><span>${g}</span><button class="btn-icon-danger" onclick="window.eliminarGerencia(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join('');
        if(document.getElementById('list-dep')) document.getElementById('list-dep').innerHTML = deps.map((dep, idx) => `<div class="settings-item"><span>${dep.nombre} <small>(${dep.gerencia})</small></span><button class="btn-icon-danger" onclick="window.eliminarDepartamento(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`).join('');
        
        // CHECKBOXES PARA USUARIOS
        if(document.getElementById('u-ger-list')) document.getElementById('u-ger-list').innerHTML = gers.map(g => `<label style="display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:6px;"><input type="checkbox" value="${g}"> ${g}</label>`).join('');
    });

    onSnapshot(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), (snap) => {
        dataMaestro = []; snap.forEach(doc => { let d = doc.data(); d.docId = doc.id; dataMaestro.push(d); }); window.renderTablaMaestro();
    });

    onSnapshot(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), (snap) => {
        globalSolicitudes = []; snap.forEach(doc => { let d = doc.data(); d.docId = doc.id; globalSolicitudes.push(d); }); window.renderTablasSolicitudes(); window.checkDailyAlerts();
    });

    onSnapshot(collection(db, "artifacts", appId, "public", "data", "Auditorias"), (snap) => {
        globalAllAuditorias = []; snap.forEach(doc => { let d = doc.data(); d.id = doc.id; globalAllAuditorias.push(d); });
        let currentYear = new Date().getFullYear().toString();
        let yearSelect = document.getElementById('aud-year-select');
        if(yearSelect && yearSelect.options.length === 0) { yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option><option value="nuevo">+ Añadir Año</option>`; }
        window.loadAuditPlan(yearSelect ? yearSelect.value : currentYear); window.renderTablaAuditorias(yearSelect ? yearSelect.value : currentYear);
    });

    onSnapshot(collection(db, "artifacts", appId, "public", "data", "AccionesCorrectivas"), (snap) => {
        globalAllSacs = []; snap.forEach(doc => { let d = doc.data(); d.sac_id = doc.id; globalAllSacs.push(d); }); window.renderF023Global();
    });
};

window.renderTablasSolicitudes = () => {
    let htmlHist = "", htmlAll = "", htmlGest = "";
    let sorted = [...globalSolicitudes].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    sorted.forEach(s => {
        let estadoStr = s.estado || "";
        let isCancelado = estadoStr === 'Anulado' || estadoStr === 'Rechazado';
        let isAprobado = estadoStr.includes('Aprobado Final');
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

    if(document.getElementById('tbody-historial')) document.getElementById('tbody-historial').innerHTML = htmlHist;
    if(document.getElementById('tbody-all')) document.getElementById('tbody-all').innerHTML = htmlAll;
    if(document.getElementById('tbody-gestionar')) document.getElementById('tbody-gestionar').innerHTML = htmlGest;

    if(document.getElementById('dash-mis-tot')) {
        let misSol = sorted.filter(s => s.uid === currentUser.usuario || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase())));
        document.getElementById('dash-mis-tot').innerText = misSol.length;
        document.getElementById('dash-mis-pend').innerText = misSol.filter(s => !s.estado.includes('Aprobado') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length;
        document.getElementById('dash-mis-ok').innerText = misSol.filter(s => s.estado.includes('Aprobado Final')).length;
        document.getElementById('dash-mis-rech').innerText = misSol.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length;
    }
    if(document.getElementById('dash-glob-tot') && currentUser.permisos && (currentUser.permisos.admin || currentUser.permisos.p_gest_sgc)) {
        document.getElementById('dash-admin-section').style.display = 'block';
        document.getElementById('dash-glob-tot').innerText = sorted.length;
        document.getElementById('dash-glob-pend').innerText = sorted.filter(s => !s.estado.includes('Aprobado') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length;
        document.getElementById('dash-glob-ok').innerText = sorted.filter(s => s.estado.includes('Aprobado Final')).length;
        document.getElementById('dash-glob-rech').innerText = sorted.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length;
    }
};

window.completarLoginUI = () => {
    const loginScreen = document.getElementById('login-screen'); if(loginScreen) loginScreen.style.display = 'none';
    const sidebar = document.getElementById('sidebar'); if(sidebar) sidebar.style.display = 'flex';
    const main = document.getElementById('main'); if(main) main.style.display = 'block';
    
    const currNameEl = document.getElementById('curr-name'); if(currNameEl) currNameEl.innerText = currentUser.nombre || 'Usuario';
    const currGerEl = document.getElementById('curr-ger'); if(currGerEl) currGerEl.innerText = currentUser.gerencias ? currentUser.gerencias.join(', ') : (currentUser.gerencia || 'Sin Gerencia');

    const p = currentUser.permisos || {};
    const adminMenu = document.getElementById('admin-only'); if(adminMenu) adminMenu.style.display = (p.admin || p.p_users || p.p_struct) ? 'block' : 'none';
    const auditGroup = document.getElementById('nav-audit-group'); if(auditGroup) auditGroup.style.display = (p.admin || p.p_audit_ver || p.p_audit_admin || p.p_audit_auditor || p.p_audit_dueno) ? 'block' : 'none';
    const navListado = document.getElementById('nav-listado'); if(navListado) navListado.style.display = (p.admin || p.p_ver_listado) ? 'flex' : 'none';
    const navAll = document.getElementById('nav-all'); if(navAll) navAll.style.display = (p.admin || p.p_ver_todas) ? 'flex' : 'none';

    // BOTONES DE AUDITORÍA (VISIBLES SÓLO PARA ADMINS DE AUDITORÍA)
    let isAdminAudit = p.admin || p.p_audit_admin || p.p_gest_sgc;
    if(document.getElementById('btn-config-plan')) document.getElementById('btn-config-plan').style.display = isAdminAudit ? 'inline-flex' : 'none';
    if(document.getElementById('btn-nueva-aud')) document.getElementById('btn-nueva-aud').style.display = isAdminAudit ? 'inline-flex' : 'none';

    window.cargarDatosCentrales();
    const navDash = document.getElementById('nav-dash'); if(navDash) window.cambiarVista('sec-dash', navDash);
};

window.logout = () => {
    localStorage.removeItem('sgc_session_user'); currentUser = null;
    const sidebar = document.getElementById('sidebar'); if(sidebar) sidebar.style.display = 'none';
    const main = document.getElementById('main'); if(main) main.style.display = 'none';
    const loginScreen = document.getElementById('login-screen'); if(loginScreen) loginScreen.style.display = 'flex';
    const userEl = document.getElementById('login-user'); if(userEl) userEl.value = '';
    const passEl = document.getElementById('login-pass'); if(passEl) passEl.value = '';
};

window.iniciarSesion = async () => {
    const u = document.getElementById('login-user').value.toLowerCase().trim(); const p = document.getElementById('login-pass').value.trim();
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
        else { alert("Credenciales incorrectas. Verifica tu usuario o contraseña."); }
    } catch (error) { alert("Hubo un problema al conectar con la base de datos."); } finally { window.hideLoading(); }
};

window.cargarUsuarioParaEditar = (usuarioId) => {
    const u = allUsers.find(x => x.usuario === usuarioId); if(!u) return;
    document.getElementById('user-form-title').innerText = "Editando Usuario: " + u.usuario;
    document.getElementById('u-nom').value = u.nombre || ''; document.getElementById('u-usr').value = u.usuario || ''; document.getElementById('u-usr').disabled = true; document.getElementById('u-pas').value = u.pass || ''; document.getElementById('u-rol').value = u.role || ''; document.getElementById('u-email').value = u.email || '';
    
    let gers = u.gerencias || []; if(!u.gerencias && u.gerencia) gers = [u.gerencia];
    document.querySelectorAll('#u-ger-list input[type="checkbox"]').forEach(cb => { cb.checked = gers.includes(cb.value); });
    
    const p = u.permisos || {};
    document.getElementById('p-solicitar').checked = p.can_solicit || false; document.getElementById('p-ver-propias').checked = p.p_ver_propias || false; document.getElementById('p-ver-ger').checked = p.p_ver_ger || false; document.getElementById('p-ver-todas').checked = p.p_ver_todas || false; document.getElementById('p-paso1').checked = p.p_paso1 || false; document.getElementById('p-paso2').checked = p.p_paso2 || false; document.getElementById('p-paso4').checked = p.p_paso4 || false; document.getElementById('p-gest-sgc').checked = p.p_gest_sgc || false; document.getElementById('p-ger-apr').checked = p.p_ger_apr || false; document.getElementById('p-users').checked = p.p_users || false; document.getElementById('p-struct').checked = p.p_struct || false; document.getElementById('p-ver-listado').checked = p.p_ver_listado || false; document.getElementById('p-audit-ver').checked = p.p_audit_ver || false; document.getElementById('p-audit-admin').checked = p.p_audit_admin || false; document.getElementById('p-audit-auditor').checked = p.p_audit_auditor || false; document.getElementById('p-audit-dueno').checked = p.p_audit_dueno || false; document.getElementById('p-admin').checked = p.admin || false;
    document.getElementById('btnSaveUser').innerText = "ACTUALIZAR USUARIO"; document.getElementById('btnCancelEdit').style.display = 'inline-flex'; window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetUserForm = () => {
    document.getElementById('user-form-title').innerText = "Registrar / Editar Usuario";
    document.getElementById('u-nom').value = ""; document.getElementById('u-usr').value = ""; document.getElementById('u-usr').disabled = false; document.getElementById('u-pas').value = "123"; document.getElementById('u-rol').value = ""; document.getElementById('u-email').value = "";
    document.querySelectorAll('#u-ger-list input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('p-solicitar').checked = false; document.getElementById('p-ver-propias').checked = true; document.getElementById('p-ver-ger').checked = false; document.getElementById('p-ver-todas').checked = false; document.getElementById('p-paso1').checked = false; document.getElementById('p-paso2').checked = false; document.getElementById('p-paso4').checked = false; document.getElementById('p-gest-sgc').checked = false; document.getElementById('p-ger-apr').checked = false; document.getElementById('p-users').checked = false; document.getElementById('p-struct').checked = false; document.getElementById('p-ver-listado').checked = false; document.getElementById('p-audit-ver').checked = false; document.getElementById('p-audit-admin').checked = false; document.getElementById('p-audit-auditor').checked = false; document.getElementById('p-audit-dueno').checked = false; document.getElementById('p-admin').checked = false;
    document.getElementById('btnSaveUser').innerText = "GUARDAR USUARIO"; document.getElementById('btnCancelEdit').style.display = 'none';
};

window.guardarUsuario = async () => {
    const nom = document.getElementById('u-nom').value.trim(); const usr = document.getElementById('u-usr').value.toLowerCase().trim(); const pas = document.getElementById('u-pas').value.trim(); const rol = document.getElementById('u-rol').value.trim(); const email = document.getElementById('u-email').value.trim().toLowerCase();
    
    const gerenciasSel = []; document.querySelectorAll('#u-ger-list input:checked').forEach(cb => { gerenciasSel.push(cb.value); });
    
    if(!nom || !usr || !pas || gerenciasSel.length === 0) return alert("Nombre, Usuario, Contraseña y al menos 1 Gerencia son obligatorios.");
    const permisos = { can_solicit: document.getElementById('p-solicitar').checked, p_ver_propias: document.getElementById('p-ver-propias').checked, p_ver_ger: document.getElementById('p-ver-ger').checked, p_ver_todas: document.getElementById('p-ver-todas').checked, p_paso1: document.getElementById('p-paso1').checked, p_paso2: document.getElementById('p-paso2').checked, p_paso4: document.getElementById('p-paso4').checked, p_gest_sgc: document.getElementById('p-gest-sgc').checked, p_ger_apr: document.getElementById('p-ger-apr').checked, p_users: document.getElementById('p-users').checked, p_struct: document.getElementById('p-struct').checked, p_ver_listado: document.getElementById('p-ver-listado').checked, p_audit_ver: document.getElementById('p-audit-ver').checked, p_audit_admin: document.getElementById('p-audit-admin').checked, p_audit_auditor: document.getElementById('p-audit-auditor').checked, p_audit_dueno: document.getElementById('p-audit-dueno').checked, admin: document.getElementById('p-admin').checked };
    window.showLoading();
    const docRef = doc(db, "artifacts", appId, "public", "data", "Usuarios", usr); const snap = await getDoc(docRef);
    if(snap.exists() && document.getElementById('user-form-title').innerText.includes("Registrar")) { window.hideLoading(); return alert("Ese ID de usuario ya existe. Elija otro o edítelo desde la tabla."); }
    await setDoc(docRef, { nombre: nom, usuario: usr, pass: pas, gerencias: gerenciasSel, gerencia: gerenciasSel[0], role: rol, email: email, permisos: permisos });
    window.resetUserForm(); window.hideLoading(); alert("Usuario guardado exitosamente.");
};

window.crearSolicitud = async () => { /*...*/ };
window.verDetalle = async (id) => {
    selectedId = id; document.getElementById('m-extra-input').innerHTML = ""; document.getElementById('m-comentario-libre').innerHTML = "";
    const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", id)); selectedDocData = docSnap.data(); const s = selectedDocData; const p = currentUser.permisos;
    
    document.getElementById('m-id').innerText = s.customId; document.getElementById('m-tit').innerText = s.titulo; document.getElementById('m-sol').innerText = s.solicitante;
    let estadoStr = (s.estado || "").toUpperCase(); let isAprobadoFinalModal = estadoStr.includes('APROBADO FINAL'); let isCancelado = estadoStr === 'ANULADO' || estadoStr === 'RECHAZADO';
    let badgeClass = 'badge-info'; if(estadoStr.includes('APROBADO')) badgeClass = 'badge-success'; if(isCancelado) badgeClass = 'badge-danger'; if(estadoStr.includes('PENDIENTE')) badgeClass = 'badge-warning';
    document.getElementById('m-est').innerText = isAprobadoFinalModal ? 'APROBADO FINAL' : s.estado; document.getElementById('m-est').className = `badge ${badgeClass}`;
    
    document.getElementById('m-ger').innerText = s.gerencia; document.getElementById('m-tipo').innerText = s.tipoDoc || "N/A"; 
    let pr = s.prioridad || "Normal"; let bPr = pr === 'Alta' ? 'badge-danger' : (pr === 'Básica' ? 'badge-info' : 'badge-dark'); document.getElementById('m-prioridad').innerText = pr.toUpperCase(); document.getElementById('m-prioridad').className = `badge ${bPr}`;
    document.getElementById('m-accion').innerText = s.accion; document.getElementById('m-jus').innerText = s.motivo || s.justificacion || "Sin justificación";
    
    let adjOrigName = s.adjunto_nombre || "Archivo Adjunto"; let dlUrl = s.adjunto ? window.getDownloadUrl(s.adjunto) : "#"; 
    document.getElementById('m-file-link').innerHTML = s.adjunto ? `<a href="#" onclick="window.abrirDocumento('${dlUrl}', '${adjOrigName}'); return false;" class="file-link">📎 ${adjOrigName}</a>` : "Sin archivo";
    if(s.accion !== 'Creación') { document.getElementById('m-extra-panel').style.display = 'block'; document.getElementById('m-cod').innerText = s.cod_ref; document.getElementById('m-ver').innerText = s.ver_ref; document.getElementById('m-fecha-ult').innerText = window.formatearFechaAbreviada(s.fecha_ref); } else document.getElementById('m-extra-panel').style.display = 'none';

    let invHTML = "No hay personas extras añadidas.";
    if(s.involucrados && s.involucrados.length > 0) { invHTML = s.involucrados.map(email => { let userFound = allUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase()); return userFound ? `${userFound.nombre} (${email})` : email; }).join('<br>'); }
    document.getElementById('m-involucrados-list').innerHTML = invHTML;

    for(let i=1; i<=4; i++) { const st = document.getElementById('s'+i); st.className = 'step'; if(isCancelado) continue; if(i <= s.idx) st.classList.add('completed'); if(i === s.idx + 1 && !isAprobadoFinalModal) st.classList.add('active'); }

    // RENDERIZAR TIEMPOS DE FASE CONECTADOS A FIREBASE
    const fDiff = (ini, fin) => {
        if(!ini || !fin) return "-";
        let ms = new Date(fin) - new Date(ini); if(ms < 0) return "-";
        let d = Math.floor(ms / 86400000); let h = Math.floor((ms % 86400000) / 3600000);
        return `${d}d ${h}h`;
    };
    document.getElementById('m-tiempos-grid').innerHTML = `
        <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 1 (Doc)</b><br>${fDiff(s.fase_0_ini, s.fase_0_fin)}</div>
        <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 2 (Verif)</b><br>${fDiff(s.fase_1_ini, s.fase_1_fin)}</div>
        <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 3 (Gerencia)</b><br>${fDiff(s.fase_2_ini, s.fase_2_fin)}</div>
        <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 4 (SGC Final)</b><br>${fDiff(s.fase_3_ini, s.fecha_final || s.fase_3_fin)}</div>
    `;

    const esAdminSGC = p.admin || p.p_gest_sgc; const esGer = p.p_ger_apr && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia); const activo = !isAprobadoFinalModal && !isCancelado;
    let puedeGestionarSGC = false;
    if(activo) { if (s.idx === 0 && (p.p_gest_sgc || p.p_paso1 || p.admin)) puedeGestionarSGC = true; if (s.idx === 1 && (p.p_gest_sgc || p.p_paso2 || p.admin)) puedeGestionarSGC = true; if (s.idx === 3 && (p.p_gest_sgc || p.p_paso4 || p.admin)) puedeGestionarSGC = true; }
    const puedeGestionarGerente = esGer && s.idx === 2 && activo; const esInvolucradoActivo = s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase()); const esDuenio = s.uid === currentUser.usuario || esInvolucradoActivo; 

    document.getElementById('btn-reabrir').style.display = (esAdminSGC && !activo) ? 'inline-flex' : 'none'; document.getElementById('m-add-involucrado-section').style.display = activo ? 'flex' : 'none';
    document.getElementById('m-actions').style.display = (puedeGestionarSGC || puedeGestionarGerente) ? 'block' : 'none'; document.getElementById('applicant-actions').style.display = (esDuenio && activo) ? 'block' : 'none'; document.getElementById('m-input-area').style.display = 'none'; document.getElementById('general-comment-area').style.display = !isCancelado ? 'block' : 'none';
    
    if (isAprobadoFinalModal) {
        if (s.version_final) {
            document.getElementById('m-original-data').classList.add('locked-data'); document.getElementById('m-orig-title').style.display = 'flex'; document.getElementById('m-display-final').style.display = 'block';
            document.getElementById('m-disp-cod').innerText = s.codigo_final || s.cod_ref || "N/A"; document.getElementById('m-disp-ver').innerText = s.version_final; document.getElementById('m-disp-fecha').innerText = s.fecha_final ? window.formatearFechaAbreviada(s.fecha_final) : "N/A"; document.getElementById('m-disp-com').innerText = s.comentario_final || "Sin comentarios adicionales.";
            let finName = s.documento_final_nombre || "Documento Oficial"; let finUrl = s.documento_final ? window.getDownloadUrl(s.documento_final) : "#"; 
            document.getElementById('m-disp-file').innerHTML = s.documento_final ? `<a href="#" onclick="window.abrirDocumento('${finUrl}', '${finName}'); return false;" class="file-link">📄 ${finName}</a>` : "N/A";
        }
    }
    
    const cb = document.getElementById('chat-box'); 
    cb.innerHTML = s.chat ? s.chat.map(c => 
        `<div class="chat-msg" style="border-left-color:${c.u===currentUser.nombre?'var(--primary)':'#cbd5e1'}">
            <b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}
            ${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${window.getDownloadUrl(c.archivo)}', 'Evidencia_Adjunta'); return false;" style="font-size:10px;color:blue;font-weight:600;text-decoration:none;">📎 Ver Evidencia Adjunta</a>` : ''}
        </div>`
    ).join('') : ''; 
    document.getElementById('modal').style.display = 'flex';
};

window.agregarGerencia = async () => { /*...*/ };
window.eliminarGerencia = async (idx) => { /*...*/ };
window.agregarDepartamento = async () => { /*...*/ };
window.eliminarDepartamento = async (idx) => { /*...*/ };
window.showLoading = () => { document.getElementById('loading-overlay').style.display = 'flex'; };
window.hideLoading = () => { document.getElementById('loading-overlay').style.display = 'none'; };
window.cambiarVista = (id, btn) => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const section = document.getElementById(id); if(section) section.classList.add('active'); if(btn) btn.classList.add('active');
    if(window.innerWidth <= 768) { const sidebar = document.getElementById('sidebar'); if(sidebar) sidebar.classList.remove('open'); const overlay = document.getElementById('sidebar-overlay'); if(overlay) overlay.classList.remove('active'); }
};
window.toggleMenu = () => { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); };
window.toggleModPanel = v => document.getElementById('panel-mod').style.display = v === 'Creación' ? 'none' : 'grid';
window.closeModal = () => document.getElementById('modal').style.display = 'none';
window.cerrarModalAuditoria = () => document.getElementById('modal-auditoria').style.display = 'none';

// ==========================================
// MÓDULO DE AUDITORÍAS (NUEVO F-003 Y F-002)
// ==========================================
window.switchAuditTab = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`btn-tab-${tabId}`).classList.add('active'); document.getElementById(`tab-${tabId}`).classList.add('active');
};

window.abrirNuevaAuditoria = () => {
    window.cancelarEdicionAuditoria();
    document.getElementById('audit-admin-panel').style.display = 'block';
    window.scrollTo({ top: document.getElementById('audit-admin-panel').offsetTop, behavior: 'smooth' });
};

window.cambiarAnioAuditoria = (val) => {
    if(val === 'nuevo') {
        let nYear = prompt("Ingrese el nuevo año a registrar (ej: 2028):");
        if(nYear && !isNaN(nYear)) {
            let opt = document.createElement('option'); opt.value = nYear; opt.text = nYear; opt.selected = true;
            document.getElementById('aud-year-select').add(opt, document.getElementById('aud-year-select').options[1]);
            val = nYear;
        } else { document.getElementById('aud-year-select').value = new Date().getFullYear().toString(); return; }
    }
    window.loadAuditPlan(val); window.renderTablaAuditorias(val);
};

window.toggleAuditHeaderForm = () => {
    const form = document.getElementById('audit-header-edit'); const view = document.getElementById('audit-header-view'); const isEditing = form.style.display === 'block';
    if(isEditing) { form.style.display = 'none'; view.style.display = 'block'; } else {
        const y = document.getElementById('aud-year-select').value; document.getElementById('edit-year-label').innerText = y;
        document.getElementById('ah-auditor-list').selectedIndex = -1;
        if(globalAuditPlan) {
            document.getElementById('ah-obj').value = globalAuditPlan.objetivo || ''; document.getElementById('ah-alcance').value = globalAuditPlan.alcance || ''; document.getElementById('ah-tecnica').value = globalAuditPlan.tecnica || ''; document.getElementById('ah-criterios').value = globalAuditPlan.criterios || ''; document.getElementById('ah-ref').value = globalAuditPlan.referencia || ''; document.getElementById('ah-fecha').value = globalAuditPlan.fecha_elab || ''; document.getElementById('ah-tec').value = globalAuditPlan.recursos_tec || ''; document.getElementById('ah-rrhh').value = globalAuditPlan.recursos_hh || ''; document.getElementById('ah-extra-emails').value = (globalAuditPlan.extra_correos || []).join(', ');
            let liderSel = document.getElementById('ah-lider'); for(let i=0; i<liderSel.options.length; i++){ if(liderSel.options[i].value === globalAuditPlan.lider) liderSel.selectedIndex = i; }
            let auditoresGuardados = globalAuditPlan.auditor_nombres || []; 
            Array.from(document.getElementById('ah-auditor-list').options).forEach(opt => { opt.selected = auditoresGuardados.includes(opt.value); });
        } else {
            document.getElementById('ah-obj').value = ''; document.getElementById('ah-alcance').value = ''; document.getElementById('ah-tecnica').value = ''; document.getElementById('ah-criterios').value = ''; document.getElementById('ah-ref').value = ''; document.getElementById('ah-fecha').value = ''; document.getElementById('ah-tec').value = ''; document.getElementById('ah-rrhh').value = ''; document.getElementById('ah-extra-emails').value = ''; document.getElementById('ah-lider').selectedIndex = 0; 
        }
        form.style.display = 'block'; view.style.display = 'none';
    }
};

window.saveAuditPlan = async () => {
    const year = document.getElementById('aud-year-select').value; const docId = `Plan_${year}`;
    let motivo = "Creación inicial"; if(globalAuditPlan) { motivo = prompt("Motivo de la modificación del Plan Anual:"); if(!motivo) return alert("El motivo es obligatorio para editar."); }

    const liderSel = document.getElementById('ah-lider'); const liderName = liderSel.options[liderSel.selectedIndex]?.value || ""; const liderEmail = liderSel.options[liderSel.selectedIndex]?.getAttribute('data-email') || "";
    
    const audNombres = []; const audEmails = []; 
    Array.from(document.getElementById('ah-auditor-list').selectedOptions).forEach(opt => { audNombres.push(opt.value); audEmails.push(opt.getAttribute('data-email')); });
    
    const extraEmails = document.getElementById('ah-extra-emails').value.split(',').map(e => e.trim().toLowerCase()).filter(e=>e.includes('@'));
    let todosLosCorreos = new Set([...audEmails, ...extraEmails]); if(liderEmail) todosLosCorreos.add(liderEmail);

    const data = { year: year, objetivo: document.getElementById('ah-obj').value, alcance: document.getElementById('ah-alcance').value, tecnica: document.getElementById('ah-tecnica').value, criterios: document.getElementById('ah-criterios').value, referencia: document.getElementById('ah-ref').value, fecha_elab: document.getElementById('ah-fecha').value, lider: liderName, auditor: audNombres.join(', '), auditor_nombres: audNombres, recursos_tec: document.getElementById('ah-tec').value, recursos_hh: document.getElementById('ah-rrhh').value, extra_correos: extraEmails, correos: Array.from(todosLosCorreos), modificado_por: currentUser.nombre, ultima_modif: new Date().toISOString() };

    window.showLoading();
    if(globalAuditPlan) { await updateDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), { ...data, historial: arrayUnion({ fecha: new Date().toISOString(), usuario: currentUser.nombre, motivo: motivo }) }); } 
    else { await setDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), { ...data, historial: [{ fecha: new Date().toISOString(), usuario: currentUser.nombre, motivo: motivo }] }); }
    window.hideLoading(); alert("Plan Anual actualizado."); document.getElementById('audit-header-edit').style.display='none'; document.getElementById('audit-header-view').style.display='block';
};

window.loadAuditPlan = (year) => {
    const docId = `Plan_${year}`; document.getElementById('view-year-label').innerText = year;
    onSnapshot(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), s => {
        const viewObj = document.getElementById('audit-header-view');
        if(s.exists()) {
            globalAuditPlan = s.data(); viewObj.style.display = 'block'; 
            document.getElementById('view-ah-obj').innerText = globalAuditPlan.objetivo || '-'; document.getElementById('view-ah-alcance').innerText = globalAuditPlan.alcance || '-'; document.getElementById('view-ah-tecnica').innerText = globalAuditPlan.tecnica || '-'; document.getElementById('view-ah-criterios').innerText = globalAuditPlan.criterios || '-'; document.getElementById('view-ah-ref').innerText = globalAuditPlan.referencia || '-'; document.getElementById('view-ah-fecha').innerText = window.formatearFechaAbreviada(globalAuditPlan.fecha_elab) || '-'; document.getElementById('view-ah-lider').innerText = globalAuditPlan.lider || '-'; document.getElementById('view-ah-auditor').innerText = globalAuditPlan.auditor || '-'; document.getElementById('view-ah-tec').innerText = globalAuditPlan.recursos_tec || '-'; document.getElementById('view-ah-rrhh').innerText = globalAuditPlan.recursos_hh || '-';
            let modInfo = `Por: ${globalAuditPlan.modificado_por || '-'} el ${window.formatearFechaAbreviada(globalAuditPlan.ultima_modif)}`;
            if(globalAuditPlan.historial && globalAuditPlan.historial.length > 0) { let ultimoMotivo = globalAuditPlan.historial[globalAuditPlan.historial.length-1].motivo; modInfo += ` (Motivo: ${ultimoMotivo})`; }
            document.getElementById('view-ah-mod-info').innerText = modInfo;
        } else { globalAuditPlan = null; viewObj.style.display = 'none'; }
    });
};

window.cargarAuditoriaParaEditar = async (id) => {
    const audit = globalAllAuditorias.find(x => x.id === id); if(!audit) return; editandoAuditoriaId = id;
    document.getElementById('titulo-form-auditoria').innerText = "Editar Auditoría Programada"; 
    
    document.getElementById('aud-fecha').value = audit.fecha || ''; document.getElementById('aud-h-ini').value = audit.hora_inicio || ''; document.getElementById('aud-h-fin').value = audit.hora_fin || ''; document.getElementById('aud-lugar').value = audit.lugar || ''; document.getElementById('aud-proceso').value = audit.proceso || ''; document.getElementById('aud-req').value = audit.requisitos || ''; document.getElementById('aud-obs').value = audit.observacion || '';
    
    document.getElementById('aud-org').value = audit.organizacion || ''; document.getElementById('aud-dir').value = audit.direccion || ''; document.getElementById('aud-sitios').value = audit.sitios || ''; document.getElementById('aud-personal').value = audit.personal || ''; document.getElementById('aud-turnos').value = audit.turnos || ''; document.getElementById('aud-formacion').value = audit.auditores_formacion || '';

    let auditadosArr = audit.auditado ? audit.auditado.split(', ') : []; 
    Array.from(document.getElementById('aud-auditado-sel').options).forEach(opt => { opt.selected = auditadosArr.includes(opt.value); });
    let auditoresArr = audit.auditor ? audit.auditor.split(', ') : []; 
    Array.from(document.getElementById('aud-auditor-sel').options).forEach(opt => { opt.selected = auditoresArr.includes(opt.value); });
    
    document.getElementById('btn-guardar-aud').innerText = "ACTUALIZAR AUDITORÍA"; document.getElementById('btn-cancelar-aud').style.display = "block"; window.scrollTo({ top: document.getElementById('audit-admin-panel').offsetTop, behavior: 'smooth' }); document.getElementById('audit-admin-panel').style.display = 'block';
};

window.cancelarEdicionAuditoria = () => {
    editandoAuditoriaId = null; document.getElementById('titulo-form-auditoria').innerText = "Programar Nueva Auditoría"; 
    document.getElementById('aud-fecha').value = ''; document.getElementById('aud-h-ini').value = ''; document.getElementById('aud-h-fin').value = ''; document.getElementById('aud-lugar').value = ''; document.getElementById('aud-proceso').value = ''; document.getElementById('aud-req').value = ''; document.getElementById('aud-obs').value = '';
    document.getElementById('aud-org').value = ''; document.getElementById('aud-dir').value = ''; document.getElementById('aud-sitios').value = ''; document.getElementById('aud-personal').value = ''; document.getElementById('aud-turnos').value = ''; document.getElementById('aud-formacion').value = '';

    document.getElementById('aud-auditado-sel').selectedIndex = -1;
    document.getElementById('aud-auditor-sel').selectedIndex = -1;
    
    document.getElementById('btn-guardar-aud').innerText = "GENERAR AUDITORÍA Y NOTIFICAR"; document.getElementById('btn-cancelar-aud').style.display = "none";
};

window.guardarAuditoria = async () => {
    const fecha = document.getElementById('aud-fecha').value; const hIni = document.getElementById('aud-h-ini').value; const hFin = document.getElementById('aud-h-fin').value; const proceso = document.getElementById('aud-proceso').value; const lugar = document.getElementById('aud-lugar').value; const req = document.getElementById('aud-req').value; const obs = document.getElementById('aud-obs').value;
    if(!fecha || !proceso) return alert("Fecha y Proceso son obligatorios.");
    
    const auditadoNombres = []; const auditadoEmails = []; 
    Array.from(document.getElementById('aud-auditado-sel').selectedOptions).forEach(opt => { auditadoNombres.push(opt.value); auditadoEmails.push(opt.getAttribute('data-email')); });
    const auditorNombres = []; const auditorEmails = []; 
    Array.from(document.getElementById('aud-auditor-sel').selectedOptions).forEach(opt => { auditorNombres.push(opt.value); auditorEmails.push(opt.getAttribute('data-email')); });

    let data = { 
        fecha: fecha, hora_inicio: hIni, hora_fin: hFin, lugar: lugar, proceso: proceso, requisitos: req, 
        auditado: auditadoNombres.join(', '), auditado_emails: auditadoEmails, 
        auditor: auditorNombres.join(', '), auditor_emails: auditorEmails, observacion: obs,
        organizacion: document.getElementById('aud-org').value, direccion: document.getElementById('aud-dir').value, sitios: document.getElementById('aud-sitios').value, personal: document.getElementById('aud-personal').value, turnos: document.getElementById('aud-turnos').value, auditores_formacion: document.getElementById('aud-formacion').value
    };

    window.showLoading();

    if(editandoAuditoriaId) {
        data.modificado_por = currentUser.nombre; data.ultima_modificacion = new Date().toISOString(); 
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", editandoAuditoriaId), data);
        window.cancelarEdicionAuditoria(); window.hideLoading(); alert(`Auditoría modificada correctamente.`);
    } else {
        let auditNum = ""; const refCont = doc(db, "artifacts", appId, "public", "data", "Contadores", "auditorias");
        await runTransaction(db, async (t) => { 
            const snap = await t.get(refCont); let count = 1; if (snap.exists()) count = snap.data().count + 1; 
            t.set(refCont, { count }); auditNum = `QSHE-${new Date().getFullYear()}-${count}`; 
        });

        data.audit_num = auditNum; data.estado = "Programada"; data.creado_por = currentUser.nombre; data.timestamp = new Date().toISOString(); 
        data.bitacora = []; data.lista_verificacion = []; data.reporte_auditoria = { conclusiones: '' }; 
        await addDoc(collection(db, "artifacts", appId, "public", "data", "Auditorias"), data);

        let correosPlan = globalAuditPlan && globalAuditPlan.correos ? globalAuditPlan.correos : []; let correosNotificacion = new Set([...correosPlan, ...auditadoEmails, ...auditorEmails]); correosNotificacion.add(EMAIL_ADMIN_SGC);
        const iniGCal = window.getGCalFormat(fecha, hIni); const finGCal = window.getGCalFormat(fecha, hFin); const tituloGCal = encodeURIComponent(`Auditoría SGC: ${proceso}`); const detallesGCal = encodeURIComponent(`Requisitos: ${req}\nAuditados: ${data.auditado}\nAuditores: ${data.auditor}\nObservaciones: ${obs}`); const lugarGCal = encodeURIComponent(lugar);
        const gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${tituloGCal}&dates=${iniGCal}/${finGCal}&details=${detallesGCal}&location=${lugarGCal}`;
        const botonCalendario = `<br><br><a href="${gcalLink}" target="_blank" style="background-color:#4285F4; color:white; padding:12px 20px; text-decoration:none; border-radius:8px; font-weight:bold; display:inline-block; font-family:sans-serif;">📅 Guardar en Google Calendar</a><br><br>`;
        const mensajeEmail = `Se ha programado una auditoría en el sistema:\n\n<b>N° Auditoría:</b> ${auditNum}<br><b>📅 Fecha:</b> ${window.formatearFechaAbreviada(fecha)}<br><b>⏰ Horario:</b> ${hIni} - ${hFin}<br><b>📍 Lugar:</b> ${lugar}<br><b>📋 Proceso/Área:</b> ${proceso}<br><b>📝 Requisitos:</b> ${req}<br><b>👤 Auditado(s):</b> ${data.auditado}<br><b>🕵️‍♂️ Auditor(es):</b> ${data.auditor}<br><b>💬 Observaciones:</b> ${obs || 'Ninguna'}\n${botonCalendario}\nPor favor, verificar y confirmar la agenda en el sistema SGC.`;
        let destStr = Array.from(correosNotificacion).filter(e=>e && e.includes('@')).join(',');
        if(destStr) { window.sendNotification({to: destStr, cc: ""}, `Auditoría Programada: ` + proceso, mensajeEmail); }
        window.cancelarEdicionAuditoria(); window.hideLoading(); alert(`Auditoría programada y notificada. ID: ${auditNum}`);
    }
};

window.renderTablaAuditorias = (yearFilter) => {
    const tb = document.getElementById('tbody-auditorias'); if(!tb) return;
    let adminView = currentUser.permisos.p_audit_admin || currentUser.permisos.admin || currentUser.permisos.p_gest_sgc;
    
    // FILTRO PARA QUE LOS AUDITORES SOLO VEAN LAS SUYAS (Y LOS ADMINS TODAS)
    globalAuditorias = globalAllAuditorias.filter(a => { 
        let matchesYear = a.fecha && a.fecha.startsWith(yearFilter); 
        if(!matchesYear) return false; 
        if(adminView) return true; 
        let miNombre = currentUser.nombre; 
        return (a.auditado && a.auditado.includes(miNombre)) || (a.auditor && a.auditor.includes(miNombre)); 
    });
    
    globalAuditorias.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    let audHtml = "";
    
    globalAuditorias.forEach(a => {
        let estadoLabel = a.estado || 'Programada'; let estadoBadge = estadoLabel === 'Completada' ? 'badge-success' : (estadoLabel === 'En Progreso' ? 'badge-info' : 'badge-warning');
        let btnAccion = `<button class="btn btn-primary" style="padding:4px 8px; font-size:10px; margin-right:5px;" onclick="window.verModalAuditoria('${a.id}')"><span class="material-icons-round" style="font-size:14px; margin-right:4px;">visibility</span> Ver</button>`;
        const isAuditor = a.auditor && a.auditor.includes(currentUser.nombre); 
        
        // BOTONES CONDICIONADOS AL PERMISO DE AUDITOR O ADMIN
        const canControl = adminView || isAuditor;
        if (canControl) { 
            if (estadoLabel === 'Programada') { btnAccion += `<button class="btn btn-success" style="padding:4px 8px; font-size:10px; margin-right:5px;" onclick="window.iniciarAuditoriaDirecto('${a.id}')" title="Iniciar Auditoría"><span class="material-icons-round" style="font-size:14px;">play_arrow</span> Iniciar</button>`; } 
            else if (estadoLabel === 'En Progreso') { btnAccion += `<button class="btn btn-warning" style="padding:4px 8px; font-size:10px; margin-right:5px;" onclick="window.finalizarAuditoriaDirecto('${a.id}')" title="Finalizar Auditoría"><span class="material-icons-round" style="font-size:14px;">stop</span> Finalizar</button>`; } 
            btnAccion += `<button class="btn btn-info" style="padding:4px 8px; font-size:10px; margin-right:5px;" onclick="window.cargarAuditoriaParaEditar('${a.id}')" title="Editar Auditoría"><span class="material-icons-round" style="font-size:14px;">edit</span></button>`;
        }
        if(adminView) { btnAccion += `<button class="btn-icon-danger" onclick="window.del('Auditorias','${a.id}')" title="Eliminar Auditoría"><span class="material-icons-round">delete</span></button>`; }
        
        audHtml += `<tr><td><b>${a.audit_num || '-'}</b></td><td><b>${window.formatearFechaAbreviada(a.fecha)}</b><br><small>${a.hora_inicio || ''} - ${a.hora_fin || ''}</small></td><td>${a.proceso}</td><td>${a.auditado || '-'}</td><td>${a.auditor || '-'}</td><td><span class="badge ${estadoBadge}">${estadoLabel}</span></td><td class="no-export" style="display:flex; align-items:center;">${btnAccion}</td></tr>`;
    });
    tb.innerHTML = audHtml; if(adminView) window.verificarAlertasAuditoria(globalAuditorias);
};

window.iniciarAuditoriaDirecto = async (id) => {
    if(!confirm("¿Iniciar la auditoría ahora? Se registrará la hora actual.")) return; window.showLoading(); const now = new Date().toISOString();
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id), { estado: "En Progreso", hora_real_inicio: now, bitacora: arrayUnion({u: currentUser.nombre, m: `▶️ <b>AUDITORÍA INICIADA</b>`, t: new Date().toLocaleString()}) });
    window.hideLoading();
};

window.finalizarAuditoriaDirecto = async (id) => {
    if(!confirm("¿Finalizar la auditoría? Se registrará la hora de cierre y calculará la duración.")) return; window.showLoading(); const now = new Date().toISOString(); const docRef = doc(db, "artifacts", appId, "public", "data", "Auditorias", id); const snap = await getDoc(docRef);
    if(snap.exists()) {
        let a = snap.data(); await updateDoc(docRef, { estado: "Completada", hora_real_fin: now, bitacora: arrayUnion({u: currentUser.nombre, m: `⏹️ <b>AUDITORÍA COMPLETADA FINALIZADA</b>`, t: new Date().toLocaleString()}) });
        let emails = new Set([...(a.auditor_emails||[]), ...(a.auditado_emails||[])]); if(globalAuditPlan && globalAuditPlan.correos) { globalAuditPlan.correos.forEach(e => emails.add(e)); } emails.add(EMAIL_ADMIN_SGC); let destStr = Array.from(emails).filter(e=>e && e.includes('@')).join(',');
        if(destStr) { window.sendNotification({to: destStr, cc: ""}, "✅ Auditoría Completada: " + a.proceso, `La auditoría del proceso ${a.proceso} ha finalizado en el sistema SGC.\nPor favor revise el panel para el tiempo total e informes.`); }
    }
    window.hideLoading(); alert("Auditoría Finalizada");
};

window.verModalAuditoria = async (id) => {
    selectedAuditId = id; const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", id)); if(!docSnap.exists()) return;
    selectedAuditData = docSnap.data(); const a = selectedAuditData;
    
    document.getElementById('ma-num').innerText = a.audit_num || 'S/N';
    document.getElementById('ma-proceso').innerText = a.proceso || 'Sin Proceso'; document.getElementById('ma-fecha').innerText = window.formatearFechaAbreviada(a.fecha) || 'Sin Fecha'; document.getElementById('ma-hora').innerText = `${a.hora_inicio || '--:--'} a ${a.hora_fin || '--:--'}`; document.getElementById('ma-lugar').innerText = a.lugar || 'N/A'; document.getElementById('ma-auditado').innerText = a.auditado || 'N/A'; document.getElementById('ma-auditor').innerText = a.auditor || 'N/A'; document.getElementById('ma-req').innerText = a.requisitos || 'Ninguno especificado.'; document.getElementById('ma-obs').innerText = a.observacion || 'Sin observaciones.';
    
    document.getElementById('rep-num').innerText = a.audit_num || 'N/A'; document.getElementById('rep-org').innerText = a.organizacion || 'FCI Logistic'; document.getElementById('rep-dir').innerText = a.direccion || 'N/A'; document.getElementById('rep-sitios').innerText = a.sitios || a.lugar || 'N/A'; document.getElementById('rep-fechas').innerText = window.formatearFechaAbreviada(a.fecha); document.getElementById('rep-personal').innerText = a.personal || 'N/A'; document.getElementById('rep-turnos').innerText = a.turnos || 'N/A'; document.getElementById('rep-lider').innerText = globalAuditPlan ? globalAuditPlan.lider : 'N/A'; document.getElementById('rep-adicionales').innerText = a.auditor || 'N/A'; document.getElementById('rep-formacion').innerText = a.auditores_formacion || 'Ninguno'; document.getElementById('rep-alcance').innerText = globalAuditPlan ? `(${globalAuditPlan.alcance})` : '';

    let estStr = a.estado || 'Programada'; let bdg = estStr === 'Completada' ? 'badge-success' : (estStr === 'En Progreso' ? 'badge-info' : 'badge-warning');
    document.getElementById('ma-estado-badge').className = `badge ${bdg}`; document.getElementById('ma-estado-badge').innerText = estStr.toUpperCase();
    
    document.getElementById('ma-inicio-real').innerText = a.hora_real_inicio ? new Date(a.hora_real_inicio).toLocaleString() : '---'; document.getElementById('ma-fin-real').innerText = a.hora_real_fin ? new Date(a.hora_real_fin).toLocaleString() : '---';
    if(a.hora_real_inicio && a.hora_real_fin) { let ms = new Date(a.hora_real_fin) - new Date(a.hora_real_inicio); let mins = Math.floor(ms / 60000); let hrs = Math.floor(mins / 60); let remMins = mins % 60; document.getElementById('ma-duracion').innerText = `${hrs} horas, ${remMins} minutos`; } else { document.getElementById('ma-duracion').innerText = '---'; }

    const isAdminAudit = currentUser.permisos.p_audit_admin || currentUser.permisos.admin || currentUser.permisos.p_gest_sgc; const isAuditor = a.auditor && a.auditor.includes(currentUser.nombre); const canControl = isAdminAudit || isAuditor;
    document.getElementById('btn-comenzar-auditoria').style.display = (canControl && estStr === 'Programada') ? 'inline-block' : 'none'; document.getElementById('btn-finalizar-auditoria').style.display = (canControl && estStr === 'En Progreso') ? 'inline-block' : 'none';
    
    const cb = document.getElementById('chat-box-audit'); 
    cb.innerHTML = a.bitacora ? a.bitacora.map(c => `<div class="chat-msg" style="border-left-color:${c.u===currentUser.nombre?'var(--primary)':'#cbd5e1'}"><b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${window.getDownloadUrl(c.archivo)}', 'Evidencia_Auditoria'); return false;" style="font-size:10px;color:blue;font-weight:600;text-decoration:none;">📎 Ver Evidencia</a>` : ''}</div>`).join('') : '';

    currentAuditF020 = a.lista_verificacion || []; window.renderF020();
    
    // BLOQUEO DE CAMPOS F-003 PARA NO-AUDITORES
    const canEditForms = canControl && estStr !== 'Completada';
    const f003Inputs = ['f003-conclusiones', 'f003-n-proceso', 'f003-n-personal', 'f003-n-cargo', 'f003-n-req', 'f003-n-doc', 'f003-n-evidencia'];
    f003Inputs.forEach(id => { let el = document.getElementById(id); if(el) el.disabled = !canEditForms; });

    if(a.reporte_auditoria) { 
        document.getElementById('f003-conclusiones').value = a.reporte_auditoria.conclusiones || ""; 
        document.getElementById('f003-n-proceso').value = a.reporte_auditoria.n_proceso || a.proceso || "";
        document.getElementById('f003-n-personal').value = a.reporte_auditoria.n_personal || a.auditado || "";
        document.getElementById('f003-n-cargo').value = a.reporte_auditoria.n_cargo || "";
        document.getElementById('f003-n-req').value = a.reporte_auditoria.n_req || a.requisitos || "";
        document.getElementById('f003-n-doc').value = a.reporte_auditoria.n_doc || "";
        document.getElementById('f003-n-evidencia').value = a.reporte_auditoria.n_evidencia || "";
    } else { 
        document.getElementById('f003-conclusiones').value = ""; document.getElementById('f003-n-proceso').value = a.proceso || "";
        document.getElementById('f003-n-personal').value = a.auditado || ""; document.getElementById('f003-n-cargo').value = ""; document.getElementById('f003-n-req').value = a.requisitos || ""; document.getElementById('f003-n-doc').value = ""; document.getElementById('f003-n-evidencia').value = "";
    }

    window.actualizarMetricasF003(canEditForms); 
    window.renderAuditSACs();
    
    document.getElementById('btn-add-f020').style.display = canEditForms ? 'inline-block' : 'none'; document.getElementById('btn-save-f020').style.display = canEditForms ? 'inline-block' : 'none'; document.getElementById('btn-save-f003').style.display = canEditForms ? 'inline-block' : 'none'; 
    window.switchAuditTab('info'); document.getElementById('modal-auditoria').style.display = 'flex';
};

window.comenzarAuditoria = async () => { await window.iniciarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.finalizarAuditoria = async () => { await window.finalizarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };

window.enviarComentarioAuditoria = async () => {
    const box = document.getElementById('ma-comentario-libre'); const txtHTML = box.innerHTML; const txtPlain = box.innerText.trim(); const f = document.getElementById('ma-file-comentario');
    if(!txtPlain && !f.files[0] && txtHTML.replace(/<[^>]*>?/gm, '').trim() === '') return alert("Escribe un mensaje o adjunta evidencia."); window.showLoading(); let fileUrl = null;
    if (f.files[0]) { fileUrl = await window.uploadToCloudinary(f.files[0]); if (!fileUrl) { window.hideLoading(); return alert("Error de red."); } }
    let chatPayload = {u: currentUser.nombre, m: `💬 <b>Anotación/Hallazgo:</b><br>${txtHTML}`, t: new Date().toLocaleString()}; if (fileUrl) chatPayload.archivo = fileUrl; 
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", selectedAuditId), { bitacora: arrayUnion(chatPayload) });
    box.innerHTML = ""; f.value = ""; window.hideLoading(); window.verModalAuditoria(selectedAuditId); 
};

// DINÁMICA DEL REPORTE F-003
window.generarBloqueNCDinamico = (item, index, tipo, canEditForms) => {
    let dRep = selectedAuditData.reporte_auditoria && selectedAuditData.reporte_auditoria.detalles_nc && selectedAuditData.reporte_auditoria.detalles_nc[item.id] ? selectedAuditData.reporte_auditoria.detalles_nc[item.id] : {};
    let dis = canEditForms ? '' : 'disabled';
    return `
        <div style="border:1px solid #ccc; font-size:12px; margin-bottom:15px;" class="f003-hallazgo-block" data-id="${item.id}" data-tipo="${tipo}">
            <div style="display:grid; grid-template-columns: 150px 1fr;">
                <div style="padding:8px; border-right:1px solid #ccc; border-bottom:1px solid #ccc; font-weight:bold; background:#f1f5f9;">No. de ${tipo.includes('NC') ? 'NC' : 'OM'}</div>
                <div style="padding:8px; border-bottom:1px solid #ccc; font-weight:bold;">${index}</div>
                <div style="padding:8px; border-right:1px solid #ccc; border-bottom:1px solid #ccc; font-weight:bold; background:#f1f5f9;">Departamento / Función</div>
                <div style="padding:0; border-bottom:1px solid #ccc;"><input type="text" class="h-dep" value="${dRep.departamento || item.auditado || ''}" ${dis} style="border:none; margin:0; width:100%; border-radius:0; height:100%;"></div>
                <div style="padding:8px; border-right:1px solid #ccc; border-bottom:1px solid #ccc; font-weight:bold; background:#f1f5f9;">Documento Ref.</div>
                <div style="padding:0; border-bottom:1px solid #ccc;"><input type="text" class="h-doc" value="${dRep.doc_ref || ''}" ${dis} style="border:none; margin:0; width:100%; border-radius:0; height:100%;"></div>
                <div style="padding:8px; border-right:1px solid #ccc; border-bottom:1px solid #ccc; font-weight:bold; background:#f1f5f9;">Estándar Programa OEA Requisito Afectado</div>
                <div style="padding:0; border-bottom:1px solid #ccc;"><input type="text" class="h-req" value="${dRep.requisito || item.requisito || ''}" ${dis} style="border:none; margin:0; width:100%; border-radius:0; height:100%;"></div>
                <div style="padding:8px; border-right:1px solid #ccc; font-weight:bold; background:#f1f5f9;">Detalle de la No Conformidad</div>
                <div style="padding:0;"><textarea class="h-det" ${dis} style="border:none; margin:0; width:100%; border-radius:0; height:100%; min-height:40px; padding:8px;">${dRep.detalle || item.comentarios || item.pregunta || ''}</textarea></div>
            </div>
        </div>
    `;
};

window.actualizarMetricasF003 = (canEditForms) => {
    let ncMay = 0, ncMen = 0, om = 0; let hMenor = "", hMayor = "", hOM = "";
    currentAuditF020.forEach(i => { 
        if(i.hallazgo === 'NC Mayor') { ncMay++; hMayor += window.generarBloqueNCDinamico(i, ncMay, 'NC Mayor', canEditForms); } 
        if(i.hallazgo === 'NC Menor') { ncMen++; hMenor += window.generarBloqueNCDinamico(i, ncMen, 'NC Menor', canEditForms); } 
        if(i.hallazgo === 'OM') { om++; hOM += window.generarBloqueNCDinamico(i, om, 'OM', canEditForms); } 
    });

    document.getElementById('f003-nc-mayor').innerText = ncMay; document.getElementById('f003-nc-menor').innerText = ncMen; document.getElementById('f003-om').innerText = om;
    document.getElementById('container-nc-menor').innerHTML = hMenor || "<p style='font-size:11px; color:#94a3b8;'>No se detectaron NC Menores.</p>";
    document.getElementById('container-nc-mayor').innerHTML = hMayor || "<p style='font-size:11px; color:#94a3b8;'>No se detectaron NC Mayores.</p>";
    document.getElementById('container-om').innerHTML = hOM || "<p style='font-size:11px; color:#94a3b8;'>No se detectaron Oportunidades de Mejora.</p>";
};

// TABLAS DINÁMICAS F-002
window.addPlanRow = (detalle="", resp="", fIni="", fFin="") => {
    const tb = document.getElementById('tbody-plan-accion');
    let rowCount = tb.children.length + 1;
    let tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="border:1px solid #ccc; padding:4px;">${rowCount}</td>
        <td style="border:1px solid #ccc; padding:0;"><input type="text" value="${detalle}" style="width:100%; border:none; margin:0; padding:6px;"></td>
        <td style="border:1px solid #ccc; padding:0;"><input type="text" value="${resp}" style="width:100%; border:none; margin:0; padding:6px;"></td>
        <td style="border:1px solid #ccc; padding:0;"><input type="date" value="${fIni}" style="width:100%; border:none; margin:0; padding:6px;"></td>
        <td style="border:1px solid #ccc; padding:0;"><input type="date" value="${fFin}" style="width:100%; border:none; margin:0; padding:6px;"></td>
        <td style="border:1px solid #ccc; text-align:center; padding:0;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round" style="font-size:14px;">delete</span></button></td>
    `;
    tb.appendChild(tr);
};

window.addSeguimientoRow = (resultado="", resp="", fecha="") => {
    const tb = document.getElementById('tbody-seguimiento');
    let rowCount = tb.children.length + 1;
    let tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="border:1px solid #ccc; padding:4px;">${rowCount}</td>
        <td style="border:1px solid #ccc; padding:0;"><input type="text" value="${resultado}" style="width:100%; border:none; margin:0; padding:6px;"></td>
        <td style="border:1px solid #ccc; padding:0;"><input type="text" value="${resp}" style="width:100%; border:none; margin:0; padding:6px;"></td>
        <td style="border:1px solid #ccc; padding:0;"><input type="date" value="${fecha}" style="width:100%; border:none; margin:0; padding:6px;"></td>
        <td style="border:1px solid #ccc; text-align:center; padding:0;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round" style="font-size:14px;">delete</span></button></td>
    `;
    tb.appendChild(tr);
};

window.abrirCrearSAC = (f020_id) => {
    let h = currentAuditF020.find(i => i.id === f020_id); if(!h) return; currentEditingSacId = null; currentEditingF020Ref = h;
    document.getElementById('sac-num').innerText = "POR ASIGNAR"; document.getElementById('sac-estado-badge').innerText = "NUEVA"; document.getElementById('sac-estado-badge').className = "badge badge-info"; 
    document.getElementById('sac-fecha').value = new Date().toISOString().split('T')[0]; document.getElementById('sac-proceso').value = h.proceso || selectedAuditData.proceso || "";
    document.getElementById('sac-tipo').value = h.hallazgo || ""; document.getElementById('sac-fuente').value = "Auditoría Interna"; document.getElementById('sac-fuente-otro').value = "";
    document.getElementById('sac-detalle').value = h.comentarios || h.pregunta; document.getElementById('sac-beneficio').value = ""; document.getElementById('sac-causa').value = ""; document.getElementById('sac-accion').value = "";
    document.getElementById('tbody-plan-accion').innerHTML = ""; document.getElementById('sac-fecha-aprob-plan').value = ""; document.getElementById('tbody-seguimiento').innerHTML = "";
    document.getElementById('sac-resp-cierre').value = ""; document.getElementById('sac-fecha-cierre').value = ""; document.getElementById('sac-check-cerrar').checked = false;

    let opt = '<option value="">-- Seleccione Responsable (Dueño) --</option>'; allUsers.forEach(u => { opt += `<option value="${u.usuario}">${u.nombre} (${u.gerencias ? u.gerencias[0]:''})</option>`; });
    document.getElementById('sac-dueno').innerHTML = opt; document.getElementById('modal-sac').style.display = 'flex';
};

window.verSAC = (sac_id) => {
    let sac = globalAllSacs.find(s => s.sac_id === sac_id); if(!sac) return; currentEditingSacId = sac_id;
    document.getElementById('sac-num').innerText = sac.sac_num; 
    let est = sac.estado; let bs = est.includes('Abierta') ? 'badge-danger' : (est === 'En Seguimiento' ? 'badge-warning' : 'badge-success');
    document.getElementById('sac-estado-badge').innerText = est.toUpperCase(); document.getElementById('sac-estado-badge').className = `badge ${bs}`; 
    document.getElementById('sac-fecha').value = sac.fecha_registro || sac.fecha_apertura.split('T')[0]; document.getElementById('sac-proceso').value = sac.proceso || ""; document.getElementById('sac-tipo').value = sac.tipo_hallazgo || "";
    document.getElementById('sac-fuente').value = sac.fuente_nc || "Auditoría Interna"; document.getElementById('sac-fuente-otro').value = sac.fuente_otro || ""; document.getElementById('sac-detalle').value = sac.detalle_nc || "";
    document.getElementById('sac-beneficio').value = sac.beneficio_esperado || ""; document.getElementById('sac-causa').value = sac.causa_raiz || ""; document.getElementById('sac-accion').value = sac.accion_implementar || "";
    
    let opt = '<option value="">-- Seleccione Responsable (Dueño) --</option>'; allUsers.forEach(u => { opt += `<option value="${u.usuario}" ${sac.dueno_uid === u.usuario ? 'selected':''}>${u.nombre}</option>`; });
    document.getElementById('sac-dueno').innerHTML = opt; 

    document.getElementById('tbody-plan-accion').innerHTML = ""; if(sac.plan_accion) { sac.plan_accion.forEach(p => window.addPlanRow(p.detalle, p.resp, p.inicio, p.fin)); }
    document.getElementById('sac-fecha-aprob-plan').value = sac.fecha_aprobacion_plan || "";
    document.getElementById('tbody-seguimiento').innerHTML = ""; if(sac.seguimiento) { sac.seguimiento.forEach(s => window.addSeguimientoRow(s.resultado, s.resp, s.fecha)); }

    document.getElementById('sac-resp-cierre').value = sac.cerrado_por || ""; document.getElementById('sac-fecha-cierre').value = sac.fecha_cierre ? sac.fecha_cierre.split('T')[0] : "";
    document.getElementById('sac-check-cerrar').checked = est === 'Cerrada'; document.getElementById('modal-sac').style.display = 'flex';
};

window.guardarSAC = async () => {
    window.showLoading(); 
    let planAccionArr = []; document.querySelectorAll('#tbody-plan-accion tr').forEach(tr => { let inputs = tr.querySelectorAll('input'); if(inputs[0].value.trim()) { planAccionArr.push({ detalle: inputs[0].value, resp: inputs[1].value, inicio: inputs[2].value, fin: inputs[3].value }); } });
    let segArr = []; document.querySelectorAll('#tbody-seguimiento tr').forEach(tr => { let inputs = tr.querySelectorAll('input'); if(inputs[0].value.trim()) { segArr.push({ resultado: inputs[0].value, resp: inputs[1].value, fecha: inputs[2].value }); } });

    let estado = "Abierta (En Plan)"; if(document.getElementById('sac-fecha-aprob-plan').value) estado = "En Seguimiento"; if(document.getElementById('sac-check-cerrar').checked) estado = "Cerrada";

    let data = { fecha_registro: document.getElementById('sac-fecha').value, proceso: document.getElementById('sac-proceso').value, fuente_nc: document.getElementById('sac-fuente').value, fuente_otro: document.getElementById('sac-fuente-otro').value, beneficio_esperado: document.getElementById('sac-beneficio').value, causa_raiz: document.getElementById('sac-causa').value, accion_implementar: document.getElementById('sac-accion').value, dueno_uid: document.getElementById('sac-dueno').value, plan_accion: planAccionArr, fecha_aprobacion_plan: document.getElementById('sac-fecha-aprob-plan').value, seguimiento: segArr, fecha_cierre: document.getElementById('sac-fecha-cierre').value, cerrado_por: document.getElementById('sac-check-cerrar').checked ? currentUser.nombre : "", estado: estado };

    if(!currentEditingSacId) {
        let num_sac = ""; const refCont = doc(db, "artifacts", appId, "public", "data", "Contadores", "sacs");
        await runTransaction(db, async (t) => { const snap = await t.get(refCont); let count = 1; if (snap.exists()) count = snap.data().count + 1; t.set(refCont, { count }); num_sac = `SAC-${new Date().getFullYear()}-${String(count).padStart(3, '0')}`; });
        data.sac_num = num_sac; data.audit_id = selectedAuditId; data.f020_id = currentEditingF020Ref.id; data.tipo_hallazgo = currentEditingF020Ref.hallazgo; data.detalle_nc = document.getElementById('sac-detalle').value; data.fecha_apertura = new Date().toISOString(); data.auditor_nombre = currentUser.nombre;
        await addDoc(collection(db, "artifacts", appId, "public", "data", "AccionesCorrectivas"), data); alert(`SAC ${num_sac} generada.`);
    } else {
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "AccionesCorrectivas", currentEditingSacId), data); alert("SAC Actualizada."); 
    }
    document.getElementById('modal-sac').style.display = 'none'; window.hideLoading(); if(selectedAuditId) window.verModalAuditoria(selectedAuditId);
};

// ==========================================
// ARRANQUE DE LA APLICACIÓN
// ==========================================
const inicializarApp = async () => {
    console.log("🚀 Paso 1: Iniciando aplicación...");
    window.hideLoading(); 
    
    const savedUser = localStorage.getItem('sgc_session_user');
    console.log("👤 Paso 2: Usuario guardado en caché:", savedUser ? savedUser : "Ninguno");

    if (savedUser) {
        window.showLoading();
        try {
            console.log("⏳ Paso 3: Conectando con Firebase para validar sesión...");
            const q = query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("usuario", "==", savedUser));
            const snap = await getDocs(q);
            
            if (!snap.empty) { 
                console.log("✅ Paso 4: Sesión restaurada con éxito. Renderizando UI...");
                currentUser = snap.docs[0].data(); 
                window.completarLoginUI(); 
            } else { 
                console.log("⚠️ Paso 4: El usuario ya no existe en la BD. Limpiando sesión...");
                window.logout();
            }
        } catch(e) { 
            console.error("❌ Error al restaurar sesión:", e); 
            window.logout();
        }
        window.hideLoading();
    } else {
        console.log("👋 Paso 3: No hay sesión. Mostrando pantalla de Login.");
        window.hideLoading();
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.style.display = 'flex';
        }
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarApp);
} else {
    inicializarApp();
}
