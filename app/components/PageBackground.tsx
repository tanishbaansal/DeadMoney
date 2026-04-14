export function PageBackground() {
  return (
    <>
      <style>{`
        @keyframes nebulaDrift {
          from { transform: scale(1.1) rotate(0deg); }
          to   { transform: scale(1.1) rotate(360deg); }
        }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none fixed select-none"
        style={{
          top: "120%",
          left: "50%",
          width: "120vmax",
          height: "120vmax",
          marginLeft: "-60vmax",
          marginTop: "-60vmax",
          backgroundImage: "url('/hero-bg.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          backgroundSize: "cover",
          filter: "blur(40px) brightness(1) saturate(1.1)",
          transformOrigin: "center center",
          animation: "nebulaDrift 120s linear infinite",
          willChange: "transform",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 58%, rgba(2,3,19,0) 0%, rgba(2,3,19,0.55) 60%, rgba(2,3,19,0.92) 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[rgba(30,30,30,0.19)]" />
    </>
  );
}
