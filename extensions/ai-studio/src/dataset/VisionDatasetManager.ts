// Copyright 2026 VirtusCo
// Extension host service for managing YOLO-format vision datasets

import * as fs from 'fs';
import * as path from 'path';

export interface VisionDatasetStats {
  path: string;
  numClasses: number;
  classNames: string[];
  splits: { train: number; val: number; test: number };
  totalImages: number;
  totalInstances: number;
  instancesPerClass: Record<string, number>;
  missingLabels: string[];
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tif', '.tiff']);

/**
 * Manages YOLO-format vision datasets: scanning, validation, and splitting.
 */
export class VisionDatasetManager {
  /**
   * Scans a YOLO dataset directory and returns comprehensive statistics.
   * Expects a data.yaml at the root with names, nc, train, val, test fields.
   */
  async scanDataset(datasetPath: string): Promise<VisionDatasetStats> {
    const errors: string[] = [];
    const dataYamlPath = path.join(datasetPath, 'data.yaml');

    // Parse data.yaml
    const yamlData = this._parseDataYaml(dataYamlPath, errors);
    const classNames = yamlData.names;
    const numClasses = yamlData.nc;
    const splitPaths = yamlData.splits;

    // Count images per split
    const trainImages = this._listImages(path.join(datasetPath, splitPaths.train));
    const valImages = this._listImages(path.join(datasetPath, splitPaths.val));
    const testImages = this._listImages(path.join(datasetPath, splitPaths.test));

    const splits = {
      train: trainImages.length,
      val: valImages.length,
      test: testImages.length,
    };

    const totalImages = splits.train + splits.val + splits.test;

    // Analyze labels across all splits
    const allImages = [
      ...trainImages.map(f => ({ file: f, split: splitPaths.train })),
      ...valImages.map(f => ({ file: f, split: splitPaths.val })),
      ...testImages.map(f => ({ file: f, split: splitPaths.test })),
    ];

    const missingLabels: string[] = [];
    const instancesPerClass: Record<string, number> = {};
    let totalInstances = 0;

    // Initialize class counts
    for (const cls of classNames) {
      instancesPerClass[cls] = 0;
    }

    for (const img of allImages) {
      const labelPath = this._imageLabelPath(datasetPath, img.split, img.file);

      if (!fs.existsSync(labelPath)) {
        missingLabels.push(img.file);
        continue;
      }

      try {
        const content = fs.readFileSync(labelPath, 'utf-8').trim();
        if (content.length === 0) {
          continue;
        }

        const lines = content.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 5) {
            continue;
          }

          const classId = parseInt(parts[0], 10);
          if (isNaN(classId) || classId < 0 || classId >= numClasses) {
            continue;
          }

          const className = classNames[classId] ?? `class_${classId}`;
          instancesPerClass[className] = (instancesPerClass[className] ?? 0) + 1;
          totalInstances++;
        }
      } catch {
        errors.push(`Failed to read label: ${labelPath}`);
      }
    }

