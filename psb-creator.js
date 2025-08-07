// psb-creator.js

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

// --- Drawing Listeners (Remain Correct) ---
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

// --- generateSVG FUNCTION WITH THE BUG FIX ---
function generateSVG() {
    if (allPoints.filter(p => p !== null).length < 2) {
        alert("Please draw something first.");
        return;
    }
    isNewSignature = true;

    const firstPoint = allPoints.find(p => p !== null);
    const lastPoint = allPoints.slice().reverse().find(p => p !== null);
    if (!firstPoint || !lastPoint) return;

    const startTime = firstPoint.time;
    const endTime = lastPoint.time;
    const totalDuration = (endTime - startTime) / 1000;

    const svgRoot = document.createElementNS(SVG_NS, 'svg');
    svgRoot.setAttribute('width', '600');
    svgRoot.setAttribute('height', '300');
    svgRoot.setAttribute('xmlns', SVG_NS);
    
    const performanceGroup = document.createElementNS(SVG_NS, 'g');
    performanceGroup.setAttribute('stroke', 'blue');
    performanceGroup.setAttribute('stroke-width', '1.5');
    performanceGroup.setAttribute('fill', 'none');

    // --- BUG FIX LOGIC STARTS HERE ---
    const totalPointsInPerformance = allPoints.length;

    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const startIdx = Math.floor(i * totalPointsInPerformance / SEGMENT_COUNT);
        const endIdx = Math.floor((i + 1) * totalPointsInPerformance / SEGMENT_COUNT);
        
        const segmentPoints = allPoints.slice(startIdx, endIdx);
        
        // Find the first and last valid points to get accurate timing for the animation
        const firstValidPointInSegment = segmentPoints.find(p => p !== null);
        const lastValidPointInSegment = segmentPoints.slice().reverse().find(p => p !== null);

        if (!firstValidPointInSegment) continue;

        let pathD = '';
        
        // This loop now intelligently builds the `d` attribute for the path.
        segmentPoints.forEach((p, index) => {
            if (p === null) return;

            // Determine if we need to "Move" or "Line To".
            // We need a "Move" if it's the very first point of the segment, AND the point
            // just before this segment in the main array was a null or didn't exist.
            const previousPointInGlobalArray = (startIdx + index > 0) ? allPoints[startIdx + index - 1] : null;
            
            if (pathD === '' && (previousPointInGlobalArray === null || startIdx + index === 0)) {
                 pathD += `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
            } else if (pathD !== '') {
                 pathD += `L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
            } else {
                 // This handles the case where a segment starts mid-stroke. It needs to know where it
                 // came from to draw a connecting line.
                 const prevPoint = allPoints[startIdx - 1];
                 if (prevPoint) {
                    pathD += `M ${prevPoint.x.toFixed(2)} ${prevPoint.y.toFixed(2)} L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
                 }
            }
        });

        if (pathD.trim() === '') continue;

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', pathD.trim());
        path.setAttribute('visibility', 'hidden');

        const anim = document.createElementNS(SVG_NS, 'animate');
        anim.setAttribute('attributeName', 'visibility');
        
        const segmentStartTime = firstValidPointInSegment.time;
        const segmentEndTime = lastValidPointInSegment.time;
        const t1 = (segmentStartTime - startTime) / 1000 / totalDuration;
        const t2 = (segmentEndTime - startTime) / 1000 / totalDuration;

        anim.setAttribute('values', 'hidden;visible;visible;visible');
        anim.setAttribute('keyTimes', `0;${t1.toFixed(4)};${t2.toFixed(4)};1`);
        anim.setAttribute('dur', `${totalDuration.toFixed(2)}s`);
        anim.setAttribute('fill', 'freeze');
        
        path.appendChild(anim);
        performanceGroup.appendChild(path);
    }
    // --- BUG FIX LOGIC ENDS HERE ---
    
    svgRoot.appendChild(performanceGroup);

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
    anchor.download = 'animation.svg'; 
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
        if (node.match( /^<?w[^>]*[^\/]$/ )) indent += tab;
    });
    return formatted.substring(1, formatted.length-3);
}