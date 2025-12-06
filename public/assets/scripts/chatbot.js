const LS_KEY = "safertech_chats_v1";
const LS_CURRENT = "safertech_current_v1";

const chatWindow = document.getElementById("chatWindow");
const mensajeInput = document.getElementById("mensaje");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");
const listPanel = document.getElementById("listPanel");
const sidebarUser = document.getElementById("sidebarUser");
const starBtn = document.getElementById("starCurrent");
const deleteBtn = document.getElementById("deleteChat");
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const userBox = document.getElementById("userBox");
const userMenu = document.getElementById("userMenu");
const logoutBtn = document.getElementById("logoutBtn");

let chats = [];
let currentChatId = null;

// UTILIDADES
function uid() {
    return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function saveAll() {
    localStorage.setItem(LS_KEY, JSON.stringify(chats));
    localStorage.setItem(LS_CURRENT, currentChatId);
}
function loadAll() {
    try {
        chats = JSON.parse(localStorage.getItem(LS_KEY)) || [];
        currentChatId = localStorage.getItem(LS_CURRENT) || null;
    } catch (e) {
        chats = [];
        currentChatId = null;
    }
}
function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// NUEVO: enviar respuesta especial del bot sin interferir
function enviarRespuestaBot(texto) {
    if (!currentChatId) createNewChat();
    const chat = chats.find(c => c.id === currentChatId);

    chat.messages.push({
        who: "bot",
        text: texto,
        ts: Date.now(),
        rating: 0
    });

    saveAll();
    renderCurrentChat();
}


// CREAR CHAT
function createNewChat() {
    const id = uid();
    const chat = {
        id,
        title: "Chat sin título",
        messages: [],
        fav: false,
        created: Date.now()
    };

    chats.unshift(chat);
    currentChatId = id;
    saveAll();
    renderCurrentChat();
}

function buscarEnChat(palabra) {
    if (!palabra) return;

    const mensajes = chatWindow.querySelectorAll(".message div");

    let firstMatch = null;

    mensajes.forEach(msg => {
        const texto = msg.innerHTML.replace(/<span class="highlight-search">|<\/span>/g, "");

        msg.innerHTML = texto;

        if (texto.toLowerCase().includes(palabra.toLowerCase())) {
            if (!firstMatch) firstMatch = msg;

            const regex = new RegExp(`(${palabra})`, "gi");
            msg.innerHTML = texto.replace(regex, `<span class="highlight-search">$1</span>`);
        }
    });

    if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
        alert("No se encontró esa palabra en el chat.");
    }
}

// RENDERIZAR CHAT
function renderCurrentChat() {
    const chat = chats.find(c => c.id === currentChatId);

    chatWindow.innerHTML = "";

    if (!chat) {
    showWelcome();
    starBtn.textContent = "☆";
    return;
}

starBtn.textContent = chat.fav ? "★" : "☆";

if (chat.messages.length === 0) {
    showWelcome();
    chatWindow.innerHTML = "";
    return;
} else {
    hideWelcome();
}


    chat.messages.forEach(m => appendMessageToWindow(m.text, m.who, m));

    setTimeout(() => {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }, 30);
}


function showWelcome() {
    // Mostrar el mensaje de bienvenida (no ocultar chat-controls ni input)
    welcomeScreen.style.display = "block";
    // vaciar la ventana de chat si no hay chat activo (opcional)
    // chatWindow.innerHTML = "";
}

function hideWelcome() {
    welcomeScreen.style.display = "none";
}


