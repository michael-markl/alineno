const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('pdf-input');
const spinner = document.getElementById('spinner-container');
const viewer = document.getElementById('pdf-viewer');
const downloadLink = document.getElementById('download-link');

let currentFile = null;

// Algorithm to detect lines on a page
const generateLinesForPage = async (page, columnFilter = 'all') => {
    const textContent = await page.getTextContent();
    if (textContent.items.length === 0) {
        return []; // Return empty array for empty pages
    }

    const pageWidth = page.getViewport({ scale: 1.0 }).width;

    // Initial filter to remove rotated text items and filter by column
    const originalItems = textContent.items.filter(item => {
        const transform = item.transform;
        const isHorizontal = Math.abs(transform[1]) < 0.01 && Math.abs(transform[2]) < 0.01;
        if (!isHorizontal) return false;

        const x = item.transform[4];
        const width = item.width;
        const midpoint = pageWidth / 2;

        if (columnFilter === 'left') {
            return x < midpoint;
        }
        if (columnFilter === 'right') {
            return x + width > midpoint;
        }
        return true; // 'all'
    });

    if (originalItems.length === 0) {
        return [];
    }

    const itemsToIgnore = new Set();

    // 1. Pre-filtering stage to identify and ignore "noise" items
    for (let i = 0; i < originalItems.length; i++) {
        for (let j = 0; j < originalItems.length; j++) {
            if (i === j) continue;

            const itemA = originalItems[i];
            const itemB = originalItems[j];

            const y_a = itemA.transform[5];
            const h_a = itemA.height;
            const y_b = itemB.transform[5];
            const h_b = itemB.height;

            // If y-intervals intersect and one is much wider than the other, mark the narrow one to be ignored.
            if (y_a <= y_b + h_b && y_b <= y_a + h_a) {
                const widthRatio = itemA.width / itemB.width;
                if (widthRatio > 10) { // itemA is much wider than itemB
                    itemsToIgnore.add(j);
                } else if (widthRatio < 0.1) { // itemB is much wider than itemA
                    itemsToIgnore.add(i);
                }
            }
        }
    }

    const filteredItems = originalItems.filter((_, index) => !itemsToIgnore.has(index));

    if (filteredItems.length === 0) {
        return [];
    }
    
    // 2. Build adjacency list on the filtered items
    const adj = new Array(filteredItems.length).fill(0).map(() => []);
    for (let i = 0; i < filteredItems.length; i++) {
        for (let j = i + 1; j < filteredItems.length; j++) {
            const itemA = filteredItems[i];
            const itemB = filteredItems[j];
            const y_a = itemA.transform[5];
            const h_a = itemA.height;
            const y_b = itemB.transform[5];
            const h_b = itemB.height;

            if (y_a <= y_b + h_b && y_b <= y_a + h_a) {
                adj[i].push(j);
                adj[j].push(i);
            }
        }
    }

    // 3. Find connected components (lines) using BFS on the filtered graph
    const visited = new Array(filteredItems.length).fill(false);
    const lines = [];
    for (let i = 0; i < filteredItems.length; i++) {
        if (!visited[i]) {
            const componentItems = [];
            const queue = [i];
            visited[i] = true;
            
            let head = 0;
            while(head < queue.length) {
                const u = queue[head++];
                componentItems.push(filteredItems[u]);

                for (const v of adj[u]) {
                    if (!visited[v]) {
                        visited[v] = true;
                        queue.push(v);
                    }
                }
            }
            lines.push(componentItems);
        }
    }

    // 4. Sort lines by their vertical position
    lines.sort((lineA, lineB) => {
        const yMaxA = Math.max(...lineA.map(item => item.transform[5] + item.height));
        const yMaxB = Math.max(...lineB.map(item => item.transform[5] + item.height));
        return yMaxB - yMaxA;
    });

    return lines;
};


// Handle file processing
const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
        console.error('File is not a PDF or no file selected.');
        alert('Please select a valid PDF file.');
        return;
    }
    currentFile = file;

    // Show spinner and hide viewer/download link
    spinner.style.display = 'flex';
    viewer.style.display = 'none';
    downloadLink.style.display = 'none';

    try {
        const existingPdfBytes = await file.arrayBuffer();
        const { PDFDocument, rgb, StandardFonts } = PDFLib;

        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();

        const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(existingPdfBytes) }).promise;
        const isTwoColumn = document.getElementById('two-column-toggle').checked;

        for (let i = 0; i < pdfjsDoc.numPages; i++) {
            const page = await pdfjsDoc.getPage(i + 1);
            const pdfPage = pages[i];
            const { width: pageWidth } = pdfPage.getSize();
            
            const drawLines = (lines, options = {}) => {
                const { lineStartCount = 1, side = 'left' } = options;
                let lineCount = lineStartCount;

                for (const lineItems of lines) {
                    const lineText = lineItems.map(item => item.str).join('');
                    if (lineText.trim() === '') continue;

                    // Calculate total width for weighting
                    const totalWidth = lineItems.reduce((sum, item) => sum + item.width, 0);
                    
                    // Sort items by y-coordinate to find the median
                    lineItems.sort((a, b) => b.transform[5] - a.transform[5]);

                    let accumulatedWidth = 0;
                    let weightedMedianY = lineItems.length > 0 ? lineItems[0].transform[5] : 0; // Default to the highest item

                    for (const item of lineItems) {
                        accumulatedWidth += item.width;
                        if (accumulatedWidth >= totalWidth / 2) {
                            weightedMedianY = item.transform[5];
                            break;
                        }
                    }

                    const x = side === 'left' ? 5 : pageWidth - 20;

                    pdfPage.drawText(`${lineCount++}`, {
                        x: x,
                        y: weightedMedianY,
                        font: helveticaFont,
                        size: 8,
                        color: rgb(0.5, 0.5, 0.5),
                    });
                }
                return lineCount;
            }

            if (isTwoColumn) {
                const leftLines = await generateLinesForPage(page, 'left');
                const rightLines = await generateLinesForPage(page, 'right');
                const leftLineCount = drawLines(leftLines, { lineStartCount: 1, side: 'left' });
                const resetCounter = document.getElementById('reset-counter-toggle').checked;
                const rightLineStartCount = resetCounter ? 1 : leftLineCount;
                drawLines(rightLines, { lineStartCount: rightLineStartCount, side: 'right' });
            } else {
                const lines = await generateLinesForPage(page, 'all');
                drawLines(lines, { lineStartCount: 1, side: 'left' });
            }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        viewer.src = url;
        viewer.style.display = 'block';
        downloadLink.href = url;
        downloadLink.download = 'line-numbered.pdf';
        downloadLink.style.display = 'block';

    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Sorry, there was an error processing your PDF. It might be encrypted or corrupted.');
    } finally {
        spinner.style.display = 'none'; // Hide spinner regardless of outcome
    }
};

// Event Listeners
const twoColumnToggle = document.getElementById('two-column-toggle');
const resetCounterContainer = document.getElementById('reset-counter-container');
const resetCounterToggle = document.getElementById('reset-counter-toggle');

// Drag and drop
dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    if (event.dataTransfer.files.length > 0) {
        handleFile(event.dataTransfer.files[0]);
    }
});

// Click to select
dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        handleFile(event.target.files[0]);
    }
});

// Re-process on toggle
twoColumnToggle.addEventListener('change', () => {
    resetCounterContainer.style.display = twoColumnToggle.checked ? '' : 'none';
    
    if (currentFile) {
        handleFile(currentFile);
    }
});

resetCounterToggle.addEventListener('change', () => {
    if (currentFile) {
        handleFile(currentFile);
    }
});
