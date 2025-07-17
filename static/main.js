const textInput = document.getElementById("textInput");
const cloud = document.getElementById("cloud");
const buttons = document.querySelectorAll("#filters button");

let currentFilter = "All";
let socket;
let lastMessages = [];
const renderedMessages = new Set();
const renderedRects = [];

function randomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}


function resizeCloud() {
    cloud.style.minHeight = `${window.innerHeight * 0.75}px`;
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
        document.getElementById("userCount").textContent = text;
    } catch {
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
        div.style.setProperty('--rotation', `${(Math.random() - 0.5) * 20}deg`);
        div.style.opacity = 0;

        cloud.appendChild(div);

        const padding = 10;
        const maxAttempts = 30;
        let placed = false;

        for (let i = 0; i < maxAttempts; i++) {
            const msgRect = div.getBoundingClientRect();

            const maxX = cloud.clientWidth - msgRect.width - padding;
            const maxY = cloud.clientHeight - msgRect.height - padding;

            const x = Math.random() * maxX + padding;
            const y = Math.random() * maxY + padding;

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

            const idx = renderedRects.findIndex(
                r => r.left === div.offsetLeft && r.top === div.offsetTop
            );
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
    // Just render all messages, no filtering by sentiment
    messages.forEach(renderMessage);
}

function getColorPair() {
    const colors = [
        "#ff595e", // Coral Red
        "#ffca3a", // Saffron Yellow
        "#8ac926", // Lime Green
        "#1982c4", // Vivid Blue
        "#6a4c93", // Deep Purple
        "#ff7f51", // Soft Orange
        "#3a86ff", // Electric Blue
        "#8338ec", // Vivid Violet
        "#fb5607", // Bright Orange
        "#ff006e", // Hot Pink
        "#00b4d8", // Aqua Blue
        "#ffd60a", // Bright Yellow
        "#06d6a0", // Mint Green
        "#ef476f", // Pink Red
        "#118ab2", // Sky Blue
        "#073b4c"  // Slate Navy
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
    const urlParams = new URLSearchParams(window.location.search);
    const channel = urlParams.get("channel") || "public";
    socket = new WebSocket(`wss://${location.host}/stream/${channel}`);


    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (Array.isArray(data.messages)) {
            lastMessages = data.messages;
            renderCloud(lastMessages);
        }
        const count = data.users;
        const text = count === 1 ? "1 person online" : `${count} people online`;
        document.getElementById("userCount").textContent = text;
    };

    socket.onclose = () => {
        setTimeout(startWebSocket, 1000);
    };
}

async function fetchInitialMessages() {
    try {
        const res = await fetch("/messages");
        const messages = await res.json();
        lastMessages = messages;
        renderCloud(messages);
    } catch (err) {
        console.error("Failed to fetch initial messages:", err);
    }
}

const fabBtn = document.getElementById("fabBtn");
const fabOptions = document.getElementById("fabOptions");
fabBtn.onclick = () => fabOptions.classList.toggle("hidden");

document.getElementById("createChannel").onclick = () => {
    const code = randomCode();
    const url = `${location.origin}?channel=${code}`;
    navigator.clipboard.writeText(url);
    alert(`Channel Created! Code: ${code}\nURL copied to clipboard.`);
    location.href = `?channel=${code}`;
};

document.getElementById("joinChannel").onclick = () => {
    const code = prompt("Enter channel code:").trim().toUpperCase();
    if (code) location.href = `?channel=${code}`;
};


fetchInitialMessages();
startWebSocket();
