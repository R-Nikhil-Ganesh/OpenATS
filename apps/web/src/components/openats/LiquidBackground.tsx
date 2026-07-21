export function LiquidBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ backgroundColor: "var(--bg-canvas)" }}
    >
      <div
        className="blob-1 absolute rounded-full"
        style={{
          top: "-8%",
          left: "-6%",
          width: "600px",
          height: "600px",
          background: "var(--frosted-mint)",
          opacity: "var(--blob-o-1)" as unknown as number,
          filter: "blur(120px)",
        }}
      />
      <div
        className="blob-2 absolute rounded-full"
        style={{
          top: "6%",
          right: "-8%",
          width: "500px",
          height: "500px",
          background: "var(--lime-cream)",
          opacity: "var(--blob-o-2)" as unknown as number,
          filter: "blur(120px)",
        }}
      />
      <div
        className="blob-3 absolute rounded-full"
        style={{
          bottom: "-14%",
          left: "22%",
          width: "700px",
          height: "700px",
          background: "var(--light-gold)",
          opacity: "var(--blob-o-3)" as unknown as number,
          filter: "blur(120px)",
        }}
      />
      <div
        className="blob-4 absolute rounded-full"
        style={{
          top: "38%",
          right: "-6%",
          width: "450px",
          height: "450px",
          background: "var(--sunlit-clay)",
          opacity: "var(--blob-o-4)" as unknown as number,
          filter: "blur(120px)",
        }}
      />
      <div
        className="blob-5 absolute rounded-full"
        style={{
          bottom: "-8%",
          left: "-6%",
          width: "550px",
          height: "550px",
          background: "var(--frosted-mint)",
          opacity: "var(--blob-o-5)" as unknown as number,
          filter: "blur(120px)",
        }}
      />
    </div>
  );
}