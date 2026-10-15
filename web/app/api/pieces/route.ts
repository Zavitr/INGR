import { NextResponse } from "next/server";
import catalogData from "@/lib/pieces-catalog.json";

interface PieceMetadata {
  name: string;
  displayName: string;
  description: string;
  logoUrl?: string | null;
  version: string;
  category: string;
}

const ALL_PIECES: PieceMetadata[] = catalogData as PieceMetadata[];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const category = (searchParams.get("category") || "all").toLowerCase().trim();
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let pieces = ALL_PIECES;

    // Filter by search term
    if (search) {
      pieces = pieces.filter(
        (p) =>
          p.displayName.toLowerCase().includes(search) ||
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search)
      );
    }

    // Filter by category
    if (category && category !== "all") {
      pieces = pieces.filter(
        (p) => p.category.toLowerCase() === category || p.category.toLowerCase().includes(category)
      );
    }

    const total = pieces.length;
    const paginated = pieces.slice(offset, offset + Math.min(limit, 500));

    return NextResponse.json({
      total,
      offset,
      limit,
      pieces: paginated,
    });
  } catch (error) {
    console.error("Failed to list pieces:", error);
    return NextResponse.json(
      { error: "Failed to load service directory" },
      { status: 500 }
    );
  }
}
