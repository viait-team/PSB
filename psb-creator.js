// psb-creator.js

const canvas = document.getElementById('signature-canvas');
const finalizeBtn = document.getElementById('finalize-button');
const outputArea = document.getElementById('output-svgx');

let isDrawing = false;
let performanceData = []; // Array to hold all stroke data
let currentStroke = null; // The stroke currently being drawn
let startTime = null; // Timestamp for the start of the signature

// 1. EVENT LISTENERS FOR DRAWING

canvas.addEventListener('pointerdown', (e) => {
    isDrawing = true;
    if (startTime === null) {
        startTime = performance.now(); // Start the master clock
    }

    const point = getCoordinates(e);
    currentStroke = { points: [point], pathElement: null };
    
    // Create a new path element for this stroke
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'black');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('d', `M ${point.x} ${point.y}`);
    canvas.appendChild(path);
    currentStroke.pathElement = path;
    
    performanceData.push(currentStroke);
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;

    const point = getCoordinates(e);
    currentStroke.points.push(point);
    
    // Update the path visually in real-time for immediate user feedback
    const currentD = currentStroke.pathElement.getAttribute('d');
    currentStroke.pathElement.setAttribute('d', `${currentD} L ${point.x} ${point.y}`);
});

canvas.addEventListener('pointerup', () => {
    isDrawing = false;
    currentStroke = null;
});

// Helper function to get coordinates relative to the SVG canvas
function getCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        time: performance.now() - startTime // Time elapsed since signature start
    };
}

// 2. THE FINALIZATION LOGIC
finalizeBtn.addEventListener('click', generateSVGX);


// Add this function to psb-creator.js

function generateSVGX() {
    let performanceGroup = '<g id="signature-performance">\n';

    performanceData.forEach((stroke, index) => {
        if (stroke.points.length < 2) return;

        // --- Create the final static path for the stroke ---
        let pathD = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
        for (let i = 1; i < stroke.points.length; i++) {
            pathD += ` L ${stroke.points[i].x} ${stroke.points[i].y}`;
        }
        
        const pathID = `stroke-${index}`;
        performanceGroup += `    <path id="${pathID}" stroke-width="2" stroke="black" fill="none" opacity="0" d="${pathD}">\n`;

        // --- Create the SMIL animation for the path drawing ---
        const startTimeMs = stroke.points[0].time;
        const endTimeMs = stroke.points[stroke.points.length - 1].time;
        const durationSec = (endTimeMs - startTimeMs) / 1000;

        // The 'values' attribute recreates the drawing process step-by-step
        let animationValues = '';
        let currentPath = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
        animationValues += currentPath; // Start with the first point
        for (let i = 1; i < stroke.points.length; i++) {
            currentPath += ` L ${stroke.points[i].x} ${stroke.points[i].y}`;
            animationValues += `;${currentPath}`;
        }

        // The animation to draw the path
        performanceGroup += `        <animate attributeName="d" begin="${startTimeMs / 1000}s" dur="${durationSec}s" values="${animationValues}" fill="freeze" />\n`;
        // The animation to make the path appear
        performanceGroup += `        <animate attributeName="opacity" begin="${startTimeMs / 1000}s" dur="0.01s" from="0" to="1" fill="freeze" />\n`;
        
        performanceGroup += `    </path>\n`;
    });

    performanceGroup += '</g>\n';

    // --- Assemble the final SVGX file structure ---
    const finalSVGX = `
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:viait="https://viait.org/schemas/2025/svgx"
     viewBox="0 0 600 300"
     <!-- The Knowledge Layer -->
     viait:signer-name="John Hancock"
     viait:signing-date="${new Date().toISOString()}"
     viait:intent="Authored">

${performanceGroup}

<!-- 
    The W3C Digital Signature block would be inserted here by a cryptographic library.
    It would sign the parent SVG element, cryptographically securing both the
    Knowledge Layer (viait:* attributes) and the Presentation Layer (<g> performance).
-->
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <!-- ... Placeholder ... -->
</Signature>

</svg>`;

    outputArea.value = finalSVGX.trim();
    // Clear the canvas for a new signature
    canvas.innerHTML = '';
    performanceData = [];
    startTime = null;
}