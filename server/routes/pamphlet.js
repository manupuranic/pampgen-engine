const express = require("express");
const router = express.Router();
const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { once } = require("events");

const TAILWIND_CSS_CDN = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`;

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vReFSbcdyZtQmmpuKeo7Py1ZnEFK64KHUmcnbHkDUjd16tYhslE6bTVpQPEDGTY1v48aIuXZaQ2iHFZ/pub?gid=1830408441&single=true&output=csv";

const toSnakeCase = (str) =>
  str
    .replace(/\W+/g, "_")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();

const snakeCaseKeys = (obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [toSnakeCase(key), value])
  );

const logoBuffer = fs.readFileSync(path.join(__dirname, "../assets/logo.png"));
const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
const deliveryBuffer = fs.readFileSync(
  path.join(__dirname, "../assets/delivery.png")
);
const deliveryBase64 = `data:image/png;base64,${deliveryBuffer.toString(
  "base64"
)}`;

const calculateDiscount = (mrp, type, value) => {
  if (type === "percent") return (mrp - (mrp * value) / 100).toFixed(2);
  if (type === "amount") return (mrp - value).toFixed(2);
  return mrp;
};

handlebars.registerHelper("calculateDiscount", calculateDiscount);

handlebars.registerHelper("formatDiscount", (type, value) => {
  if (type === "percent") return `${value}% OFF`;
  if (type === "amount") return `Save ₹${value}`;
  if (type === "combo" || type === "text") return `${value}`;
  return "";
});

handlebars.registerHelper("shouldShowDiscount", (mrp, type, value) => {
  if (!type) return false;
  const discounted = calculateDiscount(mrp, type, value);
  if (type === "combo" || type === "text") return false;
  return parseFloat(discounted) !== parseFloat(mrp);
});

handlebars.registerHelper("cardHeight", (rows, cols) => {
  const pageHeight = 842; // Approx A4 page height in px (landscape mode is 595 x 842)
  const headerFooterReserve = 100; // pixels reserved for header + footer

  const availableHeight = pageHeight - headerFooterReserve;
  const cardHeight = Math.floor(availableHeight / rows);

  return `${cardHeight}px`;
});

handlebars.registerHelper("cardFontSize", (rows, cols) => {
  const density = rows * cols;
  const preferred = Math.max(1.2, 6 - density * 0.2);
  return `clamp(0.75rem, ${preferred}vw, 1.5rem)`;
});

handlebars.registerHelper("cardPadding", (rows, cols) => {
  const density = rows * cols;
  const preferred = Math.max(1, 5 - density * 0.15);
  return `clamp(0.4rem, ${preferred}vw, 1rem)`;
});

handlebars.registerHelper("cardNameFontSize", (name) => {
  const safeLength = Math.max(name.length, 10);
  const preferred = 10 / safeLength;
  return `clamp(0.75rem, ${preferred}vw, 1.4rem)`;
});

handlebars.registerHelper("adjustDiscountFontSize", (value) => {
  if (!value) return "10px";
  if (value.length > 20) return "8px";
  if (value.length > 30) return "6px";
  return "10px";
});

function chunkProducts(products, rows, cols) {
  const perPage = rows * cols;
  const pages = [];
  for (let i = 0; i < products.length; i += perPage) {
    pages.push(products.slice(i, i + perPage));
  }
  return pages;
}

router.post("/", async (req, res) => {
  const { title, rows, cols, format, preview } = req.body;

  try {
    const csvData = await axios.get(SHEET_CSV_URL);
    let products = parseCSV(csvData.data);
    products = products.map((product) => snakeCaseKeys(product));

    const pages = chunkProducts(products, rows, cols);

    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const templateHtml = fs.readFileSync(
      path.join(__dirname, "../templates/pamphlet5.hbs"),
      "utf-8"
    );
    const template = handlebars.compile(templateHtml);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.setViewport({
      width: 1122,
      height: 794,
      deviceScaleFactor: 2,
    });

    if (format === "png") {
      if (pages.length === 1 || preview) {
        const html = template({
          title,
          rows,
          cols,
          pages: pages,
          logo: logoBase64,
          delivery: deliveryBase64,
        });

        await page.setContent(html, { waitUntil: "networkidle0" });

        const fileName = `pamphlet_${Date.now()}.png`;
        const outputPath = path.join(outputDir, fileName);

        await page.screenshot({ path: outputPath, fullPage: true });
        await browser.close();

        if (preview) {
          res.json({ url: `/output/${fileName}` });
        } else {
          res.download(outputPath, () => fs.unlinkSync(outputPath));
        }
      } else {
        const zipName = `pamphlet_${Date.now()}.zip`;
        const zipPath = path.join(outputDir, zipName);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(output);

        archive.on("warning", (err) => {
          console.warn("Archive warning:", err);
        });
        archive.on("error", (err) => {
          console.error("Archive error:", err);
          res.status(500).send("Archive error");
        });

        for (let i = 0; i < pages.length; i++) {
          const html = template({
            title,
            rows,
            cols,
            pages: [pages[i]],
            logo: logoBase64,
            delivery: deliveryBase64,
          });

          await page.setContent(html, { waitUntil: "networkidle0" });

          const screenshotPath = path.join(outputDir, `page_${i + 1}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });

          archive.file(screenshotPath, { name: `page_${i + 1}.png` });
        }

        await new Promise((resolve, reject) => {
          output.on("close", resolve);
          output.on("finish", resolve);
          output.on("error", reject);
          archive.on("error", reject);
          archive.finalize(); // don't forget this!
        });
        await browser.close();

        if (preview) {
          res.json({ url: `/output/${zipName}` });
        } else {
          res.download(zipPath, () => fs.unlinkSync(zipPath));
        }

        for (let i = 0; i < pages.length; i++) {
          const fileToDelete = path.join(outputDir, `page_${i + 1}.png`);
          if (fs.existsSync(fileToDelete)) fs.unlinkSync(fileToDelete);
        }
      }
    } else {
      const html = template({
        title,
        rows,
        cols,
        pages,
        logo: logoBase64,
        delivery: deliveryBase64,
      });

      await page.setContent(html, { waitUntil: "networkidle0" });

      const fileName = `pamphlet_${Date.now()}.pdf`;
      const outputPath = path.join(outputDir, fileName);

      await page.pdf({
        path: outputPath,
        format: "A4",
        landscape: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
        printBackground: true,
      });

      await browser.close();

      if (preview) {
        res.json({ url: `/output/${fileName}` });
      } else {
        res.download(outputPath, () => fs.unlinkSync(outputPath));
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});

function parseCSV(data) {
  const lines = data.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((acc, h, i) => ({ ...acc, [h]: values[i] }), {});
  });
}

module.exports = router;
