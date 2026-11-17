import { Share2 } from "lucide-react";
import Image from "next/image";

const sampleProfiles = [
  { name: "Maya", photo: "/profiles/maya.jpg" },
  { name: "Arif", photo: "/profiles/arif.jpg" },
  { name: "Nadia", photo: "/profiles/nadia.jpg" },
];

export function BoardPresence({ onShare }: { onShare: () => void }) {
  return (
    <section className="board-presence" aria-label="Active people preview">
      <div className="presence-heading">
        <h2>On this board</h2>
        <span>Preview</span>
      </div>
      <div className="presence-people">
        {sampleProfiles.map((profile) => (
          <div
            className="presence-person"
            key={profile.name}
            title={`${profile.name} · sample profile`}
          >
            <Image
              src={profile.photo}
              alt={`${profile.name}, sample profile`}
              width={34}
              height={34}
            />
            <span className="presence-dot" aria-hidden="true" />
          </div>
        ))}
        <span className="presence-caption">3 active</span>
      </div>
      <button type="button" className="share-board-button" onClick={onShare}>
        <Share2 size={14} />
        <span>Share board</span>
      </button>
    </section>
  );
}
