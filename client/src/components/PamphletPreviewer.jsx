const PamphletPreview = ({ url, type }) => {
  if (!url) return null;

  return (
    <div className="w-full border rounded shadow overflow-hidden">
      {type === "pdf" ? (
        <iframe
          title="Pamphlet Preview"
          src={url}
          className="w-full h-[600px]"></iframe>
      ) : (
        <img src={url} alt="Pamphlet Preview" className="w-full" />
      )}
    </div>
  );
};

export default PamphletPreview;
