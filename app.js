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

// VARIABLES GLOBALES (CORREGIDO: editandoMaestroId restaurado)
let currentUser = null, selectedId = null, selectedDocData = null, tempAction = "";
let allUsers = [], allDepartamentos = [], tiposDocumento = [], columnasMaestro = [], estatusMaestro = [], dataMaestro = [], editandoMaestroId = null;
let globalSolicitudes = [], globalAuditPlan = null, globalAllAuditorias = [], globalAuditorias = [];
let selectedAuditId = null, selectedAuditData = null, editandoAuditoriaId = null;
let currentAuditF020 = [], globalAllSacs = [], currentEditingSacId = null, currentEditingF020Ref = null;

// ==========================================
// 1. UTILIDADES Y VISUALIZADOR DE ARCHIVOS
// ==========================================
const setDisplay = (id, val) => { const el = document.getElementById(id); if (el) el.style.display = val; };

window.abrirDocumento = async (url, nombreOriginal) => {
    if (!url || url === "#") return;
    
    let safeName = nombreOriginal ? nombreOriginal.replace(/[^a-zA-Z0-9.\-_ ]/g, '_') : 'Documento';
    if (!safeName.includes('.')) { 
        let extMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/); 
        if(extMatch) safeName += "." + extMatch[1]; 
    }
    
    let isViewable = url.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif)(\?|$)/);
    
    if (isViewable) {
        const nuevaPestana = window.open('', '_blank');
        if (!nuevaPestana) return alert("Bloqueado por el navegador. Permite las ventanas emergentes.");
        nuevaPestana.document.write(`<html style="font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; background:#f8fafc; color:#1e40af;"><head><title>Cargando: ${safeName}</title></head><body><h2>Preparando documento...</h2></body></html>`);
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Archivo borrado de la nube");
            const blob = await response.blob(); 
            const fileObj = new File([blob], safeName, { type: blob.type });
            const blobUrl = window.URL.createObjectURL(fileObj);
            nuevaPestana.location.href = blobUrl; 
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
        } catch (e) { 
            nuevaPestana.close();
            alert("⚠️ El archivo ya no se encuentra disponible en la nube. Es posible que haya sido eliminado de Cloudinary o el enlace esté roto.");
        }
    } else {
        window.showLoading();
        try {
            const response = await fetch(url); 
            if (!response.ok) throw new Error("Archivo borrado de la nube");
            const blob = await response.blob(); 
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); 
            a.style.display = 'none'; a.href = blobUrl; a.download = safeName; 
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(blobUrl); document.body.removeChild(a);
        } catch (e) { 
            alert("⚠️ El archivo ya no se encuentra disponible en la nube. Es posible que haya sido eliminado de Cloudinary o el enlace esté roto.");
        }
        window.hideLoading();
    }
};

