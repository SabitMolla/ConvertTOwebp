# WebP Studio — Batch & Folder Image to WebP Converter

A blazing-fast, 100% in-browser WebP image converter supporting multi-file and entire folder uploads with recursive folder hierarchy preservation, customizable compression presets, resizing controls, and instant ZIP downloads.

![WebP Studio Preview](https://raw.githubusercontent.com/SabitMolla/ConvertTOwebp/main/preview.png) 


---

## 🌟 Key Features

- 📁 **Folder & Multi-File Batch Ingestion**: Upload entire directories with `webkitdirectory` or drag & drop folders.
- 🌳 **Recursive Folder Structure Preservation**: Exported ZIP files retain the exact original folder and subfolder structure.
- ⚡ **100% Client-Side Privacy & Speed**: Zero server uploads — all processing is done locally via HTML5 Canvas, Web Workers, and WebAssembly.
- 🖼️ **Universal Format Support**: Converts PNG, JPEG/JPG, Apple HEIC/HEIF, TIFF/TIF, SVG, GIF, AVIF, BMP, and ICO to WebP.
- 🎛️ **Custom Compression & Presets**:
  - *Web Optimized (82%)*
  - *High Fidelity (92%)*
  - *Ultra Compact (60%)*
  - *Lossless WebP (100%)*
- 📐 **Resizing & Scaling**: Scale by percentage or set custom max width/height with automatic aspect ratio lock.
- 🎨 **Alpha / Transparency Handling**: Preserve alpha transparency or fill transparent backgrounds with Solid White, Black, or custom hex color.
- 🔍 **Interactive Before / After Split Slider**: Visual side-by-side comparison modal with file size reduction percentage and dimensions.
- 📦 **Instant ZIP Packaging**: Download all converted images at once with `JSZip`.
- 📋 **Clipboard Paste Support**: Paste images directly with <kbd>Ctrl</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>V</kbd>.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm, yarn, or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/SabitMolla/ConvertTOwebp.git

# Navigate to directory
cd ConvertTOwebp

# Install dependencies
npm install

# Start local dev server
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

- **Vanilla HTML5 & CSS3** (Custom Glassmorphism Design System)
- **Modern JavaScript (ES Modules)**
- **Vite** (Build Tool & Dev Server)
- **JSZip** (In-Browser ZIP Generation)
- **heic2any** (Apple HEIC/HEIF Client-Side Decoder)
- **UTIF.js** (TIFF Format Decoder)

---

## 📄 License

MIT License. Free for personal and commercial use.
