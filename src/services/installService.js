import fs from "fs";
import https from "https";
import path from "path";
import { loadLockFile } from "./lockService.js";

const MODS_DIR = path.resolve("mods");

/**
 * Ensure mods directory exists
 */
function ensureModsDirectory() {
  if (!fs.existsSync(MODS_DIR)) {
    fs.mkdirSync(MODS_DIR, { recursive: true });
  }
}

/**
 * Extract filename from URL or generate from mod info
 * @param {string} url - Download URL
 * @param {Object} mod - Mod object with slug and version_number
 * @returns {string} Filename
 */
function getFilename(url, mod) {
  try {
    // Try to extract filename from URL
    const urlPath = new URL(url).pathname;
    const filename = path.basename(urlPath);

    // If it looks like a jar file, use it
    if (filename.endsWith('.jar')) {
      return filename;
    }
  } catch (err) {
    // URL parsing failed, fall back to generated name
  }

  // Fallback: generate filename from mod info
  const safeSlug = mod.slug.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeVersion = mod.version_number.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safeSlug}-${safeVersion}.jar`;
}

/**
 * Download a file from URL to local path using streams
 * @param {string} url - Download URL
 * @param {string} filePath - Local file path
 * @returns {Promise<Object>} Promise resolving to {success: boolean, size?: number, error?: string}
 */
function downloadFile(url, filePath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filePath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filePath, () => {}); // Delete the file on error
        resolve({
          success: false,
          error: `HTTP ${response.statusCode}: ${response.statusMessage}`
        });
        return;
      }

      let downloadedSize = 0;
      response.pipe(file);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
      });

      file.on('finish', () => {
        file.close();
        resolve({ success: true, size: downloadedSize });
      });

      file.on('error', (err) => {
        file.close();
        fs.unlink(filePath, () => {}); // Delete the file on error
        resolve({ success: false, error: err.message });
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(filePath, () => {}); // Delete the file on error
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Check if file exists and get its size
 * @param {string} filePath - File path
 * @returns {number|null} File size in bytes, or null if doesn't exist
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (err) {
    return null;
  }
}

/**
 * Download mods in batches to limit concurrency
 * @param {Array} downloads - Array of download tasks
 * @param {number} concurrency - Max concurrent downloads
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Array>} Results array
 */
async function downloadInBatches(downloads, concurrency = 5, onProgress) {
  const results = [];
  const batches = [];

  // Split downloads into batches
  for (let i = 0; i < downloads.length; i += concurrency) {
    batches.push(downloads.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (download) => {
      const result = await download();
      if (onProgress) {
        onProgress(result);
      }
      return result;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Install all mods from modpack-lock.json
 * @returns {Promise<Object>} Installation results
 */
export async function installMods() {
  // Check if lock file exists
  const lockFile = loadLockFile();
  if (!lockFile) {
    throw new Error("Run 'mpe lock' first");
  }

  if (!lockFile.mods || !Array.isArray(lockFile.mods)) {
    throw new Error("Invalid modpack-lock.json format");
  }

  ensureModsDirectory();

  console.log("Downloading mods...\n");

  const downloads = [];
  let skippedCount = 0;

  // Prepare download tasks
  for (const mod of lockFile.mods) {
    const filename = getFilename(mod.download_url, mod);
    const filePath = path.join(MODS_DIR, filename);

    // Check if file already exists with same size (basic check)
    const existingSize = getFileSize(filePath);
    if (existingSize !== null) {
      // For now, we'll skip if file exists. In a more advanced version,
      // we could check content hash, but size is a reasonable heuristic.
      skippedCount++;
      continue;
    }

    downloads.push(async () => {
      const result = await downloadFile(mod.download_url, filePath);
      return {
        mod: mod.slug,
        filename,
        ...result
      };
    });
  }

  if (downloads.length === 0) {
    console.log(`All ${lockFile.mods.length} mods already installed\n`);
    return {
      total: lockFile.mods.length,
      installed: 0,
      skipped: lockFile.mods.length,
      failed: 0,
      failures: []
    };
  }

  let completedCount = 0;
  const totalCount = downloads.length;
  const results = [];

  // Download with progress updates
  const downloadResults = await downloadInBatches(
    downloads,
    5, // concurrency limit
    (result) => {
      completedCount++;
      if (result.success) {
        console.log(`✔ ${result.mod}`);
      } else {
        console.log(`❌ ${result.mod} (${result.error})`);
      }
      results.push(result);
    }
  );

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const failures = results.filter(r => !r.success);

  console.log(`\n✔ Installed ${successful} mods successfully`);

  if (skippedCount > 0) {
    console.log(`⏭️ Skipped ${skippedCount} already installed mods`);
  }

  if (failed > 0) {
    console.log(`❌ Failed to install ${failed} mods`);
  }

  console.log("");

  return {
    total: lockFile.mods.length,
    installed: successful,
    skipped: skippedCount,
    failed,
    failures: failures.map(f => ({ mod: f.mod, error: f.error }))
  };
}