window.showLoading = () => { setDisplay('loading-overlay', 'flex'); };
window.hideLoading = () => { setDisplay('loading-overlay', 'none'); };
window.cambiarVista = (id, btn) => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const section = document.getElementById(id); if(section) section.classList.add('active'); if(btn) btn.classList.add('active');
    if(window.innerWidth <= 768) { const sidebar = document.getElementById('sidebar'); if(sidebar) sidebar.classList.remove('open'); const overlay = document.getElementById('sidebar-overlay'); if(overlay) overlay.classList.remove('active'); }
};
window.toggleMenu = () => { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); };
window.toggleModPanel = v => setDisplay('panel-mod', v === 'Creación' ? 'none' : 'grid');
window.closeModal = () => setDisplay('modal', 'none');
window.cerrarModalAuditoria = () => setDisplay('modal-auditoria', 'none');
window.del = async (c, id) => { if(confirm("¿Eliminar este registro?")) { window.showLoading(); await deleteDoc(doc(db, "artifacts", appId, "public", "data", c, id)); window.hideLoading(); } };
window.getDownloadUrl = (url) => { return url ? url : "#"; };
window.formatearFechaAbreviada = (fechaISO) => {
    if (!fechaISO) return ''; let f = fechaISO; if(f.length === 10) f += 'T12:00:00'; 
    const fecha = new Date(f); if (isNaN(fecha)) return fechaISO; 
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${fecha.getDate()}-${meses[fecha.getMonth()]}-${fecha.getFullYear()}`;
};
window.getGCalFormat = (fechaStr, horaStr) => { let d = new Date(`${fechaStr}T${horaStr}:00`); return d.toISOString().replace(/-|:|\.\d+/g, ''); };
window.sendNotification = (destinatarios, subject, message) => {
    if (!destinatarios.to && !destinatarios.cc) return;
    const templateParams = { to_email: destinatarios.to, cc_email: destinatarios.cc || "", subject: subject, message: message };
    emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, templateParams).catch((error) => console.error('Error enviando notificación', error));
};
window.getDatosEnvio = async (solicitudData) => {
    let managerEmail = "";
    if(solicitudData.gerencia) {
        try {
            const q = query(collection(db, "artifacts", appId, "public", "data", "Usuarios"), where("gerencias", "array-contains", solicitudData.gerencia), where("permisos.p_ger_apr", "==", true));
            const snap = await getDocs(q); if(!snap.empty) managerEmail = snap.docs[0].data().email || "";
        } catch(e) {}
    }
    const toEmails = new Set([EMAIL_ADMIN_SGC, solicitudData.solicitante_email]);
    if(solicitudData.involucrados) { solicitudData.involucrados.forEach(e => toEmails.add(e)); }
    return { to: Array.from(toEmails).join(','), cc: managerEmail };
};
window.uploadToCloudinary = async (file) => {
    const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET);
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: formData });
        const data = await response.json(); return data.secure_url;
    } catch (error) { return null; }
};
window.getNextFCI = async () => {
    const ref = doc(db, "artifacts", appId, "public", "data", "Contadores", "solicitudes"); let id = "";
    await runTransaction(db, async (t) => {
        const snap = await t.get(ref); let count = 1; if (snap.exists()) count = snap.data().count + 1;
        t.set(ref, { count }); id = `FCI-SOL-${String(count).padStart(4, '0')}`;
    });
    return id;
};
window.checkDailyAlerts = async () => {
    if(!currentUser || (!currentUser.permisos.p_gest_sgc && !currentUser.permisos.admin)) return;
    const ref = doc(db, "artifacts", appId, "public", "data", "Configuracion", "EstadoAlertas");
    const snap = await getDoc(ref); const today = new Date().toISOString().split('T')[0];
    if(!snap.exists() || snap.data().ultimaAlerta !== today) {
        let pendientes = globalSolicitudes.filter(s => { let est = (s.estado || "").toUpperCase(); return !est.includes('APROBADO FINAL') && est !== 'ANULADO' && est !== 'RECHAZADO'; });
        if(pendientes.length > 0) {
            let msg = `Hola Equipo SGC.\n\nActualmente hay ${pendientes.length} solicitudes pendientes en diferentes etapas del sistema que requieren atención.`;
            window.sendNotification({to: EMAIL_ADMIN_SGC, cc: ""}, "🔔 Alerta Diaria SGC: Solicitudes Pendientes", msg);
            if(!snap.exists()) { await setDoc(ref, { ultimaAlerta: today }); } else { await updateDoc(ref, { ultimaAlerta: today }); }
        }
    }
};

window.verificarAlertasAuditoria = (auditoriasArray) => {
    if(!globalAuditPlan || !globalAuditPlan.correos || globalAuditPlan.correos.length === 0) return;
    const today = new Date(); today.setHours(0,0,0,0);
    auditoriasArray.forEach(a => {
        if(a.estado === "Completada" || !a.fecha) return;
        let f = a.fecha; if(f.length === 10) f += 'T12:00:00'; 
        const auditDate = new Date(f); auditDate.setHours(0,0,0,0);
        const diffTime = auditDate - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let asunto = "";
        if(diffDays === 30) asunto = "🚨 Recordatorio: 1 Mes para Auditoría";
        if(diffDays === 14) asunto = "⚠️ Recordatorio Urgente: 2 Semanas para Auditoría";
        if(asunto) {
            const dest = { to: globalAuditPlan.correos.join(',') };
            const msg = `Se aproxima la auditoría del proceso: ${a.proceso} programada para el ${window.formatearFechaAbreviada(a.fecha)} en ${a.lugar}.\n\nRequisitos a evaluar: ${a.requisitos}\nAuditados: ${a.auditado}\nAuditores: ${a.auditor}.`;
            window.sendNotification(dest, asunto, msg);
        }
    });
};

// ==========================================
// 2. CONEXIÓN Y CARGA DE DATOS EN TIEMPO REAL
// ==========================================
window.cargarDatosCentrales = () => {
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "Usuarios"), (snap) => {
        allUsers = []; let htmlUsers = ""; let cbUsers = "";
        snap.forEach(doc => { 
            let u = doc.data(); allUsers.push(u); 
            let gers = u.gerencias ? u.gerencias.join(', ') : (u.gerencia || 'N/A');
            htmlUsers += `<tr><td>${u.nombre} (${u.usuario})</td><td>${u.email||''}</td><td>${u.role||''} / <small>${gers}</small></td><td class="no-export"><button class="btn btn-info" style="padding:4px 8px; font-size:10px;" onclick="window.cargarUsuarioParaEditar('${u.usuario}')">Editar</button></td></tr>`;
            
            // Reemplazo a CHECKBOXES para auditores/auditados
            cbUsers += `<label style="display:flex; align-items:center; justify-content:flex-start; gap:8px; font-size:13px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" value="${u.nombre}" data-email="${u.email}" style="margin:0; width:auto; flex-shrink:0;"> ${u.nombre} (${gers})</label>`;
        });
        if (document.getElementById('tbody-users')) document.getElementById('tbody-users').innerHTML = htmlUsers;
        if (document.getElementById('aud-auditado-list')) document.getElementById('aud-auditado-list').innerHTML = cbUsers;
        if (document.getElementById('aud-auditor-list')) document.getElementById('aud-auditor-list').innerHTML = cbUsers;
        if (document.getElementById('ah-auditor-list')) document.getElementById('ah-auditor-list').innerHTML = cbUsers;
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
        
        if(document.getElementById('u-ger-list')) document.getElementById('u-ger-list').innerHTML = gers.map(g => `<label style="display:flex; align-items:center; justify-content:flex-start; gap:8px; font-size:13px; margin-bottom:6px; cursor:pointer;"><input type="checkbox" value="${g}" style="margin:0; width:auto; flex-shrink:0;"> ${g}</label>`).join('');
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
        setDisplay('dash-admin-section', 'block');
        document.getElementById('dash-glob-tot').innerText = sorted.length;
        document.getElementById('dash-glob-pend').innerText = sorted.filter(s => !s.estado.includes('Aprobado') && s.estado !== 'Anulado' && s.estado !== 'Rechazado').length;
        document.getElementById('dash-glob-ok').innerText = sorted.filter(s => s.estado.includes('Aprobado Final')).length;
        document.getElementById('dash-glob-rech').innerText = sorted.filter(s => s.estado === 'Anulado' || s.estado === 'Rechazado').length;
    }
};

// ==========================================
// 3. AUTENTICACIÓN Y SESIÓN
// ==========================================
window.completarLoginUI = () => {
    setDisplay('login-screen', 'none'); setDisplay('sidebar', 'flex'); setDisplay('main', 'block');
    
    const currNameEl = document.getElementById('curr-name'); if(currNameEl) currNameEl.innerText = currentUser.nombre || 'Usuario';
    const currGerEl = document.getElementById('curr-ger'); if(currGerEl) currGerEl.innerText = currentUser.gerencias ? currentUser.gerencias.join(', ') : (currentUser.gerencia || 'Sin Gerencia');

    const p = currentUser.permisos || {};
    setDisplay('admin-only', (p.admin || p.p_users || p.p_struct) ? 'block' : 'none');
    setDisplay('nav-audit-group', (p.admin || p.p_audit_ver || p.p_audit_admin || p.p_audit_auditor || p.p_audit_dueno) ? 'block' : 'none');
    setDisplay('nav-listado', (p.admin || p.p_ver_listado) ? 'flex' : 'none');
    setDisplay('nav-all', (p.admin || p.p_ver_todas) ? 'flex' : 'none');

    let isAdminAudit = p.admin || p.p_audit_admin || p.p_gest_sgc;
    setDisplay('btn-config-plan', isAdminAudit ? 'inline-flex' : 'none');
    setDisplay('btn-nueva-aud', isAdminAudit ? 'inline-flex' : 'none');

    window.cargarDatosCentrales();
    const navDash = document.getElementById('nav-dash'); if(navDash) window.cambiarVista('sec-dash', navDash);
};

window.logout = () => {
    localStorage.removeItem('sgc_session_user'); currentUser = null;
    setDisplay('sidebar', 'none'); setDisplay('main', 'none'); setDisplay('login-screen', 'flex');
    if(document.getElementById('login-user')) document.getElementById('login-user').value = '';
    if(document.getElementById('login-pass')) document.getElementById('login-pass').value = '';
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

// ==========================================
// 4. MÓDULO DE USUARIOS Y ESTRUCTURA
// ==========================================
window.cargarUsuarioParaEditar = (usuarioId) => {
    const u = allUsers.find(x => x.usuario === usuarioId); if(!u) return;
    document.getElementById('user-form-title').innerText = "Editando Usuario: " + u.usuario;
    document.getElementById('u-nom').value = u.nombre || ''; document.getElementById('u-usr').value = u.usuario || ''; document.getElementById('u-usr').disabled = true; document.getElementById('u-pas').value = u.pass || ''; document.getElementById('u-rol').value = u.role || ''; document.getElementById('u-email').value = u.email || '';
    
    let gers = u.gerencias || []; if(!u.gerencias && u.gerencia) gers = [u.gerencia];
    document.querySelectorAll('#u-ger-list input[type="checkbox"]').forEach(cb => { cb.checked = gers.includes(cb.value); });
    
    const p = u.permisos || {};
    document.getElementById('p-solicitar').checked = p.can_solicit || false; document.getElementById('p-ver-propias').checked = p.p_ver_propias || false; document.getElementById('p-ver-ger').checked = p.p_ver_ger || false; document.getElementById('p-ver-todas').checked = p.p_ver_todas || false; document.getElementById('p-paso1').checked = p.p_paso1 || false; document.getElementById('p-paso2').checked = p.p_paso2 || false; document.getElementById('p-paso4').checked = p.p_paso4 || false; document.getElementById('p-gest-sgc').checked = p.p_gest_sgc || false; document.getElementById('p-ger-apr').checked = p.p_ger_apr || false; document.getElementById('p-users').checked = p.p_users || false; document.getElementById('p-struct').checked = p.p_struct || false; document.getElementById('p-ver-listado').checked = p.p_ver_listado || false; document.getElementById('p-audit-ver').checked = p.p_audit_ver || false; document.getElementById('p-audit-admin').checked = p.p_audit_admin || false; document.getElementById('p-audit-auditor').checked = p.p_audit_auditor || false; document.getElementById('p-audit-dueno').checked = p.p_audit_dueno || false; document.getElementById('p-admin').checked = p.admin || false;
    document.getElementById('btnSaveUser').innerText = "ACTUALIZAR USUARIO"; setDisplay('btnCancelEdit', 'inline-flex'); window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetUserForm = () => {
    document.getElementById('user-form-title').innerText = "Registrar / Editar Usuario";
    document.getElementById('u-nom').value = ""; document.getElementById('u-usr').value = ""; document.getElementById('u-usr').disabled = false; document.getElementById('u-pas').value = "123"; document.getElementById('u-rol').value = ""; document.getElementById('u-email').value = "";
    document.querySelectorAll('#u-ger-list input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('p-solicitar').checked = false; document.getElementById('p-ver-propias').checked = true; document.getElementById('p-ver-ger').checked = false; document.getElementById('p-ver-todas').checked = false; document.getElementById('p-paso1').checked = false; document.getElementById('p-paso2').checked = false; document.getElementById('p-paso4').checked = false; document.getElementById('p-gest-sgc').checked = false; document.getElementById('p-ger-apr').checked = false; document.getElementById('p-users').checked = false; document.getElementById('p-struct').checked = false; document.getElementById('p-ver-listado').checked = false; document.getElementById('p-audit-ver').checked = false; document.getElementById('p-audit-admin').checked = false; document.getElementById('p-audit-auditor').checked = false; document.getElementById('p-audit-dueno').checked = false; document.getElementById('p-admin').checked = false;
    document.getElementById('btnSaveUser').innerText = "GUARDAR USUARIO"; setDisplay('btnCancelEdit', 'none');
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

window.agregarGerencia = async () => {
    let val = document.getElementById('g-nom').value.trim().toUpperCase(); if(!val) return; window.showLoading(); let gers = [];
    const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef);
    if(snap.exists() && snap.data().gerencias) gers = snap.data().gerencias;
    if(gers.includes(val)) { window.hideLoading(); return alert("Esa Gerencia ya existe."); }
    gers.push(val); await setDoc(docRef, { gerencias: gers }, {merge: true}); document.getElementById('g-nom').value = ""; window.hideLoading();
};

window.eliminarGerencia = async (idx) => {
    if(!confirm("¿Eliminar Gerencia?")) return; window.showLoading();
    const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef);
    let gers = snap.data().gerencias; gers.splice(idx, 1); await setDoc(docRef, { gerencias: gers }, {merge: true}); window.hideLoading();
};

window.agregarDepartamento = async () => {
    let ger = document.getElementById('d-ger-sel').value; let nom = document.getElementById('d-nom').value.trim();
    if(!ger || !nom) return alert("Seleccione una Gerencia y escriba el nombre del Depto."); window.showLoading(); let deps = [];
    const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef);
    if(snap.exists() && snap.data().departamentos) deps = snap.data().departamentos;
    deps.push({ nombre: nom, gerencia: ger }); await setDoc(docRef, { departamentos: deps }, {merge: true}); document.getElementById('d-nom').value = ""; window.hideLoading();
};

window.eliminarDepartamento = async (idx) => {
    if(!confirm("¿Eliminar Departamento?")) return; window.showLoading();
    const docRef = doc(db, "artifacts", appId, "public", "data", "Configuracion", "Estructura"); const snap = await getDoc(docRef);
    let deps = snap.data().departamentos; deps.splice(idx, 1); await setDoc(docRef, { departamentos: deps }, {merge: true}); window.hideLoading();
};

// ==========================================
// 5. MÓDULO CONFIGURACIÓN DINÁMICA (MAESTRO Y TIPOS)
// ==========================================
window.actualizarSelectTiposDoc = () => {
    let html = '<option value="">-- Seleccione --</option>'; tiposDocumento.forEach(t => html += `<option value="${t}">${t}</option>`);
    if(document.getElementById('sol-tipo-doc')) document.getElementById('sol-tipo-doc').innerHTML = html;
};

window.renderListasConfig = () => {
    let hCol = ""; columnasMaestro.forEach((c, idx) => { 
        let cName = typeof c === 'string' ? c : c.nombre; let cType = typeof c === 'string' ? 'text' : c.tipo;
        hCol += `<div class="settings-item"><span>${cName} <small style="color:#94a3b8; font-size:10px;">(${cType})</small></span><button class="btn-icon-danger" onclick="window.eliminarColumna(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; 
    });
    if(document.getElementById('list-columnas')) document.getElementById('list-columnas').innerHTML = hCol;
    
    let hEst = ""; estatusMaestro.forEach((e, idx) => { hEst += `<div class="settings-item"><span>${e}</span><button class="btn-icon-danger" onclick="window.eliminarEstatus(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; });
    if(document.getElementById('list-estatus')) document.getElementById('list-estatus').innerHTML = hEst;
    
    let hTipos = ""; tiposDocumento.forEach((t, idx) => { hTipos += `<div class="settings-item"><span>${t}</span><button class="btn-icon-danger" onclick="window.eliminarTipoDoc(${idx})"><span class="material-icons-round" style="font-size:16px;">delete</span></button></div>`; });
    if(document.getElementById('list-tipos-doc')) document.getElementById('list-tipos-doc').innerHTML = hTipos;
    
    window.actualizarSelectTiposDoc();
};

window.agregarTipoDoc = async () => {
    let val = document.getElementById('doc-tipo-nom').value.trim(); if(!val) return; if(tiposDocumento.includes(val)) return alert("Ese tipo de documento ya existe.");
    tiposDocumento.push(val); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true}); document.getElementById('doc-tipo-nom').value = "";
};

window.eliminarTipoDoc = async (idx) => {
    if(!confirm("¿Eliminar este tipo de documento?")) return; tiposDocumento.splice(idx, 1);
    await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { tiposDoc: tiposDocumento }, {merge: true});
};

window.agregarColumna = async () => {
    let val = document.getElementById('col-nom').value.trim(); let tipo = document.getElementById('col-tipo').value; if(!val) return; if (columnasMaestro.some(c => (typeof c === 'string' ? c : c.nombre) === val)) return alert("Esa columna ya existe.");
    columnasMaestro.push({nombre: val, tipo: tipo}); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true}); document.getElementById('col-nom').value = "";
};

window.eliminarColumna = async (idx) => {
    if(!confirm("¿Eliminar columna?")) return; columnasMaestro.splice(idx, 1);
    await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { columnas: columnasMaestro }, {merge: true});
};

window.agregarEstatus = async () => {
    let val = document.getElementById('est-nom').value.trim(); if(!val) return; if (estatusMaestro.includes(val)) return alert("Ese estatus ya existe.");
    estatusMaestro.push(val); await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true}); document.getElementById('est-nom').value = "";
};

window.eliminarEstatus = async (idx) => {
    if(!confirm("¿Eliminar este estatus?")) return; estatusMaestro.splice(idx, 1);
    await setDoc(doc(db, "artifacts", appId, "public", "data", "Configuracion", "MaestroSettings"), { estatus: estatusMaestro }, {merge: true});
};

// ==========================================
// 6. MÓDULO LISTADO MAESTRO
// ==========================================
window.renderTablaMaestro = () => {
    const thead = document.getElementById("thead-listado-maestro"); const tbody = document.getElementById("tbody-listado-maestro"); if(!thead || !tbody) return;
    let headHTML = "<tr>"; 
    columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; headHTML += `<th>${cName}</th>`; }); 
    if(currentUser && currentUser.permisos && (currentUser.permisos.p_gest_sgc || currentUser.permisos.admin)) { headHTML += `<th class="no-export">Acción</th>`; } headHTML += "</tr>"; thead.innerHTML = headHTML;
    let dataSort = [...dataMaestro]; 
    if(columnasMaestro.length > 0) { let firstCol = typeof columnasMaestro[0] === 'string' ? columnasMaestro[0] : columnasMaestro[0].nombre; dataSort.sort((a,b) => (a[firstCol]||"").toString().localeCompare((b[firstCol]||"").toString())); }
    let tbodyHtml = "";
    dataSort.forEach(item => {
        let rowHTML = "<tr>";
        columnasMaestro.forEach(col => {
            let cName = typeof col === 'string' ? col : col.nombre; let cType = typeof col === 'string' ? 'text' : col.tipo; let val = item[cName] || "";
            if(cType === 'url' || val.toString().startsWith("http")) { 
                let dUrl = window.getDownloadUrl(val); let fName = item['Nombre del documento'] || item['Título'] || "Documento_Maestro";
                rowHTML += `<td><a href="#" onclick="window.abrirDocumento('${dUrl}', '${fName}'); return false;" class="file-link">📁 ${fName}</a></td>`; 
            } 
            else if(cName.toLowerCase().includes('estatus') || cName.toLowerCase().includes('estado')) { let badge = val.toLowerCase().includes('vigente') || val.toLowerCase().includes('activo') ? 'badge-success' : (val.toLowerCase().includes('obsoleto') || val.toLowerCase().includes('inactivo') ? 'badge-danger' : 'badge-warning'); rowHTML += `<td><span class="badge ${badge}">${val}</span></td>`; } 
            else if(cType === 'date' || cName.toLowerCase().includes('fecha')) { rowHTML += `<td>${window.formatearFechaAbreviada(val)}</td>`; } else { rowHTML += `<td>${val}</td>`; }
        });
        if(currentUser && currentUser.permisos && (currentUser.permisos.p_gest_sgc || currentUser.permisos.admin)) {
            let btnAcciones = `<button class="btn btn-info" style="padding:5px; font-size:10px; margin-right:5px;" onclick="window.abrirModalListadoMaestro('${item.docId}')">EDITAR</button>`; btnAcciones += `<button class="btn btn-danger" style="padding:5px 8px; font-size:10px;" onclick="window.del('ListadoMaestro','${item.docId}')">X</button>`; rowHTML += `<td class="no-export">${btnAcciones}</td>`;
        }
        rowHTML += "</tr>"; tbodyHtml += rowHTML;
    });
    tbody.innerHTML = tbodyHtml;
};

window.abrirModalListadoMaestro = (docId = null) => {
    editandoMaestroId = docId; 
    const titleEl = document.getElementById('lm-modal-title');
    if (titleEl) titleEl.innerText = docId ? "Editar Documento Maestro" : "Nuevo Documento Maestro";
    const container = document.getElementById('dinamic-form-maestro'); let datosEdit = {};
    if(docId) { const item = dataMaestro.find(x => x.docId === docId); if(item) datosEdit = item; }
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
    let data = {}; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; let inEl = document.getElementById(`in_dyn_${cName}`); if(inEl) data[cName] = inEl.value; });
    window.showLoading();
    if(editandoMaestroId) { await updateDoc(doc(db, "artifacts", appId, "public", "data", "ListadoMaestro", editandoMaestroId), data); } 
    else { data.registrado_por = currentUser.nombre; data.fecha_registro = new Date().toISOString(); await addDoc(collection(db, "artifacts", appId, "public", "data", "ListadoMaestro"), data); }
    window.hideLoading(); setDisplay('modal-form-listado', 'none');
};

window.subirArchivoGenericoLM = async () => {
    const f = document.getElementById('lm-generic-file').files[0]; if(!f) return alert("Selecciona un archivo primero.");
    window.showLoading(); let url = await window.uploadToCloudinary(f); if(!url) { window.hideLoading(); return alert("Hubo un error al subir el archivo."); }
    window.hideLoading();
    const inputs = Array.from(document.querySelectorAll("#dinamic-form-maestro input")); const targetInput = inputs.find(el => el.id.toLowerCase().includes('ubicaci') || el.id.toLowerCase().includes('archivo'));
    if(targetInput) { targetInput.value = url; alert("Archivo subido y enlace colocado."); } else { alert("Archivo subido. Copia este enlace:\n" + url); }
    document.getElementById('lm-generic-file').value = "";
};

window.exportarExcelListado = () => {
    if(dataMaestro.length === 0) return alert("No hay registros en el Listado Maestro para exportar.");
    let dataExport = dataMaestro.map(item => { let rowObj = {}; columnasMaestro.forEach(col => { let cName = typeof col === 'string' ? col : col.nombre; rowObj[cName] = item[cName] || ""; }); return rowObj; });
    let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "Listado_Maestro"); XLSX.writeFile(wb, "Listado_Maestro_SGC.xlsx");
};

// ==========================================
// 7. MÓDULO DE SOLICITUDES (CREAR / GESTIONAR)
// ==========================================
window.actualizarGerenteSelect = (gSelected) => {
    const gerentes = allUsers.filter(u => u.gerencias && u.gerencias.includes(gSelected) && u.permisos && u.permisos.p_ger_apr === true);
    if (gerentes && gerentes.length > 0) { 
        document.getElementById('sol-gerente-display').value = gerentes.map(g => g.nombre).join(', '); document.getElementById('sol-email-gerente').value = gerentes.map(g => g.email || '').filter(e=>e).join(', ') || "Sin Email"; 
    } else { 
        document.getElementById('sol-gerente-display').value = "No asignado"; document.getElementById('sol-email-gerente').value = ""; 
    }
    const depSelect = document.getElementById('sol-dep'); let depHtml = "<option value=''>-- Seleccionar Departamento --</option>";
    const depsFiltrados = allDepartamentos.filter(d => d.gerencia === gSelected); depsFiltrados.forEach(d => { depHtml += `<option value="${d.nombre}">${d.nombre}</option>`; });
    depSelect.innerHTML = depHtml;
};

window.crearSolicitud = async () => {
    const tit = document.getElementById('sol-tit').value; const gerTarget = document.getElementById('sol-ger').value; if(!tit) return alert("Título obligatorio"); 
    window.showLoading(); const f = document.getElementById('sol-file');
    let fileName = f.files[0] ? f.files[0].name : ""; let url = null; 
    if (f.files[0]) { url = await window.uploadToCloudinary(f.files[0]); if (!url) { window.hideLoading(); return alert("Error al subir archivo."); } }
    
    const extraEmailsNodes = document.querySelectorAll('.involucrado-item'); const extraEmails = Array.from(extraEmailsNodes).map(el => el.dataset.email); 
    const fci = await window.getNextFCI(); const gerenteEmailVisible = document.getElementById('sol-email-gerente').value; const now = new Date().toISOString();
    
    const data = { customId: fci, titulo: tit, accion: document.getElementById('sol-accion').value, tipoDoc: document.getElementById('sol-tipo-doc').value, prioridad: document.getElementById('sol-prioridad').value, gerencia: gerTarget, departamento: document.getElementById('sol-dep').value, motivo: document.getElementById('sol-motivo').value, cod_ref: document.getElementById('sol-cod-prev').value, ver_ref: document.getElementById('sol-ver-prev').value, fecha_ref: document.getElementById('sol-fecha-prev').value, solicitante: currentUser.nombre, solicitante_email: currentUser.email, uid: currentUser.usuario, involucrados: extraEmails, idx: 0, estado: "Pendiente Documentado", fase_0_ini: now, adjunto: url, adjunto_nombre: fileName, chat: [{u: "SISTEMA", m: "Solicitud creada exitosamente.", t: new Date().toLocaleString()}], fecha: now };
    
    await addDoc(collection(db, "artifacts", appId, "public", "data", "Solicitudes"), data); document.getElementById('lista-involucrados-tags').innerHTML = ""; 
    const toEmails = new Set([EMAIL_ADMIN_SGC, currentUser.email, ...extraEmails]); const destinatarios = { to: Array.from(toEmails).join(','), cc: gerenteEmailVisible }; 
    window.sendNotification(destinatarios, "Nueva Solicitud Creada", `El usuario ${currentUser.nombre} ha creado la solicitud ${fci} con prioridad ${data.prioridad}.`);
    window.hideLoading(); alert("Solicitud Creada: " + fci); window.cambiarVista('sec-hist', document.getElementById('nav-hist'));
};

window.verDetalle = async (id) => {
    selectedId = id; 
    if(document.getElementById('m-extra-input')) document.getElementById('m-extra-input').innerHTML = ""; 
    if(document.getElementById('m-comentario-libre')) document.getElementById('m-comentario-libre').innerHTML = "";
    
    const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", id)); selectedDocData = docSnap.data(); const s = selectedDocData; const p = currentUser.permisos;
    
    if(document.getElementById('m-id')) document.getElementById('m-id').innerText = s.customId; 
    if(document.getElementById('m-tit')) document.getElementById('m-tit').innerText = s.titulo; 
    if(document.getElementById('m-sol')) document.getElementById('m-sol').innerText = s.solicitante;
    
    let estadoStr = (s.estado || "").toUpperCase(); let isAprobadoFinalModal = estadoStr.includes('APROBADO FINAL'); let isCancelado = estadoStr === 'ANULADO' || estadoStr === 'RECHAZADO';
    let badgeClass = 'badge-info'; if(estadoStr.includes('APROBADO')) badgeClass = 'badge-success'; if(isCancelado) badgeClass = 'badge-danger'; if(estadoStr.includes('PENDIENTE')) badgeClass = 'badge-warning';
    
    if(document.getElementById('m-est')) { document.getElementById('m-est').innerText = isAprobadoFinalModal ? 'APROBADO FINAL' : s.estado; document.getElementById('m-est').className = `badge ${badgeClass}`; }
    if(document.getElementById('m-ger')) document.getElementById('m-ger').innerText = s.gerencia; 
    if(document.getElementById('m-tipo')) document.getElementById('m-tipo').innerText = s.tipoDoc || "N/A"; 
    
    let pr = s.prioridad || "Normal"; let bPr = pr === 'Alta' ? 'badge-danger' : (pr === 'Básica' ? 'badge-info' : 'badge-dark'); 
    if(document.getElementById('m-prioridad')) { document.getElementById('m-prioridad').innerText = pr.toUpperCase(); document.getElementById('m-prioridad').className = `badge ${bPr}`; }
    if(document.getElementById('m-accion')) document.getElementById('m-accion').innerText = s.accion; 
    if(document.getElementById('m-jus')) document.getElementById('m-jus').innerText = s.motivo || s.justificacion || "Sin justificación";
    
    let adjOrigName = s.adjunto_nombre || "Archivo Adjunto"; let dlUrl = s.adjunto ? window.getDownloadUrl(s.adjunto) : "#"; 
    if(document.getElementById('m-file-link')) document.getElementById('m-file-link').innerHTML = s.adjunto ? `<a href="#" onclick="window.abrirDocumento('${dlUrl}', '${adjOrigName}'); return false;" class="file-link">📎 ${adjOrigName}</a>` : "Sin archivo";
    
    if(s.accion !== 'Creación') { 
        setDisplay('m-extra-panel', 'block'); 
        if(document.getElementById('m-cod')) document.getElementById('m-cod').innerText = s.cod_ref; 
        if(document.getElementById('m-ver')) document.getElementById('m-ver').innerText = s.ver_ref; 
        if(document.getElementById('m-fecha-ult')) document.getElementById('m-fecha-ult').innerText = window.formatearFechaAbreviada(s.fecha_ref); 
    } else { setDisplay('m-extra-panel', 'none'); }

    let invHTML = "No hay personas extras añadidas.";
    if(s.involucrados && s.involucrados.length > 0) { invHTML = s.involucrados.map(email => { let userFound = allUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase()); return userFound ? `${userFound.nombre} (${email})` : email; }).join('<br>'); }
    if(document.getElementById('m-involucrados-list')) document.getElementById('m-involucrados-list').innerHTML = invHTML;

    for(let i=1; i<=4; i++) { 
        const st = document.getElementById('s'+i); 
        if(st) { st.className = 'step'; if(isCancelado) continue; if(i <= s.idx) st.classList.add('completed'); if(i === s.idx + 1 && !isAprobadoFinalModal) st.classList.add('active'); }
    }

    const esAdminSGC = p.admin || p.p_gest_sgc; 
    const esGer = p.p_ger_apr && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia); 
    const activo = !isAprobadoFinalModal && !isCancelado;

    const fDiff = (ini, fin) => {
        if(!ini || !fin) return "-";
        let ms = new Date(fin) - new Date(ini); if(ms < 0) return "-";
        let d = Math.floor(ms / 86400000); let h = Math.floor((ms % 86400000) / 3600000);
        return `${d}d ${h}h`;
    };
    
    if (document.getElementById('m-tiempos-panel')) {
        if(esAdminSGC) {
            setDisplay('m-tiempos-panel', 'block');
            document.getElementById('m-tiempos-grid').innerHTML = `
                <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 1 (Doc)</b><br>${fDiff(s.fase_0_ini, s.fase_0_fin)}</div>
                <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 2 (Verif)</b><br>${fDiff(s.fase_1_ini, s.fase_1_fin)}</div>
                <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 3 (Gerencia)</b><br>${fDiff(s.fase_2_ini, s.fase_2_fin)}</div>
                <div style="background:white; padding:10px; border-radius:8px; font-size:11px; text-align:center; border:1px solid #ccc;"><b style="color:var(--primary);">Fase 4 (SGC Final)</b><br>${fDiff(s.fase_3_ini, s.fecha_final || s.fase_3_fin)}</div>
            `;
        } else {
            setDisplay('m-tiempos-panel', 'none');
        }
    }

    let puedeGestionarSGC = false;
    if(activo) { if (s.idx === 0 && (p.p_gest_sgc || p.p_paso1 || p.admin)) puedeGestionarSGC = true; if (s.idx === 1 && (p.p_gest_sgc || p.p_paso2 || p.admin)) puedeGestionarSGC = true; if (s.idx === 3 && (p.p_gest_sgc || p.p_paso4 || p.admin)) puedeGestionarSGC = true; }
    const puedeGestionarGerente = esGer && s.idx === 2 && activo; const esInvolucradoActivo = s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase()); const esDuenio = s.uid === currentUser.usuario || esInvolucradoActivo; 

    setDisplay('btn-reabrir', (esAdminSGC && !activo) ? 'inline-flex' : 'none');
    setDisplay('m-add-involucrado-section', activo ? 'flex' : 'none');
    setDisplay('m-actions', (puedeGestionarSGC || puedeGestionarGerente) ? 'block' : 'none');
    setDisplay('applicant-actions', (esDuenio && activo) ? 'block' : 'none');
    setDisplay('m-input-area', 'none');
    setDisplay('general-comment-area', !isCancelado ? 'block' : 'none');
    
    const puedeDevolver = (puedeGestionarSGC || puedeGestionarGerente) && s.idx > 0 && activo; 
    setDisplay('btn-devolver-paso', puedeDevolver ? 'inline-block' : 'none');
    setDisplay('btn-anular', ((puedeGestionarSGC || esDuenio) && activo) ? 'inline-block' : 'none'); 

    if(s.fecha_esperada_cierre) { 
        setDisplay('m-admin-sla', 'block'); 
        if(document.getElementById('m-sla-date')) { document.getElementById('m-sla-date').value = s.fecha_esperada_cierre; document.getElementById('m-sla-date').disabled = !esAdminSGC; }
        setDisplay('btn-save-sla', esAdminSGC ? 'inline-block' : 'none'); 
    } else if (esAdminSGC && activo) { 
        setDisplay('m-admin-sla', 'block'); 
        if(document.getElementById('m-sla-date')) { document.getElementById('m-sla-date').value = ''; document.getElementById('m-sla-date').disabled = false; }
        setDisplay('btn-save-sla', 'inline-block'); 
    } else { setDisplay('m-admin-sla', 'none'); }
    
    setDisplay('m-panel-final-sgc', 'none'); setDisplay('m-panel-update-sgc', 'none'); setDisplay('m-display-final', 'none');
    if(document.getElementById('m-original-data')) document.getElementById('m-original-data').classList.remove('locked-data'); 
    setDisplay('m-orig-title', 'none');

    if ((esAdminSGC || p.p_paso2) && s.idx === 1 && activo) { 
        setDisplay('m-panel-update-sgc', 'block'); 
        if(document.getElementById('m-upd-tit')) document.getElementById('m-upd-tit').value = s.titulo || ''; 
        if(document.getElementById('m-upd-cod')) document.getElementById('m-upd-cod').value = s.cod_ref || ''; 
        if(document.getElementById('m-upd-ver')) document.getElementById('m-upd-ver').value = s.ver_ref || ''; 
    }
    
    if (isAprobadoFinalModal) {
        if (s.version_final) {
            if(document.getElementById('m-original-data')) document.getElementById('m-original-data').classList.add('locked-data'); 
            setDisplay('m-orig-title', 'flex'); setDisplay('m-display-final', 'block');
            if(document.getElementById('m-disp-cod')) document.getElementById('m-disp-cod').innerText = s.codigo_final || s.cod_ref || "N/A"; 
            if(document.getElementById('m-disp-ver')) document.getElementById('m-disp-ver').innerText = s.version_final; 
            if(document.getElementById('m-disp-fecha')) document.getElementById('m-disp-fecha').innerText = s.fecha_final ? window.formatearFechaAbreviada(s.fecha_final) : "N/A"; 
            
            let finName = s.documento_final_nombre || "Documento Oficial"; let finUrl = s.documento_final ? window.getDownloadUrl(s.documento_final) : "#"; 
            if(document.getElementById('m-disp-file')) document.getElementById('m-disp-file').innerHTML = s.documento_final ? `<a href="#" onclick="window.abrirDocumento('${finUrl}', '${finName}'); return false;" class="file-link">📄 ${finName}</a>` : "N/A";
        } else if (esAdminSGC || p.p_paso4) { 
            setDisplay('m-panel-final-sgc', 'block'); 
            if(document.getElementById('m-final-cod')) document.getElementById('m-final-cod').value = s.cod_ref || ""; 
        }
    }
    
    if(activo && document.getElementById('btn-firma-next')) document.getElementById('btn-firma-next').innerText = `Aprobar Etapa (${PASOS_NOMBRES[s.idx] || 'Final'})`;
    const cb = document.getElementById('chat-box'); 
    if(cb) {
        cb.innerHTML = s.chat ? s.chat.map(c => 
            `<div class="chat-msg" style="border-left-color:${c.u===currentUser.nombre?'var(--primary)':'#cbd5e1'}">
                <b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}
                ${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${window.getDownloadUrl(c.archivo)}', '${c.archivo_nombre || 'Evidencia_Adjunta'}'); return false;" style="font-size:10px;color:blue;font-weight:600;text-decoration:none;">📎 ${c.archivo_nombre || 'Ver Evidencia'}</a>` : ''}
            </div>`
        ).join('') : ''; 
    }
    setDisplay('modal', 'flex');
};

window.actualizarDatosSGC = async () => {
    const tit = document.getElementById('m-upd-tit').value; const cod = document.getElementById('m-upd-cod').value; const ver = document.getElementById('m-upd-ver').value; const f = document.getElementById('m-upd-file');
    if(!tit) return alert("El título es obligatorio."); window.showLoading();
    let updateData = { titulo: tit, cod_ref: cod, ver_ref: ver }; let msjChat = `SGC actualizó los datos pre-aprobación. Título: ${tit}, Cód: ${cod}, Ver: ${ver}.`;
    if(f.files[0]) { let fileUrl = await window.uploadToCloudinary(f.files[0]); if(!fileUrl) { window.hideLoading(); return alert("Error subiendo archivo."); } updateData.adjunto = fileUrl; updateData.adjunto_nombre = f.files[0].name; msjChat += ` (Nuevo adjunto subido: ${f.files[0].name})`; }
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { ...updateData, chat: arrayUnion({u: currentUser.nombre, m: `✏️ ${msjChat}`, t: new Date().toLocaleString()}) });
    window.hideLoading(); alert("Datos actualizados correctamente."); window.closeModal();
};

window.guardarSLA = async () => {
    const dateSLA = document.getElementById('m-sla-date').value; if(!dateSLA) return alert("Selecciona una fecha válida."); window.showLoading();
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { fecha_esperada_cierre: dateSLA, chat: arrayUnion({u: currentUser.nombre, m: `⏱️ <b>FECHA LÍMITE (SLA) ESTABLECIDA:</b> ${window.formatearFechaAbreviada(dateSLA)}`, t: new Date().toLocaleString()}) });
    window.hideLoading(); alert("Fecha límite actualizada."); window.verDetalle(selectedId);
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

window.gestionar = (tipo) => { tempAction = tipo; setDisplay('m-input-area', 'block'); if(tipo === 'Reunión') { setDisplay('reunion-container', 'block'); document.getElementById('m-extra-input').setAttribute('data-placeholder', 'Tema de la reunión...'); } else { setDisplay('reunion-container', 'none'); document.getElementById('m-extra-input').setAttribute('data-placeholder', 'Motivo / Consulta / Comentario...'); } };
window.responderSolicitante = () => { tempAction = "Respuesta"; setDisplay('m-input-area', 'block'); document.getElementById('m-extra-input').setAttribute('data-placeholder', 'Detalla tu corrección...'); setDisplay('reunion-container', 'none'); };
window.rechazar = () => { tempAction = 'Rechazado'; setDisplay('m-input-area', 'block'); setDisplay('reunion-container', 'none'); };

window.firmarPaso = async () => {
    const s = selectedDocData; const nIdx = s.idx + 1; const nEst = nIdx < 4 ? PASOS_NOMBRES[nIdx] : "Aprobado Final"; const faseAprobada = PASOS_NOMBRES[s.idx]; const now = new Date().toISOString();
    let updates = { idx: nIdx, estado: nEst, [`fase_${s.idx}_fin`]: now, [`fase_${nIdx}_ini`]: now, chat: arrayUnion({u: currentUser.nombre, m: `✅ FASE COMPLETADA: ${faseAprobada}`, t: new Date().toLocaleString()}) };
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), updates);
    const dest = await window.getDatosEnvio(s); window.sendNotification(dest, `Avance: ${s.customId}`, `La solicitud avanzó a: ${nEst}.`); window.closeModal();
};

window.enviarComentarioLibre = async () => {
    const box = document.getElementById('m-comentario-libre'); const txtHTML = box.innerHTML; const txtPlain = box.innerText.trim(); const f = document.getElementById('m-file-comentario');
    if(!txtPlain && !f.files[0] && txtHTML.replace(/<[^>]*>?/gm, '').trim() === '') return alert("Escribe un mensaje o adjunta un archivo."); window.showLoading(); let fileUrl = null; let fileName = null;
    if (f.files[0]) { fileUrl = await window.uploadToCloudinary(f.files[0]); if (!fileUrl) { window.hideLoading(); return alert("Error de red."); } fileName = f.files[0].name; }
    let chatPayload = {u: currentUser.nombre, m: `💬 <b>Comentario:</b><br>${txtHTML}`, t: new Date().toLocaleString()}; 
    if (fileUrl) { chatPayload.archivo = fileUrl; chatPayload.archivo_nombre = fileName; } 
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { chat: arrayUnion(chatPayload) });
    const dest = await window.getDatosEnvio(selectedDocData); window.sendNotification(dest, `Nuevo Comentario: ${selectedDocData.customId}`, `${currentUser.nombre} dejó un comentario.`); box.innerHTML = ""; f.value = ""; window.hideLoading(); window.closeModal();
};

window.guardarCierreFinal = async () => {
    const codFinal = document.getElementById('m-final-cod').value; const ver = document.getElementById('m-final-ver').value; const fecha = document.getElementById('m-final-fecha').value; const com = document.getElementById('m-final-comentario').value; const f = document.getElementById('m-final-file');
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
    const sel = document.getElementById('sol-involucrado-sel'); const email = sel.value; const name = sel.options[sel.selectedIndex].text; if(!email) return alert("Seleccione un usuario válido.");
    const existingTags = Array.from(document.querySelectorAll('.involucrado-item')); if(existingTags.some(el => el.dataset.email === email)) { return alert("El usuario ya está en la lista."); }
    const div = document.createElement('div'); div.className = 'involucrado-item badge badge-info'; div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '5px'; div.style.fontSize = '12px'; div.style.padding = '6px 12px'; div.dataset.email = email; div.innerHTML = `${name} <span class="material-icons-round" style="font-size:14px; cursor:pointer; color:var(--danger);" onclick="this.parentElement.remove()">close</span>`;
    document.getElementById('lista-involucrados-tags').appendChild(div); sel.value = "";
};

window.guardarNuevoInvolucrado = async () => {
    const sel = document.getElementById('m-new-involucrado-sel'); const newEmail = sel.value; const newName = sel.options[sel.selectedIndex].text; if(!newEmail || !newEmail.includes('@')) return alert('Selecciona un usuario válido.'); window.showLoading();
    let currentInv = selectedDocData.involucrados || []; if(currentInv.includes(newEmail)) { window.hideLoading(); return alert('El usuario ya está en la lista de involucrados.'); } 
    currentInv.push(newEmail); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Solicitudes", selectedId), { involucrados: currentInv, chat: arrayUnion({u: currentUser.nombre, m: `👥 Añadió a ${newName} a la lista de involucrados.`, t: new Date().toLocaleString()}) });
    sel.value = ''; window.hideLoading(); window.verDetalle(selectedId);
};

window.filtrarTabla = (inputId, tbodyId) => {
    const input = document.getElementById(inputId); if (!input) return; const filter = input.value.toLowerCase(); const tbody = document.getElementById(tbodyId); if (!tbody) return; const trs = tbody.getElementsByTagName('tr');
    for (let i = 0; i < trs.length; i++) { let rowText = trs[i].textContent || trs[i].innerText; if (rowText.toLowerCase().indexOf(filter) > -1) { trs[i].style.display = ""; } else { trs[i].style.display = "none"; } }
};

window.setFilterGest = (filterText) => {
    const tbody = document.getElementById('tbody-gestionar'); if (!tbody) return; const trs = tbody.getElementsByTagName('tr'); const filter = filterText.toLowerCase();
    for (let i = 0; i < trs.length; i++) { let statusCell = trs[i].getElementsByTagName('td')[3]; if (statusCell) { let text = statusCell.textContent || statusCell.innerText; if (filter === "" || text.toLowerCase().includes(filter)) { trs[i].style.display = ""; } else { trs[i].style.display = "none"; } } }
};

window.descargarExcelFiltrado = (origen = 'hist', isAdminTotal = false) => {
    let desde = document.getElementById(`${origen}-f-desde`).value; let hasta = document.getElementById(`${origen}-f-hasta`).value; let estado = document.getElementById(`${origen}-f-estado`).value;
    let esAdminSGC = currentUser.permisos.admin || currentUser.permisos.p_gest_sgc;

    let datosFiltrados = globalSolicitudes.filter(s => {
        if (origen !== 'all' && !esAdminSGC) {
            let isMine = (s.uid === currentUser.usuario) || (s.involucrados && currentUser.email && s.involucrados.includes(currentUser.email.toLowerCase()));
            if (origen === 'hist' && !isMine) return false;
            if (origen === 'gest') { const p = currentUser.permisos; let ver = p.p_ver_all || (p.p_ver_ger && currentUser.gerencias && currentUser.gerencias.includes(s.gerencia)) || isMine; if(!ver) return false; }
        }
        if (desde && s.fecha < desde) return false; if (hasta && s.fecha > hasta + "T23:59:59") return false;
        if (estado) {
            let eStr = (s.estado || "").toUpperCase();
            if (estado === 'Pendiente' && (eStr.includes('APROBADO FINAL') || eStr === 'ANULADO' || eStr === 'RECHAZADO')) return false;
            if (estado === 'Aprobado Final' && !eStr.includes('APROBADO FINAL')) return false;
            if (estado === 'Cancelado' && eStr !== 'ANULADO' && eStr !== 'RECHAZADO') return false;
        }
        return true;
    });

    if(datosFiltrados.length === 0) return alert("No hay datos que coincidan con estos filtros.");

    const formatearDiferencia = (ini, fin) => {
        if(!ini || !fin) return "N/A"; const ms = new Date(fin) - new Date(ini); if(ms < 0) return "N/A";
        const m = Math.floor(ms / 60000); const h = Math.floor(m / 60); const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`; if (h > 0) return `${h}h ${m % 60}m`; return `${m}m`;
    };

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

    let nameF = esAdminSGC ? "Reporte_SGC_Completo" : "Reporte_Solicitudes"; 
    let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "Datos_Filtrados"); XLSX.writeFile(wb, `${nameF}.xlsx`);
};

