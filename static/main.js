const textInput = document.getElementById("textInput");
const cloud = document.getElementById("cloud");
const buttons = document.querySelectorAll("#filters button");

let currentFilter = "All";
let socket;
let lastMessages = [];
const renderedMessages = new Set();

const slotGrid = new Set();
const GRID_ROWS = 6;
const GRID_COLS = 4;
const GRID_LIFETIME = 20000;

function resizeCloud() {
    cloud.style.minHeight = `${window.innerHeight * 0.75}px`; // Force cloud to be visible on mobile
}
window.addEventListener("resize", resizeCloud);
resizeCloud();

buttons.forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        buttons.forEach(b => {
            b.classList.remove("selected");
            b.style.background = "#222";
        });
        btn.classList.add("selected");
        btn.style.background = getColor(currentFilter);
        renderCloud(lastMessages);
    };
});

const HOT_WORDS = [
    'love', 'hate', 'cry', 'help', 'fuck', 'wow', 'please', 'lost', 'alone',
    'sad', 'happy', 'angry', 'anxious', 'depressed', 'grateful', 'sorry',
    'scared', 'hope', 'joy', 'pain', 'mad', 'tired', 'blessed', 'broken',
    'healing', 'peace', 'truth', 'liar', 'trust', 'hurt', 'need', 'want',
    'dream', 'shame', 'fear', 'excited', 'rage', 'pissed', 'ugh', 'god',
    'damn', 'freak', 'scream', 'breathe', 'die', 'alive', 'fight', 'justice',
    'skibidi', 'diddy'
];

function highlightHotWords(text) {
    const re = new RegExp(`\\b(${HOT_WORDS.join('|')})\\b`, 'gi');
    return text.replace(re, '<span class="hot-word">$1</span>');
}

async function updateUserCount() {
    try {
        const res = await fetch("/users");
        const data = await res.json();
        const count = data.count;
        const text = count === 1 ? "1 person online" : `${count} people online`;
        document.getElementById("userCount").textContent = `${text}`;
    } catch (e) {
        document.getElementById("userCount").textContent = "Offline";
    }
}

setInterval(updateUserCount, 5000);
updateUserCount();

textInput.addEventListener("keypress", async e => {
    if (e.key === "Enter" && textInput.value.trim() !== "") {
        const res = await fetch("/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: textInput.value })
        });
        const newMessage = await res.json();
        lastMessages.push(newMessage);
        renderCloud(lastMessages);
        textInput.value = "";
    }
});

const renderedRects = [];

function renderMessage(msg) {
    if (renderedMessages.has(msg.id)) return;

    requestAnimationFrame(() => {
        const div = document.createElement("div");
        div.className = "message";
        div.innerHTML = highlightHotWords(msg.text);

        const { bg, text } = getColorPair();
        div.style.background = bg;
        div.style.color = text;
        div.style.fontSize = `${Math.random() * 1 + 1}em`;
        div.style.transform = `rotate(${(Math.random() - 0.5) * 20}deg)`;
        div.style.opacity = 0; // Hide during measurement

        cloud.appendChild(div);

        const padding = 10;
        const maxAttempts = 30;
        let placed = false;

        for (let i = 0; i < maxAttempts; i++) {
            const msgRect = div.getBoundingClientRect();
            const cloudRect = cloud.getBoundingClientRect();

            const maxX = cloud.clientWidth - msgRect.width - padding;
            const maxY = cloud.clientHeight - msgRect.height - padding;

            const x = Math.random() * maxX + padding;
            const y = Math.random() * maxY + padding;

            // Apply trial position
            div.style.left = `${x}px`;
            div.style.top = `${y}px`;

            const trialRect = div.getBoundingClientRect();

            const overlaps = renderedRects.some(r => isOverlapping(r, trialRect));

            if (!overlaps) {
                renderedRects.push(trialRect);
                placed = true;
                break;
            }
        }

        if (!placed) {
            // Couldn’t find a free space, so remove or show anyway
            console.warn("Couldn't place message without overlap");
            div.remove();
            return;
        }

        div.style.opacity = 1;
        div.dataset.id = msg.id;
        renderedMessages.add(msg.id);

        setTimeout(() => {
            div.remove();
            renderedMessages.delete(msg.id);

            // Clean up old rect
            const idx = renderedRects.findIndex(r => r.left === div.offsetLeft && r.top === div.offsetTop);
            if (idx !== -1) renderedRects.splice(idx, 1);
        }, 20000);
    });
}

function isOverlapping(rect1, rect2) {
    return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
    );
}


function renderCloud(messages) {
    const filtered = messages.filter(
        msg => currentFilter === "All" || msg.sentiment === currentFilter
    );
    filtered.forEach(renderMessage);
}

function getColorPair() {
    const colors = [
        "#f94144", "#f3722c", "#f8961e", "#f9844a",
        "#90be6d", "#43aa8b", "#577590", "#277da1",
        "#9b5de5", "#f15bb5", "#00bbf9", "#00f5d4"
    ];
    const bg = colors[Math.floor(Math.random() * colors.length)];
    const text = getContrastColor(bg);
    return { bg, text };
}

function getContrastColor(hex) {
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#000000" : "#ffffff";
}

function startWebSocket() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${location.host}/stream`);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.messages && Array.isArray(data.messages)) {
            lastMessages = data.messages;
            renderCloud(lastMessages);
        }
        const count = data.users;
        const text = count === 1 ? "1 person online" : `${count} people online`;
        document.getElementById("userCount").textContent = `${text}`;
    };
    socket.onclose = () => {
        setTimeout(startWebSocket, 1000);
    };
}

async function fetchInitialMessages() {
    try {
        const res = await fetch("https://justsayit.wtf/messages");
        const messages = await res.json();
        lastMessages = messages;
        renderCloud(messages);
    } catch (err) {
        console.error("Failed to fetch initial messages:", err);
    }
}

fetchInitialMessages();
startWebSocket();
