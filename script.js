/**
 * Premium Image Viewer JS
 * Logic for Gallery, Viewer, Drawing and Onion Skin
 */

const state = {
    allFiles: [],
    currentIndex: -1,
    scale: 1,
    posX: 0,
    posY: 0,
    rotation: 0,
    activeTool: 'pen',
    isDrawing: false,
    onionSkinEnabled: false,
    isEdited: false,
    lastX: 0,
    lastY: 0
};

const elements = {};
const cache = new Map(); // Store Blobs if needed

function init() {
    // UI Elements
    elements.landing = document.getElementById('landing-screen');
    elements.app = document.getElementById('app-shell');
    elements.viewer = document.getElementById('viewer-overlay');
    elements.grid = document.getElementById('gallery-grid');
    elements.folderInput = document.getElementById('folder-input');
    elements.selectBtn = document.getElementById('select-folder-btn');
    elements.folderTitle = document.getElementById('current-folder-name');
    elements.fileCounter = document.getElementById('file-counter');

    // Viewer Elements
    elements.img = document.getElementById('view-image');
    elements.video = document.getElementById('view-video');
    elements.pdf = document.getElementById('view-pdf');
    elements.canvas = document.getElementById('drawing-canvas');
    elements.ctx = elements.canvas.getContext('2d');
    elements.wrapper = document.getElementById('transform-wrapper');
    elements.onionPrev = document.getElementById('onion-prev-layer');
    elements.onionNext = document.getElementById('onion-next-layer');
    elements.fileInfo = document.getElementById('file-info-text');

    // Setup Listeners
    elements.selectBtn.onclick = () => elements.folderInput.click();
    elements.folderInput.onchange = handleFolderSelection;

    setupViewerGestures();
}

/** フォルダ選択処理 */
function handleFolderSelection(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    state.allFiles = files.filter(f => {
        const ext = f.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'pdf'].includes(ext);
    }).map(f => ({
        file: f,
        name: f.name,
        path: f.webkitRelativePath,
        type: f.name.toLowerCase().split('.').pop()
    }));

    if (state.allFiles.length === 0) {
        alert("有効な画像・動画・PDFが見つかりませんでした。");
        return;
    }

    const firstPath = state.allFiles[0].path;
    elements.folderTitle.textContent = firstPath.split('/')[0] || 'Gallery';
    elements.fileCounter.textContent = `${state.allFiles.length} Files`;

    elements.landing.style.display = 'none';
    elements.app.style.display = 'flex';

    renderGallery();
}

/** ギャラリー一覧の描画 */
function renderGallery() {
    elements.grid.innerHTML = '';
    state.allFiles.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'card fade-in';
        card.style.animationDelay = `${idx * 0.02}s`;

        const url = URL.createObjectURL(item.file);
        const isVideo = ['mp4', 'mov'].includes(item.type);
        const isPdf = item.type === 'pdf';

        let innerHTML = `
            <div class="card-preview">
                ${isVideo ? '<span class="icon" style="font-size:2rem">▶</span>' :
                isPdf ? '<span class="icon" style="font-size:2.5rem">📄</span>' :
                    `<img src="${url}" loading="lazy">`}
                <span class="type-indicator">${item.type.toUpperCase()}</span>
            </div>
            <div class="card-info">
                <span class="card-title">${item.name}</span>
            </div>
        `;
        card.innerHTML = innerHTML;
        card.onclick = () => openViewer(idx);
        elements.grid.appendChild(card);
    });
}

/** ビューアーを開く */
function openViewer(idx) {
    state.currentIndex = idx;
    elements.viewer.classList.add('active');
    resetTransform();
    updateViewerContent();
}

/** ビューアーの内容を更新 */
function updateViewerContent() {
    const item = state.allFiles[state.currentIndex];
    const url = URL.createObjectURL(item.file);
    state.isEdited = false;

    // Reset visibility
    elements.img.style.display = 'none';
    elements.video.style.display = 'none';
    elements.pdf.style.display = 'none';
    elements.canvas.style.display = 'none';
    elements.fileInfo.textContent = `${item.name} (${state.currentIndex + 1} / ${state.allFiles.length})`;

    if (['mp4', 'mov'].includes(item.type)) {
        elements.video.src = url;
        elements.video.style.display = 'block';
        elements.video.play();
    } else if (item.type === 'pdf') {
        elements.pdf.src = url;
        elements.pdf.style.display = 'block';
    } else {
        elements.img.src = url;
        elements.img.style.display = 'block';
        elements.img.onload = () => {
            elements.canvas.width = elements.img.clientWidth;
            elements.canvas.height = elements.img.clientHeight;
            elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
            elements.canvas.style.display = 'block';
            if (state.onionSkinEnabled) renderOnionSkins();
        };
    }
}

function closeViewer() {
    elements.viewer.classList.remove('active');
    elements.video.pause();
    elements.video.src = "";
    elements.onionPrev.innerHTML = '';
    elements.onionNext.innerHTML = '';
}