// ==========================================
// 8. MÓDULO DE AUDITORÍAS (F-005, F-003, F-020, F-023)
// ==========================================
window.switchAuditTab = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.getElementById(`btn-tab-${tabId}`); if(btn) btn.classList.add('active');
    const tab = document.getElementById(`tab-${tabId}`); if(tab) tab.classList.add('active');
};

window.abrirNuevaAuditoria = () => {
    window.cancelarEdicionAuditoria();
    setDisplay('audit-admin-panel', 'block');
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
    if(isEditing) { setDisplay('audit-header-edit', 'none'); setDisplay('audit-header-view', 'block'); } else {
        const y = document.getElementById('aud-year-select').value; document.getElementById('edit-year-label').innerText = y;
        document.querySelectorAll('#ah-auditor-list input[type="checkbox"]').forEach(cb => cb.checked = false);
        if(globalAuditPlan) {
            document.getElementById('ah-obj').value = globalAuditPlan.objetivo || ''; document.getElementById('ah-alcance').value = globalAuditPlan.alcance || ''; document.getElementById('ah-tecnica').value = globalAuditPlan.tecnica || ''; document.getElementById('ah-criterios').value = globalAuditPlan.criterios || ''; document.getElementById('ah-ref').value = globalAuditPlan.referencia || ''; document.getElementById('ah-fecha').value = globalAuditPlan.fecha_elab || ''; document.getElementById('ah-tec').value = globalAuditPlan.recursos_tec || ''; document.getElementById('ah-rrhh').value = globalAuditPlan.recursos_hh || ''; document.getElementById('ah-extra-emails').value = (globalAuditPlan.extra_correos || []).join(', ');
            let liderSel = document.getElementById('ah-lider'); for(let i=0; i<liderSel.options.length; i++){ if(liderSel.options[i].value === globalAuditPlan.lider) liderSel.selectedIndex = i; }
            let auditoresGuardados = globalAuditPlan.auditor_nombres || []; 
            document.querySelectorAll('#ah-auditor-list input[type="checkbox"]').forEach(cb => { cb.checked = auditoresGuardados.includes(cb.value); });
        } else {
            document.getElementById('ah-obj').value = ''; document.getElementById('ah-alcance').value = ''; document.getElementById('ah-tecnica').value = ''; document.getElementById('ah-criterios').value = ''; document.getElementById('ah-ref').value = ''; document.getElementById('ah-fecha').value = ''; document.getElementById('ah-tec').value = ''; document.getElementById('ah-rrhh').value = ''; document.getElementById('ah-extra-emails').value = ''; document.getElementById('ah-lider').selectedIndex = 0; 
        }
        setDisplay('audit-header-edit', 'block'); setDisplay('audit-header-view', 'none');
    }
};

