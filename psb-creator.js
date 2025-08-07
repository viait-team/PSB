// psb-creator.js

// --- DOM ELEMENT REFERENCES ---
const canvas = document.getElementById('signature-canvas');
const previewPanel = document.getElementById('preview-panel');
const generateBtn = document.getElementById('generate-button');
const uploadBtn = document.getElementById('upload-button');
const downloadBtn = document.getElementById('download-button');
const resetBtn = document.getElementById('reset-button'); // ADDED
const outputArea = document.getElementById('output-svg');
const fileInput = document.getElementById('file-input');
const stChartSvg = d3.select("#st-chart");
const vsChartSvg = d3.select("#vs-chart");
const SVG_NS = "http://www.w3.org/2000/svg";

// --- State Variables ---
let isDrawing = false;
let allPoints = [];
let currentPathElement = null;
let isNewSignature = true;

// -----------------------------------------------------------------------------
// SECTION 1: DATA CAPTURE (USER DRAWING)
// -----------------------------------------------------------------------------

canvas.addEventListener('pointerdown', (e) => {
    if (isNewSignature) {
        resetApplication(); // Use the reset function to clear everything
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

// -----------------------------------------------------------------------------
// SECTION 2: EVENT HANDLERS (BUTTONS)
// -----------------------------------------------------------------------------

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
        // When uploading, we also want to clear any previous drawing state
        isNewSignature = true;
        resetApplication();
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

// ADDED Reset button handler
resetBtn.addEventListener('click', () => {
    isNewSignature = true;
    resetApplication();
});

// -----------------------------------------------------------------------------
// SECTION 3: CORE LOGIC
// -----------------------------------------------------------------------------

// ADDED Centralized Reset Function
function resetApplication() {
    canvas.innerHTML = '';
    previewPanel.innerHTML = '';
    stChartSvg.selectAll("*").remove();
    vsChartSvg.selectAll("*").remove();
    allPoints = [];
    outputArea.value = '';
    downloadBtn.disabled = true;
}

function processAndVisualize(svgString) {
    previewPanel.innerHTML = svgString;
    outputArea.value = svgString;
    downloadBtn.disabled = false;
    const analysis = analyzeSVGData(svgString);
    if (!analysis) return;
    drawCharts(analysis);
    setupInteractivity(analysis);
}

function generateSVG() {
    const TARGET_SEGMENT_COUNT_PER_STROKE = 20;
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
    strokes.forEach(strokePoints => {
        if (strokePoints.length < MIN_POINTS_PER_SEGMENT) return;
        let pointsPerSegment = Math.round(strokePoints.length / TARGET_SEGMENT_COUNT_PER_STROKE);
        if (pointsPerSegment < MIN_POINTS_PER_SEGMENT) pointsPerSegment = MIN_POINTS_PER_SEGMENT;
        if (pointsPerSegment > MAX_POINTS_PER_SEGMENT) pointsPerSegment = MAX_POINTS_PER_SEGMENT;
        for (let i = 0; i < strokePoints.length; i += pointsPerSegment) {
            const segmentPoints = strokePoints.slice(i, i + pointsPerSegment);
            if(i > 0) segmentPoints.unshift(strokePoints[i-1]);
            if (segmentPoints.length < 2) continue;
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
    const xTime = d3.scaleLinear().domain([0, totalDuration]).range([0, width]);
    const ySt = d3.scaleLinear().domain([0, d3.max(data, d => d.cumulativeDistance)]).range([height, 0]);
    stG.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xTime).tickFormat(d => `${d.toFixed(1)}s`));
    stG.append("g").call(d3.axisLeft(ySt));
    stG.append("text").attr("x", width/2).attr("y", -10).attr("class", "chart-title").text("Displacement s(t)");
    const stLine = d3.line().x(d => xTime(d.endTime)).y(d => ySt(d.cumulativeDistance));
    stG.append("path").datum(data).attr("class", "chart-line").attr("d", stLine);
    vsChartSvg.selectAll("*").remove();
    const vsG = vsChartSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const xDist = d3.scaleLinear().domain([0, d3.max(data, d => d.cumulativeDistance)]).range([0, width]);
    const yVs = d3.scaleLinear().domain([0, d3.max(data, d => d.velocity)]).range([height, 0]);
    vsG.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xDist).tickFormat(d => `${Math.round(d)}px`));
    vsG.append("g").call(d3.axisLeft(yVs));
    vsG.append("text").attr("x", width/2).attr("y", -10).attr("class", "chart-title").text("Velocity v(s)");
    const vsLine = d3.line().x(d => xDist(d.cumulativeDistance)).y(d => yVs(d.velocity));
    vsG.append("path").datum(data).attr("class", "chart-line").attr("d", vsLine);
}

function setupInteractivity(analysis) {
    const { data, totalDuration } = analysis;
    const previewSvgElement = previewPanel.querySelector('svg');
    if (!previewSvgElement || data.length === 0) return;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    const xTime = d3.scaleLinear().domain([0, totalDuration]).range([0, width]);
    const xDist = d3.scaleLinear().domain([0, data[data.length - 1].cumulativeDistance]).range([0, width]);
    const stG = stChartSvg.select("g");
    if(!stG.empty()){
        const stScrubber = stG.append("line").attr("class", "scrubber-line").attr("y1", 0).attr("y2", height).style("opacity", 0);
        stChartSvg.append("rect").attr("width", width).attr("height", height).attr("transform", `translate(${margin.left},${margin.top})`).style("fill", "none").style("pointer-events", "all")
            .on("mouseover", () => { stScrubber.style("opacity", 1); vsChartSvg.select(".scrubber-line").style("opacity", 1); })
            .on("mouseout", () => { stScrubber.style("opacity", 0); vsChartSvg.select(".scrubber-line").style("opacity", 0); })
            .on("mousemove", (event) => {
                const mouseX = d3.pointer(event)[0];
                const time = xTime.invert(mouseX);
                const bisector = d3.bisector(d => d.endTime).left;
                const i = bisector(data, time);
                const d = data[i];
                if (d) {
                    stScrubber.attr("x1", mouseX).attr("x2", mouseX);
                    vsChartSvg.select(".scrubber-line").attr("x1", xDist(d.cumulativeDistance)).attr("x2", xDist(d.cumulativeDistance));
                    previewSvgElement.setCurrentTime(time);
                }
            });
    }
    const vsG = vsChartSvg.select("g");
    if(!vsG.empty()){
        const vsScrubber = vsG.append("line").attr("class", "scrubber-line").attr("y1", 0).attr("y2", height).style("opacity", 0);
        vsChartSvg.append("rect").attr("width", width).attr("height", height).attr("transform", `translate(${margin.left},${margin.top})`).style("fill", "none").style("pointer-events", "all")
            .on("mouseover", () => { vsScrubber.style("opacity", 1); stChartSvg.select(".scrubber-line").style("opacity", 1); })
            .on("mouseout", () => { vsScrubber.style("opacity", 0); stChartSvg.select(".scrubber-line").style("opacity", 0); })
            .on("mousemove", (event) => {
                const mouseX = d3.pointer(event)[0];
                const dist = xDist.invert(mouseX);
                const bisector = d3.bisector(d => d.cumulativeDistance).left;
                const i = bisector(data, dist);
                const d = data[i];
                if (d) {
                    vsScrubber.attr("x1", mouseX).attr("x2", mouseX);
                    stChartSvg.select(".scrubber-line").attr("x1", xTime(d.endTime)).attr("x2", xTime(d.endTime));
                    previewSvgElement.setCurrentTime(d.endTime);
                }
            });
    }
}