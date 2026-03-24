import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

export interface TestImageFixtures {
  validJpgPath: string;
  validPngPath: string;
  validWebpPath: string;
  oversizedJpgPath: string;
  notAnImagePath: string;
  largeJpgPath: string; // > 1200px on long edge, for resize testing
  dir: string;
  cleanup: () => void;
}

export async function createTestImageFixtures(): Promise<TestImageFixtures> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chore-app-test-fixtures-"));

  const validJpgPath = path.join(dir, "valid.jpg");
  const validPngPath = path.join(dir, "valid.png");
  const validWebpPath = path.join(dir, "valid.webp");
  const oversizedJpgPath = path.join(dir, "oversized.jpg");
  const notAnImagePath = path.join(dir, "not-an-image.txt");
  const largeJpgPath = path.join(dir, "large.jpg");

  // 100x100 white JPEG
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .jpeg()
    .toFile(validJpgPath);

  // 100x100 white PNG
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toFile(validPngPath);

  // 100x100 white WebP
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .webp()
    .toFile(validWebpPath);

  // 2000x2000 JPEG — exceeds 1200px long edge, tests resize
  await sharp({
    create: { width: 2000, height: 2000, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .jpeg({ quality: 95 })
    .toFile(largeJpgPath);

  // > 5MB file with JPEG magic bytes so size check triggers (not MIME check)
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const padding = Buffer.alloc(6 * 1024 * 1024 - jpegHeader.length, 0);
  fs.writeFileSync(oversizedJpgPath, Buffer.concat([jpegHeader, padding]));

  // Plain text file renamed as .jpg to test MIME-by-content validation
  fs.writeFileSync(notAnImagePath, "This is not an image file.\n");

  return {
    validJpgPath,
    validPngPath,
    validWebpPath,
    oversizedJpgPath,
    notAnImagePath,
    largeJpgPath,
    dir,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