window.saveAuditPlan = async () => {
    const year = document.getElementById('aud-year-select').value; const docId = `Plan_${year}`;
    let motivo = "Creación inicial"; if(globalAuditPlan) { motivo = prompt("Motivo de la modificación del Plan Anual:"); if(!motivo) return alert("El motivo es obligatorio para editar."); }

    const liderSel = document.getElementById('ah-lider'); const liderName = liderSel.options[liderSel.selectedIndex]?.value || ""; const liderEmail = liderSel.options[liderSel.selectedIndex]?.getAttribute('data-email') || "";
    const audNombres = []; const audEmails = []; 
    document.querySelectorAll('#ah-auditor-list input:checked').forEach(cb => { audNombres.push(cb.value); audEmails.push(cb.getAttribute('data-email')); });
    
    const extraEmails = document.getElementById('ah-extra-emails').value.split(',').map(e => e.trim().toLowerCase()).filter(e=>e.includes('@'));
    let todosLosCorreos = new Set([...audEmails, ...extraEmails]); if(liderEmail) todosLosCorreos.add(liderEmail);

    const data = { year: year, objetivo: document.getElementById('ah-obj').value, alcance: document.getElementById('ah-alcance').value, tecnica: document.getElementById('ah-tecnica').value, criterios: document.getElementById('ah-criterios').value, referencia: document.getElementById('ah-ref').value, fecha_elab: document.getElementById('ah-fecha').value, lider: liderName, auditor: audNombres.join(', '), auditor_nombres: audNombres, recursos_tec: document.getElementById('ah-tec').value, recursos_hh: document.getElementById('ah-rrhh').value, extra_correos: extraEmails, correos: Array.from(todosLosCorreos), modificado_por: currentUser.nombre, ultima_modif: new Date().toISOString() };

    window.showLoading();
    if(globalAuditPlan) { await updateDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), { ...data, historial: arrayUnion({ fecha: new Date().toISOString(), usuario: currentUser.nombre, motivo: motivo }) }); } 
    else { await setDoc(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), { ...data, historial: [{ fecha: new Date().toISOString(), usuario: currentUser.nombre, motivo: motivo }] }); }
    window.hideLoading(); alert("Plan Anual actualizado."); setDisplay('audit-header-edit', 'none'); setDisplay('audit-header-view', 'block');
};

