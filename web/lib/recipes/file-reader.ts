import { FilePayload } from "./types";

/**
 * Checks if a filename is typically a text file or binary.
 */
export function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const textExtensions = [
    "html",
    "htm",
    "css",
    "js",
    "jsx",
    "ts",
    "tsx",
    "json",
    "svg",
    "txt",
    "md",
    "xml",
    "webmanifest",
    "map",
    "yaml",
    "yml",
  ];
  return textExtensions.includes(ext);
}

/**
 * Normalizes file path to remove leading dots and slashes.
 */
export function normalizePath(path: string): string {
  return path.replace(/^(\.|\/)+/, "");
}

/**
 * Checks if file bundle contains a root index.html.
 */
export function hasRootIndexHtml(files: FilePayload[]): boolean {
  return files.some((f) => normalizePath(f.path) === "index.html");
}

/**
 * Extracts files from a ZIP array buffer.
 * Supports both uncompressed (method 0) and Deflate-compressed (method 8) ZIP entries.
 */
export async function extractZipFiles(buffer: ArrayBuffer): Promise<FilePayload[]> {
  const view = new DataView(buffer);
  let offset = 0;
  const files: FilePayload[] = [];

  while (offset + 30 <= buffer.byteLength) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      // Reached end of local file headers or non-standard segment
      break;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    if (offset + 30 + fileNameLength > buffer.byteLength) {
      break;
    }

    const nameBytes = new Uint8Array(buffer, offset + 30, fileNameLength);
    const rawName = new TextDecoder().decode(nameBytes);

    const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
    if (dataOffset + compressedSize > buffer.byteLength) {
      break;
    }

    // Skip directories and macOS metadata
    const pathSegments = rawName.split("/");
    const isHidden = pathSegments.some(
      (s) => s.startsWith(".") && s !== "." && s !== ".."
    );
    if (
      !rawName.endsWith("/") &&
      !rawName.includes("__MACOSX/") &&
      !isHidden
    ) {
      const rawData = new Uint8Array(buffer, dataOffset, compressedSize);
      let uncompressedBytes: Uint8Array;

      if (compressionMethod === 0) {
        uncompressedBytes = rawData;
      } else if (compressionMethod === 8) {
        try {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.closed.catch(() => {});
          writer.write(rawData).catch(() => {});
          writer.close().catch(() => {});
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          uncompressedBytes = new Uint8Array(totalLength);
          let pos = 0;
          for (const chunk of chunks) {
            uncompressedBytes.set(chunk, pos);
            pos += chunk.length;
          }
        } catch {
          uncompressedBytes = rawData;
        }
      } else {
        // Unsupported compression method, fallback
        uncompressedBytes = rawData;
      }

      const cleanPath = normalizePath(rawName);
      if (isTextFile(cleanPath)) {
        const text = new TextDecoder().decode(uncompressedBytes);
        files.push({
          path: cleanPath,
          content: text,
          encoding: "utf-8",
        });
      } else {
        // Base64 encode binary files
        let binaryStr = "";
        const len = uncompressedBytes.byteLength;
        for (let i = 0; i < len; i++) {
          binaryStr += String.fromCharCode(uncompressedBytes[i]);
        }
        const base64 = btoa(binaryStr);
        files.push({
          path: cleanPath,
          content: base64,
          encoding: "base64",
        });
      }
    }

    offset = dataOffset + compressedSize;
  }

  return files;
}

/**
 * Reads browser File objects into FilePayload format.
 */
export async function processUploadedFiles(rawFiles: File[]): Promise<FilePayload[]> {
  const result: FilePayload[] = [];

  for (const file of rawFiles) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const arrayBuffer = await file.arrayBuffer();
      const extracted = await extractZipFiles(arrayBuffer);
      result.push(...extracted);
    } else {
      const relativePath = file.webkitRelativePath || file.name;
      const cleanPath = normalizePath(relativePath);

      if (isTextFile(cleanPath)) {
        const text = await file.text();
        result.push({
          path: cleanPath,
          content: text,
          encoding: "utf-8",
        });
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binaryStr = "";
        for (let i = 0; i < uint8.byteLength; i++) {
          binaryStr += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binaryStr);
        result.push({
          path: cleanPath,
          content: base64,
          encoding: "base64",
        });
      }
    }
  }

  // Deduplicate files by normalized path (latest wins)
  const map = new Map<string, FilePayload>();
  for (const f of result) {
    map.set(normalizePath(f.path), f);
  }

  return Array.from(map.values());
}

/**
 * Provides a clean starter website with index.html, styles.css, and script.js.
 */
export function getStarterWebsiteFiles(): FilePayload[] {
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to My Website</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="container">
    <div class="card">
      <div class="badge">Live on INGR</div>
      <h1>Hello, World!</h1>
      <p>This website was published for free using INGR and Cloudflare.</p>
      <div class="actions">
        <a href="#about" class="button">Explore</a>
      </div>
    </div>
  </main>
  <script src="script.js"></script>
</body>
</html>`;

  const stylesCss = `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
body {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #f8fafc;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.container {
  padding: 2rem;
  max-width: 600px;
  width: 100%;
}
.card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.5rem;
  padding: 3rem 2rem;
  text-align: center;
  backdrop-filter: blur(10px);
}
.badge {
  display: inline-block;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  margin-bottom: 1.5rem;
}
h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
}
p {
  color: #94a3b8;
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
}
.button {
  display: inline-block;
  background: #3b82f6;
  color: #ffffff;
  padding: 0.75rem 2rem;
  border-radius: 0.75rem;
  text-decoration: none;
  font-weight: 600;
  transition: transform 0.2s, background 0.2s;
}
.button:hover {
  background: #2563eb;
  transform: translateY(-2px);
}`;

  const scriptJs = `console.log("Website loaded successfully!");`;

  return [
    { path: "index.html", content: indexHtml, encoding: "utf-8" },
    { path: "styles.css", content: stylesCss, encoding: "utf-8" },
    { path: "script.js", content: scriptJs, encoding: "utf-8" },
  ];
}
