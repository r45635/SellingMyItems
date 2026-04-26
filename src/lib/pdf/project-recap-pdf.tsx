/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { loadImageForPdf } from "./load-image";

export type PdfItemImage = {
  url: string;
  altText?: string | null;
};

export type PdfItem = {
  id: string;
  title: string;
  brand: string | null;
  description: string | null;
  condition: string | null;
  approximateAge: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: string;
  notes: string | null;
  status: "available" | "pending" | "reserved" | "sold" | "hidden";
  coverImageUrl: string | null;
  images: PdfItemImage[];
  reservedForLabel?: string | null;
  soldToLabel?: string | null;
};

export type PdfProject = {
  name: string;
  cityArea: string;
  description: string | null;
  sellerName: string;
  sellerEmail: string | null;
};

export type PdfPayload = {
  project: PdfProject;
  items: PdfItem[];
  generatedAt: Date;
  locale: string;
  /** Optional sub-title, e.g. "Reservation for Nathalie". */
  subtitle?: string;
};

const COLORS = {
  text: "#1a1a1a",
  muted: "#666",
  border: "#e5e5e5",
  accent: "#ea580c", // tailwind orange-600
  reserved: "#dc2626",
  sold: "#1f2937",
  available: "#059669",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontSize: 11,
    color: COLORS.text,
    fontFamily: "Helvetica",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#18181b",
    color: "white",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 8,
    letterSpacing: -0.3,
  },
  brandName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  generatedAt: {
    marginLeft: "auto",
    fontSize: 9,
    color: COLORS.muted,
  },
  coverEyebrow: {
    fontSize: 9,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 20,
  },
  coverLocation: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 18,
  },
  coverDescription: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  sellerBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sellerLabel: {
    fontSize: 9,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  sellerEmail: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 2,
  },
  itemHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  statusPill: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    color: "white",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 16,
  },
  priceMain: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: COLORS.accent,
  },
  priceOriginal: {
    fontSize: 12,
    color: COLORS.muted,
    textDecoration: "line-through",
  },
  coverImage: {
    width: "100%",
    height: 230,
    objectFit: "contain",
    marginBottom: 10,
    backgroundColor: "#f7f7f7",
    borderRadius: 4,
  },
  thumbsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  thumb: {
    width: 90,
    height: 70,
    objectFit: "cover",
    backgroundColor: "#f7f7f7",
    borderRadius: 3,
  },
  attributesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  attribute: {
    minWidth: "30%",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f7f7f7",
    borderRadius: 4,
  },
  attributeLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  attributeValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  descriptionTitle: {
    fontSize: 9,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  descriptionBody: {
    fontSize: 11,
    lineHeight: 1.55,
    marginBottom: 12,
  },
  notesBody: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.muted,
    fontStyle: "italic",
    marginBottom: 12,
  },
  buyerNote: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fff7ed",
    borderRadius: 4,
    fontSize: 10,
  },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
});

function formatPrice(value: number | null, currency: string, locale: string) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function statusColor(status: PdfItem["status"]) {
  switch (status) {
    case "reserved":
      return COLORS.reserved;
    case "sold":
      return COLORS.sold;
    case "available":
      return COLORS.available;
    default:
      return COLORS.muted;
  }
}

function statusLabel(status: PdfItem["status"], locale: string) {
  const fr = locale === "fr";
  const map: Record<PdfItem["status"], { en: string; fr: string }> = {
    available: { en: "Available", fr: "Disponible" },
    pending: { en: "Pending", fr: "En attente" },
    reserved: { en: "Reserved", fr: "Réservé" },
    sold: { en: "Sold", fr: "Vendu" },
    hidden: { en: "Hidden", fr: "Masqué" },
  };
  return fr ? map[status].fr : map[status].en;
}