window.loadAuditPlan = (year) => {
    const docId = `Plan_${year}`; document.getElementById('view-year-label').innerText = year;
    onSnapshot(doc(db, "artifacts", appId, "public", "data", "AuditPlans", docId), s => {
        if(s.exists()) {
            globalAuditPlan = s.data(); setDisplay('audit-header-view', 'block'); 
            if(document.getElementById('view-ah-obj')) document.getElementById('view-ah-obj').innerText = globalAuditPlan.objetivo || '-'; 
            if(document.getElementById('view-ah-alcance')) document.getElementById('view-ah-alcance').innerText = globalAuditPlan.alcance || '-'; 
            if(document.getElementById('view-ah-tecnica')) document.getElementById('view-ah-tecnica').innerText = globalAuditPlan.tecnica || '-'; 
            if(document.getElementById('view-ah-criterios')) document.getElementById('view-ah-criterios').innerText = globalAuditPlan.criterios || '-'; 
            if(document.getElementById('view-ah-ref')) document.getElementById('view-ah-ref').innerText = globalAuditPlan.referencia || '-'; 
            if(document.getElementById('view-ah-fecha')) document.getElementById('view-ah-fecha').innerText = window.formatearFechaAbreviada(globalAuditPlan.fecha_elab) || '-'; 
            if(document.getElementById('view-ah-lider')) document.getElementById('view-ah-lider').innerText = globalAuditPlan.lider || '-'; 
            if(document.getElementById('view-ah-auditor')) document.getElementById('view-ah-auditor').innerText = globalAuditPlan.auditor || '-'; 
            if(document.getElementById('view-ah-tec')) document.getElementById('view-ah-tec').innerText = globalAuditPlan.recursos_tec || '-'; 
            if(document.getElementById('view-ah-rrhh')) document.getElementById('view-ah-rrhh').innerText = globalAuditPlan.recursos_hh || '-';
            let modInfo = `Por: ${globalAuditPlan.modificado_por || '-'} el ${window.formatearFechaAbreviada(globalAuditPlan.ultima_modif)}`;
            if(globalAuditPlan.historial && globalAuditPlan.historial.length > 0) { let ultimoMotivo = globalAuditPlan.historial[globalAuditPlan.historial.length-1].motivo; modInfo += ` (Motivo: ${ultimoMotivo})`; }
            if(document.getElementById('view-ah-mod-info')) document.getElementById('view-ah-mod-info').innerText = modInfo;
        } else { globalAuditPlan = null; setDisplay('audit-header-view', 'none'); }
    });
};

