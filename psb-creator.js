// final-simple-creator.js

const canvas = document.getElementById('signature-canvas');
const generateBtn = document.getElementById('generate-button');
const downloadBtn = document.getElementById('download-button');
const outputArea = document.getElementById('output-svg');
const SVG_NS = "http://www.w3.org/2000/svg";

const SEGMENT_COUNT = 100;

let isDrawing = false;
let allPoints = [];
let currentPathElement = null;
let isNewSignature = true;

// --- Corrected Drawing Logic for Real-Time User Feedback ---
canvas.addEventListener('pointerdown', (e) => {
    if (isNewSignature) {
        canvas.innerHTML = '';
        allPoints = [];
        outputArea.value = '';
        downloadBtn.disabled = true;
        isNewSignature = false;
    }
    isDrawing = true;
    const point = getPoint(e);
    allPoints.push(point);
    currentPathElement = document.createElementNS(SVG_NS, 'path');
    currentPathElement.setAttribute('d', `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
    currentPathElement.setAttribute('stroke', '#333');
    currentPathElement.setAttribute('stroke-width', '2');
    currentPathElement.setAttribute('fill', 'none');
    canvas.appendChild(currentPathElement);
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    const point = getPoint(e);
    allPoints.push(point);
    const currentD = currentPathElement.getAttribute('d');
    currentPathElement.setAttribute('d', `${currentD} L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
});

canvas.addEventListener('pointerup', () => {
    isDrawing = false;
    currentPathElement = null;
    if (allPoints.length > 0 && allPoints[allPoints.length - 1] !== null) {
        allPoints.push(null);
    }
});

function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        time: performance.now()
    };
}

generateBtn.addEventListener('click', generateSVG);
downloadBtn.addEventListener('click', downloadSVG);

// --- MODIFIED generateSVG FUNCTION ---
function generateSVG() {
    if (allPoints.filter(p => p !== null).length < 2) {
        alert("Please draw something first.");
        return;
    }
    isNewSignature = true;

    const startTime = allPoints.find(p => p !== null).time;
    const lastPoint = allPoints.slice().reverse().find(p => p !== null);
    const endTime = lastPoint.time;
    const totalDuration = (endTime - startTime) / 1000;

    // 1. Create a STANDARD, SIMPLE root SVG element
    const svgRoot = document.createElementNS(SVG_NS, 'svg');
    svgRoot.setAttribute('width', '600');
    svgRoot.setAttribute('height', '300');
    svgRoot.setAttribute('xmlns', SVG_NS);
    
    // 2. Create the main group for the animation
    const performanceGroup = document.createElementNS(SVG_NS, 'g');
    performanceGroup.setAttribute('stroke', 'blue');
    performanceGroup.setAttribute('stroke-width', '1.5');
    performanceGroup.setAttribute('fill', 'none');

    // 3. The segment and animation logic remains identical
    const validPoints = allPoints.filter(p => p !== null);
    const totalPoints = validPoints.length;
    let pointIndex = 0;

    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const startIdx = Math.floor(i * totalPoints / SEGMENT_COUNT);
        const endIdx = Math.floor((i + 1) * totalPoints / SEGMENT_COUNT);
        if(startIdx >= endIdx) continue;

        const segmentPoints = validPoints.slice(startIdx, endIdx + 1);
        if (segmentPoints.length < 2) continue;

        let pathD = `M ${segmentPoints[0].x.toFixed(2)} ${segmentPoints[0].y.toFixed(2)}`;
        for(let j=1; j<segmentPoints.length; j++) {
            pathD += ` L ${segmentPoints[j].x.toFixed(2)} ${segmentPoints[j].y.toFixed(2)}`;
        }

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('visibility', 'hidden');

        const anim = document.createElementNS(SVG_NS, 'animate');
        anim.setAttribute('attributeName', 'visibility');
        
        const segmentStartTime = segmentPoints[0].time;
        const segmentEndTime = segmentPoints[segmentPoints.length - 1].time;
        const t1 = (segmentStartTime - startTime) / 1000 / totalDuration;
        const t2 = (segmentEndTime - startTime) / 1000 / totalDuration;

        anim.setAttribute('values', 'hidden;visible;visible;visible');
        anim.setAttribute('keyTimes', `0;${t1.toFixed(4)};${t2.toFixed(4)};1`);
        anim.setAttribute('dur', `${totalDuration.toFixed(2)}s`);
        anim.setAttribute('fill', 'freeze');
        
        path.appendChild(anim);
        performanceGroup.appendChild(path);
    }
    
    svgRoot.appendChild(performanceGroup);

    // 4. Serialize the final SVG string (NO placeholder)
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRoot);

    outputArea.value = beautifyXML(svgString);
    downloadBtn.disabled = false;
}

function downloadSVG() {
    const svgData = outputArea.value;
    if (!svgData) return;
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'signature.svg'; 
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
}

function beautifyXML(xmlString) {
    let formatted = '', indent= '';
    const tab = '  ';
    xmlString.split(/>\s*</).forEach(node => {
        if (node.match( /^\/\w/ )) indent = indent.substring(tab.length);
        formatted += indent + '<' + node + '>\r\n';
        if (node.match( /^<?\w[^>]*[^\/]$/ )) indent += tab;
    });
    return formatted.substring(1, formatted.length-3);
}