function appendMessageToWindow(text, who, msgObj = null) {
    const wrapper = document.createElement("div");
    wrapper.className = "message " + (who === "user" ? "user" : "bot");

    const p = document.createElement("div");
    p.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
    wrapper.appendChild(p);

    // ⭐ SOLO PARA MENSAJES DEL BOT
    if (who === "bot") {
        const ratingBox = document.createElement("div");
        ratingBox.className = "rating-box";

        const currentRating = msgObj?.rating || 0;

        for (let i = 1; i <= 5; i++) {
            const star = document.createElement("span");
            star.className = "rating-star";
            star.textContent = i <= currentRating ? "★" : "☆";
            star.dataset.value = i;

            star.addEventListener("click", () => {
                msgObj.rating = i;
                saveAll();
                renderCurrentChat();
            });

            ratingBox.appendChild(star);
        }

        wrapper.appendChild(ratingBox);
    }

    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// ===== DETECTOR AUTOMÁTICO DE LENGUAJE ===== //
function detectarLenguaje(code) {

    const patrones = {
        python: [/def /, /import /, /print\(/, /self/, /:/],
        javascript: [/function /, /const /, /let /, /=>/, /console\.log/],
        java: [/public class/, /System\.out\.println/, /new [A-Z]/],
        cpp: [/#include <.*>/, /std::/, /cout <</, /int main/],
        php: [/<\?php/, /echo /, /\$\w+/],
        csharp: [/using System/, /Console\.WriteLine/, /public class/],
        go: [/package main/, /fmt\.Println/, /func main/],
        rust: [/fn main/, /let mut/, /println!/, /::/]
    };

    let posibles = [];

    for (const [lenguaje, tests] of Object.entries(patrones)) {
        let matchCount = tests.filter(t => t.test(code)).length;
        if (matchCount > 1) posibles.push({ lenguaje, score: matchCount });
    }

    if (posibles.length === 1) {
        return posibles[0].lenguaje; // Detectado con confianza
    }

    if (posibles.length > 1) {
        return "ambiguo"; // Puede ser varios lenguajes
    }

    return null; // No se detectó
}



// ======== FUNCIÓN PRINCIPAL: ENVIAR MENSAJE ======== //

function enviarMensaje() {

    const text = mensajeInput.value.trim();
    if (!text) return;

    // 🔥 1. Verificar si es un comando
    const handled = procesarComandoDeVoz(text);
    if (handled) {
        mensajeInput.value = "";
        return;
    }

    // 🔥 2. Detectar lenguaje automáticamente solo si hay código
    const contieneCodigo = /[{}();=\[\]]|class |def |function|#include/.test(text);

    if (contieneCodigo) {
        const lenguaje = detectarLenguaje(text);

        if (lenguaje === "ambiguo") {
            enviarRespuestaBot(
                "⚠ No puedo identificar con certeza el lenguaje del fragmento.\n" +
                "Por favor indícame manualmente qué lenguaje estás utilizando."
            );
            mensajeInput.value = "";
            return;
        }

        if (lenguaje === null) {
            enviarRespuestaBot(
                "❓ No reconozco el lenguaje de este código.\n" +
                "Indica el lenguaje para que pueda explicarlo correctamente."
            );
            mensajeInput.value = "";
            return;
        }

        //  Lenguaje detectado correctamente
        enviarRespuestaBot(`🔍 Detecté que este código está escrito en **${lenguaje}**.\nAquí tienes la explicación:`);

        // Aquí puedes invocar tu función del bot para explicar el código:
        // const explicacion = explicarCodigo(text, lenguaje);

        // enviarRespuestaBot(explicacion);
    }


    //  3. Guardia de chat
    if (!currentChatId) createNewChat();
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    chat.messages.push({ who: "user", text, ts: Date.now(), rating: 0 });

    if (chat.title === "Chat sin título" && text.length > 2) {
        chat.title = text.length > 28 ? text.slice(0, 28) + "..." : text;
    }

    saveAll();
    renderCurrentChat();
    mensajeInput.value = "";

    // 4. Respuesta normal (si no fue código ni comando)
    setTimeout(() => {
        const botResp = getBotResponse(text);
        chat.messages.push({ who: "bot", text: botResp, ts: Date.now(), rating: 0});
        saveAll();
        renderCurrentChat();
    }, 500);
}


// ─────────────────────────────────────────────
// DETECCIÓN AUTOMÁTICA DE LENGUAJE DE PROGRAMACIÓN
// ─────────────────────────────────────────────
function detectarLenguaje(codigo) {
    const patrones = [
        { lang: "python", regex: /\b(def|import|print|self|None|elif)\b/ },
        { lang: "javascript", regex: /\b(function|const|let|console\.log|=>)\b/ },
        { lang: "java", regex: /\b(public|class|static|void|System\.out)\b/ },
        { lang: "c++", regex: /\b(#include|std::|cout|cin|int main)\b/ },
        { lang: "php", regex: /<\?php|\becho\b|\$[A-Za-z_]/ },
        { lang: "c#", regex: /\busing System|Console\.WriteLine|namespace\b/ },
        { lang: "go", regex: /\bpackage main|fmt\.Println|func\b/ },
        { lang: "rust", regex: /\bfn main|let mut|println!|cargo\b/ }
    ];

    let coincidencias = patrones.filter(p => p.regex.test(codigo));

    if (coincidencias.length === 1) {
        return coincidencias[0].lang;
    }

    if (coincidencias.length > 1) {
        return "ambiguo";
    }

    return null; // no detectado
}



// RESPUESTAS NORMALES DEL BOT
function getBotResponse(text) {
    const t = (text || "").toLowerCase();

    if (t.includes("hola") || t.includes("buenas")) {
        return "¡Hola! Soy SaferTech. Puedo analizar, comparar o traducir código.";
    }
    if (t.includes("anali") || t.includes("error") || t.includes("bug")) {
        return "Puedo analizar tu código. Envíamelo.";
    }
    if (t.includes("compara") || t.includes("diferencia")) {
        return "Envíame ambos códigos y los comparo.";
    }
    if (t.includes("tradu") || t.includes("convert")) {
        return "¿De qué lenguaje a cuál deseas traducir?";
    }

    return "Interesante. ¿Quieres analizarlo, compararlo o traducirlo?";
}

// COMANDOS RÁPIDOS
function accionRapida(tipo) {
    if (!currentChatId) createNewChat();
    const chat = chats.find(c => c.id === currentChatId);

    const map = {
        analizar: "Quiero analizar código",
        comparar: "Quiero comparar código",
        traducir: "Quiero traducir código"
    };

    chat.messages.push({ who: "user", text: map[tipo], ts: Date.now(), rating: 0});
    saveAll();
    renderCurrentChat();
    hideWelcome();

    setTimeout(() => {
        if (tipo === "analizar") chat.messages.push({ who: "bot", text: "Perfecto, envía el código.", ts: Date.now(),rating: 0 });
        if (tipo === "comparar") chat.messages.push({ who: "bot", text: "Envíame ambos códigos.", ts: Date.now(),rating: 0 });
        if (tipo === "traducir") chat.messages.push({ who: "bot", text: "¿De qué lenguaje a cuál?", ts: Date.now(),rating: 0 });

        saveAll();
        renderCurrentChat();
    }, 350);
}

// PANEL DE CHATS
function openListPanel(type) {
    listPanel.innerHTML = "";
    listPanel.style.display = "block";
    listPanel.setAttribute("aria-hidden", "false");

    const items = type === "fav" ? chats.filter(c => c.fav) : chats;

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "list-item";
        empty.innerHTML = `<div class="list-item-title">No hay elementos.</div>`;
        listPanel.appendChild(empty);
        return;
    }

    items.forEach(c => {
        const it = document.createElement("div");
        it.className = "list-item";

        it.innerHTML = `
            <div style="flex:1; overflow:hidden;">
                <div class="list-item-title">${escapeHtml(c.title)}</div>
                <div class="meta">${new Date(c.created).toLocaleString()}</div>
            </div>
            <button class="open-btn" data-id="${c.id}">Abrir</button>
        `;

        it.querySelector(".open-btn").addEventListener("click", (ev) => {
            ev.stopPropagation();
            openChatById(c.id);
            closeListPanel();
        });

        it.addEventListener("click", () => {
            openChatById(c.id);
            closeListPanel();
        });

        listPanel.appendChild(it);
    });
}

function closeListPanel() {
    listPanel.style.display = "none";
    listPanel.setAttribute("aria-hidden", "true");
}

function openChatById(id) {
    const c = chats.find(x => x.id === id);
    if (!c) return;

    chats = chats.filter(x => x.id !== id);
    chats.unshift(c);

    currentChatId = id;
    saveAll();
    renderCurrentChat();

    sidebar.classList.remove("open");
}

// FAVORITOS Y BORRAR
function toggleFavoriteCurrent() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    chat.fav = !chat.fav;
    saveAll();
    renderCurrentChat();
}

function deleteCurrent() {
    if (!currentChatId) return;
    const idx = chats.findIndex(c => c.id === currentChatId);
    if (idx === -1) return;

    if (!confirm("¿Eliminar este chat?")) return;

    chats.splice(idx, 1);

    currentChatId = chats.length ? chats[0].id : null;

    saveAll();
    renderCurrentChat();
}

function goAjustes() {
    window.location.href = "ajustes.html";
}

// EVENTOS
document.getElementById("btnNuevo").addEventListener("click", () => {
    createNewChat();
    hideWelcome();
    renderCurrentChat();
    closeListPanel();
});

document.getElementById("btnFavoritos").addEventListener("click", () => openListPanel("fav"));
document.getElementById("btnHistorial").addEventListener("click", () => openListPanel("hist"));
document.getElementById("btnAjustes").addEventListener("click", goAjustes);

sendBtn.addEventListener("click", enviarMensaje);
mensajeInput.addEventListener("keydown", e => { if (e.key === "Enter") enviarMensaje(); });

document.querySelectorAll(".pill").forEach(b => {
    b.addEventListener("click", ev => {
        const action = ev.target.dataset.action;
        accionRapida(action);
        hideWelcome();
    });
});

starBtn.addEventListener("click", toggleFavoriteCurrent);
deleteBtn.addEventListener("click", deleteCurrent);

hamburger.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

document.addEventListener("click", e => {

    if (!e.target.closest(".sidebar") &&
        !e.target.closest("#btnFavoritos") &&
        !e.target.closest("#btnHistorial")) {
        closeListPanel();
    }

    if (!e.target.closest("#userBox") && !e.target.closest("#userMenu")) {
        if (userMenu) {
            userMenu.style.display = "none";
            userMenu.setAttribute("aria-hidden", "true");
        }
    }
});

userBox.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!userMenu) return;
    const shown = userMenu.getAttribute("aria-hidden") === "false";
    if (shown) {
        userMenu.style.display = "none";
        userMenu.setAttribute("aria-hidden", "true");
    } else {
        userMenu.style.display = "block";
        userMenu.setAttribute("aria-hidden", "false");
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        window.location.href = "login.html";
    });
}

