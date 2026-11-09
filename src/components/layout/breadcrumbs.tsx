import { Fragment, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";

export type Crumb = { title: string; href: string };

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const trail = useRef<HTMLElement>(null);
  const currentHref = crumbs.at(-1)?.href;
  useEffect(() => {
    if (currentHref && trail.current) trail.current.scrollLeft = trail.current.scrollWidth;
  }, [currentHref]);
  return (
    <nav ref={trail} aria-label="Breadcrumb" className="breadcrumbs">
      <Icon name="workspace" size={19} />
      {crumbs.map((part, index) => (
        <Fragment key={part.href}>
          {index > 0 && <Icon name="chevron" size={14} />}
          <a
            href={part.href}
            aria-current={index === crumbs.length - 1 ? "page" : undefined}
            title={part.title}
            className="max-w-[18ch] shrink-0 truncate hover:underline"
          >
            {part.title}
          </a>
        </Fragment>
      ))}
    </nav>
  );
}
