const { exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);

/**
 * Convert RGB PDF to CMYK PDF using Ghostscript
 *
 * @param {string} inputPath - Original RGB PDF
 * @param {string} outputPath - CMYK converted PDF
 */
async function convertPdfToCmyk(inputPath, outputPath) {
  try {
    const gsCommand =
      `gswin64c -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite ` +
      `-sColorConversionStrategy=CMYK ` +
      `-dProcessColorModel=/DeviceCMYK ` +
      `-sOutputFile="${outputPath}" "${inputPath}"`;

    console.log(`🔵 Converting ${inputPath} to CMYK...`);
    await execPromise(gsCommand);
    console.log(`✅ Saved CMYK PDF at: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error converting PDF to CMYK:`, error);
    throw error;
  }
}

module.exports = { convertPdfToCmyk };
