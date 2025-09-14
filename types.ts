export interface PricingData {
  id: string;
  itemName: string;
  quantity: string;
  cost: string;
  discount: string;
  effective_cost: string;
  gst: string;
  cost_with_gst: string;
  expense: string;
  final_cost: string;
  selling_price: string;
  selling_price_without_gst: string;
  selling_price_per_metre: string;
  profit: string;
}

export type PricingField = keyof PricingData;
