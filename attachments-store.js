globalThis.PROMPT_FLOOD_ATTACHMENTS = (() => {
  const DB_NAME = "promptFloodAttachments";
  const DB_VERSION = 1;
  const STORE = "blobs";
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_FILES = 3;

  const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf"
  ]);

  const EXTENSION_MIME_TYPES = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf"
  };

  function isAllowedMimeType(mimeType) {
    const mime = (mimeType || "").toLowerCase();
    return ALLOWED_MIME_TYPES.has(mime);
  }

  function inferMimeTypeFromName(name) {
    const extension = (name || "").split(".").pop()?.toLowerCase();
    return extension ? EXTENSION_MIME_TYPES[extension] || "" : "";
  }

  function inferMimeTypeFromBytes(data) {
    const bytes = new Uint8Array(data);
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }

    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "image/png";
    }

    if (bytes.length >= 6) {
      const header = String.fromCharCode(...bytes.slice(0, 6));
      if (header === "GIF87a" || header === "GIF89a") {
        return "image/gif";
      }
    }

    if (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    ) {
      return "image/webp";
    }

    if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF") {
      return "application/pdf";
    }

    return "";
  }

  function resolveMimeType(name, mimeType, data) {
    const normalized = (mimeType || "").toLowerCase();
    if (normalized && isAllowedMimeType(normalized)) {
      return normalized;
    }

    return inferMimeTypeFromBytes(data) || inferMimeTypeFromName(name);
  }

  function normalizeBinaryData(data) {
    if (data instanceof ArrayBuffer) {
      return data;
    }

    if (ArrayBuffer.isView(data)) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }

    if (Array.isArray(data)) {
      return Uint8Array.from(data).buffer;
    }

    if (data && typeof data === "object") {
      const numericKeys = Object.keys(data)
        .filter((key) => /^\d+$/.test(key))
        .map((key) => Number(key))
        .sort((left, right) => left - right);

      if (numericKeys.length > 0) {
        const bytes = new Uint8Array(numericKeys.length);
        numericKeys.forEach((key, index) => {
          bytes[index] = data[key];
        });
        return bytes.buffer;
      }
    }

    return null;
  }

  function validateAttachmentMeta({ name, mimeType, size }) {
    if (!name || !mimeType || !Number.isFinite(size) || size <= 0) {
      throw new Error("Invalid attachment metadata.");
    }

    if (size > MAX_FILE_SIZE) {
      throw new Error(`"${name}" exceeds the 5 MB limit.`);
    }

    if (!isAllowedMimeType(mimeType)) {
      throw new Error(`"${name}" is not a supported image or PDF.`);
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeBlob({ name, mimeType, data }) {
    const binary = normalizeBinaryData(data);
    if (!binary) {
      throw new Error("Invalid attachment metadata.");
    }

    const resolvedMimeType = resolveMimeType(name, mimeType, binary);
    validateAttachmentMeta({ name, mimeType: resolvedMimeType, size: binary.byteLength });

    const id = crypto.randomUUID();
    const db = await openDb();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(
        {
          name,
          mimeType: resolvedMimeType,
          data: binary,
          createdAt: Date.now()
        },
        id
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    return { id, name, mimeType: resolvedMimeType, size: binary.byteLength };
  }

  async function getBlobs(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const db = await openDb();
    const results = [];

    for (const id of ids) {
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (record) {
        results.push({
          id,
          name: record.name,
          mimeType: record.mimeType,
          data: record.data
        });
      }
    }

    db.close();
    return results;
  }

  function serializeAttachmentData(entry) {
    const binary = normalizeBinaryData(entry.data);
    if (!binary) return null;

    return {
      id: entry.id,
      name: entry.name,
      mimeType: entry.mimeType,
      data: [...new Uint8Array(binary)]
    };
  }

  async function deleteBlobs(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;

    const db = await openDb();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);

      for (const id of ids) {
        store.delete(id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  }

  async function cloneBlobs(refs) {
    if (!Array.isArray(refs) || refs.length === 0) return [];

    const blobs = await getBlobs(refs.map((entry) => entry.id));
    const clones = [];

    for (const blob of blobs) {
      const meta = await storeBlob(blob);
      clones.push(meta);
    }

    return clones;
  }

  return {
    MAX_FILES,
    MAX_FILE_SIZE,
    ALLOWED_MIME_TYPES,
    isAllowedMimeType,
    inferMimeTypeFromName,
    resolveMimeType,
    normalizeBinaryData,
    validateAttachmentMeta,
    storeBlob,
    getBlobs,
    serializeAttachmentData,
    deleteBlobs,
    cloneBlobs
  };
})();
