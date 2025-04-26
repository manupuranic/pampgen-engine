import { useState } from "react";
import axios from "axios";
import PamphletPreview from "./components/PamphletPreviewer";
import "./App.css";

const SIZE_OPTIONS = [
  { label: "A4", value: "A4" },
  { label: "A3", value: "A3" },
  { label: "Letter", value: "Letter" },
];
const FORMAT_OPTIONS = [
  { label: "PDF", value: "pdf" },
  { label: "PNG", value: "png" },
  { label: "ZIP", value: "zip" },
];
const GRID_OPTIONS = [
  { label: "2×5 (10 products)", value: { rows: 2, cols: 5, maxProducts: 10 } },
  { label: "4×5 (20 products)", value: { rows: 4, cols: 5, maxProducts: 20 } },
  { label: "5×5 (25 products)", value: { rows: 5, cols: 5, maxProducts: 25 } },
  {
    label: "5×5 (50 products, 2 pages)",
    value: { rows: 5, cols: 5, maxProducts: 50 },
  },
  {
    label: "7×6 (75 products, 2 pages)",
    value: { rows: 7, cols: 6, maxProducts: 75 },
  },
];

const DEFAULT_TITLE = "April Deals";
const DEFAULT_GRID = GRID_OPTIONS[0].value;
const DEFAULT_FORMAT = FORMAT_OPTIONS[0].value;

function App() {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [grid, setGrid] = useState(DEFAULT_GRID);
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleGeneratePreview = async () => {
    setLoading(true);
    setPreviewUrl("");
    setMessage("");
    try {
      const res = await axios.post("http://localhost:3001/api/pamphlet", {
        title,
        rows: grid.rows,
        cols: grid.cols,
        format,
        preview: true,
      });

      const fullUrl = `http://localhost:3001${res.data.url}`;
      setPreviewUrl(fullUrl);
    } catch (err) {
      setMessage("⚠️ Failed to generate preview.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.post(
        "http://localhost:3001/api/pamphlet",
        {
          title,
          rows: grid.rows,
          cols: grid.cols,
          format,
        },
        { responseType: "blob" }
      );

      const mimeType =
        res.headers["content-type"] || "application/octet-stream";
      const extension = mimeType.split("/")[1] || format;
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `pamphlet.${extension}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage("✅ Download complete!");
    } catch (err) {
      setMessage("❌ Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
      <h1 className="text-3xl font-bold mb-6 text-center">📢 PampGen Engine</h1>

      <div className="max-w-xl mx-auto bg-white shadow rounded p-6 space-y-4">
        {/* Title Input */}
        <div>
          <label className="block font-semibold mb-1">Pamphlet Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full"
            placeholder="Enter title"
          />
        </div>

        {/* Grid Selector */}
        <div>
          <label className="block font-semibold mb-1">Grid Layout</label>
          <select
            value={GRID_OPTIONS.findIndex((opt) => opt.value === grid)}
            onChange={(e) => setGrid(GRID_OPTIONS[e.target.value].value)}
            className="input w-full">
            {GRID_OPTIONS.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Format Selector */}
        <div>
          <label className="block font-semibold mb-1">Output Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="input w-full">
            {FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleGeneratePreview}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded w-full disabled:opacity-50"
            disabled={loading}>
            {loading ? "Generating..." : "Preview"}
          </button>
          <button
            onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full disabled:opacity-50"
            disabled={loading}>
            {loading ? "Downloading..." : "Download"}
          </button>
        </div>

        {/* Message */}
        {message && (
          <p className="text-center text-sm text-gray-600">{message}</p>
        )}
        {loading && (
          <div className="flex justify-center pt-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-800"></div>
          </div>
        )}
      </div>

      {/* 🔍 Live Preview */}
      {previewUrl && !loading && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2 text-center">
            Live Preview
          </h2>
          <PamphletPreview url={previewUrl} type={format} />
        </div>
      )}
    </div>
  );
}

export default App;
