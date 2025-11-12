const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('pdf-input');
const spinner = document.getElementById('spinner-container');
const viewer = document.getElementById('pdf-viewer');
const downloadLink = document.getElementById('download-link');

// Algorithm to detect lines on a page
const generateLinesForPage = async (page) => {
    const textContent = await page.getTextContent();
    if (textContent.items.length === 0) {
        return []; // Return empty array for empty pages
    }

    // Initial filter to remove rotated text items (e.g., 90 degrees)
    const horizontalItems = textContent.items.filter(item => {
        const transform = item.transform;
        // For a standard horizontal text, transform[1] and transform[2] are close to 0.
        // We check if the text is NOT rotated.
        const isHorizontal = Math.abs(transform[1]) < 0.01 && Math.abs(transform[2]) < 0.01;
        return isHorizontal;
    });

    const originalItems = horizontalItems;
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

        for (let i = 0; i < pdfjsDoc.numPages; i++) {
            const page = await pdfjsDoc.getPage(i + 1);
            const lines = await generateLinesForPage(page);
            
            const pdfPage = pages[i];
            let lineCount = 1;

            for (const lineItems of lines) {
                const lineText = lineItems.map(item => item.str).join('');
                if (lineText.trim() === '') continue;

                // Calculate total width for weighting
                const totalWidth = lineItems.reduce((sum, item) => sum + item.width, 0);
                
                // Sort items by y-coordinate to find the median
                lineItems.sort((a, b) => b.transform[5] - a.transform[5]);

                let accumulatedWidth = 0;
                let weightedMedianY = lineItems[0].transform[5]; // Default to the highest item

                for (const item of lineItems) {
                    accumulatedWidth += item.width;
                    if (accumulatedWidth >= totalWidth / 2) {
                        weightedMedianY = item.transform[5];
                        break;
                    }
                }

                pdfPage.drawText(`${lineCount++}`, {
                    x: 5,
                    y: weightedMedianY,
                    font: helveticaFont,
                    size: 8,
                    color: rgb(0.5, 0.5, 0.5),
                });
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

// Event listener for the hidden file input
fileInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        handleFile(event.target.files[0]);
    }
});

// Make the drop zone clickable
dropZone.addEventListener('click', () => {
    fileInput.click();
});

// Drag and drop event listeners
dropZone.addEventListener('dragover', (event) => {
    event.preventDefault(); // Necessary to allow drop
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

