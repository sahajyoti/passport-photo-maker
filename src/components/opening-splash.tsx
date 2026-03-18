import Image from "next/image";

export default function OpeningSplash() {
  return (
    <div className="opening-splash" aria-hidden="true">
      <div className="opening-inner">
        <Image
          src="/logo.png"
          alt="SnapPassport logo"
          width={112}
          height={112}
          className="opening-logo"
          priority
        />
        <p className="opening-name">SnapPassport</p>
        <p className="opening-loading-text" aria-label="Loading application">
          Loading
          <span className="opening-loading-ellipsis" aria-hidden>
            ...
          </span>
        </p>
      </div>
    </div>
  );
}