window.cargarAuditoriaParaEditar = async (id) => {
    const audit = globalAllAuditorias.find(x => x.id === id); if(!audit) return; editandoAuditoriaId = id;
    document.getElementById('titulo-form-auditoria').innerText = "Editar Auditoría Programada"; 
    
    document.getElementById('aud-fecha').value = audit.fecha || ''; document.getElementById('aud-h-ini').value = audit.hora_inicio || ''; document.getElementById('aud-h-fin').value = audit.hora_fin || ''; document.getElementById('aud-lugar').value = audit.lugar || ''; document.getElementById('aud-proceso').value = audit.proceso || ''; document.getElementById('aud-req').value = audit.requisitos || ''; document.getElementById('aud-obs').value = audit.observacion || '';
    document.getElementById('aud-org').value = audit.organizacion || ''; document.getElementById('aud-dir').value = audit.direccion || ''; document.getElementById('aud-sitios').value = audit.sitios || ''; document.getElementById('aud-personal').value = audit.personal || ''; document.getElementById('aud-turnos').value = audit.turnos || ''; document.getElementById('aud-formacion').value = audit.auditores_formacion || '';

    let auditadosArr = audit.auditado ? audit.auditado.split(', ') : []; 
    document.querySelectorAll('#aud-auditado-list input[type="checkbox"]').forEach(cb => { cb.checked = auditadosArr.includes(cb.value); });
    
    let auditoresArr = audit.auditor ? audit.auditor.split(', ') : []; 
    document.querySelectorAll('#aud-auditor-list input[type="checkbox"]').forEach(cb => { cb.checked = auditoresArr.includes(cb.value); });
    
    document.getElementById('btn-guardar-aud').innerText = "ACTUALIZAR AUDITORÍA"; setDisplay('btn-cancelar-aud', 'block'); window.scrollTo({ top: document.getElementById('audit-admin-panel').offsetTop, behavior: 'smooth' }); setDisplay('audit-admin-panel', 'block');
};