loadAll();

if (!chats.length) {
    createNewChat();
} else {
    if (!currentChatId) currentChatId = chats[0].id;
    renderCurrentChat();
}

sidebarUser.textContent = "admin1";
if (userMenu) userMenu.setAttribute("aria-hidden", "true");
closeListPanel();

// VOZ ───────────────────────────────────────────

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = false;

    recognition.onresult = (event) => {
        const texto = event.results[0][0].transcript;
        console.log("Usuario dijo:", texto);

        mensajeInput.value = texto;
        enviarMensaje();
    };

    recognition.onerror = (e) => {
        console.warn("Error de reconocimiento de voz:", e);
    };
}

document.getElementById("voiceBtn")?.addEventListener("click", () => {
    if (!recognition) return alert("Tu navegador no soporta reconocimiento de voz.");
    recognition.start();
});

function procesarComandoDeVoz(texto) {
    const t = texto.toLowerCase();

    // ───────────────────────────────
    // ✔ COMANDO: INFO DE USUARIO
    // ───────────────────────────────
    if (t.includes("quiero saber mi informacion") || 
        t.includes("quiero saber mi información")) {

        const infoUsuario = `
        📄 Información de usuario
        • Nombre: admin1
        • Correo: admin1@safertech.com
        • Rol: Estudiante
        • Estado: Activo
        `.trim();

        enviarRespuestaBot(infoUsuario);
        return true;
    }

    // ───────────────────────────────
    // ✔ COMANDO: CAMBIAR LENGUAJE
    // ───────────────────────────────
    const lenguajes = ["python", "javascript", "java", "c++", "php", "c#", "go", "rust"];

    const activarCambio =
        t.includes("cambiar lenguaje") ||
        t.includes("cambiar el lenguaje") ||
        t.includes("lenguaje predeterminado") ||
        t.includes("establecer lenguaje") ||
        t.includes("setear lenguaje");

    if (activarCambio) {

        const lenguajeEncontrado = lenguajes.find(lang =>
            t.includes(lang.toLowerCase())
        );

        if (!lenguajeEncontrado) {
            enviarRespuestaBot("No reconocí el lenguaje. Lenguajes válidos: Python, JavaScript, Java, C++, PHP, C#, Go, Rust.");
            return true;
        }

        localStorage.setItem("lenguaje_predeterminado", lenguajeEncontrado);
        enviarRespuestaBot(`El lenguaje predeterminado ha sido cambiado a **${lenguajeEncontrado}**.`);
        return true;
    }

    // ───────────────────────────────
    // ✔ CAMBIAR A TEMA OSCURO (VOZ)
    // ───────────────────────────────
    if (
        t.includes("modo oscuro") ||
        t.includes("tema oscuro") ||
        t.includes("cambiar a modo oscuro")
    ) {
        localStorage.setItem("modo", "oscuro");   // ← IMPORTANTE: usa la clave correcta
        aplicarModo("oscuro");                    // ← usa tu función real del preload

        enviarRespuestaBot("El tema ha sido cambiado a modo oscuro.");
        return true;
    }

    // ───────────────────────────────
    // ✔ CAMBIAR A TEMA CLARO (VOZ)
    // ───────────────────────────────
    if (
        t.includes("modo claro") ||
        t.includes("tema claro") ||
        t.includes("cambiar a modo claro")
    ) {
        localStorage.setItem("modo", "claro");
        aplicarModo("claro");

        enviarRespuestaBot("El tema ha sido cambiado a modo claro.");
        return true;
    }

    return false;
}

const searchInput = document.getElementById("searchChatInput");
const searchBtn = document.getElementById("searchChatBtn");

searchBtn.addEventListener("click", () => {
    buscarEnChat(searchInput.value.trim());
});

searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        buscarEnChat(searchInput.value.trim());
    }
});
