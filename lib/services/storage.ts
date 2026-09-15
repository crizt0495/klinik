import { put, del } from "@vercel/blob";
import { promises as fs } from "fs";
import { join, resolve } from "path";
import { randomBytes } from "crypto";

export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageService {
  put(key: string, data: Buffer, mimeType: string): Promise<StoredFile>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

class LocalStorageService implements StorageService {
  private readonly dir: string;

  constructor() {
    this.dir = resolve(process.cwd(), ".storage");
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private pathFor(key: string): string {
    // Prevent path traversal
    const safeKey = key.replace(/\.\./g, "").replace(/\//g, "_");
    return join(this.dir, safeKey);
  }

  async put(key: string, data: Buffer): Promise<StoredFile> {
    await this.ensureDir();
    const path = this.pathFor(key);
    await fs.writeFile(path, data);
    return { key, url: `/storage/${encodeURIComponent(key)}` };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.pathFor(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.pathFor(key));
    } catch {
      // ignore
    }
  }

  getUrl(key: string): string {
    return `/storage/${encodeURIComponent(key)}`;
  }
}

class BlobStorageService implements StorageService {
  async put(key: string, data: Buffer, mimeType: string): Promise<StoredFile> {
    const result = await put(key, data, {
      access: "private",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return { key: result.pathname, url: result.url };
  }

  async get(key: string): Promise<Buffer | null> {
    const { list } = await import("@vercel/blob");
    const blobs = await list({ prefix: key });
    const blob = blobs.blobs.find((b) => b.pathname === key);
    if (!blob) return null;
    const res = await fetch(blob.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    try {
      await del(key);
    } catch {
      // ignore
    }
  }

  getUrl(key: string): string {
    return key;
  }
}

let instance: StorageService | null = null;

export function storage(): StorageService {
  if (instance) return instance;
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.STORAGE_ENDPOINT) {
    instance = new BlobStorageService();
  } else {
    instance = new LocalStorageService();
  }
  return instance;
}

export function newStorageKey(prefix: string, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${prefix}/${Date.now()}-${randomBytes(4).toString("hex")}-${safeName}`;
}