window.cancelarEdicionAuditoria = () => {
    editandoAuditoriaId = null; document.getElementById('titulo-form-auditoria').innerText = "Programar Nueva Auditoría"; 
    document.getElementById('aud-fecha').value = ''; document.getElementById('aud-h-ini').value = ''; document.getElementById('aud-h-fin').value = ''; document.getElementById('aud-lugar').value = ''; document.getElementById('aud-proceso').value = ''; document.getElementById('aud-req').value = ''; document.getElementById('aud-obs').value = '';
    document.getElementById('aud-org').value = ''; document.getElementById('aud-dir').value = ''; document.getElementById('aud-sitios').value = ''; document.getElementById('aud-personal').value = ''; document.getElementById('aud-turnos').value = ''; document.getElementById('aud-formacion').value = '';

    document.querySelectorAll('#aud-auditado-list input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#aud-auditor-list input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    document.getElementById('btn-guardar-aud').innerText = "GENERAR AUDITORÍA Y NOTIFICAR"; setDisplay('btn-cancelar-aud', 'none');
};

window.guardarAuditoria = async () => {
    const fecha = document.getElementById('aud-fecha').value; const hIni = document.getElementById('aud-h-ini').value; const hFin = document.getElementById('aud-h-fin').value; const proceso = document.getElementById('aud-proceso').value; const lugar = document.getElementById('aud-lugar').value; const req = document.getElementById('aud-req').value; const obs = document.getElementById('aud-obs').value;
    if(!fecha || !proceso) return alert("Fecha y Proceso son obligatorios.");
    
    const auditadoNombres = []; const auditadoEmails = []; 
    document.querySelectorAll('#aud-auditado-list input:checked').forEach(cb => { auditadoNombres.push(cb.value); auditadoEmails.push(cb.getAttribute('data-email')); });
    const auditorNombres = []; const auditorEmails = []; 
    document.querySelectorAll('#aud-auditor-list input:checked').forEach(cb => { auditorNombres.push(cb.value); auditorEmails.push(cb.getAttribute('data-email')); });

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
    
    globalAuditorias = globalAllAuditorias.filter(a => { 
        let matchesYear = a.fecha && a.fecha.startsWith(yearFilter); if(!matchesYear) return false; 
        if(adminView) return true; 
        let miNombre = currentUser.nombre; return (a.auditado && a.auditado.includes(miNombre)) || (a.auditor && a.auditor.includes(miNombre)); 
    });
    
    globalAuditorias.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    let audHtml = "";
    
    globalAuditorias.forEach(a => {
        let estadoLabel = a.estado || 'Programada'; let estadoBadge = estadoLabel === 'Completada' ? 'badge-success' : (estadoLabel === 'En Progreso' ? 'badge-info' : 'badge-warning');
        let btnAccion = `<button class="btn btn-primary" style="padding:4px 8px; font-size:10px; margin-right:5px;" onclick="window.verModalAuditoria('${a.id}')"><span class="material-icons-round" style="font-size:14px; margin-right:4px;">visibility</span> Ver</button>`;
        const isAuditor = a.auditor && a.auditor.includes(currentUser.nombre); 
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
    
    if(document.getElementById('ma-num')) document.getElementById('ma-num').innerText = a.audit_num || 'S/N';
    if(document.getElementById('ma-proceso')) document.getElementById('ma-proceso').innerText = a.proceso || 'Sin Proceso'; 
    if(document.getElementById('ma-fecha')) document.getElementById('ma-fecha').innerText = window.formatearFechaAbreviada(a.fecha) || 'Sin Fecha'; 
    if(document.getElementById('ma-hora')) document.getElementById('ma-hora').innerText = `${a.hora_inicio || '--:--'} a ${a.hora_fin || '--:--'}`; 
    if(document.getElementById('ma-lugar')) document.getElementById('ma-lugar').innerText = a.lugar || 'N/A'; 
    if(document.getElementById('ma-auditado')) document.getElementById('ma-auditado').innerText = a.auditado || 'N/A'; 
    if(document.getElementById('ma-auditor')) document.getElementById('ma-auditor').innerText = a.auditor || 'N/A'; 
    if(document.getElementById('ma-req')) document.getElementById('ma-req').innerText = a.requisitos || 'Ninguno especificado.'; 
    if(document.getElementById('ma-obs')) document.getElementById('ma-obs').innerText = a.observacion || 'Sin observaciones.';
    
    if(document.getElementById('rep-num')) document.getElementById('rep-num').innerText = a.audit_num || 'N/A'; 
    if(document.getElementById('rep-org')) document.getElementById('rep-org').innerText = a.organizacion || 'FCI Logistic'; 
    if(document.getElementById('rep-dir')) document.getElementById('rep-dir').innerText = a.direccion || 'N/A'; 
    if(document.getElementById('rep-sitios')) document.getElementById('rep-sitios').innerText = a.sitios || a.lugar || 'N/A'; 
    if(document.getElementById('rep-fechas')) document.getElementById('rep-fechas').innerText = window.formatearFechaAbreviada(a.fecha); 
    if(document.getElementById('rep-personal')) document.getElementById('rep-personal').innerText = a.personal || 'N/A'; 
    if(document.getElementById('rep-turnos')) document.getElementById('rep-turnos').innerText = a.turnos || 'N/A'; 
    if(document.getElementById('rep-lider')) document.getElementById('rep-lider').innerText = globalAuditPlan ? globalAuditPlan.lider : 'N/A'; 
    if(document.getElementById('rep-adicionales')) document.getElementById('rep-adicionales').innerText = a.auditor || 'N/A'; 
    if(document.getElementById('rep-formacion')) document.getElementById('rep-formacion').innerText = a.auditores_formacion || 'Ninguno'; 
    if(document.getElementById('rep-alcance')) document.getElementById('rep-alcance').innerText = globalAuditPlan ? `(${globalAuditPlan.alcance})` : '';

    let estStr = a.estado || 'Programada'; let bdg = estStr === 'Completada' ? 'badge-success' : (estStr === 'En Progreso' ? 'badge-info' : 'badge-warning');
    if(document.getElementById('ma-estado-badge')) { document.getElementById('ma-estado-badge').className = `badge ${bdg}`; document.getElementById('ma-estado-badge').innerText = estStr.toUpperCase(); }
    
    if(document.getElementById('ma-inicio-real')) document.getElementById('ma-inicio-real').innerText = a.hora_real_inicio ? new Date(a.hora_real_inicio).toLocaleString() : '---'; 
    if(document.getElementById('ma-fin-real')) document.getElementById('ma-fin-real').innerText = a.hora_real_fin ? new Date(a.hora_real_fin).toLocaleString() : '---';
    if(a.hora_real_inicio && a.hora_real_fin && document.getElementById('ma-duracion')) { let ms = new Date(a.hora_real_fin) - new Date(a.hora_real_inicio); let mins = Math.floor(ms / 60000); let hrs = Math.floor(mins / 60); let remMins = mins % 60; document.getElementById('ma-duracion').innerText = `${hrs} horas, ${remMins} minutos`; } else if(document.getElementById('ma-duracion')) { document.getElementById('ma-duracion').innerText = '---'; }

    const isAdminAudit = currentUser.permisos.p_audit_admin || currentUser.permisos.admin || currentUser.permisos.p_gest_sgc; const isAuditor = a.auditor && a.auditor.includes(currentUser.nombre); const canControl = isAdminAudit || isAuditor;
    setDisplay('btn-comenzar-auditoria', (canControl && estStr === 'Programada') ? 'inline-block' : 'none'); 
    setDisplay('btn-finalizar-auditoria', (canControl && estStr === 'En Progreso') ? 'inline-block' : 'none');
    
    const cb = document.getElementById('chat-box-audit'); 
    if(cb) { 
        cb.innerHTML = a.bitacora ? a.bitacora.map(c => 
            `<div class="chat-msg" style="border-left-color:${c.u===currentUser.nombre?'var(--primary)':'#cbd5e1'}">
                <b style="font-size:10px">${c.u}</b> <span style="font-size:9px;color:#94a3b8">${c.t}</span><br>${c.m}
                ${c.archivo ? `<br><a href="#" onclick="window.abrirDocumento('${window.getDownloadUrl(c.archivo)}', '${c.archivo_nombre || 'Evidencia_Auditoria'}'); return false;" style="font-size:10px;color:blue;font-weight:600;text-decoration:none;">📎 ${c.archivo_nombre || 'Ver Evidencia'}</a>` : ''}
            </div>`
        ).join('') : ''; 
    }

    currentAuditF020 = a.lista_verificacion || []; window.renderF020();
    
    const canEditForms = canControl && estStr !== 'Completada';
    const f003Inputs = ['f003-conclusiones', 'f003-n-proceso', 'f003-n-personal', 'f003-n-cargo', 'f003-n-req', 'f003-n-doc', 'f003-n-evidencia'];
    f003Inputs.forEach(id => { let el = document.getElementById(id); if(el) el.disabled = !canEditForms; });

    if(a.reporte_auditoria) { 
        if(document.getElementById('f003-conclusiones')) document.getElementById('f003-conclusiones').value = a.reporte_auditoria.conclusiones || ""; 
        if(document.getElementById('f003-n-proceso')) document.getElementById('f003-n-proceso').value = a.reporte_auditoria.n_proceso || a.proceso || "";
        if(document.getElementById('f003-n-personal')) document.getElementById('f003-n-personal').value = a.reporte_auditoria.n_personal || a.auditado || "";
        if(document.getElementById('f003-n-cargo')) document.getElementById('f003-n-cargo').value = a.reporte_auditoria.n_cargo || "";
        if(document.getElementById('f003-n-req')) document.getElementById('f003-n-req').value = a.reporte_auditoria.n_req || a.requisitos || "";
        if(document.getElementById('f003-n-doc')) document.getElementById('f003-n-doc').value = a.reporte_auditoria.n_doc || "";
        if(document.getElementById('f003-n-evidencia')) document.getElementById('f003-n-evidencia').value = a.reporte_auditoria.n_evidencia || "";
    } else { 
        if(document.getElementById('f003-conclusiones')) document.getElementById('f003-conclusiones').value = ""; 
        if(document.getElementById('f003-n-proceso')) document.getElementById('f003-n-proceso').value = a.proceso || "";
        if(document.getElementById('f003-n-personal')) document.getElementById('f003-n-personal').value = a.auditado || ""; 
        if(document.getElementById('f003-n-cargo')) document.getElementById('f003-n-cargo').value = ""; 
        if(document.getElementById('f003-n-req')) document.getElementById('f003-n-req').value = a.requisitos || ""; 
        if(document.getElementById('f003-n-doc')) document.getElementById('f003-n-doc').value = ""; 
        if(document.getElementById('f003-n-evidencia')) document.getElementById('f003-n-evidencia').value = "";
    }

    window.actualizarMetricasF003(canEditForms); window.renderAuditSACs();
    
    setDisplay('btn-add-f020', canEditForms ? 'inline-block' : 'none'); 
    setDisplay('btn-save-f020', canEditForms ? 'inline-block' : 'none'); 
    setDisplay('btn-save-f003', canEditForms ? 'inline-block' : 'none'); 
    window.switchAuditTab('info'); setDisplay('modal-auditoria', 'flex');
};

window.comenzarAuditoria = async () => { await window.iniciarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.finalizarAuditoria = async () => { await window.finalizarAuditoriaDirecto(selectedAuditId); window.verModalAuditoria(selectedAuditId); };
window.enviarComentarioAuditoria = async () => {
    const box = document.getElementById('ma-comentario-libre'); const txtHTML = box.innerHTML; const txtPlain = box.innerText.trim(); const f = document.getElementById('ma-file-comentario');
    if(!txtPlain && !f.files[0] && txtHTML.replace(/<[^>]*>?/gm, '').trim() === '') return alert("Escribe un mensaje o adjunta evidencia."); window.showLoading(); 
    let fileUrl = null; let fileName = null;
    
    if (f.files[0]) { 
        fileUrl = await window.uploadToCloudinary(f.files[0]); 
        if (!fileUrl) { window.hideLoading(); return alert("Error de red."); } 
        fileName = f.files[0].name;
    }
    
    let chatPayload = {u: currentUser.nombre, m: `💬 <b>Anotación/Hallazgo:</b><br>${txtHTML}`, t: new Date().toLocaleString()}; 
    if (fileUrl) { 
        chatPayload.archivo = fileUrl; 
        chatPayload.archivo_nombre = fileName;
    } 
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", selectedAuditId), { bitacora: arrayUnion(chatPayload) });
    box.innerHTML = ""; f.value = ""; window.hideLoading(); window.verModalAuditoria(selectedAuditId); 
};

window.renderF020 = () => {
    const tbody = document.getElementById('tbody-f020'); if(!tbody) return; let html = "";
    let isAuditor = selectedAuditData.auditor && selectedAuditData.auditor.includes(currentUser.nombre);
    let canEdit = selectedAuditData.estado !== 'Completada' && (currentUser.permisos.admin || currentUser.permisos.p_audit_admin || isAuditor);
    
    currentAuditF020.forEach((item, index) => {
        let dis = canEdit ? '' : 'disabled';
        let opts = `<option value="Conformidad" ${item.hallazgo === 'Conformidad' ? 'selected':''}>Conformidad</option><option value="NC Menor" ${item.hallazgo === 'NC Menor' ? 'selected':''}>NC Menor</option><option value="NC Mayor" ${item.hallazgo === 'NC Mayor' ? 'selected':''}>NC Mayor</option><option value="OM" ${item.hallazgo === 'OM' ? 'selected':''}>Oportunidad Mejora</option><option value="Fortaleza" ${item.hallazgo === 'Fortaleza' ? 'selected':''}>Fortaleza</option><option value="N/A" ${item.hallazgo === 'N/A' || !item.hallazgo ? 'selected':''}>N/A</option>`;
        html += `<tr data-id="${item.id}"><td>${index + 1}</td><td><textarea class="table-input" rows="2" ${dis}>${item.pregunta || ''}</textarea></td><td><input type="text" class="table-input" value="${item.requisito || ''}" ${dis}></td><td><textarea class="table-input" rows="2" ${dis}>${item.comentarios || ''}</textarea></td><td><input type="text" class="table-input" value="${item.auditado || ''}" ${dis}></td><td><select class="table-select hallazgo-sel" ${dis}>${opts}</select></td><td class="f020-action-col">${canEdit ? `<button class="btn-icon-danger" onclick="window.eliminarF020('${item.id}')"><span class="material-icons-round">delete</span></button>` : ''}</td></tr>`;
    });
    tbody.innerHTML = html; document.querySelectorAll('.f020-action-col').forEach(el => el.style.display = canEdit ? '' : 'none');
};

window.agregarFilaF020 = () => { currentAuditF020.push({ id: 'f020_' + Date.now() + Math.floor(Math.random()*1000), pregunta: '', requisito: '', comentarios: '', auditado: '', hallazgo: 'N/A' }); window.renderF020(); };
window.eliminarF020 = (id) => { if(!confirm("¿Eliminar ítem?")) return; currentAuditF020 = currentAuditF020.filter(x => x.id !== id); window.renderF020(); };

window.guardarF020 = async () => {
    const trs = document.querySelectorAll('#tbody-f020 tr'); let dataArr = [];
    trs.forEach(tr => { let inputs = tr.querySelectorAll('.table-input, .table-select'); dataArr.push({ id: tr.dataset.id, pregunta: inputs[0].value, requisito: inputs[1].value, comentarios: inputs[2].value, auditado: inputs[3].value, hallazgo: inputs[4].value }); });
    window.showLoading(); await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", selectedAuditId), { lista_verificacion: dataArr, bitacora: arrayUnion({u: currentUser.nombre, m: `📝 <b>Actualizó Lista de Verificación (F-020)</b>`, t: new Date().toLocaleString()}) });
    window.hideLoading(); alert("F-020 Guardado correctamente."); window.verModalAuditoria(selectedAuditId); 
};

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
    if(document.getElementById('f003-nc-mayor')) document.getElementById('f003-nc-mayor').innerText = ncMay; 
    if(document.getElementById('f003-nc-menor')) document.getElementById('f003-nc-menor').innerText = ncMen; 
    if(document.getElementById('f003-om')) document.getElementById('f003-om').innerText = om;
    if(document.getElementById('container-nc-menor')) document.getElementById('container-nc-menor').innerHTML = hMenor || "<p style='font-size:11px; color:#94a3b8;'>No se detectaron NC Menores.</p>";
    if(document.getElementById('container-nc-mayor')) document.getElementById('container-nc-mayor').innerHTML = hMayor || "<p style='font-size:11px; color:#94a3b8;'>No se detectaron NC Mayores.</p>";
    if(document.getElementById('container-om')) document.getElementById('container-om').innerHTML = hOM || "<p style='font-size:11px; color:#94a3b8;'>No se detectaron Oportunidades de Mejora.</p>";
};

window.guardarF003 = async () => {
    window.showLoading(); 
    let detalles_nc = {};
    document.querySelectorAll('.f003-hallazgo-block').forEach(block => {
        let id = block.dataset.id;
        detalles_nc[id] = { departamento: block.querySelector('.h-dep').value, doc_ref: block.querySelector('.h-doc').value, requisito: block.querySelector('.h-req').value, detalle: block.querySelector('.h-det').value };
    });
    let repData = { 
        conclusiones: document.getElementById('f003-conclusiones').value, n_proceso: document.getElementById('f003-n-proceso').value, n_personal: document.getElementById('f003-n-personal').value, n_cargo: document.getElementById('f003-n-cargo').value, n_req: document.getElementById('f003-n-req').value, n_doc: document.getElementById('f003-n-doc').value, n_evidencia: document.getElementById('f003-n-evidencia').value, detalles_nc: detalles_nc
    };
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", selectedAuditId), { reporte_auditoria: repData, bitacora: arrayUnion({u: currentUser.nombre, m: `📊 <b>Actualizó Reporte de Auditoría (F-003)</b>`, t: new Date().toLocaleString()}) });
    window.hideLoading(); alert("Reporte F-003 guardado.");
};

window.renderAuditSACs = () => {
    const tb = document.getElementById('tbody-audit-sacs'); if(!tb) return; let html = ""; let hallazgosFiltrados = currentAuditF020.filter(i => i.hallazgo === 'NC Mayor' || i.hallazgo === 'NC Menor' || i.hallazgo === 'OM');
    if(hallazgosFiltrados.length === 0) { tb.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No se encontraron NC o Mejoras en la Lista de Verificación.</td></tr>"; return; }
    hallazgosFiltrados.forEach((h, idx) => {
        let sac = globalAllSacs.find(s => s.f020_id === h.id); let badge = ''; let estado = 'SIN GENERAR'; let btn = '';
        let bH = h.hallazgo === 'NC Mayor' ? 'badge-danger' : (h.hallazgo === 'NC Menor' ? 'badge-warning' : 'badge-info');
        if(sac) {
            estado = sac.estado; let bs = estado.includes('Abierta') ? 'badge-danger' : (estado === 'En Seguimiento' ? 'badge-warning' : 'badge-success');
            badge = `<span class="badge ${bs}">${estado.toUpperCase()}</span><br><small style="font-size:9px;">${sac.sac_num}</small>`; btn = `<button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verSAC('${sac.sac_id}')">VER SAC</button>`;
        } else {
            badge = `<span class="badge badge-dark">NO CREADA</span>`;
            if(currentUser.permisos.p_audit_auditor || currentUser.permisos.admin || currentUser.permisos.p_gest_sgc || (selectedAuditData.auditor && selectedAuditData.auditor.includes(currentUser.nombre))) { btn = `<button class="btn btn-info" style="padding:4px 8px; font-size:10px;" onclick="window.abrirCrearSAC('${h.id}')">CREAR SAC</button>`; }
        }
        html += `<tr><td><b>Ref. ${idx+1}</b><br><small style="color:#64748b">${h.pregunta.substring(0, 30)}...</small></td><td style="white-space:pre-wrap; font-size:11px;">${h.comentarios}</td><td><span class="badge ${bH}">${h.hallazgo}</span></td><td>${badge}</td><td>${btn}</td></tr>`;
    });
    tb.innerHTML = html;
};

window.addPlanRow = (detalle="", resp="", fIni="", fFin="") => {
    const tb = document.getElementById('tbody-plan-accion'); let rowCount = tb.children.length + 1; let tr = document.createElement('tr');
    tr.innerHTML = `<td style="border:1px solid #ccc; padding:4px;">${rowCount}</td><td style="border:1px solid #ccc; padding:0;"><input type="text" value="${detalle}" style="width:100%; border:none; margin:0; padding:6px;"></td><td style="border:1px solid #ccc; padding:0;"><input type="text" value="${resp}" style="width:100%; border:none; margin:0; padding:6px;"></td><td style="border:1px solid #ccc; padding:0;"><input type="date" value="${fIni}" style="width:100%; border:none; margin:0; padding:6px;"></td><td style="border:1px solid #ccc; padding:0;"><input type="date" value="${fFin}" style="width:100%; border:none; margin:0; padding:6px;"></td><td style="border:1px solid #ccc; text-align:center; padding:0;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round" style="font-size:14px;">delete</span></button></td>`;
    tb.appendChild(tr);
};

window.addSeguimientoRow = (resultado="", resp="", fecha="") => {
    const tb = document.getElementById('tbody-seguimiento'); let rowCount = tb.children.length + 1; let tr = document.createElement('tr');
    tr.innerHTML = `<td style="border:1px solid #ccc; padding:4px;">${rowCount}</td><td style="border:1px solid #ccc; padding:0;"><input type="text" value="${resultado}" style="width:100%; border:none; margin:0; padding:6px;"></td><td style="border:1px solid #ccc; padding:0;"><input type="text" value="${resp}" style="width:100%; border:none; margin:0; padding:6px;"></td><td style="border:1px solid #ccc; padding:0;"><input type="date" value="${fecha}" style="width:100%; border:none; margin:0; padding:6px;"></td><td style="border:1px solid #ccc; text-align:center; padding:0;"><button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove()"><span class="material-icons-round" style="font-size:14px;">delete</span></button></td>`;
    tb.appendChild(tr);
};

window.abrirCrearSAC = (f020_id) => {
    let h = currentAuditF020.find(i => i.id === f020_id); if(!h) return; currentEditingSacId = null; currentEditingF020Ref = h;
    if(document.getElementById('sac-num')) document.getElementById('sac-num').innerText = "POR ASIGNAR"; 
    if(document.getElementById('sac-estado-badge')) { document.getElementById('sac-estado-badge').innerText = "NUEVA"; document.getElementById('sac-estado-badge').className = "badge badge-info"; }
    if(document.getElementById('sac-fecha')) document.getElementById('sac-fecha').value = new Date().toISOString().split('T')[0]; 
    if(document.getElementById('sac-proceso')) document.getElementById('sac-proceso').value = h.proceso || selectedAuditData.proceso || "";
    if(document.getElementById('sac-tipo')) document.getElementById('sac-tipo').value = h.hallazgo || ""; 
    if(document.getElementById('sac-fuente')) document.getElementById('sac-fuente').value = "Auditoría Interna"; 
    if(document.getElementById('sac-fuente-otro')) document.getElementById('sac-fuente-otro').value = "";
    if(document.getElementById('sac-detalle')) document.getElementById('sac-detalle').value = h.comentarios || h.pregunta; 
    if(document.getElementById('sac-beneficio')) document.getElementById('sac-beneficio').value = ""; 
    if(document.getElementById('sac-causa')) document.getElementById('sac-causa').value = ""; 
    if(document.getElementById('sac-accion')) document.getElementById('sac-accion').value = "";
    if(document.getElementById('tbody-plan-accion')) document.getElementById('tbody-plan-accion').innerHTML = ""; 
    if(document.getElementById('sac-fecha-aprob-plan')) document.getElementById('sac-fecha-aprob-plan').value = ""; 
    if(document.getElementById('tbody-seguimiento')) document.getElementById('tbody-seguimiento').innerHTML = "";
    if(document.getElementById('sac-resp-cierre')) document.getElementById('sac-resp-cierre').value = ""; 
    if(document.getElementById('sac-fecha-cierre')) document.getElementById('sac-fecha-cierre').value = ""; 
    if(document.getElementById('sac-check-cerrar')) document.getElementById('sac-check-cerrar').checked = false;
    
    let opt = '<option value="">-- Seleccione Responsable (Dueño) --</option>'; allUsers.forEach(u => { opt += `<option value="${u.usuario}">${u.nombre} (${u.gerencias ? u.gerencias[0]:''})</option>`; });
    if(document.getElementById('sac-dueno')) document.getElementById('sac-dueno').innerHTML = opt; 
    setDisplay('modal-sac', 'flex');
};

window.verSAC = (sac_id) => {
    let sac = globalAllSacs.find(s => s.sac_id === sac_id); if(!sac) return; currentEditingSacId = sac_id;
    if(document.getElementById('sac-num')) document.getElementById('sac-num').innerText = sac.sac_num; 
    let est = sac.estado; let bs = est.includes('Abierta') ? 'badge-danger' : (est === 'En Seguimiento' ? 'badge-warning' : 'badge-success');
    if(document.getElementById('sac-estado-badge')) { document.getElementById('sac-estado-badge').innerText = est.toUpperCase(); document.getElementById('sac-estado-badge').className = `badge ${bs}`; }
    
    if(document.getElementById('sac-fecha')) document.getElementById('sac-fecha').value = sac.fecha_registro || sac.fecha_apertura.split('T')[0]; 
    if(document.getElementById('sac-proceso')) document.getElementById('sac-proceso').value = sac.proceso || ""; 
    if(document.getElementById('sac-tipo')) document.getElementById('sac-tipo').value = sac.tipo_hallazgo || "";
    if(document.getElementById('sac-fuente')) document.getElementById('sac-fuente').value = sac.fuente_nc || "Auditoría Interna"; 
    if(document.getElementById('sac-fuente-otro')) document.getElementById('sac-fuente-otro').value = sac.fuente_otro || ""; 
    if(document.getElementById('sac-detalle')) document.getElementById('sac-detalle').value = sac.detalle_nc || "";
    if(document.getElementById('sac-beneficio')) document.getElementById('sac-beneficio').value = sac.beneficio_esperado || ""; 
    if(document.getElementById('sac-causa')) document.getElementById('sac-causa').value = sac.causa_raiz || ""; 
    if(document.getElementById('sac-accion')) document.getElementById('sac-accion').value = sac.accion_implementar || "";
    
    let opt = '<option value="">-- Seleccione Responsable (Dueño) --</option>'; allUsers.forEach(u => { opt += `<option value="${u.usuario}" ${sac.dueno_uid === u.usuario ? 'selected':''}>${u.nombre}</option>`; });
    if(document.getElementById('sac-dueno')) document.getElementById('sac-dueno').innerHTML = opt; 
    
    if(document.getElementById('tbody-plan-accion')) { document.getElementById('tbody-plan-accion').innerHTML = ""; if(sac.plan_accion) { sac.plan_accion.forEach(p => window.addPlanRow(p.detalle, p.resp, p.inicio, p.fin)); } }
    if(document.getElementById('sac-fecha-aprob-plan')) document.getElementById('sac-fecha-aprob-plan').value = sac.fecha_aprobacion_plan || "";
    if(document.getElementById('tbody-seguimiento')) { document.getElementById('tbody-seguimiento').innerHTML = ""; if(sac.seguimiento) { sac.seguimiento.forEach(s => window.addSeguimientoRow(s.resultado, s.resp, s.fecha)); } }
    if(document.getElementById('sac-resp-cierre')) document.getElementById('sac-resp-cierre').value = sac.cerrado_por || ""; 
    if(document.getElementById('sac-fecha-cierre')) document.getElementById('sac-fecha-cierre').value = sac.fecha_cierre ? sac.fecha_cierre.split('T')[0] : "";
    if(document.getElementById('sac-check-cerrar')) document.getElementById('sac-check-cerrar').checked = est === 'Cerrada'; 
    setDisplay('modal-sac', 'flex');
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
    setDisplay('modal-sac', 'none'); window.hideLoading(); if(selectedAuditId) window.verModalAuditoria(selectedAuditId);
};

window.renderF023Global = () => {
    const tb = document.getElementById('tbody-noconf'); if(!tb) return;
    let html = ""; let filtrados = [...globalAllSacs];
    const selEst = document.getElementById('filter-noconf-estado');
    if(selEst && selEst.value) { filtrados = filtrados.filter(s => s.estado === selEst.value); }
    if(!currentUser.permisos.admin && !currentUser.permisos.p_gest_sgc && !currentUser.permisos.p_audit_admin) {
        filtrados = filtrados.filter(s => s.dueno_uid === currentUser.usuario || s.auditor_nombre === currentUser.nombre);
    }
    filtrados.sort((a,b) => b.sac_num > a.sac_num ? -1 : 1);
    filtrados.forEach(s => {
        let est = s.estado; let bs = est.includes('Abierta') ? 'badge-danger' : (est === 'En Seguimiento' ? 'badge-warning' : 'badge-success');
        let uDueno = allUsers.find(u => u.usuario === s.dueno_uid); let nomDueno = uDueno ? uDueno.nombre : s.dueno_uid;
        let bColor = s.tipo_hallazgo === 'NC Mayor' ? 'color:var(--danger)' : 'color:var(--warning)';
        html += `<tr><td><b>${s.sac_num}</b></td><td>${s.proceso}</td><td><b style="${bColor}">${s.tipo_hallazgo}</b></td><td>${nomDueno}</td><td><div style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${s.detalle_nc}">${s.detalle_nc}</div></td><td>${window.formatearFechaAbreviada(s.fecha_registro)}</td><td><span class="badge ${bs}">${est}</span></td><td>${s.fecha_cierre ? window.formatearFechaAbreviada(s.fecha_cierre) : '-'}</td><td class="no-export"><button class="btn btn-primary" style="padding:4px 8px; font-size:10px;" onclick="window.verSACGlobal('${s.sac_id}', '${s.audit_id}')">Revisar</button></td></tr>`;
    });
    tb.innerHTML = html;
};

window.setFilterGestNC = (val) => { window.renderF023Global(); };
window.verSACGlobal = async (sac_id, audit_id) => {
    const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "Auditorias", audit_id));
    if(docSnap.exists()) { selectedAuditData = docSnap.data(); selectedAuditId = audit_id; }
    window.verSAC(sac_id);
};
window.exportarExcelNoConf = () => {
    if(globalAllSacs.length === 0) return alert("No hay registros SAC para exportar.");
    let dataExport = globalAllSacs.map(s => {
        let uDueno = allUsers.find(u => u.usuario === s.dueno_uid);
        return { "N° SAC": s.sac_num, "Proceso / Auditoría": s.proceso, "Tipo de Hallazgo": s.tipo_hallazgo, "Responsable": uDueno ? uDueno.nombre : s.dueno_uid, "Detalle No Conformidad": s.detalle_nc, "Fecha Apertura": s.fecha_apertura ? new Date(s.fecha_apertura).toLocaleString() : '', "Causa Raíz": s.causa_raiz || '', "Acción Correctiva Implementada": s.accion_implementar || '', "Estado": s.estado, "Fecha Cierre": s.fecha_cierre ? new Date(s.fecha_cierre).toLocaleString() : '', "Cerrado Por": s.cerrado_por || '' };
    });
    let wb = XLSX.utils.book_new(); let ws = XLSX.utils.json_to_sheet(dataExport); XLSX.utils.book_append_sheet(wb, ws, "F-023_Control_NC"); XLSX.writeFile(wb, "Reporte_F-023_Control_NC.xlsx");
};

// ==========================================
// ARRANQUE DE LA APLICACIÓN
// ==========================================
const inicializarApp = async () => {
    console.log("🚀 Paso 1: Iniciando aplicación..."); window.hideLoading(); 
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
                currentUser = snap.docs[0].data(); window.completarLoginUI(); 
            } else { 
                console.log("⚠️ Paso 4: El usuario ya no existe en la BD. Limpiando sesión..."); window.logout();
            }
        } catch(e) { console.error("❌ Error al restaurar sesión:", e); window.logout(); }
        window.hideLoading();
    } else {
        console.log("👋 Paso 3: No hay sesión. Mostrando pantalla de Login."); window.hideLoading();
        const loginScreen = document.getElementById('login-screen'); if (loginScreen) { loginScreen.style.display = 'flex'; }
    }
};

if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", inicializarApp); } else { inicializarApp(); }