/** ツール切り替え */
function setTool(tool) {
    state.activeTool = tool;
    document.getElementById('tool-pen').classList.toggle('active', tool === 'pen');
    document.getElementById('tool-eraser').classList.toggle('active', tool === 'eraser');
}

/** オニオンスキンの切り替え */
function toggleOnionSkin() {
    state.onionSkinEnabled = !state.onionSkinEnabled;
    document.getElementById('btn-onion').classList.toggle('active', state.onionSkinEnabled);
    if (state.onionSkinEnabled) renderOnionSkins();
    else {
        elements.onionPrev.innerHTML = '';
        elements.onionNext.innerHTML = '';
    }
}

function renderOnionSkins() {
    elements.onionPrev.innerHTML = '';
    elements.onionNext.innerHTML = '';

    const prevIdx = (state.currentIndex - 1 + state.allFiles.length) % state.allFiles.length;
    const nextIdx = (state.currentIndex + 1) % state.allFiles.length;

    [prevIdx, nextIdx].forEach((idx, i) => {
        const item = state.allFiles[idx];
        if (['jpg', 'jpeg', 'png', 'webp'].includes(item.type)) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(item.file);
            img.style.maxWidth = '100vw';
            img.style.maxHeight = '100vh';
            if (i === 0) elements.onionPrev.appendChild(img);
            else elements.onionNext.appendChild(img);
            setTimeout(() => { if (img.parentElement) img.parentElement.style.opacity = 1; }, 50);
        }
    });
}

/** 回転 */
function rotateImage() {
    state.rotation = (state.rotation + 90) % 360;
    applyTransform();
}

/** 保存 (マージしてダウンロード) */
async function saveImage() {
    if (!state.isEdited) return alert("変更がありません。");

    const saveCanvas = document.createElement('canvas');
    saveCanvas.width = elements.img.naturalWidth;
    saveCanvas.height = elements.img.naturalHeight;
    const sctx = saveCanvas.getContext('2d');

    // 元画像
    sctx.save();
    // 回転対応が必要な場合はここでsctx.rotate
    sctx.drawImage(elements.img, 0, 0);
    sctx.restore();

    // 描画レイヤー (リサイズして描画)
    sctx.drawImage(elements.canvas, 0, 0, saveCanvas.width, saveCanvas.height);

    const link = document.createElement('a');
    link.download = `edited_${state.allFiles[state.currentIndex].name}`;
    link.href = saveCanvas.toDataURL('image/png');
    link.click();
}

/** ジェスチャーと描画の制御 */
function setupViewerGestures() {
    const container = document.getElementById('viewer-viewport');
    let initialDist = 0;
    let startScale = 1;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            // Drawing or Panning? 
            // If scale > 1, single touch might be panning? 
            // In this version, single touch = drawing if image is active.
            if (state.allFiles[state.currentIndex]?.type === 'pdf') return;

            state.isDrawing = true;
            const rect = elements.canvas.getBoundingClientRect();
            state.lastX = (e.touches[0].clientX - rect.left) * (elements.canvas.width / rect.width);
            state.lastY = (e.touches[0].clientY - rect.top) * (elements.canvas.height / rect.height);
        } else if (e.touches.length === 2) {
            state.isDrawing = false;
            initialDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            startScale = state.scale;
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (state.isDrawing && e.touches.length === 1) {
            if (state.scale > 1.1) {
                // Pan instead of draw if zoomed?
                // Let's keep it simple: Single touch DRAWING.
            }
            e.preventDefault();
            const rect = elements.canvas.getBoundingClientRect();
            const currX = (e.touches[0].clientX - rect.left) * (elements.canvas.width / rect.width);
            const currY = (e.touches[0].clientY - rect.top) * (elements.canvas.height / rect.height);

            const ctx = elements.ctx;
            ctx.beginPath();
            if (state.activeTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = 30;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = document.getElementById('color-picker').value;
                ctx.lineWidth = 4;
            }
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.moveTo(state.lastX, state.lastY);
            ctx.lineTo(currX, currY);
            ctx.stroke();

            state.lastX = currX;
            state.lastY = currY;
            state.isEdited = true;
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            state.scale = startScale * (dist / initialDist);
            if (state.scale < 0.5) state.scale = 0.5;
            if (state.scale > 5) state.scale = 5;
            applyTransform();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        state.isDrawing = false;
    });

    // Sidebar swipe (Optional)
}

function applyTransform() {
    elements.wrapper.style.transform = `scale(${state.scale}) rotate(${state.rotation}deg)`;
}

function resetTransform() {
    state.scale = 1;
    state.rotation = 0;
    state.posX = 0;
    state.posY = 0;
    applyTransform();
}

function goNext() {
    if (state.allFiles.length === 0) return;
    state.currentIndex = (state.currentIndex + 1) % state.allFiles.length;
    updateViewerContent();
}

function goPrev() {
    if (state.allFiles.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.allFiles.length) % state.allFiles.length;
    updateViewerContent();
}

// Start
init();
