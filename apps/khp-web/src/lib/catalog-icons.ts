import sheets from "./streamline-catalog.json" with { type: "json" };

export type CatalogIconId = `core:${string}`;

export const iconCategories = {
  interface: "Interface essentials",
  devices: "Computers & devices",
  lifestyle: "Lifestyle",
  finance: "Finance",
  productivity: "Productivity",
} as const;

export type IconCategory = keyof typeof iconCategories;

export type CatalogIcon = {
  id: CatalogIconId;
  label: string;
  category: IconCategory;
  href: string;
  searchText: string;
};

export const catalogIcons: CatalogIcon[] = Object.entries(sheets).flatMap(([sheet, entries]) => {
  const category = sheet.split("-")[0] as IconCategory;
  return entries.map(([slug, keywords]) => {
    const words = slug.slice(slug.indexOf("-") + 1).replaceAll("-", " ");
    return {
      id: `core:${slug}` as const,
      label: words.charAt(0).toUpperCase() + words.slice(1),
      category,
      href: `/design/streamline/${sheet}.svg#${slug}`,
      searchText: `${slug.replaceAll("-", " ")} ${keywords} ${iconCategories[category].toLowerCase()}`,
    };
  });
});

const byId = new Map<string, CatalogIcon>(catalogIcons.map((icon) => [icon.id, icon]));

export function getCatalogIcon(id: string) {
  return byId.get(id);
}