    return {
      path: datasetPath,
      numClasses,
      classNames,
      splits,
      totalImages,
      totalInstances,
      instancesPerClass,
      missingLabels,
      errors,
    };
  }

  /**
   * Validates a YOLO dataset for common issues.
   */
  async validateDataset(datasetPath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check data.yaml exists
    const dataYamlPath = path.join(datasetPath, 'data.yaml');
    if (!fs.existsSync(dataYamlPath)) {
      errors.push('data.yaml not found in dataset root');
      return { valid: false, errors, warnings };
    }

    // Parse data.yaml
    const yamlErrors: string[] = [];
    const yamlData = this._parseDataYaml(dataYamlPath, yamlErrors);
    errors.push(...yamlErrors);

    if (yamlErrors.length > 0) {
      return { valid: false, errors, warnings };
    }

    const splitPaths = yamlData.splits;
    const numClasses = yamlData.nc;

    // Validate each split
    for (const [splitName, splitDir] of Object.entries(splitPaths)) {
      const imagesDir = path.join(datasetPath, splitDir);
      const labelsDir = imagesDir.replace(/images\/?$/, 'labels');

      if (!fs.existsSync(imagesDir)) {
        if (splitName === 'test') {
          warnings.push(`Test split directory not found: ${splitDir}`);
        } else {
          errors.push(`${splitName} images directory not found: ${splitDir}`);
        }
        continue;
      }

      const images = this._listImages(imagesDir);

      if (images.length === 0 && splitName !== 'test') {
        warnings.push(`${splitName} split has no images`);
        continue;
      }

      // Check each image has a matching label
      for (const img of images) {
        const baseName = path.parse(img).name;
        const labelFile = path.join(labelsDir, `${baseName}.txt`);

        if (!fs.existsSync(labelFile)) {
          warnings.push(`Missing label for ${splitName}/${img}`);
          continue;
        }

        // Validate label format
        try {
          const content = fs.readFileSync(labelFile, 'utf-8').trim();
          if (content.length === 0) {
            warnings.push(`Empty label file: ${splitName}/${baseName}.txt`);
            continue;
          }

          const lines = content.split('\n');
          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();
            if (line.length === 0) {
              continue;
            }

            const parts = line.split(/\s+/);
            if (parts.length < 5) {
              errors.push(
                `${splitName}/${baseName}.txt line ${lineNum + 1}: expected 5 values (class x y w h), got ${parts.length}`
              );
              continue;
            }

            const classId = parseInt(parts[0], 10);
            if (isNaN(classId) || classId < 0 || classId >= numClasses) {
              errors.push(
                `${splitName}/${baseName}.txt line ${lineNum + 1}: class_id ${parts[0]} out of range [0, ${numClasses - 1}]`
              );
            }

            // Check bbox values are in [0, 1]
            for (let i = 1; i <= 4; i++) {
              const val = parseFloat(parts[i]);
              if (isNaN(val) || val < 0 || val > 1) {
                errors.push(
                  `${splitName}/${baseName}.txt line ${lineNum + 1}: value ${parts[i]} not in [0, 1]`
                );
              }
            }
          }
        } catch {
          errors.push(`Failed to read label: ${labelFile}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Splits a dataset by moving images and labels between train/val/test
   * according to the specified ratios.
   */
  async splitDataset(
    datasetPath: string,
    ratios: { train: number; val: number; test: number }
  ): Promise<void> {
    // Normalize ratios
    const total = ratios.train + ratios.val + ratios.test;
    if (total <= 0) {
      throw new Error('Split ratios must sum to a positive number');
    }

    const norm = {
      train: ratios.train / total,
      val: ratios.val / total,
      test: ratios.test / total,
    };

    const yamlErrors: string[] = [];
    const yamlData = this._parseDataYaml(path.join(datasetPath, 'data.yaml'), yamlErrors);
    if (yamlErrors.length > 0) {
      throw new Error(`data.yaml errors: ${yamlErrors.join(', ')}`);
    }

    const splitPaths = yamlData.splits;

    // Collect all images and labels from all splits
    const allEntries: Array<{ imagePath: string; labelPath: string | null }> = [];

    for (const splitDir of Object.values(splitPaths)) {
      const imagesDir = path.join(datasetPath, splitDir);
      const labelsDir = imagesDir.replace(/images\/?$/, 'labels');

      if (!fs.existsSync(imagesDir)) {
        continue;
      }

      const images = this._listImages(imagesDir);
      for (const img of images) {
        const baseName = path.parse(img).name;
        const imgFull = path.join(imagesDir, img);
        const lblFull = path.join(labelsDir, `${baseName}.txt`);
        allEntries.push({
          imagePath: imgFull,
          labelPath: fs.existsSync(lblFull) ? lblFull : null,
        });
      }
    }

    // Shuffle deterministically
    for (let i = allEntries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allEntries[i], allEntries[j]] = [allEntries[j], allEntries[i]];
    }

    // Compute split boundaries
    const trainEnd = Math.round(allEntries.length * norm.train);
    const valEnd = trainEnd + Math.round(allEntries.length * norm.val);

    const splits: Record<string, typeof allEntries> = {
      train: allEntries.slice(0, trainEnd),
      val: allEntries.slice(trainEnd, valEnd),
      test: allEntries.slice(valEnd),
    };

    // Move files into their target splits
    for (const [splitName, entries] of Object.entries(splits)) {
      const targetImgDir = path.join(datasetPath, splitPaths[splitName as keyof typeof splitPaths]);
      const targetLblDir = targetImgDir.replace(/images\/?$/, 'labels');

      // Ensure directories exist
      fs.mkdirSync(targetImgDir, { recursive: true });
      fs.mkdirSync(targetLblDir, { recursive: true });

      for (const entry of entries) {
        const imgName = path.basename(entry.imagePath);
        const targetImg = path.join(targetImgDir, imgName);

        // Only move if not already in place
        if (entry.imagePath !== targetImg) {
          fs.copyFileSync(entry.imagePath, targetImg);
          fs.unlinkSync(entry.imagePath);
        }

        if (entry.labelPath) {
          const lblName = path.basename(entry.labelPath);
          const targetLbl = path.join(targetLblDir, lblName);
          if (entry.labelPath !== targetLbl) {
            fs.copyFileSync(entry.labelPath, targetLbl);
            fs.unlinkSync(entry.labelPath);
          }
        }
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Parse data.yaml manually (no YAML library dependency).
   * Supports simple key-value pairs and YAML lists.
   */
  private _parseDataYaml(
    yamlPath: string,
    errors: string[]
  ): { names: string[]; nc: number; splits: { train: string; val: string; test: string } } {
    const defaults = {
      names: [] as string[],
      nc: 0,
      splits: { train: 'images/train', val: 'images/val', test: 'images/test' },
    };

    if (!fs.existsSync(yamlPath)) {
      errors.push('data.yaml not found');
      return defaults;
    }

    let content: string;
    try {
      content = fs.readFileSync(yamlPath, 'utf-8');
    } catch {
      errors.push('Failed to read data.yaml');
      return defaults;
    }

    const lines = content.split('\n');
    let names: string[] = [];
    let nc = 0;
    const splits = { train: '', val: '', test: '' };
    let inNamesList = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Handle list continuation for names
      if (inNamesList) {
        if (line.startsWith('- ')) {
          const name = line.slice(2).trim().replace(/^['"]|['"]$/g, '');
          names.push(name);
          continue;
        } else {
          inNamesList = false;
        }
      }

      // Skip comments and empty lines
      if (line.startsWith('#') || line.length === 0) {
        continue;
      }

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) {
        continue;
      }

      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();

      switch (key) {
        case 'nc':
          nc = parseInt(value, 10) || 0;
          break;

        case 'train':
          splits.train = value.replace(/^['"]|['"]$/g, '');
          break;

        case 'val':
          splits.val = value.replace(/^['"]|['"]$/g, '');
          break;

        case 'test':
          splits.test = value.replace(/^['"]|['"]$/g, '');
          break;

        case 'names':
          if (value.startsWith('[')) {
            // Inline list: names: ['cat', 'dog']
            const inner = value.replace(/^\[|\]$/g, '');
            names = inner.split(',').map(
              (s) => s.trim().replace(/^['"]|['"]$/g, '')
            ).filter(s => s.length > 0);
          } else if (value.length === 0) {
            // Block list starts on next lines
            inNamesList = true;
          }
          break;
      }
    }

    // Validate
    if (names.length === 0) {
      errors.push('data.yaml: no class names found');
    }
    if (nc === 0 && names.length > 0) {
      nc = names.length;
    }
    if (nc !== names.length && names.length > 0) {
      errors.push(`data.yaml: nc (${nc}) does not match names count (${names.length})`);
    }

    // Default split paths if not specified
    if (!splits.train) {
      splits.train = 'images/train';
    }
    if (!splits.val) {
      splits.val = 'images/val';
    }
    if (!splits.test) {
      splits.test = 'images/test';
    }

    return { names, nc, splits };
  }

  /**
   * Lists image files in a directory (non-recursive).
   */
  private _listImages(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    try {
      return fs.readdirSync(dirPath).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return IMAGE_EXTENSIONS.has(ext);
      });
    } catch {
      return [];
    }
  }

  /**
   * Converts an image filename to its corresponding label path.
   * YOLO convention: images/train/img.jpg -> labels/train/img.txt
   */
  private _imageLabelPath(datasetRoot: string, splitDir: string, imageFile: string): string {
    const labelsDir = path.join(datasetRoot, splitDir).replace(/images/g, 'labels');
    const baseName = path.parse(imageFile).name;
    return path.join(labelsDir, `${baseName}.txt`);
  }
}
