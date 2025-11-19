<p align="center">
  <img src="logo.svg" alt="Alineno Logo" width="150">
</p>

<h1 align="center">Alineno</h1>

<p align="center">
  <strong>Add Perfectly Aligned Line Numbers to PDFs</strong>
  <br /><br />
  <a href="https://michael-markl.github.io/alineno">Open App</a>
  <br /><br />
  <a href="https://github.com/michael-markl/alineno/issues">Report Bug</a>
  ·
  <a href="https://github.com/michael-markl/alineno/issues">Request Feature</a>
</p>

---

Alineno is a free, open-source, client-side tool for adding line numbers to PDFs. It detects lines even if your document contains math formulas, footnotes, superscripts, etc.
Your files are never uploaded to a server, ensuring 100% privacy and security.

This project was built to solve a common problem for students, researchers, and other professionals who need to reference specific lines in a PDF document.

The name "Alineno" is an homage to the LaTeX package [lineno](https://ctan.org/pkg/lineno).
If you use LaTeX, please use this LaTeX package for professional line numbers.

## ✨ Features

- **Accurate Line Detection**: Uses an advanced graph-based algorithm to precisely identify text lines, handling variations in spacing and layout.
- **Two-Column Mode**: Seamlessly process academic papers, legal documents even if they use a two-column layout.
- **Client-Side Processing**: All operations happen locally in your browser. Your files are never uploaded, guaranteeing privacy and speed.
- **Drag & Drop Interface**: A simple and intuitive user interface for selecting files.
- **Customizable Counter**: Choose to continue line numbering across columns or reset the counter for each column.
- **No Installation Required**: Works directly in any modern web browser.
- **Raw HTML, CSS, JS**: A total of 275 lines of self-owned JS, unminified for 100% transparency.

## 🚀 How to Use

Just open [michael-markl.github.io/alineno](https://michael-markl.github.io/alineno).

## ✈️ Local Usage

You can of course also clone the repository, and start a local web server. Make sure to have Node installed.

1.  **Clone the repository and install dependencies:**

    ```bash
    git clone https://github.com/michael-markl/alineno.git
    cd alineno
    ```

2.  **Install dependencies:**:

    ```bash
    npm install
    ```

3.  **Convert Typescript to Javascript:**:

    ```bash
    npm build
    ```

4.  **Start a local web server:**

    ```bash
    npx serve .
    ```

5.  **Open the application:**
    Navigate to `http://localhost:8000` (or the port specified by your server) in your web browser.

## ⚠️ Limitations

This tool relies on extracting text data from the PDF file. Therefore, it has the following limitations:

- It only works with PDFs that contain selectable text. It will not work on scanned documents or PDFs that consist only of images.
- The accuracy of line numbering depends on the structure of the PDF. While robust, extremely complex layouts might not be numbered correctly.
- Very large PDF files may cause performance issues in the browser.

## 📄 AI Disclaimer & License

Most of the project including this README was generated using an LLM.

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
