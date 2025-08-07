// psb-creator.js

// --- DOM ELEMENT REFERENCES ---
const canvas = document.getElementById('signature-canvas');
const previewPanel = document.getElementById('preview-panel');
const generateBtn = document.getElementById('generate-button');
const uploadBtn = document.getElementById('upload-button');
const downloadBtn = document.getElementById('download-button');
const outputArea = document.getElementById('output-svg');
const fileInput = document.getElementById('file-input');
const stChartSvg = d3.select("#st-chart");
const vtChartSvg = d3.select("#vt-chart");
const SVG_NS = "http://www.w3.org/2000/svg";

// --- Drawing Listeners (Remain Correct) ---
let isDrawing = false;
let allPoints = [];
let currentPathElement = null;
let isNewSignature = true;

canvas.addEventListener('pointerdown', (e) => {
    if (isNewSignature) {
        canvas.innerHTML = '';
        previewPanel.innerHTML = '';
        stChartSvg.selectAll("*").remove();
        vtChartSvg.selectAll("*").remove();
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
        time: event.timeStamp
    };
}

generateBtn.addEventListener('click', () => {
    if (allPoints.filter(p => p !== null).length < 2) {
        alert("Please draw something first.");
        return;
    }
    isNewSignature = true;
    const svgString = generateSVG();
    processAndVisualize(svgString);
});

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const svgContent = e.target.result;
        processAndVisualize(svgContent);
    };
    reader.readAsText(file);
    event.target.value = '';
});

downloadBtn.addEventListener('click', () => {
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
});

// -----------------------------------------------------------------------------
// SECTION 3: CORE LOGIC (PROCESS, ANALYZE, VISUALIZE)
// (The `processAndVisualize` function and below are now correct because `generateSVG` is fixed)
// -----------------------------------------------------------------------------
function processAndVisualize(svgString) {
    previewPanel.innerHTML = svgString;
    outputArea.value = svgString;
    downloadBtn.disabled = false;
    const analysis = analyzeSVGData(svgString);
    if (!analysis) return;
    drawCharts(analysis);
    setupInteractivity(analysis);
}

// =============================================================================
// === CORRECTED AND FINAL generateSVG FUNCTION ===
// =============================================================================
function generateSVG() {
    // --- Adaptive Segmentation Constraints ---
    const TARGET_SEGMENT_COUNT_PER_STROKE = 20; // Target segments per stroke
    const MIN_POINTS_PER_SEGMENT = 3;
    const MAX_POINTS_PER_SEGMENT = 10;

    const allValidPoints = allPoints.filter(p => p !== null);
    if (allValidPoints.length < MIN_POINTS_PER_SEGMENT) {
        alert(`Signature must have at least ${MIN_POINTS_PER_SEGMENT} points.`);
        return "";
    }

    const startTime = allValidPoints[0].time;
    const endTime = allValidPoints[allValidPoints.length - 1].time;
    const totalDuration = (endTime - startTime) / 1000;

    const svgRoot = document.createElementNS(SVG_NS, 'svg');
    svgRoot.setAttribute('width', '600');
    svgRoot.setAttribute('height', '300');
    svgRoot.setAttribute('viewBox', '0 0 600 300');
    svgRoot.setAttribute('xmlns', SVG_NS);
    
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = 'Composition Animation';
    svgRoot.appendChild(title);

    const performanceGroup = document.createElementNS(SVG_NS, 'g');
    performanceGroup.setAttribute('stroke', 'royalblue');
    performanceGroup.setAttribute('stroke-width', '2');
    performanceGroup.setAttribute('fill', 'none');

    // Step 1: Split allPoints into an array of strokes
    const strokes = [];
    let currentStroke = [];
    for (const point of allPoints) {
        if (point === null) {
            if (currentStroke.length > 0) {
                strokes.push(currentStroke);
                currentStroke = [];
            }
        } else {
            currentStroke.push(point);
        }
    }
    if (currentStroke.length > 0) strokes.push(currentStroke);

    // Step 2: Apply adaptive segmentation to each stroke
    strokes.forEach(strokePoints => {
        if (strokePoints.length < MIN_POINTS_PER_SEGMENT) return; // Skip tiny strokes

        let pointsPerSegment = Math.round(strokePoints.length / TARGET_SEGMENT_COUNT_PER_STROKE);
        if (pointsPerSegment < MIN_POINTS_PER_SEGMENT) pointsPerSegment = MIN_POINTS_PER_SEGMENT;
        if (pointsPerSegment > MAX_POINTS_PER_SEGMENT) pointsPerSegment = MAX_POINTS_PER_SEGMENT;

        for (let i = 0; i < strokePoints.length; i += pointsPerSegment) {
            const segmentPoints = strokePoints.slice(i, i + pointsPerSegment);
            if(i > 0) segmentPoints.unshift(strokePoints[i-1]); // Overlap for continuity

            if (segmentPoints.length < 2) continue;

            // The first point of the first segment of a stroke always uses 'M'
            let pathD = `M ${segmentPoints[0].x.toFixed(2)} ${segmentPoints[0].y.toFixed(2)}`;
            for (let j = 1; j < segmentPoints.length; j++) {
                pathD += ` L ${segmentPoints[j].x.toFixed(2)} ${segmentPoints[j].y.toFixed(2)}`;
            }

            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('visibility', 'hidden');

            const anim = document.createElementNS(SVG_NS, 'animate');
            anim.setAttribute('attributeName', 'visibility');
            
            const segmentStartTime = segmentPoints[0].time;
            const segmentEndTime = segmentPoints[segmentPoints.length - 1].time;
            const safeTotalDuration = totalDuration > 0 ? totalDuration : 1;
            const t1 = ((segmentStartTime - startTime) / 1000) / safeTotalDuration;
            const t2 = ((segmentEndTime - startTime) / 1000) / safeTotalDuration;

            anim.setAttribute('values', 'hidden;visible;visible;visible');
            anim.setAttribute('keyTimes', `0;${t1.toFixed(4)};${t2.toFixed(4)};1`);
            anim.setAttribute('dur', `${totalDuration.toFixed(2)}s`);
            anim.setAttribute('fill', 'freeze');
            
            path.appendChild(anim);
            performanceGroup.appendChild(path);
        }
    });
    
    svgRoot.appendChild(performanceGroup);
    return new XMLSerializer().serializeToString(svgRoot);
}

