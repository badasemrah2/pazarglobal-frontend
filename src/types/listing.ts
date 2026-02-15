export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  image: string;
  images?: string[]; // Detay sayfası için çoklu resim
  isPremium: boolean;
  premiumBadge?: string | null;
  views: number;
  createdAt: string;
  seller: {
    name: string;
    rating: number;
    verified: boolean;
  };
}

export interface FilterState {
  categories: string[];
  priceRange: [number, number];
  location: string;
  condition: string[];
  isPremium: boolean;
  dateRange: string;
  searchText: string;
}
