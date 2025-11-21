import { getLines, lineMedianY } from "./lib.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

if (location.protocol !== "file:") {
  GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs";
} else {
  GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs";
}

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("pdf-input");
const spinner = document.getElementById("spinner-container");
const viewer = document.getElementById("pdf-viewer");
const downloadLink = document.getElementById("download-link");

let currentFile = null;

// Handle file processing
const handleFile = async (file) => {
  if (!file && currentFile) {
    file = currentFile.file;
  }
  if (!file || file.type !== "application/pdf") {
    console.error("File is not a PDF or no file selected.");
    alert("Please select a valid PDF file.");
    return;
  }
  currentFile = { file };

  // Show spinner and hide viewer/download link
  spinner.style.display = "flex";
  viewer.style.display = "none";
  downloadLink.style.display = "none";

  try {
    if (!currentFile.payload) {
      const payload = await file.arrayBuffer();
      if (currentFile.file !== file) {
        return;
      }
      currentFile.payload = payload;
    }
    const payload = currentFile.payload;

    const pdfDoc = await PDFDocument.load(payload);
    const font = await pdfDoc.embedFont(StandardFonts.Courier);
    const pages = pdfDoc.getPages();

    const pdfjsDoc = await getDocument({
      data: new Uint8Array(payload),
    }).promise;
    const isTwoColumn = document.getElementById("two-column-toggle").checked;
    const margin = parseInt(document.getElementById("margin-input").value, 10);

    for (let i = 0; i < pdfjsDoc.numPages; i++) {
      const page = await pdfjsDoc.getPage(i + 1);
      const pdfPage = pages[i];
      const { width: pageWidth } = pdfPage.getSize();

      const drawLines = (lines, options = {}) => {
        const { lineStartCount = 1, side = "left" } = options;
        const nonEmptyLines = lines.filter((item) => {
          const lineText = item.map((subItem) => subItem.str).join("");
          return lineText.trim() !== "";
        });
        const maxLineNumber = lineStartCount + nonEmptyLines.length - 1;
        const numDigits = Math.floor(Math.log10(maxLineNumber)) + 1;

        let lineCount = lineStartCount;

        for (const lineItems of nonEmptyLines) {
          const medianY = lineMedianY(lineItems);
          const lineNumberText = lineCount.toString().padStart(numDigits, " ");
          const textWidth = font.widthOfTextAtSize(lineNumberText, 8);

          const x = side === "left" ? margin : pageWidth - margin - textWidth;
          pdfPage.drawText(lineNumberText, {
            x: x,
            y: medianY,
            font: font,
            size: 8,
            color: rgb(0.5, 0.5, 0.5),
          });

          lineCount += 1;
        }
      };

      if (isTwoColumn) {
        const leftLines = await getLines(page, { columnFilter: "left" });
        const rightLines = await getLines(page, { columnFilter: "right" });
        const leftLineCount = drawLines(leftLines, {
          lineStartCount: 1,
          side: "left",
        });
        const resetCounter = document.getElementById(
          "reset-counter-toggle",
        ).checked;
        const rightLineStartCount = resetCounter ? 1 : leftLineCount;
        drawLines(rightLines, {
          lineStartCount: rightLineStartCount,
          side: "right",
        });
      } else {
        const lines = await getLines(page, { columnFilter: "none" });
        drawLines(lines, { lineStartCount: 1, side: "left" });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    viewer.src = url;
    viewer.style.display = "block";
    downloadLink.href = url;
    downloadLink.download = currentFile.name;
    downloadLink.style.display = "block";
  } catch (error) {
    console.error("Error processing PDF:", error);
    alert(
      "Sorry, there was an error processing your PDF. It might be encrypted or corrupted.",
    );
  } finally {
    spinner.style.display = "none"; // Hide spinner regardless of outcome
  }
};

const twoColumnToggle = document.getElementById("two-column-toggle");
const resetCounterContainer = document.getElementById(
  "reset-counter-container",
);
const resetCounterToggle = document.getElementById("reset-counter-toggle");
const marginInput = document.getElementById("margin-input");

// Event Listeners

// Drag and drop
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  if (event.dataTransfer.files.length > 0) {
    handleFile(event.dataTransfer.files[0]);
  }
});

// Click to select
dropZone.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  if (event.target.files.length > 0) {
    handleFile(event.target.files[0]);
  }
});

// Re-process on toggle
marginInput.addEventListener("change", () => {
  if (currentFile) {
    handleFile();
  }
});

twoColumnToggle.addEventListener("change", () => {
  resetCounterContainer.style.display = twoColumnToggle.checked ? "" : "none";

  if (currentFile) {
    handleFile();
  }
});

resetCounterToggle.addEventListener("change", () => {
  if (currentFile) {
    handleFile();
  }
});