// -----------------------------------------------------------------------------
// SECTION 4 & 5 & 6: ANALYSIS AND VISUALIZATION (UNCHANGED)
// -----------------------------------------------------------------------------

function analyzeSVGData(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const paths = doc.querySelectorAll('g[stroke] path');
    if (paths.length === 0) return null;
    let totalDuration = 0;
    const animationData = Array.from(paths).map((path, index) => {
        const anim = path.querySelector('animate');
        if (!anim) return null;
        const durString = anim.getAttribute('dur');
        const duration = parseFloat(durString.replace('s', ''));
        if (duration > totalDuration) totalDuration = duration;
        const keyTimes = anim.getAttribute('keyTimes').split(';').map(parseFloat);
        const startTime = keyTimes[1] * duration;
        const endTime = keyTimes[2] * duration;
        const tempSvg = document.createElementNS(SVG_NS, 'svg');
        document.body.appendChild(tempSvg);
        const tempPath = path.cloneNode();
        tempSvg.appendChild(tempPath);
        const distance = tempPath.getTotalLength();
        document.body.removeChild(tempSvg);
        const timeDelta = endTime - startTime;
        const velocity = timeDelta > 0 ? distance / timeDelta : 0;
        return { index, startTime, endTime, distance, velocity };
    }).filter(d => d !== null);
    let cumulativeDistance = 0;
    animationData.forEach(d => {
        cumulativeDistance += d.distance;
        d.cumulativeDistance = cumulativeDistance;
    });
    return { data: animationData, totalDuration };
}

function drawCharts(analysis) {
    const { data, totalDuration } = analysis;
    if (data.length === 0) return;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    stChartSvg.selectAll("*").remove();
    const stG = stChartSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, totalDuration]).range([0, width]);
    const ySt = d3.scaleLinear().domain([0, d3.max(data, d => d.cumulativeDistance)]).range([height, 0]);
    stG.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    stG.append("g").call(d3.axisLeft(ySt));
    stG.append("text").attr("x", width/2).attr("y", -10).attr("class", "chart-title").text("Displacement (pixels)");
    const stLine = d3.line().x(d => x(d.endTime)).y(d => ySt(d.cumulativeDistance));
    stG.append("path").datum(data).attr("class", "chart-line").attr("d", stLine);
    vtChartSvg.selectAll("*").remove();
    const vtG = vtChartSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const yVt = d3.scaleLinear().domain([0, d3.max(data, d => d.velocity)]).range([height, 0]);
    vtG.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    vtG.append("g").call(d3.axisLeft(yVt));
    vtG.append("text").attr("x", width/2).attr("y", -10).attr("class", "chart-title").text("Velocity (pixels/sec)");
    const vtLine = d3.line().x(d => x(d.startTime)).y(d => yVt(d.velocity)).curve(d3.curveStepAfter);
    vtG.append("path").datum(data).attr("class", "chart-line").attr("d", vtLine);
}

function setupInteractivity(analysis) {
    const { totalDuration } = analysis;
    const previewSvgElement = previewPanel.querySelector('svg');
    if (!previewSvgElement) return;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    const x = d3.scaleLinear().domain([0, totalDuration]).range([0, width]);
    const allCharts = [stChartSvg, vtChartSvg];
    allCharts.forEach(chart => {
        const g = chart.select("g");
        if(g.empty()) return;
        const scrubber = g.append("line").attr("class", "scrubber-line").attr("y1", 0).attr("y2", height).style("opacity", 0);
        chart.append("rect").attr("width", width).attr("height", height).attr("transform", `translate(${margin.left},${margin.top})`).style("fill", "none").style("pointer-events", "all")
            .on("mouseover", () => scrubber.style("opacity", 1))
            .on("mouseout", () => scrubber.style("opacity", 0))
            .on("mousemove", (event) => {
                const mouseX = d3.pointer(event)[0];
                const time = x.invert(mouseX);
                allCharts.forEach(c => c.select(".scrubber-line").attr("x1", mouseX).attr("x2", mouseX));
                try {
                   previewSvgElement.setCurrentTime(time);
                } catch (e) {
                   // This can sometimes fail in certain browsers on complex SVGs, so we catch it.
                   console.error("Error setting current time on SVG:", e);
                }
            });
    });
}