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

const SEGMENT_COUNT = 100;

let isDrawing = false;
let allPoints = [];
let currentPathElement = null;
let isNewSignature = true;

// -----------------------------------------------------------------------------
// SECTION 1: DATA CAPTURE (USER DRAWING)
// -----------------------------------------------------------------------------

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
        time: performance.now()
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
// -----------------------------------------------------------------------------

function processAndVisualize(svgString) {
    // Step 1: Display the replay and store the code
    previewPanel.innerHTML = svgString;
    outputArea.value = svgString;
    downloadBtn.disabled = false;

    // Step 2: Analyze the SVG to extract the Temporal Truth
    const analysis = analyzeSVGData(svgString);
    if (!analysis) return;

    // Step 3: Visualize the data with D3.js
    drawCharts(analysis);
    setupInteractivity(analysis);
}

function generateSVG() {
    // This function now just returns the SVG string
    const firstPoint = allPoints.find(p => p !== null);
    const lastPoint = allPoints.slice().reverse().find(p => p !== null);
    const startTime = firstPoint.time;
    const endTime = lastPoint.time;
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

    const validPoints = allPoints.filter(p => p !== null);
    const totalPoints = validPoints.length;

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
        const t1 = totalDuration > 0 ? ((segmentStartTime - startTime) / 1000) / totalDuration : 0;
        const t2 = totalDuration > 0 ? ((segmentEndTime - startTime) / 1000) / totalDuration : 0;

        anim.setAttribute('values', 'hidden;visible;visible;visible');
        anim.setAttribute('keyTimes', `0;${t1.toFixed(4)};${t2.toFixed(4)};1`);
        anim.setAttribute('dur', `${totalDuration.toFixed(2)}s`);
        anim.setAttribute('fill', 'freeze');
        
        path.appendChild(anim);
        performanceGroup.appendChild(path);
    }
    
    svgRoot.appendChild(performanceGroup);
    return new XMLSerializer().serializeToString(svgRoot);
}

// -----------------------------------------------------------------------------
// SECTION 4: FORENSIC ANALYSIS (DATA EXTRACTION)
// -----------------------------------------------------------------------------

function analyzeSVGData(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");

    const paths = doc.querySelectorAll('g[stroke] path');
    if (paths.length === 0) return null;
    
    let totalDuration = 0;
    const animationData = Array.from(paths).map((path, index) => {
        const anim = path.querySelector('animate');
        const durString = anim.getAttribute('dur');
        const duration = parseFloat(durString.replace('s', ''));
        if (duration > totalDuration) totalDuration = duration;

        const keyTimes = anim.getAttribute('keyTimes').split(';').map(parseFloat);
        const startTime = keyTimes[1] * duration;
        const endTime = keyTimes[2] * duration;
        
        // Use the off-screen measurement trick to get path length
        const tempSvg = document.createElementNS(SVG_NS, 'svg');
        document.body.appendChild(tempSvg);
        const tempPath = path.cloneNode();
        tempSvg.appendChild(tempPath);
        const distance = tempPath.getTotalLength();
        document.body.removeChild(tempSvg);
        
        const timeDelta = endTime - startTime;
        const velocity = timeDelta > 0 ? distance / timeDelta : 0;

        return { index, startTime, endTime, distance, velocity };
    });

    let cumulativeDistance = 0;
    animationData.forEach(d => {
        cumulativeDistance += d.distance;
        d.cumulativeDistance = cumulativeDistance;
    });

    return { data: animationData, totalDuration };
}

// -----------------------------------------------------------------------------
// SECTION 5: D3.JS VISUALIZATION
// -----------------------------------------------------------------------------

function drawCharts(analysis) {
    const { data, totalDuration } = analysis;

    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // --- Draw Displacement Chart (s(t)) ---
    stChartSvg.selectAll("*").remove(); // Clear previous chart
    const stG = stChartSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleLinear().domain([0, totalDuration]).range([0, width]);
    const ySt = d3.scaleLinear().domain([0, d3.max(data, d => d.cumulativeDistance)]).range([height, 0]);

    stG.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    stG.append("g").call(d3.axisLeft(ySt));
    stG.append("text").attr("x", width/2).attr("y", -10).attr("class", "chart-title").text("Displacement (pixels)");

    const stLine = d3.line().x(d => x(d.endTime)).y(d => ySt(d.cumulativeDistance));
    stG.append("path").datum(data).attr("class", "chart-line").attr("d", stLine);

    // --- Draw Velocity Chart (v(t)) ---
    vtChartSvg.selectAll("*").remove();
    const vtG = vtChartSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    const yVt = d3.scaleLinear().domain([0, d3.max(data, d => d.velocity)]).range([height, 0]);

    vtG.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    vtG.append("g").call(d3.axisLeft(yVt));
    vtG.append("text").attr("x", width/2).attr("y", -10).attr("class", "chart-title").text("Velocity (pixels/sec)");

    const vtLine = d3.line().x(d => x(d.endTime)).y(d => yVt(d.velocity)).curve(d3.curveStepAfter);
    vtG.append("path").datum(data).attr("class", "chart-line").attr("d", vtLine);
}

// -----------------------------------------------------------------------------
// SECTION 6: INTERACTIVITY (THE "SCRUBBER")
// -----------------------------------------------------------------------------

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
        const scrubber = g.append("line")
            .attr("class", "scrubber-line")
            .attr("y1", 0)
            .attr("y2", height)
            .style("opacity", 0);

        chart.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("transform", `translate(${margin.left},${margin.top})`)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", () => scrubber.style("opacity", 1))
            .on("mouseout", () => scrubber.style("opacity", 0))
            .on("mousemove", (event) => {
                const mouseX = d3.pointer(event)[0];
                const time = x.invert(mouseX);
                
                // Update scrubber lines on ALL charts
                allCharts.forEach(c => c.select(".scrubber-line").attr("x1", mouseX).attr("x2", mouseX));

                // Sync the animation in the preview panel
                previewSvgElement.setCurrentTime(time);
            });
    });
}