function ProjectRecapDocument({
  project,
  items,
  imageData,
  generatedAtLabel,
  locale,
  subtitle,
}: {
  project: PdfProject;
  items: (PdfItem & { resolvedImages: (Buffer | string)[] })[];
  imageData: Map<string, Buffer | string>;
  generatedAtLabel: string;
  locale: string;
  subtitle?: string;
}) {
  const fr = locale === "fr";
  const totals = items.reduce(
    (acc, it) => {
      acc.total += it.price ?? 0;
      acc.byStatus[it.status] = (acc.byStatus[it.status] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      byStatus: {} as Record<PdfItem["status"], number>,
    }
  );
  const currency = items.find((i) => i.price != null)?.currency ?? "USD";
  const formattedTotal = formatPrice(totals.total, currency, locale) ?? "";

  const labels = fr
    ? {
        cover: "Récapitulatif projet",
        location: "Localisation",
        description: "Description",
        seller: "Vendeur",
        items: "Articles",
        available: "Disponibles",
        reserved: "Réservés",
        sold: "Vendus",
        totalValue: "Valeur totale",
        condition: "État",
        brand: "Marque",
        age: "Âge",
        originalPrice: "Prix initial",
        attachedNotes: "Notes",
        descriptionLabel: "Description",
        reservedFor: "Réservé pour",
        soldTo: "Vendu à",
        page: "Page",
        of: "sur",
      }
    : {
        cover: "Project recap",
        location: "Location",
        description: "Description",
        seller: "Seller",
        items: "Items",
        available: "Available",
        reserved: "Reserved",
        sold: "Sold",
        totalValue: "Total value",
        condition: "Condition",
        brand: "Brand",
        age: "Age",
        originalPrice: "Original price",
        attachedNotes: "Notes",
        descriptionLabel: "Description",
        reservedFor: "Reserved for",
        soldTo: "Sold to",
        page: "Page",
        of: "of",
      };

  return (
    <Document
      title={`${project.name} — recap`}
      author="SellingMyItems"
      subject={subtitle ?? project.name}
    >
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.brandRow}>
          <Text style={styles.brandLogo}>SMI</Text>
          <Text style={styles.brandName}>SellingMyItems</Text>
          <Text style={styles.generatedAt}>{generatedAtLabel}</Text>
        </View>

        <Text style={styles.coverEyebrow}>{labels.cover}</Text>
        <Text style={styles.coverTitle}>{project.name}</Text>
        {subtitle && <Text style={styles.coverSubtitle}>{subtitle}</Text>}
        <Text style={styles.coverLocation}>📍 {project.cityArea}</Text>

        {project.description && (
          <Text style={styles.coverDescription}>{project.description}</Text>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{labels.items}</Text>
            <Text style={styles.statValue}>{items.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{labels.reserved}</Text>
            <Text style={styles.statValue}>
              {totals.byStatus.reserved ?? 0}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{labels.sold}</Text>
            <Text style={styles.statValue}>{totals.byStatus.sold ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{labels.totalValue}</Text>
            <Text style={styles.statValue}>{formattedTotal}</Text>
          </View>
        </View>

        <View style={styles.sellerBlock}>
          <Text style={styles.sellerLabel}>{labels.seller}</Text>
          <Text style={styles.sellerName}>{project.sellerName}</Text>
          {project.sellerEmail && (
            <Text style={styles.sellerEmail}>{project.sellerEmail}</Text>
          )}
        </View>
      </Page>

      {/* Per-item pages */}
      {items.map((item, idx) => {
        const formattedPrice = formatPrice(item.price, item.currency, locale);
        const formattedOriginal = formatPrice(
          item.originalPrice,
          item.currency,
          locale
        );
        const cover = item.coverImageUrl
          ? imageData.get(item.coverImageUrl)
          : null;
        const thumbs = item.images
          .map((img) => imageData.get(img.url))
          .filter((b): b is Buffer | string => Boolean(b))
          .slice(0, 6);

        return (
          <Page key={item.id} size="A4" style={styles.page} wrap>
            <View style={styles.brandRow} fixed>
              <Text style={styles.brandLogo}>SMI</Text>
              <Text style={styles.brandName}>{project.name}</Text>
              <Text style={styles.generatedAt}>{generatedAtLabel}</Text>
            </View>

            <View style={styles.itemHeaderRow}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text
                style={[
                  styles.statusPill,
                  { backgroundColor: statusColor(item.status) },
                ]}
              >
                {statusLabel(item.status, locale)}
              </Text>
            </View>

            {(formattedPrice || formattedOriginal) && (
              <View style={styles.priceRow}>
                {formattedPrice && (
                  <Text style={styles.priceMain}>{formattedPrice}</Text>
                )}
                {formattedOriginal && formattedOriginal !== formattedPrice && (
                  <Text style={styles.priceOriginal}>{formattedOriginal}</Text>
                )}
              </View>
            )}

            {cover && (
              <Image src={cover as Buffer} style={styles.coverImage} />
            )}

            {thumbs.length > 1 && (
              <View style={styles.thumbsRow}>
                {thumbs.slice(1).map((src, i) => (
                  <Image key={i} src={src as Buffer} style={styles.thumb} />
                ))}
              </View>
            )}

            <View style={styles.attributesGrid}>
              {item.brand && (
                <View style={styles.attribute}>
                  <Text style={styles.attributeLabel}>{labels.brand}</Text>
                  <Text style={styles.attributeValue}>{item.brand}</Text>
                </View>
              )}
              {item.condition && (
                <View style={styles.attribute}>
                  <Text style={styles.attributeLabel}>{labels.condition}</Text>
                  <Text style={styles.attributeValue}>{item.condition}</Text>
                </View>
              )}
              {item.approximateAge && (
                <View style={styles.attribute}>
                  <Text style={styles.attributeLabel}>{labels.age}</Text>
                  <Text style={styles.attributeValue}>
                    {item.approximateAge}
                  </Text>
                </View>
              )}
            </View>

            {item.description && (
              <View>
                <Text style={styles.descriptionTitle}>
                  {labels.descriptionLabel}
                </Text>
                <Text style={styles.descriptionBody}>{item.description}</Text>
              </View>
            )}

            {item.notes && <Text style={styles.notesBody}>{item.notes}</Text>}

            {(item.reservedForLabel || item.soldToLabel) && (
              <Text style={styles.buyerNote}>
                {item.soldToLabel
                  ? `${labels.soldTo}: ${item.soldToLabel}`
                  : `${labels.reservedFor}: ${item.reservedForLabel}`}
              </Text>
            )}

            <View style={styles.pageFooter} fixed>
              <Text>{project.name}</Text>
              <Text
                render={({ pageNumber, totalPages }) =>
                  `${labels.page} ${pageNumber} ${labels.of} ${totalPages}`
                }
              />
              <Text>
                {idx + 1} / {items.length}
              </Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

/**
 * Render the project recap document into a PDF Buffer. Loads every required
 * image once so multiple references to the same file don't hit the disk
 * twice.
 */
export async function renderProjectRecapPdf(
  payload: PdfPayload
): Promise<Buffer> {
  // Collect every image URL we'll reference (cover + gallery for each item).
  const urls = new Set<string>();
  for (const item of payload.items) {
    if (item.coverImageUrl) urls.add(item.coverImageUrl);
    for (const img of item.images) {
      if (img.url) urls.add(img.url);
    }
  }

  const imageData = new Map<string, Buffer | string>();
  await Promise.all(
    Array.from(urls).map(async (url) => {
      const buf = await loadImageForPdf(url);
      if (buf) imageData.set(url, buf);
    })
  );

  const itemsWithImages = payload.items.map((it) => ({
    ...it,
    resolvedImages: [
      ...(it.coverImageUrl && imageData.has(it.coverImageUrl)
        ? [imageData.get(it.coverImageUrl)!]
        : []),
      ...it.images
        .map((img) => imageData.get(img.url))
        .filter((b): b is Buffer | string => Boolean(b)),
    ],
  }));

  const generatedAtLabel = new Intl.DateTimeFormat(
    payload.locale === "fr" ? "fr-FR" : "en-US",
    { dateStyle: "long", timeStyle: "short" }
  ).format(payload.generatedAt);

  const doc = (
    <ProjectRecapDocument
      project={payload.project}
      items={itemsWithImages}
      imageData={imageData}
      generatedAtLabel={generatedAtLabel}
      locale={payload.locale}
      subtitle={payload.subtitle}
    />
  );

  return renderToBuffer(doc);
}
