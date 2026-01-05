
// State
let state = {
    allFilesMap: new Map(),
    files: [],
    currentIndex: -1,
    scale: 1,
    posX: 0,
    posY: 0,
    currentTool: 'pen',
    isEdited: false
};

const blobCache = new Map();
let canvas, ctx;

function init() {
    canvas = document.getElementById('drawing-canvas');
    ctx = canvas.getContext('2d');
    setupEventListeners();
    setupTouchGestures();
}

function setupEventListeners() {
    const folderInput = document.getElementById('folder-input');
    folderInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        state.files = [];
        state.allFilesMap.clear();
        files.forEach(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'pdf'];
            if (validExts.includes(ext)) {
                state.files.push(file.webkitRelativePath);
                state.allFilesMap.set(file.webkitRelativePath, file);
            }
        });
        document.getElementById('drop-zone-initial').style.display = 'none';
        renderGallery();
    });
}

function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';
    state.files.forEach((path, idx) => {
        const card = document.createElement('div');
        card.className = 'image-card';
        const url = getBlobUrl(path);
        const name = path.split('/').pop();
        const ext = name.toLowerCase().split('.').pop();

        const preview = document.createElement('div');
        preview.style.height = '150px'; preview.style.borderRadius = '12px';
        preview.style.overflow = 'hidden'; preview.style.background = '#222';
        preview.style.display = 'flex'; preview.style.alignItems = 'center'; preview.style.justifyContent = 'center';

        if (['mp4', 'mov'].includes(ext)) {
            preview.innerHTML = '▶ VIDEO';
        } else if (ext === 'pdf') {
            preview.innerHTML = '📄 PDF';
        } else {
            const img = document.createElement('img');
            img.src = url; img.loading = "lazy";
            img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover';
            preview.appendChild(img);
        }

        card.appendChild(preview);
        const caption = document.createElement('div');
        caption.className = 'caption';
        caption.textContent = name;
        caption.style.fontSize = '0.8rem'; caption.style.marginTop = '8px';
        card.appendChild(caption);
        card.onclick = () => openViewer(idx);
        grid.appendChild(card);
    });
}

function getBlobUrl(fullPath) {
    if (blobCache.has(fullPath)) return blobCache.get(fullPath);
    const file = state.allFilesMap.get(fullPath);
    if (!file) return "";
    const url = URL.createObjectURL(file);
    blobCache.set(fullPath, url);
    return url;
}

function openViewer(index) {
    state.currentIndex = index;
    document.getElementById('viewer-overlay').classList.add('active');
    resetTransform();
    updateViewerContent();
}

window.closeViewer = async function () {
    if (state.isEdited) {
        saveAsDownload();
    }
    document.getElementById('viewer-overlay').classList.remove('active');
    const video = document.getElementById('modal-video');
    video.pause(); video.src = "";
    state.isEdited = false;
};

function saveAsDownload() {
    const img = document.getElementById('modal-image');
    const saveCanvas = document.createElement('canvas');
    saveCanvas.width = img.naturalWidth;
    saveCanvas.height = img.naturalHeight;
    const saveCtx = saveCanvas.getContext('2d');

    saveCtx.drawImage(img, 0, 0);
    saveCtx.drawImage(canvas, 0, 0, saveCanvas.width, saveCanvas.height);

    const dataUrl = saveCanvas.toDataURL('image/jpeg', 0.9);
    const filename = state.files[state.currentIndex].split('/').pop();
    const nameParts = filename.split('.');
    const ext = nameParts.pop();

    const link = document.createElement('a');
    link.download = `${nameParts.join('.')}_edited.${ext}`;
    link.href = dataUrl;
    link.click();
}

window.setTool = function (tool) {
    state.currentTool = tool;
    document.getElementById('pen-toggle').classList.toggle('active', tool === 'pen');
    document.getElementById('eraser-toggle').classList.toggle('active', tool === 'eraser');
    canvas.style.pointerEvents = 'auto';
};

function updateViewerContent() {
    const path = state.files[state.currentIndex];
    const url = getBlobUrl(path);
    const ext = path.toLowerCase().split('.').pop();

    const img = document.getElementById('modal-image');
    const video = document.getElementById('modal-video');
    const pdf = document.getElementById('modal-pdf');
    const penTool = document.getElementById('pen-toggle');
    const eraserTool = document.getElementById('eraser-toggle');
    const colorTool = document.querySelector('.color-picker-container');

    img.style.display = 'none'; video.style.display = 'none'; pdf.style.display = 'none';
    canvas.style.display = 'none'; penTool.style.display = 'none'; eraserTool.style.display = 'none'; colorTool.style.display = 'none';

    if (ext === 'pdf') {
        pdf.src = url; pdf.style.display = 'block';
    } else if (['mp4', 'mov'].includes(ext)) {
        video.src = url; video.style.display = 'block'; video.play();
    } else {
        img.src = url;
        img.style.display = 'block';
        penTool.style.display = 'flex';
        eraserTool.style.display = 'flex';
        colorTool.style.display = 'block';
        img.onload = () => {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'block';
        };
    }
}

function setupTouchGestures() {
    const container = document.getElementById('gestures-container');
    let startTouchX = 0, initialDist = 0, startScale = 1;
    let lastX = 0, lastY = 0;
    let isDrawing = false;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            lastX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
            lastY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
            startTouchX = e.touches[0].clientX;
            return;
        }
        if (e.touches.length === 2) {
            isDrawing = false;
            initialDist = getDistance(e.touches);
            startScale = state.scale;
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (isDrawing && e.touches.length === 1) {
            const rect = canvas.getBoundingClientRect();
            const currX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
            const currY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);

            ctx.beginPath();
            if (state.currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = 20;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = document.getElementById('color-input').value;
                ctx.lineWidth = 3;
            }
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.moveTo(lastX, lastY); ctx.lineTo(currX, currY);
            ctx.stroke();

            lastX = currX; lastY = currY;
            state.isEdited = true;
            e.preventDefault();
        } else if (e.touches.length === 2) {
            e.preventDefault();
            state.scale = startScale * (getDistance(e.touches) / initialDist);
            applyTransform();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (isDrawing && e.touches.length === 0 && state.scale <= 1.1) {
            const diff = startTouchX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50 && !state.isEdited) {
                if (diff > 0) window.goNext();
                else window.goPrev();
            }
        }
        isDrawing = false;
    });
}

function getDistance(ts) {
    return Math.sqrt(Math.pow(ts[0].clientX - ts[1].clientX, 2) + Math.pow(ts[0].clientY - ts[1].clientY, 2));
}

function applyTransform() {
    document.getElementById('canvas-wrapper').style.transform = `translate(${state.posX}px, ${state.posY}px) scale(${state.scale})`;
}

function resetTransform() {
    state.scale = 1; state.posX = 0; state.posY = 0;
    applyTransform();
}

window.goNext = function () {
    if (state.files.length === 0) return;
    state.currentIndex = (state.currentIndex + 1) % state.files.length;
    resetTransform(); updateViewerContent();
};

window.goPrev = function () {
    if (state.files.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.files.length) % state.files.length;
    resetTransform(); updateViewerContent();
};

init();
